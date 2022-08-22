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
	cfg            *setting.Cfg
	logger         log.Logger
	sqlStore       sqlstore.Store
	secretsService secrets.Service
	manager        plugins.SecretsPluginManager
}

func ProvideMigrateFromPluginService(
	cfg *setting.Cfg,
	sqlStore sqlstore.Store,
	secretsService secrets.Service,
	manager plugins.SecretsPluginManager,
) *MigrateFromPluginService {
	return &MigrateFromPluginService{
		cfg:            cfg,
		logger:         log.New("sec-plugin-mig"),
		sqlStore:       sqlStore,
		secretsService: secretsService,
		manager:        manager,
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
	res, err := plugin.ListSecrets(ctx, &secretsmanagerplugin.ListSecretsRequest{
		AllKeys: true,
	})
	if err != nil {
		s.logger.Error("Failed to retrieve all secrets from plugin")
		return err
	}
	s.logger.Debug("retrieved all secrets from plugin", "num secrets", len(res.Keys))
	// create a secret sql store manually
	secretsSql := &secretsKVStoreSQL{
		sqlStore:       s.sqlStore,
		secretsService: s.secretsService,
		log:            s.logger,
		decryptionCache: decryptionCache{
			cache: make(map[int64]cachedDecrypted),
		},
	}
	for _, k := range res.Keys {
		// Get each secret description from plugin and handle errors
		resp, err := plugin.GetSecret(ctx, &secretsmanagerplugin.GetSecretRequest{
			KeyDescriptor: &secretsmanagerplugin.Key{
				OrgId:     k.OrgId,
				Namespace: k.Namespace,
				Type:      k.Type,
			}})
		if err != nil {
			s.logger.Error("Error retrieving secret from plugin", "orgId", k.OrgId, "namespace", k.Namespace, "type", k.Type)
			return err
		}
		if !resp.Exists {
			s.logger.Warn("Secret not found on plugin", "orgId", k.OrgId, "namespace", k.Namespace, "type", k.Type)
			continue
		}
		// Add to sql store
		err = secretsSql.Set(ctx, k.OrgId, k.Namespace, k.Type, resp.DecryptedValue)
		if err != nil {
			s.logger.Error("Error adding secret to unified secrets", "orgId", k.OrgId, "namespace", k.Namespace, "type", k.Type)
			return err
		}
	}

	for _, k := range res.Keys {
		// Delete from the plugin
		_, err := plugin.DeleteSecret(ctx, &secretsmanagerplugin.DeleteSecretRequest{
			KeyDescriptor: &secretsmanagerplugin.Key{
				OrgId:     k.OrgId,
				Namespace: k.Namespace,
				Type:      k.Type,
			}})
		if err != nil {
			s.logger.Error("Error deleting secret from plugin after migration", "orgId", k.OrgId, "namespace", k.Namespace, "type", k.Type)
			continue
		}
	}

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
