package metadata

import (
	"context"
	"testing"

	secretv1beta1 "github.com/grafana/grafana/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
)

func createTestKeeper(t *testing.T, ctx context.Context, keeperStorage contracts.KeeperMetadataStorage, name, namespace string) string {
	t.Helper()

	testKeeper := &secretv1beta1.Keeper{
		Spec: secretv1beta1.KeeperSpec{
			Description: "test keeper description",
			AWS:         &secretv1beta1.AWSKeeperConfig{},
		},
	}
	testKeeper.Name = name
	testKeeper.Namespace = namespace

	// Create the keeper
	_, err := keeperStorage.Create(ctx, testKeeper, "testuser")
	require.NoError(t, err)

	return name
}

func Test_SecureValueMetadataStorage_CreateAndRead(t *testing.T) {
	ctx := context.Background()
	testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
	tracer := noop.NewTracerProvider().Tracer("test")
	db := database.ProvideDatabase(testDB, tracer)

	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)

	// Initialize the secure value storage
	secureValueStorage, err := ProvideSecureValueMetadataStorage(db, tracer, features, nil)
	require.NoError(t, err)

	// Initialize the keeper storage
	keeperStorage, err := ProvideKeeperMetadataStorage(db, tracer, features, nil)
	require.NoError(t, err)

	t.Run("create and read a secure value", func(t *testing.T) {
		// First create a keeper
		keeperName := createTestKeeper(t, ctx, keeperStorage, "test-keeper", "default")

		// Create a test secure value
		testSecureValue := &secretv1beta1.SecureValue{
			Spec: secretv1beta1.SecureValueSpec{
				Description: "test description",
				Value:       "test-value",
				Keeper:      &keeperName,
			},
		}
		testSecureValue.Name = "sv-test"
		testSecureValue.Namespace = "default"

		// Create the secure value
		createdSecureValue, err := secureValueStorage.Create(ctx, testSecureValue, "testuser")
		require.NoError(t, err)
		require.NotNil(t, createdSecureValue)
		require.Equal(t, "sv-test", createdSecureValue.Name)
		require.Equal(t, "default", createdSecureValue.Namespace)
		require.Equal(t, "test description", createdSecureValue.Spec.Description)
		require.Equal(t, keeperName, *createdSecureValue.Spec.Keeper)
		require.Equal(t, secretv1beta1.SecureValuePhasePending, createdSecureValue.Status.Phase)

		// Read the secure value back
		readSecureValue, err := secureValueStorage.Read(ctx, xkube.Namespace("default"), "sv-test", contracts.ReadOpts{})
		require.NoError(t, err)
		require.NotNil(t, readSecureValue)
		require.Equal(t, "sv-test", readSecureValue.Name)
		require.Equal(t, "default", readSecureValue.Namespace)
		require.Equal(t, "test description", readSecureValue.Spec.Description)
		require.Equal(t, keeperName, *readSecureValue.Spec.Keeper)
		require.Equal(t, secretv1beta1.SecureValuePhasePending, readSecureValue.Status.Phase)

		// List secure values and verify our value is in the list
		secureValues, err := secureValueStorage.List(ctx, xkube.Namespace("default"))
		require.NoError(t, err)
		require.NotEmpty(t, secureValues)

		// Find our secure value in the list
		var found bool
		for _, sv := range secureValues {
			if sv.Name == "sv-test" {
				found = true
				require.Equal(t, "default", sv.Namespace)
				require.Equal(t, "test description", sv.Spec.Description)
				require.Equal(t, keeperName, *sv.Spec.Keeper)
				require.Equal(t, secretv1beta1.SecureValuePhasePending, sv.Status.Phase)
				break
			}
		}
		require.True(t, found, "secure value not found in list")
	})

	t.Run("create, read, delete and verify secure value", func(t *testing.T) {
		// First create a keeper
		keeperName := createTestKeeper(t, ctx, keeperStorage, "test-keeper-2", "default")

		// Create a test secure value
		testSecureValue := &secretv1beta1.SecureValue{
			Spec: secretv1beta1.SecureValueSpec{
				Description: "test description 2",
				Value:       "test-value-2",
				Keeper:      &keeperName,
			},
		}
		testSecureValue.Name = "sv-test-2"
		testSecureValue.Namespace = "default"

		// Create the secure value
		createdSecureValue, err := secureValueStorage.Create(ctx, testSecureValue, "testuser")
		require.NoError(t, err)
		require.NotNil(t, createdSecureValue)

		// Read the secure value to verify it exists
		readSecureValue, err := secureValueStorage.Read(ctx, xkube.Namespace("default"), "sv-test-2", contracts.ReadOpts{})
		require.NoError(t, err)
		require.NotNil(t, readSecureValue)
		require.Equal(t, "sv-test-2", readSecureValue.Name)

		// Delete the secure value
		err = secureValueStorage.Delete(ctx, xkube.Namespace("default"), "sv-test-2")
		require.NoError(t, err)

		// Try to read the deleted secure value - should return error
		_, err = secureValueStorage.Read(ctx, xkube.Namespace("default"), "sv-test-2", contracts.ReadOpts{})
		require.Error(t, err)
		require.Equal(t, contracts.ErrSecureValueNotFound, err)
	})
}
