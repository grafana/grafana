package kvstore

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

// This tests will create a mock sql database and an inmemory
// implementation of the secret manager to simulate the plugin.
func TestPluginSecretMigrationService_Migrate(t *testing.T) {
	ctx := context.Background()

	t.Run("migration run ok - 2 secrets migrated", func(t *testing.T) {
		// --- SETUP
		migratorService, secretsStore, sqlSecretStore := setupTestMigratorService(t)
		var orgId int64 = 1
		namespace1, namespace2 := "namespace-test", "namespace-test2"
		typ := "type-test"
		value := "SUPER_SECRET"

		addSecretToSqlStore(t, sqlSecretStore, ctx, orgId, namespace1, typ, value)
		addSecretToSqlStore(t, sqlSecretStore, ctx, orgId, namespace2, typ, value)

		// --- EXECUTION
		err := migratorService.Migrate(ctx)
		require.NoError(t, err)

		// --- VALIDATIONS
		validateSecretWasDeleted(t, sqlSecretStore, ctx, orgId, namespace1, typ)
		validateSecretWasDeleted(t, sqlSecretStore, ctx, orgId, namespace2, typ)

		validateSecretWasStoreInPlugin(t, secretsStore, ctx, orgId, namespace1, typ)
		validateSecretWasStoreInPlugin(t, secretsStore, ctx, orgId, namespace1, typ)
	})
}

func addSecretToSqlStore(t *testing.T, sqlSecretStore *secretsKVStoreSQL, ctx context.Context, orgId int64, namespace1 string, typ string, value string) {
	err := sqlSecretStore.Set(ctx, orgId, namespace1, typ, value)
	require.NoError(t, err)
}

// validates that secrets on the sql store were deleted.
func validateSecretWasDeleted(t *testing.T, sqlSecretStore *secretsKVStoreSQL, ctx context.Context, orgId int64, namespace1 string, typ string) {
	res, err := sqlSecretStore.Keys(ctx, orgId, namespace1, typ)
	require.NoError(t, err)
	require.Equal(t, 0, len(res))
}

// validates that secrets should be on the plugin
func validateSecretWasStoreInPlugin(t *testing.T, secretsStore SecretsKVStore, ctx context.Context, orgId int64, namespace1 string, typ string) {
	resPlugin, err := secretsStore.Keys(ctx, orgId, namespace1, typ)
	require.NoError(t, err)
	require.Equal(t, 1, len(resPlugin))
}

//
func setupTestMigratorService(t *testing.T) (*PluginSecretMigrationService, SecretsKVStore, *secretsKVStoreSQL) {
	t.Helper()

	rawCfg := `
		[secrets]
		use_plugin = true
		migrate_to_plugin = true
		`
	raw, err := ini.Load([]byte(rawCfg))
	require.NoError(t, err)
	cfg := &setting.Cfg{Raw: raw}
	// this would be the plugin - mocked at the moment
	secretsStoreForPlugin := NewFakeSecretsKVStore()

	// this is to init the sql secret store inside the migration
	sqlStore := sqlstore.InitTestDB(t)
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	manager := NewFakeSecretsPluginManager(t, false)
	migratorService := ProvidePluginSecretMigrationService(
		secretsStoreForPlugin,
		cfg,
		sqlStore,
		secretsService,
		kvstore.ProvideService(sqlStore),
		manager,
	)

	secretsSql := &secretsKVStoreSQL{
		sqlStore:       sqlStore,
		secretsService: secretsService,
		log:            log.New("test.logger"),
		decryptionCache: decryptionCache{
			cache: make(map[int64]cachedDecrypted),
		},
	}

	err = secretsStoreForPlugin.SetFallback(secretsSql)
	require.NoError(t, err)
	return migratorService, secretsStoreForPlugin, secretsSql
}
