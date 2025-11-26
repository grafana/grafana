package kv_test

import (
	"context"
	"testing"
	"time"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"
	"k8s.io/utils/ptr"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/storage/secret/metadata/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func setupTestKVStorage(t *testing.T) (contracts.SecureValueMetadataStorage, *testutils.FakeClock) {
	t.Helper()

	// Create in-memory BadgerDB
	opts := badger.DefaultOptions("").WithInMemory(true).WithLoggingLevel(badger.ERROR)
	db, err := badger.Open(opts)
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = db.Close()
	})

	kvStore := resource.NewBadgerKV(db)
	clk := testutils.NewFakeClock()

	storage := kv.NewSecureValueMetadataStorage(kvStore, clk)

	return storage, clk
}

func Test_KV_SecureValueMetadataStorage_CreateAndRead(t *testing.T) {
	ctx := context.Background()
	storage, _ := setupTestKVStorage(t)

	t.Run("create and read a secure value", func(t *testing.T) {
		testSecureValue := &secretv1beta1.SecureValue{
			Spec: secretv1beta1.SecureValueSpec{
				Description: "test description",
				Value:       ptr.To(secretv1beta1.NewExposedSecureValue("test-value")),
			},
		}
		testSecureValue.Name = "sv-test"
		testSecureValue.Namespace = "default"

		// Create the secure value
		createdSecureValue, err := storage.Create(ctx, "test-keeper", testSecureValue, "testuser")
		require.NoError(t, err)
		require.NotNil(t, createdSecureValue)
		require.Equal(t, "sv-test", createdSecureValue.Name)
		require.Equal(t, "default", createdSecureValue.Namespace)
		require.Equal(t, "test description", createdSecureValue.Spec.Description)
		require.Equal(t, "test-keeper", createdSecureValue.Status.Keeper)
		require.Equal(t, int64(1), createdSecureValue.Status.Version)

		// Set version to active (this is what the service does)
		err = storage.SetVersionToActive(ctx, xkube.Namespace("default"), "sv-test", createdSecureValue.Status.Version)
		require.NoError(t, err)

		// Read the secure value back
		readSecureValue, err := storage.Read(ctx, xkube.Namespace("default"), "sv-test", contracts.ReadOpts{})
		require.NoError(t, err)
		require.NotNil(t, readSecureValue)
		require.Equal(t, "sv-test", readSecureValue.Name)
		require.Equal(t, "default", readSecureValue.Namespace)
		require.Equal(t, "test description", readSecureValue.Spec.Description)
		require.Equal(t, "test-keeper", readSecureValue.Status.Keeper)

		// List secure values and verify our value is in the list
		secureValues, err := storage.List(ctx, xkube.Namespace("default"))
		require.NoError(t, err)
		require.NotEmpty(t, secureValues)

		// Find our secure value in the list
		var found bool
		for _, sv := range secureValues {
			if sv.Name == "sv-test" {
				found = true
				require.Equal(t, "default", sv.Namespace)
				require.Equal(t, "test description", sv.Spec.Description)
				require.Equal(t, "test-keeper", sv.Status.Keeper)
				break
			}
		}
		require.True(t, found, "secure value not found in list")
	})

	t.Run("create, read, delete and verify secure value", func(t *testing.T) {
		testSecureValue := &secretv1beta1.SecureValue{
			Spec: secretv1beta1.SecureValueSpec{
				Description: "test description 2",
				Value:       ptr.To(secretv1beta1.NewExposedSecureValue("test-value-2")),
			},
		}
		testSecureValue.Name = "sv-test-2"
		testSecureValue.Namespace = "default"

		// Create the secure value
		createdSecureValue, err := storage.Create(ctx, "test-keeper", testSecureValue, "testuser")
		require.NoError(t, err)
		require.NotNil(t, createdSecureValue)

		// Set version to active
		err = storage.SetVersionToActive(ctx, xkube.Namespace("default"), "sv-test-2", createdSecureValue.Status.Version)
		require.NoError(t, err)

		// Read the secure value to verify it exists
		readSecureValue, err := storage.Read(ctx, xkube.Namespace("default"), "sv-test-2", contracts.ReadOpts{})
		require.NoError(t, err)
		require.NotNil(t, readSecureValue)
		require.Equal(t, "sv-test-2", readSecureValue.Name)

		// Set the version to inactive
		err = storage.SetVersionToInactive(ctx, xkube.Namespace("default"), "sv-test-2", readSecureValue.Status.Version)
		require.NoError(t, err)

		// Try to read the deleted secure value - should return error
		_, err = storage.Read(ctx, xkube.Namespace("default"), "sv-test-2", contracts.ReadOpts{})
		require.Error(t, err)
		require.Equal(t, contracts.ErrSecureValueNotFound, err)
	})

	t.Run("create multiple versions", func(t *testing.T) {
		testSecureValue := &secretv1beta1.SecureValue{
			Spec: secretv1beta1.SecureValueSpec{
				Description: "version 1",
				Value:       ptr.To(secretv1beta1.NewExposedSecureValue("v1")),
			},
		}
		testSecureValue.Name = "sv-multi"
		testSecureValue.Namespace = "default"

		// Create version 1
		v1, err := storage.Create(ctx, "test-keeper", testSecureValue, "testuser")
		require.NoError(t, err)
		require.Equal(t, int64(1), v1.Status.Version)
		err = storage.SetVersionToActive(ctx, xkube.Namespace("default"), "sv-multi", v1.Status.Version)
		require.NoError(t, err)

		// Create version 2
		testSecureValue.Spec.Description = "version 2"
		v2, err := storage.Create(ctx, "test-keeper", testSecureValue, "testuser")
		require.NoError(t, err)
		require.Equal(t, int64(2), v2.Status.Version)
		err = storage.SetVersionToActive(ctx, xkube.Namespace("default"), "sv-multi", v2.Status.Version)
		require.NoError(t, err)

		// Read should return the latest active version (v2)
		readSecureValue, err := storage.Read(ctx, xkube.Namespace("default"), "sv-multi", contracts.ReadOpts{})
		require.NoError(t, err)
		require.Equal(t, "version 2", readSecureValue.Spec.Description)
		require.Equal(t, int64(2), readSecureValue.Status.Version)
	})
}

func Test_KV_SetExternalID(t *testing.T) {
	ctx := context.Background()
	storage, _ := setupTestKVStorage(t)

	testSecureValue := &secretv1beta1.SecureValue{
		Spec: secretv1beta1.SecureValueSpec{
			Description: "test",
			Value:       ptr.To(secretv1beta1.NewExposedSecureValue("value")),
		},
	}
	testSecureValue.Name = "sv-external"
	testSecureValue.Namespace = "default"

	created, err := storage.Create(ctx, "test-keeper", testSecureValue, "testuser")
	require.NoError(t, err)

	// Set version to active
	err = storage.SetVersionToActive(ctx, xkube.Namespace("default"), "sv-external", created.Status.Version)
	require.NoError(t, err)

	// Set external ID
	externalID := contracts.ExternalID("external-123")
	err = storage.SetExternalID(ctx, xkube.Namespace("default"), "sv-external", created.Status.Version, externalID)
	require.NoError(t, err)

	// Read and verify external ID
	read, err := storage.Read(ctx, xkube.Namespace("default"), "sv-external", contracts.ReadOpts{})
	require.NoError(t, err)
	require.Equal(t, "external-123", read.Status.ExternalID)
}

func Test_KV_SetVersionToActive(t *testing.T) {
	ctx := context.Background()
	storage, _ := setupTestKVStorage(t)

	testSecureValue := &secretv1beta1.SecureValue{
		Spec: secretv1beta1.SecureValueSpec{
			Description: "v1",
		},
	}
	testSecureValue.Name = "sv-active"
	testSecureValue.Namespace = "default"

	// Create two versions
	v1, err := storage.Create(ctx, "test-keeper", testSecureValue, "testuser")
	require.NoError(t, err)
	err = storage.SetVersionToActive(ctx, xkube.Namespace("default"), "sv-active", v1.Status.Version)
	require.NoError(t, err)

	testSecureValue.Spec.Description = "v2"
	v2, err := storage.Create(ctx, "test-keeper", testSecureValue, "testuser")
	require.NoError(t, err)
	err = storage.SetVersionToActive(ctx, xkube.Namespace("default"), "sv-active", v2.Status.Version)
	require.NoError(t, err)

	// Currently v2 should be active
	read, err := storage.Read(ctx, xkube.Namespace("default"), "sv-active", contracts.ReadOpts{})
	require.NoError(t, err)
	require.Equal(t, "v2", read.Spec.Description)

	// Set v1 as active
	err = storage.SetVersionToActive(ctx, xkube.Namespace("default"), "sv-active", v1.Status.Version)
	require.NoError(t, err)

	// Now v1 should be active
	read, err = storage.Read(ctx, xkube.Namespace("default"), "sv-active", contracts.ReadOpts{})
	require.NoError(t, err)
	require.Equal(t, "v1", read.Spec.Description)
	require.Equal(t, v1.Status.Version, read.Status.Version)
}

func Test_KV_LeaseInactiveSecureValues(t *testing.T) {
	ctx := context.Background()
	storage, clk := setupTestKVStorage(t)

	t.Run("no secure value exists", func(t *testing.T) {
		svs, err := storage.LeaseInactiveSecureValues(ctx, 10)
		require.NoError(t, err)
		require.Empty(t, svs)
	})

	t.Run("lease inactive secure values", func(t *testing.T) {
		testSecureValue := &secretv1beta1.SecureValue{
			Spec: secretv1beta1.SecureValueSpec{
				Description: "test",
			},
		}
		testSecureValue.Name = "sv-lease"
		testSecureValue.Namespace = "default"

		// Create and then deactivate
		created, err := storage.Create(ctx, "test-keeper", testSecureValue, "testuser")
		require.NoError(t, err)

		err = storage.SetVersionToInactive(ctx, xkube.Namespace("default"), "sv-lease", created.Status.Version)
		require.NoError(t, err)

		// Advance clock to pass min age (5 minutes)
		clk.AdvanceBy(10 * time.Minute)

		// Acquire a lease
		values1, err := storage.LeaseInactiveSecureValues(ctx, 10)
		require.NoError(t, err)
		require.Equal(t, 1, len(values1))
		require.Equal(t, "sv-lease", values1[0].Name)

		// Try to acquire a lease again - should be empty since it's already leased
		values2, err := storage.LeaseInactiveSecureValues(ctx, 10)
		require.NoError(t, err)
		require.Empty(t, values2)

		// Advance clock to expire lease (30 seconds)
		clk.AdvanceBy(1 * time.Minute)

		// Should be able to acquire a new lease
		values3, err := storage.LeaseInactiveSecureValues(ctx, 10)
		require.NoError(t, err)
		require.Equal(t, 1, len(values3))
		require.Equal(t, "sv-lease", values3[0].Name)
	})
}

func Test_KV_Delete(t *testing.T) {
	ctx := context.Background()
	storage, _ := setupTestKVStorage(t)

	testSecureValue := &secretv1beta1.SecureValue{
		Spec: secretv1beta1.SecureValueSpec{
			Description: "test",
		},
	}
	testSecureValue.Name = "sv-delete"
	testSecureValue.Namespace = "default"

	created, err := storage.Create(ctx, "test-keeper", testSecureValue, "testuser")
	require.NoError(t, err)

	// Delete the secure value
	err = storage.Delete(ctx, xkube.Namespace("default"), "sv-delete", created.Status.Version)
	require.NoError(t, err)

	// Deleting again should be idempotent
	err = storage.Delete(ctx, xkube.Namespace("default"), "sv-delete", created.Status.Version)
	require.NoError(t, err)
}

func Test_KV_List(t *testing.T) {
	ctx := context.Background()
	storage, _ := setupTestKVStorage(t)

	// Create multiple secure values in different namespaces
	for i := 0; i < 3; i++ {
		sv := &secretv1beta1.SecureValue{
			Spec: secretv1beta1.SecureValueSpec{
				Description: "test",
			},
		}
		svName := "sv-" + string(rune('a'+i))
		sv.Name = svName
		sv.Namespace = "ns1"

		created, err := storage.Create(ctx, "test-keeper", sv, "testuser")
		require.NoError(t, err)
		err = storage.SetVersionToActive(ctx, xkube.Namespace("ns1"), svName, created.Status.Version)
		require.NoError(t, err)
	}

	// Create in another namespace
	sv := &secretv1beta1.SecureValue{
		Spec: secretv1beta1.SecureValueSpec{
			Description: "test",
		},
	}
	sv.Name = "sv-other"
	sv.Namespace = "ns2"
	created, err := storage.Create(ctx, "test-keeper", sv, "testuser")
	require.NoError(t, err)
	err = storage.SetVersionToActive(ctx, xkube.Namespace("ns2"), "sv-other", created.Status.Version)
	require.NoError(t, err)

	// List ns1
	list1, err := storage.List(ctx, xkube.Namespace("ns1"))
	require.NoError(t, err)
	require.Equal(t, 3, len(list1))

	// List ns2
	list2, err := storage.List(ctx, xkube.Namespace("ns2"))
	require.NoError(t, err)
	require.Equal(t, 1, len(list2))
	require.Equal(t, "sv-other", list2[0].Name)
}
