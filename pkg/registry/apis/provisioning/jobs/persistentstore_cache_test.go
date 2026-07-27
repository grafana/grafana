package jobs

import (
	"context"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/cache"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	provisioningv0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// fakeClaimCache is an in-memory ClaimCache for exercising the cache-backed
// claim path. It records deletes so tests can assert self-healing.
type fakeClaimCache struct {
	mu      sync.Mutex
	items   map[string]runtime.Object
	deleted []string
	updated []string
}

func newFakeClaimCache(objs ...runtime.Object) *fakeClaimCache {
	c := &fakeClaimCache{items: map[string]runtime.Object{}}
	for _, o := range objs {
		key, _ := cache.MetaNamespaceKeyFunc(o)
		c.items[key] = o
	}
	return c
}

func (c *fakeClaimCache) List(_ context.Context) []runtime.Object {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]runtime.Object, 0, len(c.items))
	for _, o := range c.items {
		out = append(out, o)
	}
	return out
}

func (c *fakeClaimCache) Update(_ context.Context, obj runtime.Object) {
	key, err := cache.MetaNamespaceKeyFunc(obj)
	if err != nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = obj
	c.updated = append(c.updated, key)
}

func (c *fakeClaimCache) Delete(_ context.Context, namespace, name string) {
	key := name
	if namespace != "" {
		key = namespace + "/" + name
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.items, key)
	c.deleted = append(c.deleted, key)
}

func newTestStoreWithCache(client provisioningv0alpha1.ProvisioningV0alpha1Interface, c ClaimCache) *persistentStore {
	return &persistentStore{
		client:       client,
		clock:        time.Now,
		expiry:       30 * time.Second,
		cache:        c,
		queueMetrics: RegisterQueueMetrics(prometheus.NewPedanticRegistry()),
	}
}

func minimalJob(namespace, name string) *provisioning.Job {
	return &provisioning.Job{ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name}}
}

// TestClaim_FromCache_ClaimsCandidate verifies the cache path claims an unclaimed
// job that exists in storage, stamping the ownership labels, without a
// cluster-wide List.
func TestClaim_FromCache_ClaimsCandidate(t *testing.T) {
	fakeClient := newTestClientset()
	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "*")
	require.NoError(t, err)

	created, err := fakeClient.Jobs("stacks-1").Create(ctx, &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "repo-pull", Namespace: "stacks-1"},
		Spec:       provisioning.JobSpec{Repository: "repo", Action: provisioning.JobActionPull},
	}, metav1.CreateOptions{})
	require.NoError(t, err)

	cacheStore := newFakeClaimCache(created.DeepCopy())
	store := newTestStoreWithCache(fakeClient, cacheStore)

	claimed, rollback, err := store.Claim(ctx)
	require.NoError(t, err)
	require.NotNil(t, claimed)
	defer rollback()

	assert.Equal(t, "repo-pull", claimed.GetName())
	assert.NotEmpty(t, claimed.Labels[LabelJobClaim], "claim timestamp should be set")
	assert.NotEmpty(t, claimed.Labels[LabelJobClaimOwner], "claim owner token should be set")
	assert.NotEmpty(t, cacheStore.updated, "claim should be reflected back into the cache")
}

// TestClaim_FromCache_MinimalCandidateGetsFresh verifies a minimal cache entry
// (only namespace/name, as delivered by a live add) is enough: the store Gets the
// authoritative object before claiming.
func TestClaim_FromCache_MinimalCandidateGetsFresh(t *testing.T) {
	fakeClient := newTestClientset()
	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "*")
	require.NoError(t, err)

	_, err = fakeClient.Jobs("stacks-1").Create(ctx, &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "repo-pull", Namespace: "stacks-1"},
		Spec:       provisioning.JobSpec{Repository: "repo", Action: provisioning.JobActionPull},
	}, metav1.CreateOptions{})
	require.NoError(t, err)

	// Cache holds only namespace/name, as a live notification would.
	cacheStore := newFakeClaimCache(minimalJob("stacks-1", "repo-pull"))
	store := newTestStoreWithCache(fakeClient, cacheStore)

	claimed, rollback, err := store.Claim(ctx)
	require.NoError(t, err)
	require.NotNil(t, claimed)
	defer rollback()
	assert.Equal(t, provisioning.JobActionPull, claimed.Spec.Action, "fresh Get should populate the spec")
	assert.NotEmpty(t, claimed.Labels[LabelJobClaimOwner])
}

// TestClaim_FromCache_SkipsAlreadyClaimed verifies a candidate that is claimed in
// storage (but not yet reflected in the cache) is skipped, and the fresh state is
// written back so siblings skip it too.
func TestClaim_FromCache_SkipsAlreadyClaimed(t *testing.T) {
	fakeClient := newTestClientset()
	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "*")
	require.NoError(t, err)

	_, err = fakeClient.Jobs("stacks-1").Create(ctx, &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "repo-pull",
			Namespace: "stacks-1",
			Labels:    map[string]string{LabelJobClaim: "1", LabelJobClaimOwner: "someone-else"},
		},
		Spec: provisioning.JobSpec{Repository: "repo", Action: provisioning.JobActionPull},
	}, metav1.CreateOptions{})
	require.NoError(t, err)

	// Cache thinks it is unclaimed (minimal entry), storage says otherwise.
	cacheStore := newFakeClaimCache(minimalJob("stacks-1", "repo-pull"))
	store := newTestStoreWithCache(fakeClient, cacheStore)

	claimed, _, err := store.Claim(ctx)
	assert.Nil(t, claimed)
	assert.ErrorIs(t, err, ErrNoJobs)
	assert.NotEmpty(t, cacheStore.updated, "claimed candidate should be written back into the cache")
}

// TestClaim_FromCache_NotFoundDeletesFromCache verifies a candidate missing from
// storage (completed/reaped) is evicted from the cache and does not error.
func TestClaim_FromCache_NotFoundDeletesFromCache(t *testing.T) {
	fakeClient := newTestClientset()
	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "*")
	require.NoError(t, err)

	cacheStore := newFakeClaimCache(minimalJob("stacks-1", "ghost"))
	store := newTestStoreWithCache(fakeClient, cacheStore)

	claimed, _, err := store.Claim(ctx)
	assert.Nil(t, claimed)
	assert.ErrorIs(t, err, ErrNoJobs)
	assert.Contains(t, cacheStore.deleted, "stacks-1/ghost", "missing candidate should be evicted from cache")
}

// TestClaim_FromCache_EmptyReturnsNoJobs verifies an empty cache yields ErrNoJobs
// and makes no storage calls.
func TestClaim_FromCache_EmptyReturnsNoJobs(t *testing.T) {
	fakeClient := newTestClientset()
	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "*")
	require.NoError(t, err)

	store := newTestStoreWithCache(fakeClient, newFakeClaimCache())

	claimed, _, err := store.Claim(ctx)
	assert.Nil(t, claimed)
	assert.ErrorIs(t, err, ErrNoJobs)
}

// TestClaim_FromCache_DoesNotShareClaimedJobWithCache guards the object handed to
// the driver against the copy left in the cache. The driver mutates the job it is
// given (Complete deletes the claim labels off it) while sibling drivers read
// cached labels with no per-object locking, so sharing the pointer is a data race
// that Go turns into a fatal, unrecoverable abort. Run under -race.
func TestClaim_FromCache_DoesNotShareClaimedJobWithCache(t *testing.T) {
	fakeClient := newTestClientset()
	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "*")
	require.NoError(t, err)

	_, err = fakeClient.Jobs("stacks-1").Create(ctx, &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "repo-pull", Namespace: "stacks-1"},
		Spec:       provisioning.JobSpec{Repository: "repo", Action: provisioning.JobActionPull},
	}, metav1.CreateOptions{})
	require.NoError(t, err)

	cacheStore := newFakeClaimCache(minimalJob("stacks-1", "repo-pull"))
	store := newTestStoreWithCache(fakeClient, cacheStore)

	claimed, _, err := store.Claim(ctx)
	require.NoError(t, err)
	require.NotNil(t, claimed)

	for _, obj := range cacheStore.List(ctx) {
		if cached, ok := obj.(*provisioning.Job); ok && cached.GetName() == claimed.GetName() {
			require.NotSame(t, claimed, cached, "cache must not hold the pointer handed to the driver")
			require.NotEqual(t, reflect.ValueOf(claimed.Labels).Pointer(), reflect.ValueOf(cached.Labels).Pointer(),
				"cache must not share the driver's label map")
		}
	}

	// What the driver actually does to the job it was handed, concurrently with a
	// sibling driver claiming from the same cache.
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		for i := 0; i < 200; i++ {
			delete(claimed.Labels, LabelJobClaim)
			claimed.Labels[LabelJobClaim] = "1"
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < 200; i++ {
			_, _, _ = store.Claim(ctx)
		}
	}()
	wg.Wait()
}
