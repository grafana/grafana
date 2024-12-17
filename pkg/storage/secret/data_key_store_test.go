package secret

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestEncryptionStoreImpl_DataKeyLifecycle(t *testing.T) {
	// Initialize data key storage with a fake db
	testDB := db.InitTestDB(t)
	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)
	cfg := &setting.Cfg{}
	store, err := ProvideDataKeyStorageStorage(testDB, cfg, features)
	require.NoError(t, err)

	ctx := context.Background()

	// Define a data key whose lifecycle we will test
	dataKey := &EncryptionDataKey{
		UID:           "test-uid",
		Namespace:     "test-namespace",
		Label:         "test-label",
		Active:        true,
		EncryptedData: []byte("test-data"),
	}

	// Define a second data key in a different namespace that should remain undisturbed
	unchangingDataKey := &EncryptionDataKey{
		UID:           "static-uid",
		Namespace:     "static-namespace",
		Label:         "static-label",
		Active:        true,
		EncryptedData: []byte("static-data"),
	}

	// Test CreateDataKey
	err = store.CreateDataKey(ctx, dataKey)
	require.NoError(t, err)
	err = store.CreateDataKey(ctx, unchangingDataKey)
	require.NoError(t, err)

	// Test GetDataKey
	retrievedKey, err := store.GetDataKey(ctx, "test-uid", "test-namespace")
	require.NoError(t, err)
	require.Equal(t, dataKey.UID, retrievedKey.UID)
	require.Equal(t, dataKey.Namespace, retrievedKey.Namespace)

	// Test GetCurrentDataKey
	currentKey, err := store.GetCurrentDataKey(ctx, "test-label", "test-namespace")
	require.NoError(t, err)
	require.Equal(t, dataKey.UID, currentKey.UID)
	require.Equal(t, dataKey.Namespace, currentKey.Namespace)

	// Test GetAllDataKeys
	allKeys, err := store.GetAllDataKeys(ctx, "test-namespace")
	require.NoError(t, err)
	require.Len(t, allKeys, 1)
	require.Equal(t, dataKey.UID, allKeys[0].UID)

	// Test DisableDataKeys
	err = store.DisableDataKeys(ctx, "test-namespace")
	require.NoError(t, err)

	// Verify that the data key is disabled
	disabledKey, err := store.GetDataKey(ctx, "test-uid", "test-namespace")
	require.NoError(t, err)
	require.False(t, disabledKey.Active)

	// Test DeleteDataKey
	err = store.DeleteDataKey(ctx, "test-uid", "test-namespace")
	require.NoError(t, err)

	// Verify that the data key is deleted
	_, err = store.GetDataKey(ctx, "test-uid", "test-namespace")
	require.Error(t, err)
	require.Equal(t, ErrDataKeyNotFound, err)

	// Verify that the unchanging data key still exists and is active
	staticKey, err := store.GetDataKey(ctx, "static-uid", "static-namespace")
	require.NoError(t, err)
	require.Equal(t, unchangingDataKey.UID, staticKey.UID)
	require.Equal(t, unchangingDataKey.Namespace, staticKey.Namespace)
	require.True(t, staticKey.Active)
}
