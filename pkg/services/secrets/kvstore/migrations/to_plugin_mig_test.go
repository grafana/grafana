package migrations

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

// This tests will create a mock sql database and an inmemory
// implementation of the secret manager to simulate the plugin.
func TestPluginSecretMigrationService_MigrateToPlugin(t *testing.T) {
	ctx := context.Background()

	t.Run("migration run ok - 2 secrets migrated", func(t *testing.T) {
		// --- SETUP
		migratorService, secretsStore, sqlSecretStore := setupTestMigrateToPluginService(t)
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
		validateSqlSecretWasDeleted(t, sqlSecretStore, ctx, orgId, namespace1, typ)
		validateSqlSecretWasDeleted(t, sqlSecretStore, ctx, orgId, namespace2, typ)

		validateSecretWasStoredInPlugin(t, secretsStore, ctx, orgId, namespace1, typ)
		validateSecretWasStoredInPlugin(t, secretsStore, ctx, orgId, namespace1, typ)
	})
}

// With fatal flag unset, do a migration with backwards compatibility disabled. When unified secrets are deleted, return an error on the first deletion
// Should result in the fatal flag remaining unset
func TestFatalPluginErr_MigrationTestWithErrorDeletingUnifiedSecrets(t *testing.T) {
	p, err := secretskvs.SetupFatalCrashTest(t, false, false, true)
	assert.NoError(t, err)

	migration := setupTestMigratorServiceWithDeletionError(t, p.SecretsKVStore, &mockstore.SQLStoreMock{
		ExpectedError: errors.New("random error"),
	}, p.KVStore)
	err = migration.Migrate(context.Background())
	assert.Error(t, err)
	assert.Equal(t, "mocked del error", err.Error())

	isFatal, err := secretskvs.IsPluginStartupErrorFatal(context.Background(), secretskvs.GetNamespacedKVStore(p.KVStore))
	assert.NoError(t, err)
	assert.False(t, isFatal)
}

func addSecretToSqlStore(t *testing.T, sqlSecretStore secretskvs.SecretsKVStore, ctx context.Context, orgId int64, namespace1 string, typ string, value string) {
	t.Helper()
	err := sqlSecretStore.Set(ctx, orgId, namespace1, typ, value)
	require.NoError(t, err)
}

// validates that secrets on the sql store were deleted.
func validateSqlSecretWasDeleted(t *testing.T, sqlSecretStore secretskvs.SecretsKVStore, ctx context.Context, orgId int64, namespace1 string, typ string) {
	t.Helper()
	res, err := sqlSecretStore.Keys(ctx, orgId, namespace1, typ)
	require.NoError(t, err)
	require.Equal(t, 0, len(res))
}

// validates that secrets should be on the plugin
func validateSecretWasStoredInPlugin(t *testing.T, secretsStore secretskvs.SecretsKVStore, ctx context.Context, orgId int64, namespace1 string, typ string) {
	t.Helper()
	resPlugin, err := secretsStore.Keys(ctx, orgId, namespace1, typ)
	require.NoError(t, err)
	require.Equal(t, 1, len(resPlugin))
}

// Set up services used in migration
func setupTestMigrateToPluginService(t *testing.T) (*MigrateToPluginService, secretskvs.SecretsKVStore, secretskvs.SecretsKVStore) {
	t.Helper()

	rawCfg := `
		[secrets]
		use_plugin = true
		`
	raw, err := ini.Load([]byte(rawCfg))
	require.NoError(t, err)
	cfg := &setting.Cfg{Raw: raw}
	// this would be the plugin - mocked at the moment
	fallbackStore := secretskvs.WithCache(secretskvs.NewFakeSQLSecretsKVStore(t), time.Minute*5, time.Minute*5)
	secretsStoreForPlugin := secretskvs.WithCache(secretskvs.NewFakePluginSecretsKVStore(t, featuremgmt.WithFeatures(), fallbackStore), time.Minute*5, time.Minute*5)

	// this is to init the sql secret store inside the migration
	sqlStore := sqlstore.InitTestDB(t)
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	manager := secretskvs.NewFakeSecretsPluginManager(t, false)
	migratorService := ProvideMigrateToPluginService(
		secretsStoreForPlugin,
		cfg,
		sqlStore,
		secretsService,
		kvstore.ProvideService(sqlStore),
		manager,
	)

	return migratorService, secretsStoreForPlugin, fallbackStore
}

func setupTestMigratorServiceWithDeletionError(
	t *testing.T,
	secretskv secretskvs.SecretsKVStore,
	sqlStore sqlstore.Store,
	kvstore kvstore.KVStore,
) *MigrateToPluginService {
	t.Helper()
	t.Cleanup(secretskvs.ResetPlugin)
	cfg := secretskvs.SetupTestConfig(t)
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	manager := secretskvs.NewFakeSecretsPluginManager(t, false)
	migratorService := ProvideMigrateToPluginService(
		secretskv,
		cfg,
		sqlStore,
		secretsService,
		kvstore,
		manager,
	)
	fallback := secretskvs.NewFakeSecretsKVStore()
	var orgId int64 = 1
	str := "random string"
	err := fallback.Set(context.Background(), orgId, str, str, "bogus")
	require.NoError(t, err)
	fallback.DeletionError(true)
	err = secretskvs.ReplaceFallback(t, secretskv, fallback)
	require.NoError(t, err)
	return migratorService
}
