package kvstore

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

// MigrateFromPluginService This migrator will handle migration of the configured plugin secrets back to Grafana unified secrets
type MigrateFromPluginService struct {
	secretsStore   SecretsKVStore
	cfg            *setting.Cfg
	logger         log.Logger
	sqlStore       sqlstore.Store
	secretsService secrets.Service
	manager        plugins.SecretsPluginManager
}

func ProvideMigrateFromPluginService(
	secretsStore SecretsKVStore,
	cfg *setting.Cfg,
	sqlStore sqlstore.Store,
	secretsService secrets.Service,
	manager plugins.SecretsPluginManager,
) *MigrateFromPluginService {
	return &MigrateFromPluginService{
		secretsStore:   secretsStore,
		cfg:            cfg,
		logger:         log.New("sec-plugin-mig"),
		sqlStore:       sqlStore,
		secretsService: secretsService,
		manager:        manager,
	}
}

func (s *MigrateFromPluginService) Migrate(ctx context.Context) error {
	if !s.cfg.SectionWithEnvOverrides("secrets").Key("migrate_from_plugin").MustBool(false) {
		return nil
	}

	s.logger.Debug("starting migration of plugin secrets to unified secrets")
	// we need to instantiate the secretsKVStore as this is not on wire, and in this scenario,
	// the secrets store would be the plugin.

	plugin, err := startAndReturnPlugin(s.manager, context.Background())
	if err != nil {
		s.logger.Error("Error retrieiving plugin", "error", err.Error())
		return err
	}
	// Get full list of secrets from the plugin
	res, err := plugin.ListSecrets(ctx, &secretsmanagerplugin.ListSecretsRequest{
		AllKeys: true,
	})
	if err != nil {
		s.logger.Error("Failed to retrieve all secrets from plugin")
		return err
	}
	keys := res.Keys
	s.logger.Debug("retrieved all secrets from plugin", "num secrets", len(keys))
	secretsSql := &secretsKVStoreSQL{
		sqlStore:       s.sqlStore,
		secretsService: s.secretsService,
		log:            s.logger,
		decryptionCache: decryptionCache{
			cache: make(map[int64]cachedDecrypted),
		},
	}
	for _, k := range keys {
		// Get each secret description from plugin and handle errors
		v, exists, err := s.secretsStore.Get(ctx, k.OrgId, k.Namespace, k.Type)
		if err != nil {
			s.logger.Error("Error retrieving secret from plugin", "orgId", k.OrgId, "namespace", k.Namespace, "type", k.Type)
			continue
		}
		if !exists {
			s.logger.Warn("Secret not found on plugin", "orgId", k.OrgId, "namespace", k.Namespace, "type", k.Type)
			continue
		}
		// Add to sql store
		secretsSql.Set(ctx, k.OrgId, k.Namespace, k.Type, v)

	}

	return nil
}
