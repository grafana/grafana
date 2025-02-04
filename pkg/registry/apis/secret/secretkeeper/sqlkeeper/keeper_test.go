package sqlkeeper

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	encryptionmanager "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	keepertypes "github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/types"
	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/kmsproviders/osskmsproviders"
	"github.com/grafana/grafana/pkg/setting"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func Test_SQLKeeperSetup(t *testing.T) {
	cfg := `
	[security]
	secret_key = sdDkslslld
	encryption_provider = secretKey.v1
	available_encryption_providers = secretKey.v1
	`
	ctx := context.Background()
	namespace1 := "namespace1"
	namespace2 := "namespace2"
	plaintext1 := "very secret string in namespace 1"
	plaintext2 := "very secret string in namespace 2"
	nonExistentID := keepertypes.ExternalID("non existent")

	sqlKeeper, err := setupTestService(t, cfg)
	require.NoError(t, err)
	require.NotNil(t, sqlKeeper)

	t.Run("storing an encrypted value returns no error", func(t *testing.T) {
		externalId1, err := sqlKeeper.Store(ctx, nil, namespace1, plaintext1)
		require.NoError(t, err)
		require.NotEmpty(t, externalId1)

		externalId2, err := sqlKeeper.Store(ctx, nil, namespace2, plaintext2)
		require.NoError(t, err)
		require.NotEmpty(t, externalId2)

		t.Run("expose the encrypted value from existing namespace", func(t *testing.T) {
			exposedVal1, err := sqlKeeper.Expose(ctx, nil, namespace1, externalId1)
			require.NoError(t, err)
			require.NotNil(t, exposedVal1)
			assert.Equal(t, plaintext1, exposedVal1.DangerouslyExposeAndConsumeValue())

			exposedVal2, err := sqlKeeper.Expose(ctx, nil, namespace2, externalId2)
			require.NoError(t, err)
			require.NotNil(t, exposedVal2)
			assert.Equal(t, plaintext2, exposedVal2.DangerouslyExposeAndConsumeValue())
		})

		t.Run("expose encrypted value from different namespace returns error", func(t *testing.T) {
			exposedVal, err := sqlKeeper.Expose(ctx, nil, namespace2, externalId1)
			require.Error(t, err)
			assert.Empty(t, exposedVal)

			exposedVal, err = sqlKeeper.Expose(ctx, nil, namespace1, externalId2)
			require.Error(t, err)
			assert.Empty(t, exposedVal)
		})
	})

	t.Run("storing same value in same namespace returns no error", func(t *testing.T) {
		externalId1, err := sqlKeeper.Store(ctx, nil, namespace1, plaintext1)
		require.NoError(t, err)
		require.NotEmpty(t, externalId1)

		externalId2, err := sqlKeeper.Store(ctx, nil, namespace1, plaintext1)
		require.NoError(t, err)
		require.NotEmpty(t, externalId2)

		assert.NotEqual(t, externalId1, externalId2)
	})

	t.Run("storing same value in different namespace returns no error", func(t *testing.T) {
		externalId1, err := sqlKeeper.Store(ctx, nil, namespace1, plaintext1)
		require.NoError(t, err)
		require.NotEmpty(t, externalId1)

		externalId2, err := sqlKeeper.Store(ctx, nil, namespace2, plaintext1)
		require.NoError(t, err)
		require.NotEmpty(t, externalId2)

		assert.NotEqual(t, externalId1, externalId2)
	})

	t.Run("exposing non existing values returns error", func(t *testing.T) {
		exposedVal, err := sqlKeeper.Expose(ctx, nil, namespace1, nonExistentID)
		require.Error(t, err)
		assert.Empty(t, exposedVal)
	})

	t.Run("deleting an existing secure value does not return error", func(t *testing.T) {
		externalID, err := sqlKeeper.Store(ctx, nil, namespace1, plaintext1)
		require.NoError(t, err)
		require.NotEmpty(t, externalID)

		exposedVal, err := sqlKeeper.Expose(ctx, nil, namespace1, externalID)
		require.NoError(t, err)
		assert.NotNil(t, exposedVal)
		assert.Equal(t, plaintext1, exposedVal.DangerouslyExposeAndConsumeValue())

		err = sqlKeeper.Delete(ctx, nil, namespace1, externalID)
		require.NoError(t, err)
	})

	t.Run("deleting an non existing secure value does not return error", func(t *testing.T) {
		err = sqlKeeper.Delete(ctx, nil, namespace1, nonExistentID)
		require.NoError(t, err)
	})
}

func setupTestService(t *testing.T, config string) (*SQLKeeper, error) {
	raw, err := ini.Load([]byte(config))
	require.NoError(t, err)

	testDB := db.InitTestDB(t)
	cfg := &setting.Cfg{Raw: raw}
	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)

	// Initialize the encryption manager
	dataKeyStore, err := encryptionstorage.ProvideDataKeyStorageStorage(testDB, cfg, features)
	require.NoError(t, err)

	encProvider := encryptionprovider.Provider{}
	usageStats := &usagestats.UsageStatsMock{T: t}
	encryption, err := encryptionservice.ProvideEncryptionService(tracing.InitializeTracerForTest(), encProvider, usageStats, cfg)
	require.NoError(t, err)

	encMgr, err := encryptionmanager.NewEncryptionManager(
		tracing.InitializeTracerForTest(),
		dataKeyStore,
		osskmsproviders.ProvideService(encryption, cfg, features),
		encryption,
		cfg,
		usageStats,
	)
	require.NoError(t, err)

	// Initialize encrypted value storage with a fake db
	encValueStore, err := encryptionstorage.ProvideEncryptedValueStorage(testDB, cfg, features)
	require.NoError(t, err)

	// Initialize the SQLKeeper
	sqlKeeper, err := NewSQLKeeper(tracing.InitializeTracerForTest(), encMgr, encValueStore)

	return sqlKeeper, err
}
