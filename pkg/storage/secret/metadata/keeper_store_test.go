package metadata

import (
	"context"
	"testing"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	"github.com/stretchr/testify/require"
)

func Test_KeeperMetadataStorage_GetKeeperConfig(t *testing.T) {
	ctx := types.WithAuthInfo(context.Background(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Subject: "testuser",
		},
	}))

	testDB := db.InitTestDB(t)
	database := database.ProvideDatabase(testDB)

	require.NoError(t, migrator.MigrateSecretSQL(testDB.GetEngine(), nil))

	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)
	accessControl := &actest.FakeAccessControl{ExpectedEvaluate: true}
	accessClient := accesscontrol.NewLegacyAccessClient(accessControl)

	// Initialize the keeper storage and add a test keeper
	keeperMetadataStorage, err := ProvideKeeperMetadataStorage(database, features, accessClient)
	require.NoError(t, err)
	testKeeper := &secretv0alpha1.Keeper{
		Spec: secretv0alpha1.KeeperSpec{
			Description: "description",
			SQL:         &secretv0alpha1.SQLKeeperConfig{Encryption: &secretv0alpha1.Encryption{}},
		},
	}
	testKeeper.Name = "kp-test"
	testKeeper.Namespace = "default"
	_, err = keeperMetadataStorage.Create(ctx, testKeeper)
	require.NoError(t, err)

	t.Run("get default sql keeper config", func(t *testing.T) {
		keeperType, keeperConfig, err := keeperMetadataStorage.GetKeeperConfig(ctx, "default", nil)
		require.NoError(t, err)
		require.Equal(t, contracts.SQLKeeperType, keeperType)
		require.Nil(t, keeperConfig)
	})

	t.Run("get test keeper config", func(t *testing.T) {
		keeper := "kp-test"
		keeperType, keeperConfig, err := keeperMetadataStorage.GetKeeperConfig(ctx, "default", &keeper)
		require.NoError(t, err)
		require.Equal(t, contracts.SQLKeeperType, keeperType)
		require.NotNil(t, keeperConfig)
	})
}
