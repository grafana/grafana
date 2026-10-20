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

func repoAt(namespace, name, rv string) *provisioningapis.Repository {
	r := repo(namespace, name)
	r.ResourceVersion = rv
	return r
}

// terminating marks a repository as deleted but not yet gone.
func terminating(r *provisioningapis.Repository) *provisioningapis.Repository {
	now := metav1.Now()
	r.DeletionTimestamp = &now
	return r
}

// seededStore fills a real store the way the re-list does, with identities.
func seededStore(objs ...*provisioningapis.Repository) usinformer.Store {
	store := usinformer.NewStore()
	projected := make([]runtime.Object, 0, len(objs))
	for _, obj := range objs {
		projected = append(projected, obj)
	}
	store.Replace(projectObjects(projected), 1)
	return store
}

// A live repository notification is delivered as an identity, the same shape the
// re-list stores.
func TestNewRepositoryInformer_DeliversTheProjection(t *testing.T) {
	sub := newFakeSubscriber()
	rec := &typeRecorder{}
	gvr := provisioningapis.RepositoryResourceInfo.GroupVersionResource()

	inf := NewRepositoryInformer(sub, fake.NewClientset(), testNamespace, time.Minute, usinformer.NewStore(), nil, RelistRecorder{})
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
	got, ok := rec.last().(*metav1.PartialObjectMetadata)
	require.True(t, ok, "expected a projection, got %T", rec.last())
	assert.Equal(t, "repo-a", got.Name)
	assert.Equal(t, testNamespace, got.Namespace)
}

// The cached getter reads the informer's lister for both Get and the count.
func TestNewCachedRepositoryGetter(t *testing.T) {
	indexer := cache.NewIndexer(cache.MetaNamespaceKeyFunc, cache.Indexers{cache.NamespaceIndex: cache.MetaNamespaceIndexFunc})
	require.NoError(t, indexer.Add(repo(testNamespace, "a")))
	require.NoError(t, indexer.Add(terminating(repo(testNamespace, "going"))))
	require.NoError(t, indexer.Add(repo("other", "c")))
	getter := NewCachedRepositoryGetter(listers.NewRepositoryLister(indexer))

	got, err := getter.Get(context.Background(), testNamespace, "a")
	require.NoError(t, err)
	assert.Equal(t, "a", got.Name)

	count, err := getter.CountRepositories(context.Background(), testNamespace)
	require.NoError(t, err)
	assert.Equal(t, 2, count, "scoped to the namespace, and a repository awaiting its finalizers still counts")

	confirmed, err := getter.ConfirmRepositoryCount(context.Background(), testNamespace)
	require.NoError(t, err)
	assert.Equal(t, count, confirmed, "the apiserver watch reaches every replica, so the lister already is the confirmation")
}

// The client getter reads the reconcile's object fresh from the API.
func TestClientRepositoryGetter_GetReadsTheAPI(t *testing.T) {
	full := repoAt("ns", "fresh", "7")
	full.Spec.Title = "a title"
	g := NewClientRepositoryGetter(fake.NewClientset(full).ProvisioningV0alpha1(), usinformer.NewStore(), nil, nil)

	got, err := g.Get(context.Background(), "ns", "fresh")
	require.NoError(t, err)
	assert.Equal(t, "a title", got.Spec.Title, "the reconcile gets the whole object")

	_, err = g.Get(context.Background(), "ns", "missing")
	assert.True(t, apierrors.IsNotFound(err))
}

// A reconcile Get writes the identity it read into the store, so the count
// reflects the repository under reconciliation even when this replica never
// stored it. A NotFound leaves the store alone: eviction is the informer's job
// (a dated live delete or the next re-list), and the count tolerates the gap.
func TestClientRepositoryGetter_GetWritesThrough(t *testing.T) {
	store := usinformer.NewStore()
	g := NewClientRepositoryGetter(fake.NewClientset(repoAt("ns", "fresh", "7")).ProvisioningV0alpha1(), store, nil, nil)

	_, err := g.Get(context.Background(), "ns", "fresh")
	require.NoError(t, err)
	assert.Equal(t, []string{"ns/fresh@7"}, identities(t, store.List(context.Background())), "an identity, not the whole object")

	store.Update(context.Background(), identity("ns", "gone", "3"))
	_, err = g.Get(context.Background(), "ns", "gone")
	require.True(t, apierrors.IsNotFound(err))
	assert.ElementsMatch(t, []string{"ns/fresh@7", "ns/gone@3"}, identities(t, store.List(context.Background())),
		"the getter must not evict on a NotFound it cannot date")
}

// The confirmed count reads the API, not the store.
func TestClientRepositoryGetter_ConfirmCountListsTheAPI(t *testing.T) {
	client := fake.NewClientset(repo("ns-a", "one"), repo("ns-a", "two"), repo("ns-b", "other"))
	g := NewClientRepositoryGetter(client.ProvisioningV0alpha1(), usinformer.NewStore(), nil, nil)

	cached, err := g.CountRepositories(context.Background(), "ns-a")
	require.NoError(t, err)
	assert.Zero(t, cached, "the store has seen none of them")

	confirmed, err := g.ConfirmRepositoryCount(context.Background(), "ns-a")
	require.NoError(t, err)
	assert.Equal(t, 2, confirmed, "scoped to the namespace")
}

// The count reads only the requested namespace out of the cluster-wide store, and
// it agrees with the cached getter: a repository awaiting its finalizers counts,
// which is what lets the store hold identities alone.
func TestClientRepositoryGetter_CountFiltersNamespace(t *testing.T) {
	store := seededStore(repo("ns-a", "one"), repo("ns-a", "two"), terminating(repo("ns-a", "going")), repo("ns-b", "other"))
	g := NewClientRepositoryGetter(fake.NewClientset().ProvisioningV0alpha1(), store, nil, nil)

	count, err := g.CountRepositories(context.Background(), "ns-a")
	require.NoError(t, err)
	assert.Equal(t, 3, count)
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
// until the API serves the announced version, then keeps it as the watermark.
func TestClientRepositoryGetter_WaitsForAnnouncedVersion(t *testing.T) {
	client := fake.NewClientset()
	var reads atomic.Int32
	client.PrependReactor("get", "repositories", func(k8stesting.Action) (bool, runtime.Object, error) {
		if reads.Add(1) == 1 {
			return true, repoWithRV("ns", "r", rvStale), nil
		}
		return true, repoWithRV("ns", "r", rvFresh), nil
	})

	floor := usinformer.NewRVFloor()
	floor.Raise("ns", "r", rvFresh)
	store := usinformer.NewStore()
	g := clientRepositoryGetter{client: client.ProvisioningV0alpha1(), store: store,
		reader: usinformer.FreshReader{Floor: floor, Retries: 3}}

	got, err := g.Get(context.Background(), "ns", "r")
	require.NoError(t, err)
	assert.Equal(t, strconv.FormatInt(rvFresh, 10), got.ResourceVersion)
	assert.EqualValues(t, 2, reads.Load(), "the stale first read must be retried")
	assert.Equal(t, rvFresh, floor.Floor("ns", "r"), "the floor persists as the observed watermark")

	assert.Equal(t, []string{"ns/r@" + strconv.FormatInt(rvFresh, 10)}, identities(t, store.List(context.Background())),
		"only the fresh read may be written back to the snapshot")
}

// A 404 while an event announced the object exists is a stale read, not a
// delete: the getter must not trust it (or evict the snapshot on it).
func TestClientRepositoryGetter_NotFoundBelowFloorIsStale(t *testing.T) {
	client := fake.NewClientset()
	floor := usinformer.NewRVFloor()
	floor.Raise("ns", "r", rvFresh)
	store := seededStore(repoWithRV("ns", "r", rvStale))
	g := clientRepositoryGetter{client: client.ProvisioningV0alpha1(), store: store,
		reader: usinformer.FreshReader{Floor: floor, Retries: 3}}

	_, err := g.Get(context.Background(), "ns", "r")
	require.ErrorIs(t, err, usinformer.ErrStaleRead)
	assert.False(t, apierrors.IsNotFound(err), "the NotFound must not leak through as a trusted delete")
	assert.Len(t, store.List(context.Background()), 1, "an ambiguous 404 must not touch the snapshot")
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
	source, getter := NewRepositoryDeltaSource(sub, client, nil, time.Minute, nil, nil)

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
	require.ErrorIs(t, err, usinformer.ErrStaleRead)

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
		_, getter := NewRepositoryDeltaSource(newFakeSubscriber(), client, nil, time.Minute, nil, nil)
		got, err := getter.Get(context.Background(), testNamespace, "r")
		require.NoError(t, err)
		assert.Equal(t, "r", got.Name)
	})

	t.Run("nats disabled reads the informer cache", func(t *testing.T) {
		_, getter := NewRepositoryDeltaSource(nil, client, nil, time.Minute, nil, nil)
		// The cache getter reads the (empty, unsynced) informer lister, so the
		// object present in the API is not found — proving it does not hit the API.
		_, err := getter.Get(context.Background(), testNamespace, "r")
		assert.True(t, apierrors.IsNotFound(err))
	})
}
