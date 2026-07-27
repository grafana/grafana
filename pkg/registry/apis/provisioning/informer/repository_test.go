package informer

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/cache"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

func repo(namespace, name string) *provisioningapis.Repository {
	return &provisioningapis.Repository{ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name}}
}

// fakeStore is a minimal usinformer.Cache for exercising the store-backed getter.
type fakeStore struct {
	objs map[string]runtime.Object
}

func newFakeStore(objs ...*provisioningapis.Repository) *fakeStore {
	s := &fakeStore{objs: map[string]runtime.Object{}}
	for _, o := range objs {
		s.objs[o.Namespace+"/"+o.Name] = o
	}
	return s
}

func (s *fakeStore) Get(_ context.Context, namespace, name string) (runtime.Object, bool) {
	o, ok := s.objs[namespace+"/"+name]
	return o, ok
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
	delete(s.objs, namespace+"/"+name)
}

// A live repository notification warms the object into the Store and delivers it
// as the concrete *Repository the controller's handler expects.
func TestNewRepositoryInformer_DeliversRepositoryType(t *testing.T) {
	sub := newFakeSubscriber()
	rec := &typeRecorder{}
	gvr := provisioningapis.RepositoryResourceInfo.GroupVersionResource()

	// The informer warms by fetching, so the object must be readable from the API.
	inf := NewRepositoryInformer(sub, fake.NewClientset(repo(testNamespace, "repo-a")), testNamespace, time.Minute, usinformer.NewStore())
	_, err := inf.AddEventHandler(rec)
	require.NoError(t, err)
	stopCh := make(chan struct{})
	go inf.Run(stopCh)
	t.Cleanup(func() { close(stopCh) })

	subject := resourcewatch.Subject(gvr, testNamespace)
	require.Eventually(t, func() bool { return sub.subscribed(subject) }, 5*time.Second, 5*time.Millisecond)

	sub.publish(t, subject, &resourcepb.WatchNotification{
		Type: resourcepb.WatchNotification_MODIFIED, Group: gvr.Group, Resource: gvr.Resource,
		Namespace: testNamespace, Name: "repo-a",
	})

	require.Eventually(t, func() bool { return rec.last() != nil }, 5*time.Second, 5*time.Millisecond)
	got, ok := rec.last().(*provisioningapis.Repository)
	require.True(t, ok, "expected *Repository, got %T", rec.last())
	assert.Equal(t, "repo-a", got.Name)
	assert.Equal(t, testNamespace, got.Namespace)
}

// The cached getter reads the informer's lister for both Get and List.
func TestNewCachedRepositoryGetter(t *testing.T) {
	indexer := cache.NewIndexer(cache.MetaNamespaceKeyFunc, cache.Indexers{cache.NamespaceIndex: cache.MetaNamespaceIndexFunc})
	require.NoError(t, indexer.Add(repo(testNamespace, "a")))
	require.NoError(t, indexer.Add(repo(testNamespace, "b")))
	require.NoError(t, indexer.Add(repo("other", "c")))
	getter := NewCachedRepositoryGetter(listers.NewRepositoryLister(indexer))

	got, err := getter.Get(context.Background(), testNamespace, "a")
	require.NoError(t, err)
	assert.Equal(t, "a", got.Name)

	list, err := getter.List(context.Background(), testNamespace)
	require.NoError(t, err)
	assert.Len(t, list, 2, "List must be scoped to the namespace")
}

// The store getter serves Get from the informer's warmed Store.
func TestStoreRepositoryGetter_GetReadsStore(t *testing.T) {
	g := NewStoreRepositoryGetter(newFakeStore(repo("ns", "present")))

	got, err := g.Get(context.Background(), "ns", "present")
	require.NoError(t, err)
	assert.Equal(t, "present", got.Name)
}

// An object absent from the warmed Store is an authoritative NotFound: the
// informer only dispatches after warming, so absence means genuinely gone.
func TestStoreRepositoryGetter_GetMissingReturnsNotFound(t *testing.T) {
	g := NewStoreRepositoryGetter(newFakeStore())

	_, err := g.Get(context.Background(), "ns", "gone")
	assert.True(t, apierrors.IsNotFound(err))
}

// List reads only the requested namespace out of the store.
func TestStoreRepositoryGetter_ListFiltersNamespace(t *testing.T) {
	g := NewStoreRepositoryGetter(newFakeStore(repo("ns-a", "one"), repo("ns-a", "two"), repo("ns-b", "other")))

	list, err := g.List(context.Background(), "ns-a")
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

// The delta source's getter is store-backed under NATS (reads the informer's
// warmed Store) and cache-backed otherwise (reads the informer's lister).
func TestNewRepositoryDeltaSource(t *testing.T) {
	client := fake.NewClientset(repo(testNamespace, "r"))

	t.Run("nats enabled reads the warmed store", func(t *testing.T) {
		source, getter := NewRepositoryDeltaSource(newFakeSubscriber(), client, time.Minute)
		inf := source.(*usinformer.Informer)
		stopCh := make(chan struct{})
		go inf.Run(stopCh)
		t.Cleanup(func() { close(stopCh) })
		// The initial re-list warms the Store; then the getter reads it.
		require.Eventually(t, func() bool { return inf.HasSynced() }, 5*time.Second, 5*time.Millisecond)

		got, err := getter.Get(context.Background(), testNamespace, "r")
		require.NoError(t, err)
		assert.Equal(t, "r", got.Name)
	})

	t.Run("nats disabled reads the informer cache", func(t *testing.T) {
		_, getter := NewRepositoryDeltaSource(nil, client, time.Minute)
		// The cache getter reads the (empty, unsynced) informer lister, so the
		// object present in the API is not found — proving it does not hit the API.
		_, err := getter.Get(context.Background(), testNamespace, "r")
		assert.True(t, apierrors.IsNotFound(err))
	})
}
