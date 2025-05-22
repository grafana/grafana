package metadata

import (
	"context"
	"testing"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	"github.com/stretchr/testify/require"
)

func Test_KeeperMetadataStorage_GetKeeperConfig(t *testing.T) {
	t.Parallel()

	defaultKeeperName := "kp-test"
	defaultKeeperNS := "default"

	testKeeper := &secretv0alpha1.Keeper{
		Spec: secretv0alpha1.KeeperSpec{
			Description: "description",
			AWS:         &secretv0alpha1.AWSKeeperConfig{},
		},
	}

	testKeeper.Name = defaultKeeperName
	testKeeper.Namespace = defaultKeeperNS

	t.Run("get the system keeper config", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()
		keeperMetadataStorage := initStorage(t)

		// get system keeper config
		keeperConfig, err := keeperMetadataStorage.GetKeeperConfig(ctx, defaultKeeperNS, nil, contracts.ReadOpts{})
		require.NoError(t, err)
		require.Nil(t, keeperConfig)
	})

	t.Run("get test keeper config", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()
		keeperMetadataStorage := initStorage(t)

		//
		_, err := keeperMetadataStorage.Create(ctx, testKeeper, "testuser")
		require.NoError(t, err)

		keeperConfig, err := keeperMetadataStorage.GetKeeperConfig(ctx, defaultKeeperNS, &defaultKeeperName, contracts.ReadOpts{})
		require.NoError(t, err)
		require.NotNil(t, keeperConfig)
		require.NotEmpty(t, keeperConfig.Type())
	})

	t.Run("get test keeper config when listing", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()
		keeperMetadataStorage := initStorage(t)

		//
		_, err := keeperMetadataStorage.Create(ctx, testKeeper, "testuser")
		require.NoError(t, err)

		keeperList, err := keeperMetadataStorage.List(ctx, xkube.Namespace(defaultKeeperNS))
		require.NoError(t, err)
		require.NotEmpty(t, keeperList)

		require.Len(t, keeperList, 1)
		keeper := keeperList[0]
		require.Equal(t, "kp-test", keeper.Name)
		require.Equal(t, "default", keeper.Namespace)
		require.Equal(t, "description", keeper.Spec.Description)
	})

	t.Run("create a keeper and then delete it", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()
		keeperMetadataStorage := initStorage(t)

		keeperTest := "kp-test2"
		keeperNamespaceTest := "ns"

		testKeeper := &secretv0alpha1.Keeper{
			Spec: secretv0alpha1.KeeperSpec{
				Description: "another description",
				AWS:         &secretv0alpha1.AWSKeeperConfig{},
			},
		}
		testKeeper.Name = keeperTest
		testKeeper.Namespace = keeperNamespaceTest

		// create the keeper
		_, err := keeperMetadataStorage.Create(ctx, testKeeper, "testuser")
		require.NoError(t, err)

		// we are able to get it
		keeperConfig, err := keeperMetadataStorage.GetKeeperConfig(ctx, keeperNamespaceTest, &keeperTest, contracts.ReadOpts{})
		require.NoError(t, err)
		require.NotNil(t, keeperConfig)
		require.NotEmpty(t, keeperConfig.Type())

		// now we delete it
		delErr := keeperMetadataStorage.Delete(ctx, xkube.Namespace(keeperNamespaceTest), keeperTest)
		require.NoError(t, delErr)

		// and we shouldn't be able to get it again
		_, getErr := keeperMetadataStorage.GetKeeperConfig(ctx, keeperNamespaceTest, &keeperTest, contracts.ReadOpts{})
		require.Errorf(t, getErr, "keeper not found")
	})

	t.Run("create, update and validate keeper", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()
		keeperMetadataStorage := initStorage(t)

		keeperTest := "kp-test3"
		keeperNamespaceTest := "ns"

		// Create initial keeper
		initialKeeper := &secretv0alpha1.Keeper{
			Spec: secretv0alpha1.KeeperSpec{
				Description: "initial description",
				AWS:         &secretv0alpha1.AWSKeeperConfig{},
			},
		}
		initialKeeper.Name = keeperTest
		initialKeeper.Namespace = keeperNamespaceTest

		// Create the keeper
		_, err := keeperMetadataStorage.Create(ctx, initialKeeper, "testuser")
		require.NoError(t, err)

		// Validate that the description was set
		keeper, err := keeperMetadataStorage.Read(ctx, xkube.Namespace(keeperNamespaceTest), keeperTest, contracts.ReadOpts{})
		require.NoError(t, err)
		require.Equal(t, "initial description", keeper.Spec.Description)

		// Update the keeper with new values
		updatedKeeper := &secretv0alpha1.Keeper{
			Spec: secretv0alpha1.KeeperSpec{
				Description: "updated description",
				AWS:         &secretv0alpha1.AWSKeeperConfig{},
			},
		}
		updatedKeeper.Name = keeperTest
		updatedKeeper.Namespace = keeperNamespaceTest

		// Perform the update
		_, err = keeperMetadataStorage.Update(ctx, updatedKeeper, "testuser")
		require.NoError(t, err)

		// Validate updated values
		updatedConfig, err := keeperMetadataStorage.GetKeeperConfig(ctx, keeperNamespaceTest, &keeperTest, contracts.ReadOpts{})
		require.NoError(t, err)
		require.NotNil(t, updatedConfig)
		require.NotEmpty(t, updatedConfig.Type())

		// Validate that the description was updated
		updatedKeeper, err = keeperMetadataStorage.Read(ctx, xkube.Namespace(keeperNamespaceTest), keeperTest, contracts.ReadOpts{})
		require.NoError(t, err)
		require.Equal(t, "updated description", updatedKeeper.Spec.Description)
	})

	t.Run("update keeper with different AWS configuration", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()
		keeperMetadataStorage := initStorage(t)

		keeperTest := "kp-test4"
		keeperNamespaceTest := "ns"

		// Create initial keeper with first AWS config
		initialKeeper := &secretv0alpha1.Keeper{
			Spec: secretv0alpha1.KeeperSpec{
				Description: "initial description",
				AWS: &secretv0alpha1.AWSKeeperConfig{
					AWSCredentials: secretv0alpha1.AWSCredentials{
						AccessKeyID: secretv0alpha1.CredentialValue{
							ValueFromEnv: "AWS_ACCESS_KEY_ID_1",
						},
						SecretAccessKey: secretv0alpha1.CredentialValue{
							ValueFromEnv: "AWS_SECRET_ACCESS_KEY_1",
						},
						KMSKeyID: "kms-key-id-1",
					},
				},
			},
		}
		initialKeeper.Name = keeperTest
		initialKeeper.Namespace = keeperNamespaceTest

		// Create the keeper
		_, err := keeperMetadataStorage.Create(ctx, initialKeeper, "testuser")
		require.NoError(t, err)

		// Verify initial AWS config
		keeper, err := keeperMetadataStorage.Read(ctx, xkube.Namespace(keeperNamespaceTest), keeperTest, contracts.ReadOpts{})
		require.NoError(t, err)
		require.Equal(t, "AWS_ACCESS_KEY_ID_1", keeper.Spec.AWS.AccessKeyID.ValueFromEnv)
		require.Equal(t, "AWS_SECRET_ACCESS_KEY_1", keeper.Spec.AWS.SecretAccessKey.ValueFromEnv)
		require.Equal(t, "kms-key-id-1", keeper.Spec.AWS.KMSKeyID)

		// Update with new AWS config
		updatedKeeper := &secretv0alpha1.Keeper{
			Spec: secretv0alpha1.KeeperSpec{
				Description: "updated description",
				AWS: &secretv0alpha1.AWSKeeperConfig{
					AWSCredentials: secretv0alpha1.AWSCredentials{
						AccessKeyID: secretv0alpha1.CredentialValue{
							ValueFromEnv: "AWS_ACCESS_KEY_ID_2",
						},
						SecretAccessKey: secretv0alpha1.CredentialValue{
							ValueFromEnv: "AWS_SECRET_ACCESS_KEY_2",
						},
						KMSKeyID: "kms-key-id-2",
					},
				},
			},
		}
		updatedKeeper.Name = keeperTest
		updatedKeeper.Namespace = keeperNamespaceTest

		// Perform the update
		_, err = keeperMetadataStorage.Update(ctx, updatedKeeper, "testuser")
		require.NoError(t, err)

		// Verify updated AWS config
		updatedKeeper, err = keeperMetadataStorage.Read(ctx, xkube.Namespace(keeperNamespaceTest), keeperTest, contracts.ReadOpts{})
		require.NoError(t, err)
		require.Equal(t, "AWS_ACCESS_KEY_ID_2", updatedKeeper.Spec.AWS.AccessKeyID.ValueFromEnv)
		require.Equal(t, "AWS_SECRET_ACCESS_KEY_2", updatedKeeper.Spec.AWS.SecretAccessKey.ValueFromEnv)
		require.Equal(t, "kms-key-id-2", updatedKeeper.Spec.AWS.KMSKeyID)
	})

	t.Run("list keepers in empty namespace", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()
		keeperMetadataStorage := initStorage(t)

		keeperList, err := keeperMetadataStorage.List(ctx, "")
		require.NoError(t, err)
		require.Empty(t, keeperList)
	})

	t.Run("read non-existent keeper", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()
		keeperMetadataStorage := initStorage(t)

		_, err := keeperMetadataStorage.Read(ctx, "ns", "non-existent", contracts.ReadOpts{})
		require.Error(t, err)
		require.Equal(t, contracts.ErrKeeperNotFound, err)
	})

	t.Run("update keeper with different namespace", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()
		keeperMetadataStorage := initStorage(t)

		keeperTest := "kp-test5"
		keeperNamespaceTest := "ns1"

		// Create initial keeper
		initialKeeper := &secretv0alpha1.Keeper{
			Spec: secretv0alpha1.KeeperSpec{
				Description: "initial description",
				AWS: &secretv0alpha1.AWSKeeperConfig{
					AWSCredentials: secretv0alpha1.AWSCredentials{
						AccessKeyID: secretv0alpha1.CredentialValue{
							ValueFromEnv: "AWS_ACCESS_KEY_ID",
						},
						SecretAccessKey: secretv0alpha1.CredentialValue{
							ValueFromEnv: "AWS_SECRET_ACCESS_KEY",
						},
					},
				},
			},
		}
		initialKeeper.Name = keeperTest
		initialKeeper.Namespace = keeperNamespaceTest

		// Create the keeper
		_, err := keeperMetadataStorage.Create(ctx, initialKeeper, "testuser")
		require.NoError(t, err)

		// Try to update with different namespace
		updatedKeeper := initialKeeper.DeepCopy()
		updatedKeeper.Namespace = "ns2"
		updatedKeeper.Spec.Description = "updated description"

		_, err = keeperMetadataStorage.Update(ctx, updatedKeeper, "testuser")
		// should this return contracts.ErrKeeperNotFound directly?
		// require.Equal(t, contracts.ErrKeeperNotFound, err)
		require.Error(t, err, "db failure: keeper not found")

		// Verify original keeper is unchanged
		keeper, err := keeperMetadataStorage.Read(ctx, xkube.Namespace(keeperNamespaceTest), keeperTest, contracts.ReadOpts{})
		require.NoError(t, err)
		require.Equal(t, "initial description", keeper.Spec.Description)
	})

	t.Run("update non-existent keeper", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()
		keeperMetadataStorage := initStorage(t)

		nonExistentKeeper := &secretv0alpha1.Keeper{
			Spec: secretv0alpha1.KeeperSpec{
				Description: "some description",
				AWS:         &secretv0alpha1.AWSKeeperConfig{},
			},
		}
		nonExistentKeeper.Name = "non-existent"
		nonExistentKeeper.Namespace = "ns"

		_, err := keeperMetadataStorage.Update(ctx, nonExistentKeeper, "testuser")
		require.Error(t, err, "db failure: keeper not found")
	})
}

func initStorage(t *testing.T) contracts.KeeperMetadataStorage {
	testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
	db := database.ProvideDatabase(testDB)
	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)

	// Initialize the keeper storage
	keeperMetadataStorage, err := ProvideKeeperMetadataStorage(db, features)
	require.NoError(t, err)
	return keeperMetadataStorage
}
