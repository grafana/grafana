package reconciler

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

// stubServer is a minimal implementation of zanzana.ServerInternal for
// EnsureNamespace / reconcileNamespace tests.
//
// GetStore returns results from getStoreResults in order; a nil entry means
// ErrStoreNotFound. Panics if called more times than results provided.
type stubServer struct {
	authzv1.UnimplementedAuthzServiceServer
	authzextv1.UnimplementedAuthzExtentionServiceServer

	getStoreResults  []*zanzana.StoreInfo
	getStoreIdx      atomic.Int32
	deleteStoreCalls atomic.Int32
	getOrCreateCalls atomic.Int32

	// listAllStoresResults is returned by ListAllStores. Defaults to nil so
	// existing tests that don't care about listing remain unaffected.
	listAllStoresResults []zanzana.StoreInfo
}

func (s *stubServer) Close()                              {}
func (s *stubServer) RunReconciler(context.Context) error { return nil }
func (s *stubServer) ListAllStores(context.Context) ([]zanzana.StoreInfo, error) {
	return s.listAllStoresResults, nil
}
func (s *stubServer) WriteTuples(context.Context, *zanzana.StoreInfo, []*openfgav1.TupleKey, []*openfgav1.TupleKeyWithoutCondition) error {
	return nil
}
func (s *stubServer) GetOpenFGAServer() openfgav1.OpenFGAServiceServer {
	return nil
}
func (s *stubServer) GetOrCreateStore(_ context.Context, ns string) (*zanzana.StoreInfo, error) {
	s.getOrCreateCalls.Add(1)
	return &zanzana.StoreInfo{ID: "store-1", Name: ns}, nil
}
func (s *stubServer) DeleteStore(context.Context, string) error {
	s.deleteStoreCalls.Add(1)
	return nil
}
func (s *stubServer) GetStore(_ context.Context, ns string) (*zanzana.StoreInfo, error) {
	idx := int(s.getStoreIdx.Add(1)) - 1
	if idx >= len(s.getStoreResults) || s.getStoreResults[idx] == nil {
		return nil, zanzana.ErrStoreNotFound
	}
	return s.getStoreResults[idx], nil
}

// notFoundClientFactory causes fetchAndTranslateTuples to return a NotFound
// error, driving reconcileNamespace into its "namespace deleted" branch.
type notFoundClientFactory struct{}

func (notFoundClientFactory) Clients(_ context.Context, ns string) (resources.ResourceClients, error) {
	return nil, apierrors.NewNotFound(schema.GroupResource{Resource: "namespaces"}, ns)
}

func newReconcilerForTest(srv *stubServer, cf resources.ClientFactory) *Reconciler {
	return &Reconciler{
		server:        srv,
		clientFactory: cf,
		cfg:           Config{CRDs: DefaultCRDs},
		logger:        log.NewNopLogger(),
		tracer:        tracing.NewNoopTracerService(),
		metrics:       newReconcilerMetrics(prometheus.NewRegistry()),
	}
}

func TestEnsureNamespace_DoesNotCacheDeletedNamespace(t *testing.T) {
	// Store is missing on both the initial check and the post-reconcile
	// verification → EnsureNamespace must return an error and not cache.
	srv := &stubServer{getStoreResults: []*zanzana.StoreInfo{nil, nil}}
	r := newReconcilerForTest(srv, notFoundClientFactory{})

	err := r.EnsureNamespace(context.Background(), "deleted-ns")
	require.ErrorContains(t, err, "store disappeared during reconciliation")

	_, cached := r.ensuredNamespaces.Load("deleted-ns")
	assert.False(t, cached)
	assert.Equal(t, int32(1), srv.deleteStoreCalls.Load())
}

func TestEnsureNamespace_CachesSuccessfulNamespace(t *testing.T) {
	// Store is missing on the initial check but present on the post-reconcile
	// verification → EnsureNamespace must succeed and cache the namespace.
	srv := &stubServer{getStoreResults: []*zanzana.StoreInfo{nil, {ID: "store-1", Name: "good-ns"}}}
	r := newReconcilerForTest(srv, notFoundClientFactory{})

	require.NoError(t, r.EnsureNamespace(context.Background(), "good-ns"))

	_, cached := r.ensuredNamespaces.Load("good-ns")
	assert.True(t, cached)
}

func TestEnsureNamespace_ShortCircuitsOnCachedNamespace(t *testing.T) {
	// Pre-populated cache → GetStore must never be called.
	srv := &stubServer{}
	r := newReconcilerForTest(srv, notFoundClientFactory{})
	r.ensuredNamespaces.Store("cached-ns", struct{}{})

	require.NoError(t, r.EnsureNamespace(context.Background(), "cached-ns"))
	assert.Equal(t, int32(0), srv.getStoreIdx.Load(), "GetStore should not be called for a cached namespace")
}

func TestEnsureNamespace_ExistingStoreIsCachedWithoutReconcile(t *testing.T) {
	// Store already exists → GetOrCreateStore and reconcile must be skipped,
	// but the namespace should still be cached.
	srv := &stubServer{getStoreResults: []*zanzana.StoreInfo{{ID: "store-1", Name: "existing-ns"}}}
	r := newReconcilerForTest(srv, notFoundClientFactory{})

	require.NoError(t, r.EnsureNamespace(context.Background(), "existing-ns"))

	_, cached := r.ensuredNamespaces.Load("existing-ns")
	assert.True(t, cached)
	assert.Equal(t, int32(0), srv.getOrCreateCalls.Load(), "GetOrCreateStore should not be called when store already exists")
}

func TestReconcileNamespace_EvictsCacheOnNotFound(t *testing.T) {
	// A previously cached namespace is evicted from ensuredNamespaces when the
	// background worker discovers the namespace is gone (NotFound).
	srv := &stubServer{}
	r := newReconcilerForTest(srv, notFoundClientFactory{})
	r.ensuredNamespaces.Store("evict-ns", struct{}{})

	_, err := r.reconcileNamespace(context.Background(), "evict-ns")
	require.NoError(t, err)

	_, cached := r.ensuredNamespaces.Load("evict-ns")
	assert.False(t, cached)
	assert.Equal(t, int32(1), srv.deleteStoreCalls.Load())
}

// drainWorkQueue reads every pending namespace out of the channel and returns
// them as a slice, blocking no longer than it takes to observe len(ch)==0.
func drainWorkQueue(ch chan string) []string {
	out := make([]string, 0, len(ch))
	for len(ch) > 0 {
		out = append(out, <-ch)
	}
	return out
}

func TestQueueAllNamespaces_SkipsAlreadyQueuedNamespaces(t *testing.T) {
	// When a previous cycle's namespaces are still sitting in the queue (or
	// being processed by a worker), a subsequent queueAllNamespaces call must
	// skip them rather than enqueue duplicates.
	srv := &stubServer{
		listAllStoresResults: []zanzana.StoreInfo{
			{Name: "ns-1"},
			{Name: "ns-2"},
			{Name: "ns-3"},
		},
	}
	r := newReconcilerForTest(srv, notFoundClientFactory{})
	r.workQueue = make(chan string, 10)

	// Pretend ns-1 and ns-2 are still in-flight from a previous cycle.
	r.queuedNamespaces.Store("ns-1", struct{}{})
	r.queuedNamespaces.Store("ns-2", struct{}{})

	r.queueAllNamespaces(context.Background())

	// Only ns-3 should have been enqueued; ns-1 and ns-2 were deduped.
	require.Equal(t, 1, len(r.workQueue))
	assert.Equal(t, "ns-3", <-r.workQueue)

	// All three namespaces are now "reserved" in queuedNamespaces: the two
	// pre-existing reservations plus the one we just made for ns-3.
	for _, ns := range []string{"ns-1", "ns-2", "ns-3"} {
		_, loaded := r.queuedNamespaces.Load(ns)
		assert.True(t, loaded, "expected %s to be reserved", ns)
	}
}

func TestQueueAllNamespaces_ReleasesReservationOnContextCancel(t *testing.T) {
	// If the producer blocks on a full workQueue and ctx is then cancelled,
	// the reservation it made via LoadOrStore must be released so a future
	// leadership term can enqueue the namespace again.
	srv := &stubServer{
		listAllStoresResults: []zanzana.StoreInfo{{Name: "ns-1"}},
	}
	r := newReconcilerForTest(srv, notFoundClientFactory{})

	// Buffer size 1, pre-filled so the only send inside queueAllNamespaces
	// blocks and must unblock via ctx.Done().
	r.workQueue = make(chan string, 1)
	r.workQueue <- "filler"

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	r.queueAllNamespaces(ctx)

	_, loaded := r.queuedNamespaces.Load("ns-1")
	assert.False(t, loaded, "ns-1 reservation should be released after cancel")

	// The filler is the only thing that should remain in the channel.
	assert.Equal(t, []string{"filler"}, drainWorkQueue(r.workQueue))
}

func TestQueueAllNamespaces_ReenqueuesAfterDedupEntryCleared(t *testing.T) {
	// Walks the full lifecycle across three ticks:
	//   tick 1: both namespaces enqueued fresh
	//   tick 2: workers haven't drained yet → nothing added (full dedup)
	//   tick 3: ns-1's reservation has been cleared → ns-1 re-enqueued, ns-2 still skipped
	srv := &stubServer{
		listAllStoresResults: []zanzana.StoreInfo{{Name: "ns-1"}, {Name: "ns-2"}},
	}
	r := newReconcilerForTest(srv, notFoundClientFactory{})
	r.workQueue = make(chan string, 10)

	r.queueAllNamespaces(context.Background())
	require.Equal(t, 2, len(r.workQueue))

	r.queueAllNamespaces(context.Background())
	require.Equal(t, 2, len(r.workQueue), "second tick must not add duplicates")

	// Simulate a worker finishing ns-1: pop from the channel and release
	// the dedup reservation.
	require.Equal(t, "ns-1", <-r.workQueue)
	r.queuedNamespaces.Delete("ns-1")

	r.queueAllNamespaces(context.Background())

	// Queue should now contain ns-2 (still from tick 1) and ns-1 (re-added on
	// tick 3). ns-2's reservation is still held, so it was not re-added.
	remaining := drainWorkQueue(r.workQueue)
	assert.ElementsMatch(t, []string{"ns-1", "ns-2"}, remaining)
}

func TestRunWorker_ClearsDedupEntryAfterReconcile(t *testing.T) {
	// The worker must remove the namespace from queuedNamespaces after
	// reconciliation completes, otherwise it would be permanently locked out
	// of future cycles.
	srv := &stubServer{}
	r := newReconcilerForTest(srv, notFoundClientFactory{})
	r.workQueue = make(chan string, 10)

	// Simulate queueAllNamespaces having reserved and enqueued ns-1.
	r.queuedNamespaces.Store("ns-1", struct{}{})
	r.workQueue <- "ns-1"

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan struct{})
	go func() {
		defer close(done)
		r.runWorker(ctx, 0)
	}()

	require.Eventually(t, func() bool {
		_, loaded := r.queuedNamespaces.Load("ns-1")
		return !loaded
	}, 2*time.Second, 10*time.Millisecond, "worker did not release ns-1 from queuedNamespaces")

	// notFoundClientFactory drives reconcileNamespace into its "namespace
	// deleted" branch, which calls DeleteStore exactly once.
	assert.Equal(t, int32(1), srv.deleteStoreCalls.Load())

	cancel()
	<-done
}
