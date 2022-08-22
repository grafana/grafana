package kvstore

import (
	"context"
	"errors"
	"sync"
	"testing"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

// Set fatal flag to true, then simulate a plugin start failure
// Should result in an error from the secret store provider
func TestFatalPluginErr_PluginFailsToStartWithFatalFlagSet(t *testing.T) {
	svc, _, _, err := setupFatalCrashTest(t, true, true, false)
	require.Error(t, err)
	require.Nil(t, svc)
}

// Set fatal flag to false, then simulate a plugin start failure
// Should result in the secret store provider returning the sql impl
func TestFatalPluginErr_PluginFailsToStartWithFatalFlagNotSet(t *testing.T) {
	svc, _, _, err := setupFatalCrashTest(t, true, false, false)
	require.NoError(t, err)
	require.IsType(t, &CachedKVStore{}, svc)
	cachedKv, _ := svc.(*CachedKVStore)
	require.IsType(t, &secretsKVStoreSQL{}, cachedKv.GetUnwrappedStore())
}

// With fatal flag not set, store a secret in the plugin while backwards compatibility is disabled
// Should result in the fatal flag going from unset -> set to true
func TestFatalPluginErr_FatalFlagGetsSetWithBackwardsCompatDisabled(t *testing.T) {
	svc, kvstore, _, err := setupFatalCrashTest(t, false, false, true)
	require.NoError(t, err)
	require.NotNil(t, svc)
	err = svc.Set(context.Background(), 0, "datasource", "postgres", "my secret")
	require.NoError(t, err)
	isFatal, err := isPluginStartupErrorFatal(context.Background(), GetNamespacedKVStore(kvstore))
	require.NoError(t, err)
	require.True(t, isFatal)
}

// With fatal flag set, retrieve a secret from the plugin while backwards compatibility is enabled
// Should result in the fatal flag going from set to true -> unset
func TestFatalPluginErr_FatalFlagGetsUnSetWithBackwardsCompatEnabled(t *testing.T) {
	svc, kvstore, _, err := setupFatalCrashTest(t, false, true, false)
	require.NoError(t, err)
	require.NotNil(t, svc)
	val, exists, err := svc.Get(context.Background(), 0, "datasource", "postgres")
	require.NoError(t, err)
	require.NotNil(t, val)
	require.True(t, exists)
	isFatal, err := isPluginStartupErrorFatal(context.Background(), GetNamespacedKVStore(kvstore))
	require.NoError(t, err)
	require.False(t, isFatal)
}

// With fatal flag unset, do a migration with backwards compatibility disabled. When unified secrets are deleted, return an error on the first deletion
// Should result in the fatal flag remaining unset
func TestFatalPluginErr_MigrationTestWithErrorDeletingUnifiedSecrets(t *testing.T) {
	svc, kvstore, _, err := setupFatalCrashTest(t, false, false, true)
	require.NoError(t, err)

	migration := setupTestMigratorServiceWithDeletionError(t, svc, &mockstore.SQLStoreMock{
		ExpectedError: errors.New("random error"),
	}, kvstore)
	err = migration.Migrate(context.Background())
	require.Error(t, err)
	isFatal, err := isPluginStartupErrorFatal(context.Background(), GetNamespacedKVStore(kvstore))
	require.NoError(t, err)
	require.False(t, isFatal)
}

func setupFatalCrashTest(
	t *testing.T,
	shouldFailOnStart bool,
	isPluginErrorFatal bool,
	isBackwardsCompatDisabled bool,
) (SecretsKVStore, kvstore.KVStore, *sqlstore.SQLStore, error) {
	t.Helper()
	fatalFlagOnce = sync.Once{}
	startupOnce = sync.Once{}
	cfg := setupTestConfig(t)
	sqlStore := sqlstore.InitTestDB(t)
	secretService := fakes.FakeSecretsService{}
	kvstore := kvstore.ProvideService(sqlStore)
	if isPluginErrorFatal {
		_ = setPluginStartupErrorFatal(context.Background(), GetNamespacedKVStore(kvstore), true)
	}
	features := NewFakeFeatureToggles(t, isBackwardsCompatDisabled)
	manager := NewFakeSecretsPluginManager(t, shouldFailOnStart)
	svc, err := ProvideService(sqlStore, secretService, manager, kvstore, features, cfg)
	t.Cleanup(func() {
		fatalFlagOnce = sync.Once{}
	})
	return svc, kvstore, sqlStore, err
}

func setupTestMigratorServiceWithDeletionError(
	t *testing.T,
	secretskv SecretsKVStore,
	sqlStore sqlstore.Store,
	kvstore kvstore.KVStore,
) *PluginSecretMigrationService {
	t.Helper()
	fatalFlagOnce = sync.Once{}
	startupOnce = sync.Once{}
	cfg := setupTestConfig(t)
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	manager := NewFakeSecretsPluginManager(t, false)
	migratorService := ProvidePluginSecretMigrationService(
		secretskv,
		cfg,
		sqlStore,
		secretsService,
		kvstore,
		manager,
	)
	fallback := NewFakeSecretsKVStore()
	var orgId int64 = 1
	str := "random string"
	fallback.store[Key{
		OrgId:     orgId,
		Type:      str,
		Namespace: str,
	}] = "bogus"
	fallback.delError = true
	err := secretskv.SetFallback(fallback)
	require.NoError(t, err)
	return migratorService
}

func setupTestConfig(t *testing.T) *setting.Cfg {
	t.Helper()
	rawCfg := `
		[secrets]
		use_plugin = true
		migrate_to_plugin = true
		`
	raw, err := ini.Load([]byte(rawCfg))
	require.NoError(t, err)
	return &setting.Cfg{Raw: raw}
}
