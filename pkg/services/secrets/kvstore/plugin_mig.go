package kvstore

import (
	"context"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"strconv"
)

// PluginSecretMigrationService This migrator will handle migration of datasource secrets (aka Unified secrets)
// into the plugin secrets configured
type PluginSecretMigrationService struct {
	features       featuremgmt.FeatureToggles
	secretsStore   SecretsKVStore
	cfg            *setting.Cfg
	logger         log.Logger
	sqlStore       sqlstore.Store
	secretsService secrets.Service
	remoteCheck    UseRemoteSecretsPluginCheck
}

func ProvidePluginSecretMigrationService(
	features featuremgmt.FeatureToggles,
	// TODO LND We need to check if this is actually a plugin store
	secretsStore SecretsKVStore,
	cfg *setting.Cfg,
	sqlStore sqlstore.Store,
	secretsService secrets.Service,
	remoteCheck UseRemoteSecretsPluginCheck,
) *PluginSecretMigrationService {
	return &PluginSecretMigrationService{
		features:       features,
		secretsStore:   secretsStore,
		cfg:            cfg,
		logger:         log.New("sec-plugin-mig"),
		sqlStore:       sqlStore,
		secretsService: secretsService,
		remoteCheck:    remoteCheck,
	}
}

func (s *PluginSecretMigrationService) Migrate(ctx context.Context) error {
	// TODO LND DONE 1- check if the configuration is set to true.
	// TODO LND DONE 2- Retrieve all the secrets from the secretsKVStoreSQL (we may need to add a new service there).
	// TODO LND DONE 3- Store one by one to the plugin
	// TODO LND 4- Delete all the secrets once all are migrated
	// TODO LND DONE We need to take into account HA, see gui conversation to check how to lock on that - This is done, as with Gui implementation this runs within a lock.

	// TODO LND Check the config key if need rename it
	// TODO LND check other parameters with gui, if legacy mode or other config is enabled what whould we do
	// Check if we should migrate to plugin - default false
	if s.cfg.SectionWithEnvOverrides("secrets").Key("migrate_to_plugin").MustBool(false) &&
		s.remoteCheck.ShouldUseRemoteSecretsPlugin() {
		// we need to instantiate the secretsKVStore as this is not on wire, and in this scenario,
		// the secrets store would be the plugin.
		secretsSql := &secretsKVStoreSQL{
			sqlStore:       s.sqlStore,
			secretsService: s.secretsService,
			log:            s.logger,
			decryptionCache: decryptionCache{
				cache: make(map[int64]cachedDecrypted),
			},
		}

		// TODO LND this needs to change to return all the rows
		allSec, err := secretsSql.GetAll(ctx)
		if err != nil {
			return nil
		}
		// TODO LND Remove this log
		s.logger.Debug("item count" + strconv.Itoa(len(allSec)))
		// We just set it again as the current secret store should be the plugin secret
		for _, sec := range allSec {
			err = s.secretsStore.Set(ctx, *sec.OrgId, *sec.Namespace, *sec.Type, sec.Value)
			if err != nil {
				return err
			}
		}
		// as no err was returned, when we delete all the secrets from the sql store
		// TODO LND Should we do this as we save into the plugin??
		for _, sec := range allSec {
			err = secretsSql.Del(ctx, *sec.OrgId, *sec.Namespace, *sec.Type)
			if err != nil {
				return err
			}
		}
	}
	return nil
}
