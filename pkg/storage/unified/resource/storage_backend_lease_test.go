package resource

import (
	"context"
	"net/http"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestKVStorageBackendWriteLeases(t *testing.T) {
	for _, namespace := range []string{"ns", ""} {
		t.Run("namespace="+namespace, func(t *testing.T) {
			backend := setupTestStorageBackend(t)
			key := &resourcepb.ResourceKey{Group: "group", Resource: "resources", Namespace: namespace, Name: "name"}
			name := "write/group/resources/" + namespace + "/name"
			event := WriteEvent{Key: key}

			ctx, cancel := context.WithCancel(t.Context())
			leaseCtx, release, err := backend.acquireWriteLease(ctx, event)
			require.NoError(t, err)
			release = sync.OnceFunc(release)
			defer release()
			_, err = backend.LeaseManager().Acquire(t.Context(), name)
			require.ErrorIs(t, err, lease.ErrLeaseAlreadyHeld)
			cancel()
			require.ErrorIs(t, leaseCtx.Err(), context.Canceled)
			release()

			held, err := backend.LeaseManager().Acquire(t.Context(), name)
			require.NoError(t, err)
			_, _, err = backend.acquireWriteLease(t.Context(), event)
			require.True(t, apierrors.IsConflict(err), "expected conflict, got %v", err)
			require.NoError(t, backend.LeaseManager().Release(t.Context(), held))

			_, release, err = backend.acquireWriteLease(t.Context(), event)
			require.NoError(t, err)
			release()
		})
	}
}

type batchFailingKV struct {
	KV
	err error
}

func (f *batchFailingKV) Batch(context.Context, string, []BatchOp) error {
	return f.err
}

func TestKVStorageBackendWriteLeaseBackendFailure(t *testing.T) {
	key := &resourcepb.ResourceKey{Group: "group", Resource: "resources", Namespace: "ns", Name: "name"}
	newBackend := func(err error) *kvStorageBackend {
		store := &batchFailingKV{KV: setupBadgerKV(t), err: err}
		manager := lease.NewManager(store, "test", "storage", nil, lease.WithGarbageCollectionDisabled)
		return &kvStorageBackend{leaseManager: manager, log: &logging.NoOpLogger{}}
	}

	t.Run("store failure is an internal error without backend details", func(t *testing.T) {
		// A remote KV reports failed batch operations, including database errors, as Aborted.
		backend := newBackend(status.Error(codes.Aborted,
			"batch operation 0 failed: Error 1290 (HY000): The MySQL server is running with the --read-only option"))
		_, _, writeErr := backend.acquireWriteLease(t.Context(), WriteEvent{Key: key})
		_, _, bulkErr := backend.acquireBulkLeases(t.Context(), []*resourcepb.ResourceKey{key})

		for _, err := range []error{writeErr, bulkErr} {
			require.Error(t, err)
			res := AsErrorResult(err)
			require.Equal(t, int32(http.StatusInternalServerError), res.Code)
			require.NotContains(t, res.Message, "MySQL")
			require.NotContains(t, res.Message, "group/resources/ns")
			require.Equal(t, codes.Internal, status.Code(GRPCStatusError(res)))
		}
	})

	t.Run("remote deadline with a live request is an internal error", func(t *testing.T) {
		backend := newBackend(status.Error(codes.DeadlineExceeded, "remote timeout"))
		_, _, err := backend.acquireWriteLease(t.Context(), WriteEvent{Key: key})
		require.Equal(t, int32(http.StatusInternalServerError), AsErrorResult(err).Code)
	})

	t.Run("request cancellation is preserved without lease details", func(t *testing.T) {
		backend := newBackend(context.Canceled)
		ctx, cancel := context.WithCancel(t.Context())
		cancel()
		_, _, err := backend.acquireWriteLease(ctx, WriteEvent{Key: key})
		require.ErrorIs(t, err, context.Canceled)
		require.NotContains(t, err.Error(), "group/resources/ns")
	})
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
