package kvstore

import (
	"context"
	"errors"
	"sync"
	"testing"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

// Set fatal flag to true, then simulate a plugin start failure
// Should result in an error from the secret store provider
func TestFatalPluginErr_PluginFailsToStartWithFatalFlagSet(t *testing.T) {
	p, err := setupFatalCrashTest(t, true, true, false)
	assert.Error(t, err)
	assert.Equal(t, "mocked failed to start", err.Error())
	assert.Nil(t, p.secretsKVStore)
}

// Set fatal flag to false, then simulate a plugin start failure
// Should result in the secret store provider returning the sql impl
func TestFatalPluginErr_PluginFailsToStartWithFatalFlagNotSet(t *testing.T) {
	p, err := setupFatalCrashTest(t, true, false, false)
	assert.NoError(t, err)
	require.IsType(t, &CachedKVStore{}, p.secretsKVStore)

	cachedKv, _ := p.secretsKVStore.(*CachedKVStore)
	assert.IsType(t, &secretsKVStoreSQL{}, cachedKv.GetUnwrappedStore())
}

// With fatal flag not set, store a secret in the plugin while backwards compatibility is disabled
// Should result in the fatal flag going from unset -> set to true
func TestFatalPluginErr_FatalFlagGetsSetWithBackwardsCompatDisabled(t *testing.T) {
	p, err := setupFatalCrashTest(t, false, false, true)
	assert.NoError(t, err)
	require.NotNil(t, p.secretsKVStore)

	err = p.secretsKVStore.Set(context.Background(), 0, "datasource", "postgres", "my secret")
	assert.NoError(t, err)

	isFatal, err := isPluginStartupErrorFatal(context.Background(), GetNamespacedKVStore(p.kvstore))
	assert.NoError(t, err)
	assert.True(t, isFatal)
}

// With fatal flag set, retrieve a secret from the plugin while backwards compatibility is enabled
// Should result in the fatal flag going from set to true -> unset
func TestFatalPluginErr_FatalFlagGetsUnSetWithBackwardsCompatEnabled(t *testing.T) {
	p, err := setupFatalCrashTest(t, false, true, false)
	assert.NoError(t, err)
	require.NotNil(t, p.secretsKVStore)

	// setup - store secret and manually bypassing the remote plugin impl
	_, err = p.pluginManager.SecretsManager().SecretsManager.SetSecret(context.Background(), &secretsmanagerplugin.SetSecretRequest{
		KeyDescriptor: &secretsmanagerplugin.Key{
			OrgId:     0,
			Namespace: "postgres",
			Type:      "datasource",
		},
		Value: "bogus",
	})
	assert.NoError(t, err)

	// retrieve the secret and check values
	val, exists, err := p.secretsKVStore.Get(context.Background(), 0, "postgres", "datasource")
	assert.NoError(t, err)
	assert.NotNil(t, val)
	assert.True(t, exists)

	isFatal, err := isPluginStartupErrorFatal(context.Background(), GetNamespacedKVStore(p.kvstore))
	assert.NoError(t, err)
	assert.False(t, isFatal)
}

// With fatal flag unset, do a migration with backwards compatibility disabled. When unified secrets are deleted, return an error on the first deletion
// Should result in the fatal flag remaining unset
func TestFatalPluginErr_MigrationTestWithErrorDeletingUnifiedSecrets(t *testing.T) {
	p, err := setupFatalCrashTest(t, false, false, true)
	assert.NoError(t, err)

	migration := setupTestMigratorServiceWithDeletionError(t, p.secretsKVStore, &mockstore.SQLStoreMock{
		ExpectedError: errors.New("random error"),
	}, p.kvstore)
	err = migration.Migrate(context.Background())
	assert.Error(t, err)
	assert.Equal(t, "mocked del error", err.Error())

	isFatal, err := isPluginStartupErrorFatal(context.Background(), GetNamespacedKVStore(p.kvstore))
	assert.NoError(t, err)
	assert.False(t, isFatal)
}

func setupFatalCrashTest(
	t *testing.T,
	shouldFailOnStart bool,
	isPluginErrorFatal bool,
	isBackwardsCompatDisabled bool,
) (fatalCrashTestFields, error) {
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
	return fatalCrashTestFields{
		secretsKVStore: svc,
		pluginManager:  manager,
		kvstore:        kvstore,
		sqlStore:       sqlStore,
	}, err
}

type fatalCrashTestFields struct {
	secretsKVStore SecretsKVStore
	pluginManager  plugins.SecretsPluginManager
	kvstore        kvstore.KVStore
	sqlStore       *sqlstore.SQLStore
}

func setupTestMigratorServiceWithDeletionError(
	t *testing.T,
	secretskv SecretsKVStore,
	sqlStore sqlstore.Store,
	kvstore kvstore.KVStore,
) *MigrateToPluginService {
	t.Helper()
	fatalFlagOnce = sync.Once{}
	startupOnce = sync.Once{}
	cfg := setupTestConfig(t)
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	manager := NewFakeSecretsPluginManager(t, false)
	migratorService := ProvideMigrateToPluginService(
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
		`
	raw, err := ini.Load([]byte(rawCfg))
	require.NoError(t, err)
	return &setting.Cfg{Raw: raw}
}
