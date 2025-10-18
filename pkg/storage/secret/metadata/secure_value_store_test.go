package metadata_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"k8s.io/utils/ptr"
	"pgregory.net/rapid"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/clock"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	"github.com/grafana/grafana/pkg/storage/secret/metadata"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
)

func createTestKeeper(t *testing.T, ctx context.Context, keeperStorage contracts.KeeperMetadataStorage, name, namespace string) string {
	t.Helper()

	testKeeper := &secretv1beta1.Keeper{
		Spec: secretv1beta1.KeeperSpec{
			Description: "test keeper description",
			Aws:         &secretv1beta1.KeeperAWSConfig{},
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

	// Initialize the secure value storage
	secureValueStorage, err := metadata.ProvideSecureValueMetadataStorage(clock.ProvideClock(), db, tracer, nil)
	require.NoError(t, err)

	// Initialize the keeper storage
	keeperStorage, err := metadata.ProvideKeeperMetadataStorage(db, tracer, nil)
	require.NoError(t, err)

	t.Run("create and read a secure value", func(t *testing.T) {
		// First create a keeper
		keeperName := createTestKeeper(t, ctx, keeperStorage, "test-keeper", "default")

		// Create a test secure value
		testSecureValue := &secretv1beta1.SecureValue{
			Spec: secretv1beta1.SecureValueSpec{
				Description: "test description",
				Value:       ptr.To(secretv1beta1.NewExposedSecureValue("test-value")),
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

		require.NoError(t, secureValueStorage.SetVersionToActive(ctx, xkube.Namespace(createdSecureValue.Namespace), createdSecureValue.Name, createdSecureValue.Status.Version))

		// Read the secure value back
		readSecureValue, err := secureValueStorage.Read(ctx, xkube.Namespace("default"), "sv-test", contracts.ReadOpts{})
		require.NoError(t, err)
		require.NotNil(t, readSecureValue)
		require.Equal(t, "sv-test", readSecureValue.Name)
		require.Equal(t, "default", readSecureValue.Namespace)
		require.Equal(t, "test description", readSecureValue.Spec.Description)
		require.Equal(t, keeperName, *readSecureValue.Spec.Keeper)

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
				Value:       ptr.To(secretv1beta1.NewExposedSecureValue("test-value-2")),
				Keeper:      &keeperName,
			},
		}
		testSecureValue.Name = "sv-test-2"
		testSecureValue.Namespace = "default"

		// Create the secure value
		createdSecureValue, err := secureValueStorage.Create(ctx, testSecureValue, "testuser")
		require.NoError(t, err)
		require.NotNil(t, createdSecureValue)

		require.NoError(t, secureValueStorage.SetVersionToActive(ctx, xkube.Namespace(createdSecureValue.Namespace), createdSecureValue.Name, createdSecureValue.Status.Version))

		// Read the secure value to verify it exists
		readSecureValue, err := secureValueStorage.Read(ctx, xkube.Namespace("default"), "sv-test-2", contracts.ReadOpts{})
		require.NoError(t, err)
		require.NotNil(t, readSecureValue)
		require.Equal(t, "sv-test-2", readSecureValue.Name)

		// Delete the secure value
		err = secureValueStorage.SetVersionToInactive(ctx, xkube.Namespace("default"), "sv-test-2", readSecureValue.Status.Version)
		require.NoError(t, err)

		// Try to read the deleted secure value - should return error
		_, err = secureValueStorage.Read(ctx, xkube.Namespace("default"), "sv-test-2", contracts.ReadOpts{})
		require.Error(t, err)
		require.Equal(t, contracts.ErrSecureValueNotFound, err)
	})
}

func TestLeaseInactiveSecureValues(t *testing.T) {
	t.Parallel()

	t.Run("no secure value exists", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		svs, err := sut.SecureValueMetadataStorage.LeaseInactiveSecureValues(t.Context(), 10)
		require.NoError(t, err)
		require.Empty(t, svs)
	})

	t.Run("secure values are not visible to other requests during lease duration", func(t *testing.T) {
		sut := testutils.Setup(t)
		sv, err := sut.CreateSv(t.Context())
		require.NoError(t, err)
		_, err = sut.DeleteSv(t.Context(), sv.Namespace, sv.Name)
		require.NoError(t, err)
		// Advance clock to handle grace period
		sut.Clock.AdvanceBy(10 * time.Minute)
		// Acquire a lease on inactive secure values
		values1, err := sut.SecureValueMetadataStorage.LeaseInactiveSecureValues(t.Context(), 10)
		require.NoError(t, err)
		require.Equal(t, 1, len(values1))
		require.Equal(t, sv.UID, values1[0].UID)
		// Try to acquire a lease again
		values2, err := sut.SecureValueMetadataStorage.LeaseInactiveSecureValues(t.Context(), 10)
		require.NoError(t, err)
		// There's only one inactive secure value and it is already leased
		require.Empty(t, values2)
		// Advance clock to expire lease
		sut.Clock.AdvanceBy(10 * time.Minute)
		values3, err := sut.SecureValueMetadataStorage.LeaseInactiveSecureValues(t.Context(), 10)
		require.NoError(t, err)
		// Should acquire a new lease since the previous one expired
		require.Equal(t, 1, len(values3))
		require.Equal(t, sv.UID, values3[0].UID)
	})
}

func TestPropertySecureValueMetadataStorage(t *testing.T) {
	t.Parallel()

	tt := t

	rapid.Check(t, func(t *rapid.T) {
		sut := testutils.Setup(tt)
		model := newModel()

		t.Repeat(map[string]func(*rapid.T){
			"create": func(t *rapid.T) {
				sv := anySecureValueGen.Draw(t, "sv")
				modelCreatedSv, modelErr := model.create(sut.Clock.Now(), deepCopy(sv))
				createdSv, err := sut.CreateSv(t.Context(), testutils.CreateSvWithSv(deepCopy(sv)))
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
				require.Equal(t, modelCreatedSv.Namespace, createdSv.Namespace)
				require.Equal(t, modelCreatedSv.Name, createdSv.Name)
				require.Equal(t, modelCreatedSv.Status.Version, createdSv.Status.Version)
			},
			"delete": func(t *rapid.T) {
				ns := namespaceGen.Draw(t, "ns")
				name := nameGen.Draw(t, "name")
				modelSv, modelErr := model.delete(ns, name)
				sv, err := sut.DeleteSv(t.Context(), ns, name)
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
				require.Equal(t, modelSv.Namespace, sv.Namespace)
				require.Equal(t, modelSv.Name, sv.Name)
				require.Equal(t, modelSv.Status.Version, sv.Status.Version)
			},
			"lease": func(t *rapid.T) {
				// Taken from secureValueMetadataStorage.acquireLeases
				minAge := 300 * time.Second
				leaseTTL := 30 * time.Second
				maxBatchSize := rapid.Uint16Range(1, 10).Draw(t, "maxBatchSize")
				modelSvs, modelErr := model.leaseInactiveSecureValues(sut.Clock.Now(), minAge, leaseTTL, maxBatchSize)
				svs, err := sut.SecureValueMetadataStorage.LeaseInactiveSecureValues(t.Context(), maxBatchSize)
				require.ErrorIs(t, err, modelErr)
				require.Equal(t, len(modelSvs), len(svs))
			},
			"advanceTime": func(t *rapid.T) {
				duration := time.Duration(rapid.IntRange(1, 10).Draw(t, "minutes")) * time.Minute
				sut.Clock.AdvanceBy(duration)
			},
		})
	})
}
