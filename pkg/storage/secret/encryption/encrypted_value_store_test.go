package encryption

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestEncryptedValueStoreImpl(t *testing.T) {
	// Initialize data key storage with a fake db
	testDB := db.InitTestDB(t)
	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)
	cfg := &setting.Cfg{}
	ctx := context.Background()

	store, err := ProvideEncryptedValueStorage(testDB, cfg, features)
	require.NoError(t, err)

	t.Run("creating an encrypted value returns it", func(t *testing.T) {
		createdEV, err := store.Create(ctx, []byte("test-data"))
		require.NoError(t, err)
		require.NotEmpty(t, createdEV.UID)
		require.NotEmpty(t, createdEV.Created)
		require.NotEmpty(t, createdEV.Updated)
		require.NotEmpty(t, createdEV.EncryptedData)
	})

	t.Run("get an existent encrypted value returns it", func(t *testing.T) {
		createdEV, err := store.Create(ctx, []byte("test-data"))
		require.NoError(t, err)

		obtainedEV, err := store.Get(ctx, createdEV.UID)
		require.NoError(t, err)

		require.Equal(t, createdEV.UID, obtainedEV.UID)
		require.Equal(t, createdEV.Created, obtainedEV.Created)
		require.Equal(t, createdEV.Updated, obtainedEV.Updated)
		require.Equal(t, createdEV.EncryptedData, obtainedEV.EncryptedData)
	})

	t.Run("get a non existent encrypted value returns error", func(t *testing.T) {
		obtainedEV, err := store.Get(ctx, "test-uid")
		require.Error(t, err)
		require.Nil(t, obtainedEV)
	})

	t.Run("updating an existing encrypted value returns no error", func(t *testing.T) {
		createdEV, err := store.Create(ctx, []byte("test-data"))
		require.NoError(t, err)

		err = store.Update(ctx, createdEV.UID, []byte("test-data-updated"))
		require.NoError(t, err)

		updatedEV, err := store.Get(ctx, createdEV.UID)
		require.NoError(t, err)

		require.Equal(t, []byte("test-data-updated"), updatedEV.EncryptedData)
		require.Equal(t, createdEV.Created, updatedEV.Created)
	})

	t.Run("updating a non existing encrypted value returns error", func(t *testing.T) {
		err := store.Update(ctx, "test-uid", []byte("test-data"))
		require.Error(t, err)
	})

	t.Run("delete an existing encrypted value returns error", func(t *testing.T) {
		createdEV, err := store.Create(ctx, []byte("ttttest-data"))
		require.NoError(t, err)

		obtainedEV, err := store.Get(ctx, createdEV.UID)
		require.NoError(t, err)

		err = store.Delete(ctx, obtainedEV.UID)
		require.NoError(t, err)

		obtainedEV, err = store.Get(ctx, createdEV.UID)
		require.Error(t, err)
		require.Nil(t, obtainedEV)
	})

	t.Run("delete a non existing encrypted value does not return error", func(t *testing.T) {
		err := store.Delete(ctx, "test-uid")
		require.NoError(t, err)
	})
}
