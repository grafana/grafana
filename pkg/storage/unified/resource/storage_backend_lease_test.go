package resource

import (
	"context"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestKVStorageBackendWriteLeases(t *testing.T) {
	for _, namespace := range []string{"ns", ""} {
		t.Run("namespace="+namespace, func(t *testing.T) {
			backend := setupTestStorageBackend(t)
			key := &resourcepb.ResourceKey{Group: "group", Resource: "resources", Namespace: namespace, Name: "name"}
			legacyName := "group/resources/" + namespace + "/name"
			if namespace == "" {
				legacyName = "group/resources/name"
			}
			names := []string{legacyName, "write/group/resources/" + namespace + "/name"}
			event := WriteEvent{Key: key}

			ctx, cancel := context.WithCancel(t.Context())
			leaseCtx, release, err := backend.acquireWriteLease(ctx, event)
			require.NoError(t, err)
			release = sync.OnceFunc(release)
			defer release()
			for _, name := range names {
				_, err := backend.LeaseManager().Acquire(t.Context(), name)
				require.ErrorIs(t, err, lease.ErrLeaseAlreadyHeld)
			}
			cancel()
			require.ErrorIs(t, leaseCtx.Err(), context.Canceled)
			release()

			for _, heldName := range names {
				t.Run("held="+heldName, func(t *testing.T) {
					held, err := backend.LeaseManager().Acquire(t.Context(), heldName)
					require.NoError(t, err)
					_, _, err = backend.acquireWriteLease(t.Context(), event)
					require.True(t, apierrors.IsConflict(err), "expected conflict, got %v", err)
					require.NoError(t, backend.LeaseManager().Release(t.Context(), held))

					// A failed second acquisition must not leave the legacy lease held.
					_, release, err := backend.acquireWriteLease(t.Context(), event)
					require.NoError(t, err)
					release()
				})
			}
		})
	}
}

func TestKVStorageBackendStorageLeaseLossCancelsContext(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		store := setupBadgerKV(t)
		manager := lease.NewManager(store, "test", "storage", nil,
			lease.WithInternalMinTTL(time.Millisecond), lease.WithGarbageCollectionDisabled)
		backend := &kvStorageBackend{leaseManager: manager, log: &logging.NoOpLogger{}}
		ctx, release, err := backend.acquireStorageLeases(t.Context(), []string{"first", "second"}, lease.WithTTL(10*time.Millisecond))
		require.NoError(t, err)
		defer release()
		time.Sleep(11 * time.Millisecond)
		synctest.Wait()
		require.ErrorIs(t, ctx.Err(), context.Canceled)
	})
}

func TestKVStorageBackendBulkLeases(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		store := setupBadgerKV(t)
		manager := lease.NewManager(store, "test", "storage", nil, lease.WithGarbageCollectionDisabled)
		backend := &kvStorageBackend{leaseManager: manager, log: &logging.NoOpLogger{}}
		key := &resourcepb.ResourceKey{Group: "group", Resource: "resources", Namespace: "ns"}
		ctx, release, err := backend.acquireBulkLeases(t.Context(), []*resourcepb.ResourceKey{key, key})
		require.NoError(t, err, "duplicate collection keys should acquire only one lease")
		release = sync.OnceFunc(release)
		defer release()

		// Imports may outlive the default ten-second lease TTL.
		time.Sleep(30 * time.Second)
		synctest.Wait()
		require.NoError(t, ctx.Err())
		_, err = manager.Acquire(t.Context(), "bulk/group/resources/ns")
		require.ErrorIs(t, err, lease.ErrLeaseAlreadyHeld)

		for _, other := range []*resourcepb.ResourceKey{
			{Group: "other", Resource: key.Resource, Namespace: key.Namespace},
			{Group: key.Group, Resource: "other", Namespace: key.Namespace},
			{Group: key.Group, Resource: key.Resource, Namespace: "other"},
			{Group: key.Group, Resource: key.Resource},
		} {
			_, releaseOther, err := backend.acquireBulkLeases(t.Context(), []*resourcepb.ResourceKey{other})
			require.NoError(t, err)
			releaseOther()
		}
		release()
		_, releaseAgain, err := backend.acquireBulkLeases(t.Context(), []*resourcepb.ResourceKey{key})
		require.NoError(t, err)
		releaseAgain()
	})
}

func TestKVStorageBackendBulkLeasePartialFailureReleasesEarlierLeases(t *testing.T) {
	backend := setupTestStorageBackend(t)
	keys := []*resourcepb.ResourceKey{
		{Group: "group", Resource: "resources", Namespace: "a"},
		{Group: "group", Resource: "resources", Namespace: "b"},
	}
	_, releaseHeld, err := backend.acquireBulkLeases(t.Context(), keys[1:])
	require.NoError(t, err)
	defer releaseHeld()
	_, _, err = backend.acquireBulkLeases(t.Context(), keys)
	require.ErrorContains(t, err, "bulk import is already running")
	_, releaseFirst, err := backend.acquireBulkLeases(t.Context(), keys[:1])
	require.NoError(t, err)
	releaseFirst()
}
