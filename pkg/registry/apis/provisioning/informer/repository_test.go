package informer

import (
	"context"
	"strconv"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8stesting "k8s.io/client-go/testing"
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

// A live repository notification is delivered as the concrete *Repository the
// controller's handler expects, built from the notification's identity.
func TestNewRepositoryInformer_DeliversRepositoryType(t *testing.T) {
	sub := newFakeSubscriber()
	rec := &typeRecorder{}
	gvr := provisioningapis.RepositoryResourceInfo.GroupVersionResource()

	inf := NewRepositoryInformer(sub, fake.NewClientset(), testNamespace, time.Minute, usinformer.NewStore())
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

// A successful reconcile Get returns the fresh object and writes it back into the
// store, so a later List (the quota count) reflects it without waiting for a
// re-list.
func TestClientGetCachedListRepositoryGetter_GetWritesThrough(t *testing.T) {
	client := fake.NewClientset(repo("ns", "fresh"))
	store := newFakeStore()
	g := NewClientGetCachedListRepositoryGetter(client.ProvisioningV0alpha1(), store, nil)

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
func TestClientGetCachedListRepositoryGetter_GetNotFoundRemoves(t *testing.T) {
	client := fake.NewClientset()
	store := newFakeStore(repo("ns", "stale"))
	g := NewClientGetCachedListRepositoryGetter(client.ProvisioningV0alpha1(), store, nil)

	_, err := g.Get(context.Background(), "ns", "stale")
	require.True(t, apierrors.IsNotFound(err))
	assert.Equal(t, []string{"ns/stale"}, store.deleted)

	list, err := g.List(context.Background(), "ns")
	require.NoError(t, err)
	assert.Empty(t, list, "the vanished object must be removed from the store")
}

// List reads only the requested namespace out of the store.
func TestClientGetCachedListRepositoryGetter_ListFiltersNamespace(t *testing.T) {
	store := newFakeStore(repo("ns-a", "one"), repo("ns-a", "two"), repo("ns-b", "other"))
	g := NewClientGetCachedListRepositoryGetter(fake.NewClientset().ProvisioningV0alpha1(), store, nil)

	list, err := g.List(context.Background(), "ns-a")
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

// Realistic snowflake-range resource versions (above the legacy threshold), so
// the tests exercise the same numeric space production RVs live in.
const (
	rvStale = int64(200000000000000000)
	rvFresh = int64(300000000000000000)
)

func repoWithRV(namespace, name string, rv int64) *provisioningapis.Repository {
	r := repo(namespace, name)
	r.ResourceVersion = strconv.FormatInt(rv, 10)
	return r
}

// A reconcile Get below the announced floor is not returned: the getter re-reads
// until the API serves the announced version, then settles the floor.
func TestClientGetCachedListRepositoryGetter_WaitsForAnnouncedVersion(t *testing.T) {
	client := fake.NewClientset()
	var reads atomic.Int32
	client.PrependReactor("get", "repositories", func(k8stesting.Action) (bool, runtime.Object, error) {
		if reads.Add(1) == 1 {
			return true, repoWithRV("ns", "r", rvStale), nil
		}
		return true, repoWithRV("ns", "r", rvFresh), nil
	})

	floor := NewRVFloor()
	floor.Raise("ns", "r", rvFresh)
	store := newFakeStore()
	g := clientGetCachedListRepositoryGetter{client: client.ProvisioningV0alpha1(), store: store, floor: floor, retries: 3}

	got, err := g.Get(context.Background(), "ns", "r")
	require.NoError(t, err)
	assert.Equal(t, strconv.FormatInt(rvFresh, 10), got.ResourceVersion)
	assert.EqualValues(t, 2, reads.Load(), "the stale first read must be retried")
	assert.Zero(t, floor.Floor("ns", "r"), "a met floor must settle")

	list, err := g.List(context.Background(), "ns")
	require.NoError(t, err)
	require.Len(t, list, 1, "only the fresh read may be written back to the snapshot")
}

// A read that never catches up to the floor surfaces ErrStaleRead (so the
// controller requeues the key) instead of handing the reconcile stale state.
func TestClientGetCachedListRepositoryGetter_StaleReadExhaustsToError(t *testing.T) {
	client := fake.NewClientset(repoWithRV("ns", "r", rvStale))
	floor := NewRVFloor()
	floor.Raise("ns", "r", rvFresh)
	g := clientGetCachedListRepositoryGetter{client: client.ProvisioningV0alpha1(), store: newFakeStore(), floor: floor, retries: 3}

	_, err := g.Get(context.Background(), "ns", "r")
	require.ErrorIs(t, err, ErrStaleRead)
	assert.Equal(t, rvFresh, floor.Floor("ns", "r"), "an unmet floor must stay for the retry")
}

// A 404 while an event announced the object exists is a stale read, not a
// delete: the getter must not trust it (or evict the snapshot on it).
func TestClientGetCachedListRepositoryGetter_NotFoundBelowFloorIsStale(t *testing.T) {
	client := fake.NewClientset()
	floor := NewRVFloor()
	floor.Raise("ns", "r", rvFresh)
	store := newFakeStore(repoWithRV("ns", "r", rvStale))
	g := clientGetCachedListRepositoryGetter{client: client.ProvisioningV0alpha1(), store: store, floor: floor, retries: 3}

	_, err := g.Get(context.Background(), "ns", "r")
	require.ErrorIs(t, err, ErrStaleRead)
	assert.False(t, apierrors.IsNotFound(err), "the NotFound must not leak through as a trusted delete")
	assert.Empty(t, store.deleted, "an ambiguous 404 must not evict the snapshot")
}

// The NATS wiring shares one floor between the delta source and the getter: a
// notification's resource version becomes the minimum a reconcile read must
// reach, and the getter unblocks once the API serves it.
func TestNewRepositoryDeltaSource_EnforcesNotificationVersion(t *testing.T) {
	// The API serves the stale version until the test flips caughtUp, standing in
	// for a read path that lags the committed write behind the notification.
	var caughtUp atomic.Bool
	client := fake.NewClientset()
	client.PrependReactor("get", "repositories", func(k8stesting.Action) (bool, runtime.Object, error) {
		if caughtUp.Load() {
			return true, repoWithRV(testNamespace, "r", rvFresh), nil
		}
		return true, repoWithRV(testNamespace, "r", rvStale), nil
	})
	sub := newFakeSubscriber()
	source, getter := NewRepositoryDeltaSource(sub, client, time.Minute)

	rec := &typeRecorder{}
	_, err := source.AddEventHandler(rec)
	require.NoError(t, err)
	stopCh := make(chan struct{})
	go source.Run(stopCh)
	t.Cleanup(func() { close(stopCh) })

	gvr := provisioningapis.RepositoryResourceInfo.GroupVersionResource()
	subject := resourcewatch.Subject(gvr, "")
	require.Eventually(t, func() bool { return sub.subscribed(subject) }, 5*time.Second, 5*time.Millisecond)

	// The notification announces a version ahead of what the API serves: the
	// reconcile read must not return the stale object.
	sub.publish(t, subject, &resourcepb.WatchNotification{
		Type: resourcepb.WatchNotification_MODIFIED, Group: gvr.Group, Resource: gvr.Resource,
		Namespace: testNamespace, Name: "r", ResourceVersion: rvFresh,
	})
	_, err = getter.Get(context.Background(), testNamespace, "r")
	require.ErrorIs(t, err, ErrStaleRead)

	// Once the API catches up, the same floor is met and the read goes through.
	caughtUp.Store(true)
	got, err := getter.Get(context.Background(), testNamespace, "r")
	require.NoError(t, err)
	assert.Equal(t, strconv.FormatInt(rvFresh, 10), got.ResourceVersion)
}

// The delta source's getter is client-backed under NATS (reads fresh from the
// API) and cache-backed otherwise (reads the informer's lister, not the API).
func TestNewRepositoryDeltaSource(t *testing.T) {
	client := fake.NewClientset(repo(testNamespace, "r"))

	t.Run("nats enabled reads fresh from the API", func(t *testing.T) {
		_, getter := NewRepositoryDeltaSource(newFakeSubscriber(), client, time.Minute)
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
