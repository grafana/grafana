package informer

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana-app-sdk/resource"

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

// fakeSnapshot stands in for the informer's snapshot, which holds identities only.
type fakeSnapshot []resource.Identifier

func (s fakeSnapshot) Snapshot() []resource.Identifier { return s }

// seededSnapshot is the snapshot a re-list of objs would leave behind.
func seededSnapshot(objs ...*provisioningapis.Repository) fakeSnapshot {
	out := make(fakeSnapshot, 0, len(objs))
	for _, obj := range objs {
		out = append(out, resource.Identifier{Namespace: obj.Namespace, Name: obj.Name})
	}
	return out
}

// A live repository notification is delivered as an identity, the same shape the
// re-list stores.
func TestNewRepositoryInformer_DeliversTheProjection(t *testing.T) {
	sub := newFakeSubscriber()
	rec := &typeRecorder{}
	gvr := provisioningapis.RepositoryResourceInfo.GroupVersionResource()

	inf, err := NewRepositoryInformer(sub, fake.NewClientset(), testNamespace, time.Minute, nil, usinformer.BusSourceOptions{})
	require.NoError(t, err)
	_, err = inf.AddEventHandler(rec)
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
	g := NewClientRepositoryGetter(fake.NewClientset(full).ProvisioningV0alpha1(), fakeSnapshot{})

	got, err := g.Get(context.Background(), "ns", "fresh")
	require.NoError(t, err)
	assert.Equal(t, "a title", got.Spec.Title, "the reconcile gets the whole object")

	_, err = g.Get(context.Background(), "ns", "missing")
	assert.True(t, apierrors.IsNotFound(err))
}

// A reconcile Get is remembered until a re-list picks it up, so the count
// reflects the repository under reconciliation even when the snapshot has not
// caught up; a Get that 404s drops it again.
func TestClientRepositoryGetter_GetIsCountedBeforeTheSnapshotCatchesUp(t *testing.T) {
	g := NewClientRepositoryGetter(fake.NewClientset(repoAt("ns", "fresh", "7")).ProvisioningV0alpha1(), fakeSnapshot{})

	count, err := g.CountRepositories(context.Background(), "ns")
	require.NoError(t, err)
	assert.Zero(t, count, "the snapshot has seen nothing")

	_, err = g.Get(context.Background(), "ns", "fresh")
	require.NoError(t, err)
	count, err = g.CountRepositories(context.Background(), "ns")
	require.NoError(t, err)
	assert.Equal(t, 1, count, "the repository the reconcile just read counts")

	_, err = g.Get(context.Background(), "ns", "gone")
	require.True(t, apierrors.IsNotFound(err))
	count, err = g.CountRepositories(context.Background(), "ns")
	require.NoError(t, err)
	assert.Equal(t, 1, count, "a repository that 404s does not")
}

// What the snapshot already holds is dropped from the remembered set, so it
// drains on the next re-list rather than growing.
func TestClientRepositoryGetter_TheSnapshotDrainsWhatItCatchesUpWith(t *testing.T) {
	snapshot := seededSnapshot(repo("ns", "fresh"))
	g := NewClientRepositoryGetter(fake.NewClientset(repoAt("ns", "fresh", "7")).ProvisioningV0alpha1(), snapshot)

	_, err := g.Get(context.Background(), "ns", "fresh")
	require.NoError(t, err)

	count, err := g.CountRepositories(context.Background(), "ns")
	require.NoError(t, err)
	assert.Equal(t, 1, count, "counted once, not twice")
	assert.Empty(t, g.(*clientRepositoryGetter).recent)
}

// The confirmed count reads the API, not the store.
func TestClientRepositoryGetter_ConfirmCountListsTheAPI(t *testing.T) {
	client := fake.NewClientset(repo("ns-a", "one"), repo("ns-a", "two"), repo("ns-b", "other"))
	g := NewClientRepositoryGetter(client.ProvisioningV0alpha1(), fakeSnapshot{})

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
	snapshot := seededSnapshot(repo("ns-a", "one"), repo("ns-a", "two"), terminating(repo("ns-a", "going")), repo("ns-b", "other"))
	g := NewClientRepositoryGetter(fake.NewClientset().ProvisioningV0alpha1(), snapshot)

	count, err := g.CountRepositories(context.Background(), "ns-a")
	require.NoError(t, err)
	assert.Equal(t, 3, count)
}

// The delta source's getter is client-backed under NATS (reads fresh from the
// API) and cache-backed otherwise (reads the informer's lister, not the API).
func TestNewRepositoryDeltaSource(t *testing.T) {
	client := fake.NewClientset(repo(testNamespace, "r"))

	t.Run("nats enabled reads fresh from the API", func(t *testing.T) {
		_, getter, err := NewRepositoryDeltaSource(newFakeSubscriber(), client, nil, time.Minute, nil, nil)
		require.NoError(t, err)
		got, err := getter.Get(context.Background(), testNamespace, "r")
		require.NoError(t, err)
		assert.Equal(t, "r", got.Name)
	})

	t.Run("nats disabled reads the informer cache", func(t *testing.T) {
		_, getter, err := NewRepositoryDeltaSource(nil, client, nil, time.Minute, nil, nil)
		require.NoError(t, err)
		// The cache getter reads the (empty, unsynced) informer lister, so the
		// object present in the API is not found — proving it does not hit the API.
		_, err = getter.Get(context.Background(), testNamespace, "r")
		assert.True(t, apierrors.IsNotFound(err))
	})
}

// A repository that is gone is absent from the snapshot too, so nothing there could prune it: the delete has to
// reach the getter from the event stream, or the namespace stays at its quota forever.
func TestClientRepositoryGetter_ADeleteStopsItCounting(t *testing.T) {
	g := NewClientRepositoryGetter(fake.NewClientset(repoAt("ns", "fresh", "7")).ProvisioningV0alpha1(), fakeSnapshot{})

	_, err := g.Get(context.Background(), "ns", "fresh")
	require.NoError(t, err)
	count, err := g.CountRepositories(context.Background(), "ns")
	require.NoError(t, err)
	require.Equal(t, 1, count)

	forgetDeleted{getter: g}.OnDelete(identity("ns", "fresh", "8"))

	count, err = g.CountRepositories(context.Background(), "ns")
	require.NoError(t, err)
	assert.Zero(t, count)
}
