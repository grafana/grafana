package kvstore

import (
	"context"
	"sync"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

// MigrateFromPluginService This migrator will handle migration of the configured plugin secrets back to Grafana unified secrets
type MigrateFromPluginService struct {
	cfg            *setting.Cfg
	logger         log.Logger
	sqlStore       sqlstore.Store
	secretsService secrets.Service
	manager        plugins.SecretsPluginManager
	kvstore        kvstore.KVStore
}

func ProvideMigrateFromPluginService(
	cfg *setting.Cfg,
	sqlStore sqlstore.Store,
	secretsService secrets.Service,
	manager plugins.SecretsPluginManager,
	kvstore kvstore.KVStore,

) *MigrateFromPluginService {
	return &MigrateFromPluginService{
		cfg:            cfg,
		logger:         log.New("sec-plugin-mig"),
		sqlStore:       sqlStore,
		secretsService: secretsService,
		manager:        manager,
		kvstore:        kvstore,
	}
}

func (s *MigrateFromPluginService) Migrate(ctx context.Context) error {
	s.logger.Debug("starting migration of plugin secrets to unified secrets")
	// access the plugin directly
	plugin, err := startAndReturnPlugin(s.manager, context.Background())
	if err != nil {
		s.logger.Error("Error retrieiving plugin", "error", err.Error())
		return err
	}
	// Get full list of secrets from the plugin
	res, err := plugin.GetAllSecrets(ctx, &secretsmanagerplugin.GetAllSecretsRequest{})
	if err != nil {
		s.logger.Error("Failed to retrieve all secrets from plugin")
		return err
	}
	s.logger.Debug("retrieved all secrets from plugin", "num secrets", len(res.Items))
	// create a secret sql store manually
	secretsSql := &secretsKVStoreSQL{
		sqlStore:       s.sqlStore,
		secretsService: s.secretsService,
		log:            s.logger,
		decryptionCache: decryptionCache{
			cache: make(map[int64]cachedDecrypted),
		},
	}
	for _, item := range res.Items {
		// Add to sql store
		err = secretsSql.Set(ctx, item.Key.OrgId, item.Key.Namespace, item.Key.Type, item.Value)
		if err != nil {
			s.logger.Error("Error adding secret to unified secrets", "orgId", item.Key.OrgId,
				"namespace", item.Key.Namespace, "type", item.Key.Type)
			return err
		}
	}

	for _, item := range res.Items {
		// Delete from the plugin
		_, err := plugin.DeleteSecret(ctx, &secretsmanagerplugin.DeleteSecretRequest{
			KeyDescriptor: &secretsmanagerplugin.Key{
				OrgId:     item.Key.OrgId,
				Namespace: item.Key.Namespace,
				Type:      item.Key.Type,
			}})
		if err != nil {
			s.logger.Error("Error deleting secret from plugin after migration", "orgId", item.Key.OrgId,
				"namespace", item.Key.Namespace, "type", item.Key.Type)
			continue
		}
	}

	// The plugin is no longer needed at the moment
	err = setPluginStartupErrorFatal(ctx, GetNamespacedKVStore(s.kvstore), false)
	if err != nil {
		s.logger.Error("Failed to remove plugin error fatal flag", "error", err.Error())
	}
	// Create a new fatal flag setter in case another secret is created
	fatalFlagOnce = sync.Once{}

	// if `use_plugin` wasn't set, stop the plugin after migration
	if !s.cfg.SectionWithEnvOverrides("secrets").Key("use_plugin").MustBool(false) {
		err := s.manager.SecretsManager().Stop(ctx)
		if err != nil {
			// Log a warning but don't throw an error
			s.logger.Error("Error stopping secrets plugin after migration", "error", err.Error())
		}
	}
	return nil
}
