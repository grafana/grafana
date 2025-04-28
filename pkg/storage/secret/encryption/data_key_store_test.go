package encryption

import (
	"context"
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

const (
	passThroughProvider encryption.ProviderID = "PASS_THROUGH_PROVIDER"
	base64Provider      encryption.ProviderID = "BASE64_PROVIDER"
)

func TestEncryptionStoreImpl_DataKeyLifecycle(t *testing.T) {
	// Initialize data key storage with a fake db
	testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)
	store, err := ProvideDataKeyStorage(testDB, features)
	require.NoError(t, err)

	ctx := context.Background()

	// Define a data key whose lifecycle we will test
	dataKey := &SecretDataKey{
		UID:           "test-uid",
		Namespace:     "test-namespace",
		Label:         "test-label",
		Active:        true,
		EncryptedData: []byte("test-data"),
		Provider:      passThroughProvider, // so that the Decrypt() method just gets us the input test data
	}

	// Define a second data key in a different namespace that should remain undisturbed
	unchangingDataKey := &SecretDataKey{
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
	retrievedKey, err := store.GetDataKey(ctx, "test-namespace", "test-uid")
	require.NoError(t, err)
	require.Equal(t, dataKey.UID, retrievedKey.UID)
	require.Equal(t, dataKey.Namespace, retrievedKey.Namespace)

	// Test GetCurrentDataKey
	currentKey, err := store.GetCurrentDataKey(ctx, "test-namespace", "test-label")
	require.NoError(t, err)
	require.Equal(t, dataKey.UID, currentKey.UID)
	require.Equal(t, dataKey.Namespace, currentKey.Namespace)

	// Test GetAllDataKeys
	allKeys, err := store.GetAllDataKeys(ctx, "test-namespace")
	require.NoError(t, err)
	require.Len(t, allKeys, 1)
	require.Equal(t, dataKey.UID, allKeys[0].UID)

	// TODO: Unskip when re-encryption is fully working
	// Initialize some test providers
	// providers := map[encryption.ProviderID]encryption.Provider{
	// 	base64Provider:      &Base64EncryptionProvider{},
	// 	passThroughProvider: &PassThroughEncryptionProvider{},
	// }

	// // Test ReEncryptDataKeys
	// err = store.ReEncryptDataKeys(ctx, "test-namespace", providers, base64Provider)
	// require.NoError(t, err)
	// // Then check that the value is what we expect it to be
	// currentKey, err = store.GetCurrentDataKey(ctx, "test-namespace", "test-label")
	// require.NoError(t, err)
	// dest := make([]byte, 0)
	// _, err = base64.RawStdEncoding.Decode(dest, currentKey.EncryptedData)
	// require.NoError(t, err)
	// require.Equal(t, dataKey.EncryptedData, dest)

	// Test DisableDataKeys
	err = store.DisableDataKeys(ctx, "test-namespace")
	require.NoError(t, err)

	// Verify that the data key is disabled
	disabledKey, err := store.GetDataKey(ctx, "test-namespace", "test-uid")
	require.NoError(t, err)
	require.False(t, disabledKey.Active)

	// Test DeleteDataKey
	err = store.DeleteDataKey(ctx, "test-namespace", "test-uid")
	require.NoError(t, err)

	// Verify that the data key is deleted
	_, err = store.GetDataKey(ctx, "test-namespace", "test-uid")
	require.Error(t, err)
	require.Equal(t, ErrDataKeyNotFound, err)

	// Verify that the unchanging data key still exists and is active
	staticKey, err := store.GetDataKey(ctx, "static-namespace", "static-uid")
	require.NoError(t, err)
	require.Equal(t, unchangingDataKey.UID, staticKey.UID)
	require.Equal(t, unchangingDataKey.Namespace, staticKey.Namespace)
	require.True(t, staticKey.Active)
}

type PassThroughEncryptionProvider struct{}

func (d *PassThroughEncryptionProvider) Encrypt(ctx context.Context, blob []byte) ([]byte, error) {
	return blob, nil
}

func (d *PassThroughEncryptionProvider) Decrypt(ctx context.Context, blob []byte) ([]byte, error) {
	return blob, nil
}

type Base64EncryptionProvider struct{}

func (d *Base64EncryptionProvider) Encrypt(ctx context.Context, blob []byte) ([]byte, error) {
	r := base64.RawStdEncoding.EncodeToString(blob)
	return []byte(r), nil
}

func (d *Base64EncryptionProvider) Decrypt(ctx context.Context, blob []byte) ([]byte, error) {
	r, err := base64.RawStdEncoding.DecodeString(string(blob))
	return r, err
}
