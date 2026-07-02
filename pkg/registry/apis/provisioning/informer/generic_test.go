package informer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	typedclient "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// fakeStore is a minimal usinformer.Cache for asserting the client getter's
// write-through behaviour.
type fakeStore struct {
	objs    map[string]runtime.Object
	deleted []string
}

func newFakeStore(objs ...*provisioningapis.Repository) *fakeStore {
	s := &fakeStore{objs: map[string]runtime.Object{}}
	for _, o := range objs {
		s.objs[o.Namespace+"/"+o.Name] = o
	}
	return s
}

func (s *fakeStore) List(_ context.Context) []runtime.Object {
	out := make([]runtime.Object, 0, len(s.objs))
	for _, o := range s.objs {
		out = append(out, o)
	}
	return out
}

func (s *fakeStore) Update(_ context.Context, obj runtime.Object) {
	r := obj.(*provisioningapis.Repository)
	s.objs[r.Namespace+"/"+r.Name] = r
}

func (s *fakeStore) Delete(_ context.Context, namespace, name string) {
	key := namespace + "/" + name
	delete(s.objs, key)
	s.deleted = append(s.deleted, key)
}

// clientRepositoryGetter is the client-backed, store-write-through Getter the
// NATS delta source embeds — reconstructed here so its behaviour is tested
// directly against the generic Getter rather than through the delta source.
func clientRepositoryGetter(c typedclient.ProvisioningV0alpha1Interface, store usinformer.Cache) Getter[*provisioningapis.Repository] {
	return Getter[*provisioningapis.Repository]{
		get: func(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
			return c.Repositories(namespace).Get(ctx, name, metav1.GetOptions{})
		},
		store: store,
	}
}

// A successful reconcile Get returns the fresh object and writes it back into the
// store, so a later List (the quota count) reflects it without waiting for a
// re-list.
func TestGetter_ClientGetWritesThrough(t *testing.T) {
	client := fake.NewClientset(repo("ns", "fresh"))
	store := newFakeStore()
	g := clientRepositoryGetter(client.ProvisioningV0alpha1(), store)

	got, err := g.Get(context.Background(), "ns", "fresh")
	require.NoError(t, err)
	assert.Equal(t, "fresh", got.Name)

	list, err := g.List(context.Background(), "ns")
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, "fresh", list[0].Name, "the fresh Get must be reflected in the store")
}

// A reconcile Get for a vanished object returns NotFound and removes it from the
// store, so the count drops it without waiting for a re-list.
func TestGetter_ClientGetNotFoundRemoves(t *testing.T) {
	client := fake.NewClientset()
	store := newFakeStore(repo("ns", "stale"))
	g := clientRepositoryGetter(client.ProvisioningV0alpha1(), store)

	_, err := g.Get(context.Background(), "ns", "stale")
	require.True(t, apierrors.IsNotFound(err))
	assert.Equal(t, []string{"ns/stale"}, store.deleted)

	list, err := g.List(context.Background(), "ns")
	require.NoError(t, err)
	assert.Empty(t, list, "the vanished object must be removed from the store")
}

// The store-backed List reads only the requested namespace.
func TestGetter_StoreListFiltersNamespace(t *testing.T) {
	store := newFakeStore(repo("ns-a", "one"), repo("ns-a", "two"), repo("ns-b", "other"))
	g := clientRepositoryGetter(fake.NewClientset().ProvisioningV0alpha1(), store)

	list, err := g.List(context.Background(), "ns-a")
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

// A Get-only Getter (no list, no store — the Connection NATS shape) returns
// nothing from List rather than panicking on a nil store.
func TestGetter_GetOnlyListReturnsNothing(t *testing.T) {
	g := Getter[*provisioningapis.Connection]{
		get: func(context.Context, string, string) (*provisioningapis.Connection, error) { return nil, nil },
	}
	list, err := g.List(context.Background(), "ns")
	require.NoError(t, err)
	assert.Empty(t, list)
}
