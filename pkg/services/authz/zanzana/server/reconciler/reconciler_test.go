package reconciler

import (
	"context"
	"sync/atomic"
	"testing"

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
}

func (s *stubServer) Close()                              {}
func (s *stubServer) RunReconciler(context.Context) error { return nil }
func (s *stubServer) ListAllStores(context.Context) ([]zanzana.StoreInfo, error) {
	return nil, nil
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
