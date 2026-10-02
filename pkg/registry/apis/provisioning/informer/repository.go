package informer

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	typedclient "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/nats"
	keysapi "github.com/grafana/grafana/pkg/registry/apis/keys"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// RepositoryGetter is the read seam the repository controller reconciles
// against. It exposes exactly what the controller needs — the single repository
// under reconciliation, and the active count for the quota check — so the source
// can be swapped without touching the controller.
//
// Get must return a current object (the reconcile acts on its spec);
// CountActiveRepositories backs the quota count, which tolerates staleness.
type RepositoryGetter interface {
	Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error)
	CountActiveRepositories(ctx context.Context, namespace string) (int, error)
}

// NewRepositoryDeltaSource returns the repository delta source and the getter it
// backs. Under NATS the getter reads reconcile state fresh from the API and the
// quota count from the informer's shared snapshot (written back on each reconcile
// read); otherwise the getter reads the informer's cache lister.
//
// A non-nil keys makes the NATS re-list keys-only; nil keeps the full-object
// list. Both callers follow [provisioning] keys_only_relist, in process over
// storage and in the operator over HTTP.
func NewRepositoryDeltaSource(subscriber nats.Subscriber, client versioned.Interface, keys keysapi.Lister, resync time.Duration, metrics *RelistProjectionMetrics) (DeltaSource, RepositoryGetter) {
	if nats.Enabled(subscriber) {
		store := usinformer.NewStore()
		recorder := metrics.Recorder(provisioningapis.RepositoryResourceInfo.GroupVersionResource())
		source := NewRepositoryInformer(subscriber, client, "", resync, store, keys, recorder)
		// The informer is the repository controller's only feed, and everything
		// that creates provisioning work lives in its reconcile: scheduled syncs,
		// health checks, webhook create/rotate, quota. Gating the initial list on
		// the subscription would stall all of it while NATS is unavailable — and
		// gating buys no safety here, since reconcile reads come fresh from the
		// API and the re-list (not the live stream) is what keeps a replica
		// reconciled under round-robin delivery. In degraded mode only the
		// live-event latency is lost until the subscription opens.
		source.AllowDegradedStart()
		return source, NewClientRepositoryGetter(client.ProvisioningV0alpha1(), store)
	}
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Repositories()
	return inf.Informer(), NewCachedRepositoryGetter(inf.Lister())
}

// NewRepositoryInformer builds an Informer for repositories. When keys is
// non-nil the periodic re-list is keys-only; otherwise it lists full objects.
func NewRepositoryInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, store usinformer.Store, keys keysapi.Lister, recorder RelistRecorder) *usinformer.Informer {
	c := client.ProvisioningV0alpha1()
	newObject := func(ns, name string) runtime.Object {
		return &provisioningapis.Repository{ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: name}}
	}
	return usinformer.NewInformer(subscriber, provisioningapis.RepositoryResourceInfo.GroupVersionResource(), namespace, resync, queueGroup, store, newObject, repositoryList(c, namespace, keys, store, recorder))
}

// repositoryList builds the informer's re-list. With a keys lister it asks
// storage for identities only, carries unchanged repositories forward from the
// previous snapshot and reads back just the ones whose resource version moved.
// The read-back is needed because the projection cannot carry a
// deletionTimestamp, which the quota count reads.
// Without a keys lister, or against storage too old to honour the projection, it
// lists full objects. Both paths store trimmed objects; see trimRepository.
func repositoryList(c typedclient.ProvisioningV0alpha1Interface, namespace string, keys keysapi.Lister, store usinformer.Cache, recorder RelistRecorder) func(context.Context) ([]runtime.Object, int64, error) {
	full := func(ctx context.Context) ([]runtime.Object, int64, error) {
		objs, listRV, err := listAllPages(ctx, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
			return c.Repositories(namespace).List(ctx, opts)
		})
		if err != nil {
			return nil, 0, err
		}
		recorder.Projection(false)
		return trimRepositories(objs), listRV, nil
	}

	return func(ctx context.Context) ([]runtime.Object, int64, error) {
		if keys == nil {
			return full(ctx)
		}

		// An empty snapshot has nothing to carry forward, so every key would be
		// an object read and one list is cheaper. This is the initial list, and
		// the recovery if the snapshot is ever emptied.
		prev := indexRepositories(store.List(ctx))
		if len(prev) == 0 {
			return full(ctx)
		}

		objs, listRV, err := listRepositoryKeys(ctx, c, keys, prev, recorder)
		switch {
		case err == nil:
			recorder.Projection(true)
			return objs, listRV, nil
		case errors.Is(err, keysapi.ErrUnsupported):
			// Storage predates keys_only. The full list is still correct, and
			// failing the tick would stop reconciling altogether.
			logging.FromContext(ctx).Warn("storage did not honour keys_only, re-listing full objects")
		case errors.Is(err, errRelistFullObjects):
			logging.FromContext(ctx).Info("keys-only re-list fell back to full objects", "reason", err)
		default:
			return nil, 0, err
		}
		return full(ctx)
	}
}

// Read-backs are bounded as a share of the snapshot rather than by a flat count,
// because the full list they are competing against also grows with it.
// BenchmarkRepositoryRelist measures one read-back at roughly twenty times what
// one object costs inside a list, so listing everything wins once a few percent
// of the snapshot has drifted: at a thousand repositories and a 1ms server hop,
// one list takes ~99ms while fifty read-backs take ~137ms. A flat cap is wrong
// in both directions -- too slow for a small snapshot, too eager for a large one.
//
// The floor keeps a small snapshot on the projection, where the share alone
// would round to nothing: at ten repositories a single read-back still beats
// listing all ten.
const (
	hydrationShare = 32 // read back at most one key in this many
	minHydrations  = 4
)

// maxHydrations is how many keys this re-list will read back before it takes a
// single full list instead.
func maxHydrations(snapshot int) int {
	return max(minHydrations, snapshot/hydrationShare)
}

// errRelistFullObjects means the keys-only re-list gave up and the caller should
// list full objects instead. Not a failure: the full list is authoritative, just
// more expensive.
var errRelistFullObjects = errors.New("keys-only re-list needs the full objects")

// listRepositoryKeys collects a keys-only re-list into the minimal objects the
// informer's Store keys on, reading back only what prev cannot answer for.
func listRepositoryKeys(ctx context.Context, c typedclient.ProvisioningV0alpha1Interface, keys keysapi.Lister, prev map[string]*provisioningapis.Repository, recorder RelistRecorder) ([]runtime.Object, int64, error) {
	listRV, seq := keys.ListKeys(ctx)

	// The Store diffs the whole set, so the stream is drained before any object
	// read: how far the snapshot drifted is what decides whether reading the
	// difference back is still cheaper than listing everything.
	var (
		objs    []runtime.Object
		drifted []keysapi.Key
	)
	for k, err := range seq {
		if err != nil {
			return nil, 0, err
		}
		if repo, ok := prev[repositoryKey(k.Namespace, k.Name)]; ok && repo.ResourceVersion == k.ResourceVersion {
			objs = append(objs, repo)
			continue
		}
		drifted = append(drifted, k)
	}

	snapshot := len(objs) + len(drifted)
	if limit := maxHydrations(snapshot); len(drifted) > limit {
		return nil, 0, fmt.Errorf("%w: %d of %d repositories drifted, past the %d read-back limit", errRelistFullObjects, len(drifted), snapshot, limit)
	}

	for _, k := range drifted {
		recorder.Hydration()
		repo, err := c.Repositories(k.Namespace).Get(ctx, k.Name, metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			// Deleted between the keys list and the read. Leaving it out of the
			// snapshot is the right answer: Replace reports the removal.
			continue
		}
		if err != nil {
			// Dropping the key instead would be indistinguishable from a delete,
			// so take the authoritative list rather than guess.
			return nil, 0, fmt.Errorf("%w: reading back %s/%s: %w", errRelistFullObjects, k.Namespace, k.Name, err)
		}
		objs = append(objs, trimRepository(repo))
	}
	return objs, listRV, nil
}

// NewCachedRepositoryGetter backs a RepositoryGetter with the informer's
// generated lister, i.e. the informer's local cache.
func NewCachedRepositoryGetter(lister listers.RepositoryLister) RepositoryGetter {
	return cachedRepositoryGetter{lister: lister}
}

type cachedRepositoryGetter struct {
	lister listers.RepositoryLister
}

func (g cachedRepositoryGetter) Get(_ context.Context, namespace, name string) (*provisioningapis.Repository, error) {
	return g.lister.Repositories(namespace).Get(name)
}

func (g cachedRepositoryGetter) CountActiveRepositories(_ context.Context, namespace string) (int, error) {
	repos, err := g.lister.Repositories(namespace).List(labels.Everything())
	if err != nil {
		return 0, err
	}
	count := 0
	for _, repo := range repos {
		if repo.DeletionTimestamp == nil {
			count++
		}
	}
	return count, nil
}

// NewClientRepositoryGetter backs Get with the API client — fresh, for the
// reconcile — and the count with the NATS informer's snapshot (a
// unified-storage informer Cache). The quota count is the only reader and
// tolerates the snapshot's staleness (as stale as the resync interval), so
// reading it avoids an API LIST on every quota check. Each reconcile Get is
// written back into the store (or removed on NotFound), keeping the count warm
// between re-lists rather than only as fresh as the last resync.
func NewClientRepositoryGetter(c typedclient.ProvisioningV0alpha1Interface, store usinformer.Cache) RepositoryGetter {
	return clientRepositoryGetter{client: c, store: store}
}

type clientRepositoryGetter struct {
	client typedclient.ProvisioningV0alpha1Interface
	store  usinformer.Cache
}

func (g clientRepositoryGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
	repo, err := g.client.Repositories(namespace).Get(ctx, name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		g.store.Delete(ctx, namespace, name)
		return nil, err
	}
	if err != nil {
		return nil, err
	}
	// Trimmed, so a warm snapshot costs the same as a re-listed one.
	g.store.Update(ctx, trimRepository(repo))
	return repo, nil
}

func (g clientRepositoryGetter) CountActiveRepositories(ctx context.Context, namespace string) (int, error) {
	count := 0
	for _, obj := range g.store.List(ctx) {
		repo, ok := obj.(*provisioningapis.Repository)
		if !ok || repo.Namespace != namespace || repo.DeletionTimestamp != nil {
			continue
		}
		count++
	}
	return count, nil
}

// trimRepository keeps what the snapshot's readers need and drops the body: the
// Store's diff keys off namespace/name and resourceVersion, and the active
// repository count reads deletionTimestamp. Keeping bodies would undo the
// keys-only re-list, since every repository read back would stay resident.
func trimRepository(repo *provisioningapis.Repository) *provisioningapis.Repository {
	trimmed := &provisioningapis.Repository{ObjectMeta: metav1.ObjectMeta{
		Namespace:       repo.Namespace,
		Name:            repo.Name,
		ResourceVersion: repo.ResourceVersion,
	}}
	if ts := repo.DeletionTimestamp; ts != nil {
		trimmed.DeletionTimestamp = ts.DeepCopy()
	}
	return trimmed
}

// trimRepositories trims a full list in place, so the snapshot holds the same
// shape whichever re-list produced it.
func trimRepositories(objs []runtime.Object) []runtime.Object {
	for i, obj := range objs {
		if repo, ok := obj.(*provisioningapis.Repository); ok {
			objs[i] = trimRepository(repo)
		}
	}
	return objs
}

// indexRepositories keys a snapshot for lookup by the identities a keys-only
// re-list returns.
func indexRepositories(objs []runtime.Object) map[string]*provisioningapis.Repository {
	out := make(map[string]*provisioningapis.Repository, len(objs))
	for _, obj := range objs {
		if repo, ok := obj.(*provisioningapis.Repository); ok {
			out[repositoryKey(repo.Namespace, repo.Name)] = repo
		}
	}
	return out
}

func repositoryKey(namespace, name string) string {
	return namespace + "/" + name
}
