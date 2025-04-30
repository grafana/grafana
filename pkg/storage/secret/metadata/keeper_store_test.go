package metadata

import (
	"context"
	"testing"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	"github.com/stretchr/testify/require"
)

func Test_KeeperMetadataStorage_GetKeeperConfig(t *testing.T) {
	ctx := context.Background()
	testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
	database := database.ProvideDatabase(testDB)

	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)

	// Initialize the keeper storage and add a test keeper
	keeperMetadataStorage, err := ProvideKeeperMetadataStorage(database, features)
	require.NoError(t, err)
	testKeeper := &secretv0alpha1.Keeper{
		Spec: secretv0alpha1.KeeperSpec{
			Description: "description",
			AWS:         &secretv0alpha1.AWSKeeperConfig{},
		},
	}
	testKeeper.Name = "kp-test"
	testKeeper.Namespace = "default"
	_, err = keeperMetadataStorage.Create(ctx, testKeeper, "testuser")
	require.NoError(t, err)

	t.Run("get the system keeper config", func(t *testing.T) {
		keeperConfig, err := keeperMetadataStorage.GetKeeperConfig(ctx, "default", nil)
		require.NoError(t, err)
		require.Nil(t, keeperConfig)
	})

	t.Run("get test keeper config", func(t *testing.T) {
		keeperTest := "kp-test"
		keeperConfig, err := keeperMetadataStorage.GetKeeperConfig(ctx, "default", &keeperTest)
		require.NoError(t, err)
		require.NotNil(t, keeperConfig)
		require.NotEmpty(t, keeperConfig.Type())
	})
}
