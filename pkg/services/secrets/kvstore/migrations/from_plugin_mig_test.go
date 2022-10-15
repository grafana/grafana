package migrations

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

// This tests will create a mock sql database and an inmemory
// implementation of the secret manager to simulate the plugin.
func TestPluginSecretMigrationService_MigrateFromPlugin(t *testing.T) {
	ctx := context.Background()

	t.Run("migrate secrets from secrets plugin to Grafana", func(t *testing.T) {
		// --- SETUP
		migratorService, plugin, sqlStore := setupTestMigrateFromPluginService(t)

		addSecretToPluginStore(t, plugin, ctx, 1, "secret-1", "bogus", "value-1")
		addSecretToPluginStore(t, plugin, ctx, 1, "secret-2", "bogus", "value-2")

		// --- EXECUTION
		err := migratorService.Migrate(ctx)
		require.NoError(t, err)

		// --- VALIDATIONS
		validatePluginSecretsWereDeleted(t, plugin, ctx)

		validateSecretWasStoredInSql(t, sqlStore, ctx, 1, "secret-1", "bogus", "value-1")
		validateSecretWasStoredInSql(t, sqlStore, ctx, 1, "secret-2", "bogus", "value-2")
	})
}

// Set up services used in migration
func setupTestMigrateFromPluginService(t *testing.T) (*MigrateFromPluginService, secretsmanagerplugin.SecretsManagerPlugin, *secretskvs.SecretsKVStoreSQL) {
	t.Helper()

	// this is to init the sql secret store inside the migration
	sqlStore := sqlstore.InitTestDB(t)
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	manager := secretskvs.NewFakeSecretsPluginManager(t, false)
	migratorService := ProvideMigrateFromPluginService(
		setting.NewCfg(),
		sqlStore,
		secretsService,
		manager,
		kvstore.ProvideService(sqlStore),
	)

	secretsSql := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))

	return migratorService, manager.SecretsManager(context.Background()).SecretsManager, secretsSql
}

func addSecretToPluginStore(t *testing.T, plugin secretsmanagerplugin.SecretsManagerPlugin, ctx context.Context, orgId int64, namespace string, typ string, value string) {
	t.Helper()
	_, err := plugin.SetSecret(ctx, &secretsmanagerplugin.SetSecretRequest{
		KeyDescriptor: &secretsmanagerplugin.Key{
			OrgId:     orgId,
			Namespace: namespace,
			Type:      typ,
		},
		Value: value,
	})
	require.NoError(t, err)
}

// validates that secrets on the plugin were deleted
func validatePluginSecretsWereDeleted(t *testing.T, plugin secretsmanagerplugin.SecretsManagerPlugin, ctx context.Context) {
	t.Helper()
	res, err := plugin.GetAllSecrets(ctx, &secretsmanagerplugin.GetAllSecretsRequest{})
	require.NoError(t, err)
	require.Equal(t, 0, len(res.Items))
}

// validates that secrets are in sql
func validateSecretWasStoredInSql(t *testing.T, sqlStore *secretskvs.SecretsKVStoreSQL, ctx context.Context, orgId int64, namespace string, typ string, expectedValue string) {
	t.Helper()
	res, exists, err := sqlStore.Get(ctx, orgId, namespace, typ)
	require.NoError(t, err)
	require.True(t, exists)
	require.Equal(t, expectedValue, res)
}
