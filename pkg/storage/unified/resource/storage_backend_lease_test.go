package resource

import (
	"context"
	"io"
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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

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

// leaseStoreHookKV fails Batch calls, numbered from 1, when hook returns an
// error, and delays every Save by saveDelay.
type leaseStoreHookKV struct {
	KV
	calls     int
	hook      func(call int) error
	saveDelay time.Duration
}

func (f *leaseStoreHookKV) Batch(ctx context.Context, section string, ops []BatchOp) error {
	f.calls++
	if err := f.hook(f.calls); err != nil {
		return err
	}
	return f.KV.Batch(ctx, section, ops)
}

func (f *leaseStoreHookKV) Save(ctx context.Context, section, key string) (io.WriteCloser, error) {
	time.Sleep(f.saveDelay)
	return f.KV.Save(ctx, section, key)
}

func TestKVStorageBackendWriteLeaseBackendFailure(t *testing.T) {
	key := &resourcepb.ResourceKey{Group: "group", Resource: "resources", Namespace: "ns", Name: "name"}
	newBackend := func(t *testing.T, hook func(call int) error, saveDelay time.Duration) *kvStorageBackend {
		store := &leaseStoreHookKV{KV: setupBadgerKV(t), hook: hook, saveDelay: saveDelay}
		manager := lease.NewManager(store, "test", "storage", nil, lease.WithGarbageCollectionDisabled)
		return &kvStorageBackend{leaseManager: manager, log: &logging.NoOpLogger{}}
	}
	failWith := func(err error) func(int) error {
		return func(int) error { return err }
	}
	requireInternalLeaseError := func(t *testing.T, err error, message string) {
		t.Helper()
		// Round-trip through the server and client conversions an API caller sees.
		clientErr := StatusErrorFromGRPC(GRPCStatusError(AsErrorResult(err)))
		var apiStatus apierrors.APIStatus
		require.ErrorAs(t, clientErr, &apiStatus)
		require.Equal(t, int32(http.StatusInternalServerError), apiStatus.Status().Code)
		require.Equal(t, metav1.StatusReasonInternalError, apiStatus.Status().Reason)
		require.Equal(t, message, apiStatus.Status().Message)
	}

	t.Run("store failure is an internal error without backend details", func(t *testing.T) {
		// A remote KV reports failed batch operations, including database errors, as Aborted.
		backend := newBackend(t, failWith(status.Error(codes.Aborted,
			"batch operation 0 failed: Error 1290 (HY000): The MySQL server is running with the --read-only option")), 0)
		_, _, err := backend.acquireWriteLease(t.Context(), WriteEvent{Key: key})
		requireInternalLeaseError(t, err, "failed to acquire write lease")
		_, _, err = backend.acquireBulkLeases(t.Context(), []*resourcepb.ResourceKey{key})
		requireInternalLeaseError(t, err, "failed to acquire bulk lease")
	})

	t.Run("remote deadline is internal even if the request ends during cleanup", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			// The second lease fails while the request is live; releasing the first outlasts the request.
			backend := newBackend(t, func(call int) error {
				if call == 2 {
					return status.Error(codes.DeadlineExceeded, "remote timeout")
				}
				return nil
			}, 2*time.Second)
			ctx, cancel := context.WithTimeout(t.Context(), time.Second)
			defer cancel()
			_, _, err := backend.acquireBulkLeases(ctx, []*resourcepb.ResourceKey{
				{Group: "group", Resource: "resources", Namespace: "a"},
				{Group: "group", Resource: "resources", Namespace: "b"},
			})
			require.Error(t, ctx.Err(), "the request should have ended during cleanup")
			requireInternalLeaseError(t, err, "failed to acquire bulk lease")
		})
	})

	t.Run("request cancellation is preserved without lease details", func(t *testing.T) {
		backend := newBackend(t, failWith(context.Canceled), 0)
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
		ctx, release, err := backend.acquireStorageLeases(t.Context(), "test", []string{"first", "second"}, lease.WithTTL(10*time.Millisecond))
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
