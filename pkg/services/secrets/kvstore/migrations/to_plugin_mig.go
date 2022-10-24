package migrations

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/secrets"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/setting"
)

var errSecretStoreIsNotPlugin = errors.New("SecretsKVStore is not a SecretsKVStorePlugin")

// MigrateToPluginService This migrator will handle migration of datasource secrets (aka Unified secrets)
// into the plugin secrets configured
type MigrateToPluginService struct {
	secretsStore   secretskvs.SecretsKVStore
	cfg            *setting.Cfg
	sqlStore       db.DB
	secretsService secrets.Service
	kvstore        kvstore.KVStore
	manager        plugins.SecretsPluginManager
}

func ProvideMigrateToPluginService(
	secretsStore secretskvs.SecretsKVStore,
	cfg *setting.Cfg,
	sqlStore db.DB,
	secretsService secrets.Service,
	kvstore kvstore.KVStore,
	manager plugins.SecretsPluginManager,
) *MigrateToPluginService {
	return &MigrateToPluginService{
		secretsStore:   secretsStore,
		cfg:            cfg,
		sqlStore:       sqlStore,
		secretsService: secretsService,
		kvstore:        kvstore,
		manager:        manager,
	}
}

func (s *MigrateToPluginService) Migrate(ctx context.Context) error {
	err := secretskvs.EvaluateRemoteSecretsPlugin(ctx, s.manager, s.cfg)
	hasStarted := secretskvs.HasPluginStarted(ctx, s.manager)
	if err == nil && hasStarted {
		logger.Debug("starting migration of unified secrets to the plugin")
		// we need to get the fallback store since in this scenario the secrets store would be the plugin.
		tmpStore, err := secretskvs.GetUnwrappedStoreFromCache(s.secretsStore)
		if err != nil {
			tmpStore = s.secretsStore
			logger.Warn("secret store is not cached, this is unexpected - continuing migration anyway.")
		}
		pluginStore, ok := tmpStore.(*secretskvs.SecretsKVStorePlugin)
		if !ok {
			return errSecretStoreIsNotPlugin
		}
		fallbackStore := pluginStore.Fallback()

		// before we start migrating, check see if plugin startup failures were already fatal
		namespacedKVStore := secretskvs.GetNamespacedKVStore(s.kvstore)
		wasFatal, err := secretskvs.IsPluginStartupErrorFatal(ctx, namespacedKVStore)
		if err != nil {
			logger.Warn("unable to determine whether plugin startup failures are fatal - continuing migration anyway.")
		}

		var allSec []secretskvs.Item
		var totalSec int
		// during migration we need to have fallback enabled while we move secrets to plugin
		err = pluginStore.WithFallbackEnabled(func() error {
			// get all secrets in the fallback store
			allSec, err = fallbackStore.GetAll(ctx)
			if err != nil {
				return nil
			}
			totalSec := len(allSec)
			logger.Debug(fmt.Sprintf("Total amount of secrets to migrate: %d", totalSec))

			// We just set it again as the current secret store should be the plugin secret
			for i, sec := range allSec {
				logger.Debug(fmt.Sprintf("Migrating secret %d of %d", i+1, totalSec), "current", i+1, "secretCount", totalSec)
				err = pluginStore.Set(ctx, *sec.OrgId, *sec.Namespace, *sec.Type, sec.Value)
				if err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			return err
		}

		// as no err was returned, when we delete all the secrets from the sql store
		logger.Debug("migrated unified secrets to plugin", "number of secrets", totalSec)
		for index, sec := range allSec {
			logger.Debug(fmt.Sprintf("Cleaning secret %d of %d", index+1, totalSec), "current", index+1, "secretCount", totalSec)

			err = fallbackStore.Del(ctx, *sec.OrgId, *sec.Namespace, *sec.Type)
			if err != nil {
				logger.Error("plugin migrator encountered error while deleting unified secrets")
				if index == 0 && !wasFatal {
					// old unified secrets still exists, so plugin startup errors are still not fatal, unless they were before we started
					err := secretskvs.SetPluginStartupErrorFatal(ctx, namespacedKVStore, false)
					if err != nil {
						logger.Error("error reverting plugin failure fatal status", "error", err.Error())
					} else {
						logger.Debug("application will continue to function without the secrets plugin")
					}
				}
				return err
			}
		}
		logger.Debug("deleted unified secrets after migration", "number of secrets", totalSec)
	}
	return nil
}
