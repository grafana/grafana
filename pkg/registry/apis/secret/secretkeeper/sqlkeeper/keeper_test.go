package sqlkeeper

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	encryptionmanager "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	encryptionstorage "github.com/grafana/grafana/pkg/storage/secret/encryption"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func Test_SQLKeeperSetup(t *testing.T) {
	ctx := context.Background()
	namespace1 := "namespace1"
	namespace2 := "namespace2"
	plaintext1 := "very secret string in namespace 1"
	plaintext2 := "very secret string in namespace 2"
	nonExistentID := contracts.ExternalID("non existent")

	cfg := &setting.Cfg{
		SecretsManagement: setting.SecretsManagerSettings{
			SecretKey:          "sdDkslslld",
			EncryptionProvider: "secretKey.v1",
			Encryption: setting.EncryptionSettings{
				DataKeysCacheTTL:        5 * time.Minute,
				DataKeysCleanupInterval: 1 * time.Nanosecond,
				Algorithm:               cipher.AesGcm,
			},
		},
	}

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

	t.Run("deleting an existing encrypted value does not return error", func(t *testing.T) {
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

	t.Run("deleting an non existing encrypted value does not return error", func(t *testing.T) {
		err = sqlKeeper.Delete(ctx, nil, namespace1, nonExistentID)
		require.NoError(t, err)
	})

	t.Run("updating an existent encrypted value returns no error", func(t *testing.T) {
		externalId1, err := sqlKeeper.Store(ctx, nil, namespace1, plaintext1)
		require.NoError(t, err)
		require.NotEmpty(t, externalId1)

		err = sqlKeeper.Update(ctx, nil, namespace1, externalId1, plaintext2)
		require.NoError(t, err)

		exposedVal, err := sqlKeeper.Expose(ctx, nil, namespace1, externalId1)
		require.NoError(t, err)
		assert.NotNil(t, exposedVal)
		assert.Equal(t, plaintext2, exposedVal.DangerouslyExposeAndConsumeValue())
	})

	t.Run("updating a non existent encrypted value returns error", func(t *testing.T) {
		externalId1, err := sqlKeeper.Store(ctx, nil, namespace1, plaintext1)
		require.NoError(t, err)
		require.NotEmpty(t, externalId1)

		err = sqlKeeper.Update(ctx, nil, namespace1, nonExistentID, plaintext2)
		require.Error(t, err)
	})
}

func setupTestService(t *testing.T, cfg *setting.Cfg) (*SQLKeeper, error) {
	testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
	database := database.ProvideDatabase(testDB)

	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)

	// Initialize the encryption manager
	dataKeyStore, err := encryptionstorage.ProvideDataKeyStorage(testDB, features)
	require.NoError(t, err)

	usageStats := &usagestats.UsageStatsMock{T: t}

	encMgr, err := encryptionmanager.ProvideEncryptionManager(
		tracing.InitializeTracerForTest(),
		dataKeyStore,
		cfg,
		usageStats,
		nil,
	)
	require.NoError(t, err)

	// Initialize encrypted value storage with a fake db
	encValueStore, err := encryptionstorage.ProvideEncryptedValueStorage(database, features)
	require.NoError(t, err)

	// Initialize the SQLKeeper
	sqlKeeper := NewSQLKeeper(tracing.InitializeTracerForTest(), encMgr, encValueStore)

	return sqlKeeper, nil
}
