package migrations

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
	"github.com/grafana/grafana/pkg/services/secrets"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/setting"
)

var errPluginUnavailable = errors.New("remote secret management plugin is unavailable")

// MigrateFromPluginService This migrator will handle migration of the configured plugin secrets back to Grafana unified secrets
type MigrateFromPluginService struct {
	cfg            *setting.Cfg
	sqlStore       db.DB
	secretsService secrets.Service
	manager        plugins.SecretsPluginManager
	kvstore        kvstore.KVStore
}

func ProvideMigrateFromPluginService(
	cfg *setting.Cfg,
	sqlStore db.DB,
	secretsService secrets.Service,
	manager plugins.SecretsPluginManager,
	kvstore kvstore.KVStore,

) *MigrateFromPluginService {
	return &MigrateFromPluginService{
		cfg:            cfg,
		sqlStore:       sqlStore,
		secretsService: secretsService,
		manager:        manager,
		kvstore:        kvstore,
	}
}

func (s *MigrateFromPluginService) Migrate(ctx context.Context) error {
	logger.Debug("starting migration of plugin secrets to unified secrets")
	// access the plugin directly
	plugin, err := secretskvs.StartAndReturnPlugin(s.manager, context.Background())
	if err != nil {
		return errPluginUnavailable
	}
	// Get full list of secrets from the plugin
	res, err := plugin.GetAllSecrets(ctx, &secretsmanagerplugin.GetAllSecretsRequest{})
	if err != nil {
		logger.Error("Failed to retrieve all secrets from plugin")
		return err
	}
	totalSecrets := len(res.Items)
	logger.Debug("retrieved all secrets from plugin", "num secrets", totalSecrets)
	// create a secret sql store manually
	secretsSql := secretskvs.NewSQLSecretsKVStore(s.sqlStore, s.secretsService, logger)
	for i, item := range res.Items {
		logger.Debug(fmt.Sprintf("Migrating secret %d of %d", i+1, totalSecrets), "current", i+1, "secretCount", totalSecrets)
		// Add to sql store
		err = secretsSql.Set(ctx, item.Key.OrgId, item.Key.Namespace, item.Key.Type, item.Value)
		if err != nil {
			logger.Error("Error adding secret to unified secrets", "orgId", item.Key.OrgId,
				"namespace", item.Key.Namespace, "type", item.Key.Type)
			return err
		}
	}

	for i, item := range res.Items {
		logger.Debug(fmt.Sprintf("Cleaning secret %d of %d", i+1, totalSecrets), "current", i+1, "secretCount", totalSecrets)
		// Delete from the plugin
		_, err := plugin.DeleteSecret(ctx, &secretsmanagerplugin.DeleteSecretRequest{
			KeyDescriptor: &secretsmanagerplugin.Key{
				OrgId:     item.Key.OrgId,
				Namespace: item.Key.Namespace,
				Type:      item.Key.Type,
			}})
		if err != nil {
			logger.Error("Error deleting secret from plugin after migration", "orgId", item.Key.OrgId,
				"namespace", item.Key.Namespace, "type", item.Key.Type)
			continue
		}
	}
	logger.Debug("Completed migration of secrets from plugin")

	// The plugin is no longer needed at the moment
	err = secretskvs.SetPluginStartupErrorFatal(ctx, secretskvs.GetNamespacedKVStore(s.kvstore), false)
	if err != nil {
		logger.Error("Failed to remove plugin error fatal flag", "error", err.Error())
	}
	// Reset the fatal flag setter in case another secret is created on the plugin
	secretskvs.ResetPlugin()

	logger.Debug("Shutting down secrets plugin now that migration is complete")
	// if `use_plugin` wasn't set, stop the plugin after migration
	if !s.cfg.SectionWithEnvOverrides("secrets").Key("use_plugin").MustBool(false) {
		err := s.manager.SecretsManager(ctx).Stop(ctx)
		if err != nil {
			// Log a warning but don't throw an error
			logger.Error("Error stopping secrets plugin after migration", "error", err.Error())
		}
	}
	return nil
}
