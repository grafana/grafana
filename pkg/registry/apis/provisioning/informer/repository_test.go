package informer

import (
	"context"
	"errors"
	"strconv"
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
	keysapi "github.com/grafana/grafana/pkg/registry/apis/keys"
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

// terminating marks a repository as deleted but not yet gone, the state the
// quota count has to keep seeing across a re-list.
func terminating(r *provisioningapis.Repository) *provisioningapis.Repository {
	now := metav1.Now()
	r.DeletionTimestamp = &now
	return r
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

	count, err := getter.CountActiveRepositories(context.Background(), testNamespace)
	require.NoError(t, err)
	assert.Equal(t, 2, count, "the count must be scoped to the namespace")
}

// The quota count is the reason the snapshot carries a deletionTimestamp at all:
// a repository awaiting its finalizers is still stored, and must not be counted.
func TestCachedRepositoryGetter_CountExcludesTerminating(t *testing.T) {
	indexer := cache.NewIndexer(cache.MetaNamespaceKeyFunc, cache.Indexers{cache.NamespaceIndex: cache.MetaNamespaceIndexFunc})
	require.NoError(t, indexer.Add(repo(testNamespace, "active")))
	require.NoError(t, indexer.Add(terminating(repo(testNamespace, "going"))))
	getter := NewCachedRepositoryGetter(listers.NewRepositoryLister(indexer))

	count, err := getter.CountActiveRepositories(context.Background(), testNamespace)
	require.NoError(t, err)
	assert.Equal(t, 1, count)
}

// A successful reconcile Get returns the fresh object and writes it back into the
// store, so a later List (the quota count) reflects it without waiting for a
// re-list.
func TestClientGetCachedListRepositoryGetter_GetWritesThrough(t *testing.T) {
	client := fake.NewClientset(repo("ns", "fresh"))
	store := newFakeStore()
	g := NewClientGetCachedListRepositoryGetter(client.ProvisioningV0alpha1(), store)

	got, err := g.Get(context.Background(), "ns", "fresh")
	require.NoError(t, err)
	assert.Equal(t, "fresh", got.Name)

	count, err := g.CountActiveRepositories(context.Background(), "ns")
	require.NoError(t, err)
	assert.Equal(t, 1, count, "the fresh Get must be reflected in the store")
}

// The write-through is trimmed like the re-list, so a warm snapshot costs the
// same as a re-listed one and the store holds one shape either way.
func TestClientGetCachedListRepositoryGetter_GetWritesThroughTrimmed(t *testing.T) {
	full := repoAt("ns", "fresh", "7")
	full.Spec.Title = "a title nobody reading the snapshot needs"
	full.Finalizers = []string{"provisioning.grafana.app/cleanup"}
	client := fake.NewClientset(full)
	store := newFakeStore()
	g := NewClientGetCachedListRepositoryGetter(client.ProvisioningV0alpha1(), store)

	got, err := g.Get(context.Background(), "ns", "fresh")
	require.NoError(t, err)
	assert.Equal(t, "a title nobody reading the snapshot needs", got.Spec.Title, "the reconcile still gets the whole object")

	stored, ok := store.objs["ns/fresh"].(*provisioningapis.Repository)
	require.True(t, ok)
	assert.Empty(t, stored.Spec.Title, "the body must not be retained in the snapshot")
	assert.Empty(t, stored.Finalizers)
	assert.Equal(t, "7", stored.ResourceVersion, "the Store diffs on this")
}

// A reconcile Get for a vanished object returns NotFound and removes it from the
// store, so the count drops it without waiting for a re-list.
func TestClientGetCachedListRepositoryGetter_GetNotFoundRemoves(t *testing.T) {
	client := fake.NewClientset()
	store := newFakeStore(repo("ns", "stale"))
	g := NewClientGetCachedListRepositoryGetter(client.ProvisioningV0alpha1(), store)

	_, err := g.Get(context.Background(), "ns", "stale")
	require.True(t, apierrors.IsNotFound(err))
	assert.Equal(t, []string{"ns/stale"}, store.deleted)

	count, err := g.CountActiveRepositories(context.Background(), "ns")
	require.NoError(t, err)
	assert.Zero(t, count, "the vanished object must be removed from the store")
}

// The count reads only the requested namespace out of the cluster-wide snapshot,
// and skips repositories awaiting their finalizers.
func TestClientGetCachedListRepositoryGetter_CountFiltersNamespaceAndTerminating(t *testing.T) {
	store := newFakeStore(repo("ns-a", "one"), repo("ns-a", "two"), terminating(repo("ns-a", "going")), repo("ns-b", "other"))
	g := NewClientGetCachedListRepositoryGetter(fake.NewClientset().ProvisioningV0alpha1(), store)

	count, err := g.CountActiveRepositories(context.Background(), "ns-a")
	require.NoError(t, err)
	assert.Equal(t, 2, count)
}

// The delta source's getter is client-backed under NATS (reads fresh from the
// API) and cache-backed otherwise (reads the informer's lister, not the API).
func TestNewRepositoryDeltaSource(t *testing.T) {
	client := fake.NewClientset(repo(testNamespace, "r"))

	t.Run("nats enabled reads fresh from the API", func(t *testing.T) {
		_, getter := NewRepositoryDeltaSource(newFakeSubscriber(), client, nil, time.Minute, nil)
		got, err := getter.Get(context.Background(), testNamespace, "r")
		require.NoError(t, err)
		assert.Equal(t, "r", got.Name)
	})

	t.Run("nats disabled reads the informer cache", func(t *testing.T) {
		_, getter := NewRepositoryDeltaSource(nil, client, nil, time.Minute, nil)
		// The cache getter reads the (empty, unsynced) informer lister, so the
		// object present in the API is not found — proving it does not hit the API.
		_, err := getter.Get(context.Background(), testNamespace, "r")
		assert.True(t, apierrors.IsNotFound(err))
	})
}

// The whole point of the projection: a repository whose resource version has not
// moved is carried forward from the previous snapshot, keeping the
// deletionTimestamp the projection cannot carry. The API copy here has no
// deletionTimestamp, so a read-back would silently resurrect it into the quota
// count.
func TestRepositoryList_CarriesUnchangedForward(t *testing.T) {
	store := newFakeStore(terminating(repoAt("ns", "going", "10")))
	keys := &stubKeysLister{listRV: 100, keys: []keysapi.Key{{Namespace: "ns", Name: "going", ResourceVersion: "10"}}}
	client := fake.NewClientset(repoAt("ns", "going", "10"))

	recorder, reg := newTestRecorder(repoGVR)
	objs, listRV, err := repositoryList(client.ProvisioningV0alpha1(), "", keys, store, recorder)(t.Context())
	require.NoError(t, err)

	assert.Equal(t, int64(100), listRV)
	require.Len(t, objs, 1)
	got, ok := objs[0].(*provisioningapis.Repository)
	require.True(t, ok)
	assert.NotNil(t, got.DeletionTimestamp, "the stored deletionTimestamp must survive the re-list")
	assert.Equal(t, float64(1), projectionCount(t, reg, repoGVR, "keys"))
	assert.Zero(t, hydrationCount(t, reg, repoGVR), "an unchanged key must not be read back")
}

// A key whose resource version moved is read back, which is how a soft delete
// reaches the snapshot: the live MODIFIED event is deliberately not written
// through, so the re-list is what notices.
func TestRepositoryList_ReadsBackDrifted(t *testing.T) {
	store := newFakeStore(repoAt("ns", "going", "10"), repoAt("ns", "steady", "10"))
	keys := &stubKeysLister{listRV: 100, keys: []keysapi.Key{
		{Namespace: "ns", Name: "going", ResourceVersion: "11"},
		{Namespace: "ns", Name: "steady", ResourceVersion: "10"},
	}}
	client := fake.NewClientset(terminating(repoAt("ns", "going", "11")), repoAt("ns", "steady", "10"))

	recorder, reg := newTestRecorder(repoGVR)
	objs, _, err := repositoryList(client.ProvisioningV0alpha1(), "", keys, store, recorder)(t.Context())
	require.NoError(t, err)

	byName := map[string]*provisioningapis.Repository{}
	for _, obj := range objs {
		r, ok := obj.(*provisioningapis.Repository)
		require.True(t, ok)
		byName[r.Name] = r
	}
	require.Len(t, byName, 2)
	assert.NotNil(t, byName["going"].DeletionTimestamp, "the read-back must pick up the soft delete")
	assert.Equal(t, "11", byName["going"].ResourceVersion)
	assert.Nil(t, byName["steady"].DeletionTimestamp)
	assert.Equal(t, float64(1), projectionCount(t, reg, repoGVR, "keys"))
	assert.Equal(t, float64(1), hydrationCount(t, reg, repoGVR), "only the drifted key is read back")
}

// An empty snapshot has nothing to carry forward, so every key would be a
// read-back: one list is cheaper. This is the initial list.
func TestRepositoryList_EmptyStoreListsFullObjects(t *testing.T) {
	keys := &stubKeysLister{listRV: 100, keys: []keysapi.Key{{Namespace: "ns", Name: "a", ResourceVersion: "10"}}}
	client := fake.NewClientset(repoAt("ns", "from-full-list", "10"))

	recorder, reg := newTestRecorder(repoGVR)
	objs, _, err := repositoryList(client.ProvisioningV0alpha1(), "", keys, newFakeStore(), recorder)(t.Context())
	require.NoError(t, err)

	assert.Zero(t, keys.called, "the keys list is not worth asking for with nothing to compare against")
	assert.Equal(t, []string{"from-full-list"}, repoNames(t, objs))
	assert.Equal(t, float64(1), projectionCount(t, reg, repoGVR, "objects"))
	assert.Zero(t, hydrationCount(t, reg, repoGVR))
}

// Past the cap, reading each one back costs more than listing everything.
func TestRepositoryList_TooManyDriftedListsFullObjects(t *testing.T) {
	drifted := make([]keysapi.Key, 0, maxHydrations+1)
	for i := range maxHydrations + 1 {
		drifted = append(drifted, keysapi.Key{Namespace: "ns", Name: "r" + strconv.Itoa(i), ResourceVersion: "11"})
	}
	keys := &stubKeysLister{listRV: 100, keys: drifted}
	client := fake.NewClientset(repoAt("ns", "from-full-list", "10"))

	recorder, reg := newTestRecorder(repoGVR)
	objs, _, err := repositoryList(client.ProvisioningV0alpha1(), "", keys, newFakeStore(repoAt("ns", "seed", "10")), recorder)(t.Context())
	require.NoError(t, err)

	assert.Equal(t, []string{"from-full-list"}, repoNames(t, objs))
	assert.Equal(t, float64(1), projectionCount(t, reg, repoGVR, "objects"))
	assert.Zero(t, hydrationCount(t, reg, repoGVR), "the cap is checked before any read-back")
}

// Hard-deleted between the keys list and the read-back. Leaving it out is right:
// the Store's diff reports the removal from the snapshot's silence.
func TestRepositoryList_ReadBackNotFoundDropsTheKey(t *testing.T) {
	store := newFakeStore(repoAt("ns", "kept", "10"), repoAt("ns", "gone", "10"))
	keys := &stubKeysLister{listRV: 100, keys: []keysapi.Key{
		{Namespace: "ns", Name: "kept", ResourceVersion: "10"},
		{Namespace: "ns", Name: "gone", ResourceVersion: "11"},
	}}
	client := fake.NewClientset(repoAt("ns", "kept", "10"))

	recorder, reg := newTestRecorder(repoGVR)
	objs, _, err := repositoryList(client.ProvisioningV0alpha1(), "", keys, store, recorder)(t.Context())
	require.NoError(t, err, "a vanished repository is not a reason to fail the tick")

	assert.Equal(t, []string{"kept"}, repoNames(t, objs))
	assert.Equal(t, float64(1), projectionCount(t, reg, repoGVR, "keys"))
}

// A failed read-back must not drop the key: the Store cannot tell a missing key
// from a delete, so it would dispatch a spurious OnDelete. Take the
// authoritative list instead.
func TestRepositoryList_ReadBackErrorListsFullObjects(t *testing.T) {
	store := newFakeStore(repoAt("ns", "a", "10"))
	keys := &stubKeysLister{listRV: 100, keys: []keysapi.Key{{Namespace: "ns", Name: "a", ResourceVersion: "11"}}}
	client := fake.NewClientset(repoAt("ns", "from-full-list", "10"))
	client.PrependReactor("get", "repositories", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.New("apiserver unavailable")
	})

	recorder, reg := newTestRecorder(repoGVR)
	objs, _, err := repositoryList(client.ProvisioningV0alpha1(), "", keys, store, recorder)(t.Context())
	require.NoError(t, err)

	assert.Equal(t, []string{"from-full-list"}, repoNames(t, objs))
	assert.Equal(t, float64(1), projectionCount(t, reg, repoGVR, "objects"))
}

// Storage older than keys_only must degrade to the full list rather than stop
// reconciling, since the re-list is the repository controller's only feed.
func TestRepositoryList_FallsBackWhenKeysOnlyUnsupported(t *testing.T) {
	keys := &stubKeysLister{err: keysapi.ErrUnsupported}
	client := fake.NewClientset(repoAt("ns", "from-full-list", "10"))

	recorder, reg := newTestRecorder(repoGVR)
	objs, _, err := repositoryList(client.ProvisioningV0alpha1(), "", keys, newFakeStore(repoAt("ns", "seed", "10")), recorder)(t.Context())
	require.NoError(t, err, "an unsupported projection is not a reason to fail the tick")

	assert.Equal(t, 1, keys.called, "the keys path is tried first")
	assert.Equal(t, []string{"from-full-list"}, repoNames(t, objs))
	assert.Equal(t, float64(1), projectionCount(t, reg, repoGVR, "objects"))
}

// Any other keys failure is real and has to surface: swallowing it would hide an
// outage behind a silently more expensive list.
func TestRepositoryList_SurfacesOtherKeysErrors(t *testing.T) {
	boom := errors.New("storage unavailable")
	keys := &stubKeysLister{err: boom}
	client := fake.NewClientset(repoAt("ns", "from-full-list", "10"))

	objs, _, err := repositoryList(client.ProvisioningV0alpha1(), "", keys, newFakeStore(repoAt("ns", "seed", "10")), RelistRecorder{})(t.Context())
	require.ErrorIs(t, err, boom)
	assert.Nil(t, objs, "a failed tick must not deliver a partial set, which the Store would read as deletions")
}

// The setting off arrives here as a nil lister, and its snapshot must hold the
// same shape as a keys-only one: the flag changes the transport, not what the
// readers of the snapshot can see.
func TestRepositoryList_NilListerListsFullObjectsTrimmed(t *testing.T) {
	full := repoAt("ns", "a", "10")
	full.Spec.Title = "a title nobody reading the snapshot needs"
	client := fake.NewClientset(full)

	recorder, reg := newTestRecorder(repoGVR)
	objs, _, err := repositoryList(client.ProvisioningV0alpha1(), "", nil, newFakeStore(), recorder)(t.Context())
	require.NoError(t, err)

	require.Len(t, objs, 1)
	got, ok := objs[0].(*provisioningapis.Repository)
	require.True(t, ok)
	assert.Empty(t, got.Spec.Title, "the full list must be trimmed too")
	assert.Equal(t, "10", got.ResourceVersion)
	assert.Equal(t, float64(1), projectionCount(t, reg, repoGVR, "objects"))
}

func repoNames(t *testing.T, objs []runtime.Object) []string {
	t.Helper()
	out := make([]string, 0, len(objs))
	for _, o := range objs {
		r, ok := o.(*provisioningapis.Repository)
		require.True(t, ok, "expected *Repository, got %T", o)
		out = append(out, r.Name)
	}
	return out
}
