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
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// RepositoryGetter is the read seam the repository controller reconciles
// against: the single repository under reconciliation, and the active count for
// the quota check. Get must return a current object; the count tolerates
// staleness.
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
// list.
func NewRepositoryDeltaSource(subscriber nats.Subscriber, client versioned.Interface, keys keysapi.Lister, resync time.Duration, metrics *RelistProjectionMetrics) (DeltaSource, RepositoryGetter) {
	if nats.Enabled(subscriber) {
		store := NewRepositorySnapshot(usinformer.NewStore())
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
		return projectIdentity(ns, name, "")
	}
	return usinformer.NewInformer(subscriber, provisioningapis.RepositoryResourceInfo.GroupVersionResource(), namespace, resync, queueGroup, store, newObject, repositoryList(c, namespace, keys, store, recorder))
}

// repositoryList builds the informer's re-list. With a keys lister it carries
// unchanged repositories forward and reads back only those whose resource
// version moved, because the projection cannot carry the deletionTimestamp the
// quota count reads. Without one, or against storage too old for keys_only, it
// lists full objects.
func repositoryList(c typedclient.ProvisioningV0alpha1Interface, namespace string, keys keysapi.Lister, store usinformer.Cache, recorder RelistRecorder) func(context.Context) ([]runtime.Object, int64, error) {
	full := func(ctx context.Context) ([]runtime.Object, int64, error) {
		objs, listRV, err := listAllPages(ctx, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
			return c.Repositories(namespace).List(ctx, opts)
		})
		if err != nil {
			return nil, 0, err
		}
		recorder.Projection(false)
		return projectRepositories(objs), listRV, nil
	}

	return func(ctx context.Context) ([]runtime.Object, int64, error) {
		if keys == nil {
			return full(ctx)
		}

		// Nothing to carry forward (startup, or recovery from an emptied
		// snapshot): one list is cheaper than a read per key.
		prev := indexProjections(store.List(ctx))
		if len(prev) == 0 {
			return full(ctx)
		}

		objs, listRV, err := listRepositoryKeys(ctx, c, keys, prev, recorder)
		switch {
		case err == nil:
			recorder.Projection(true)
			return objs, listRV, nil
		case errors.Is(err, keysapi.ErrUnsupported):
			// Storage predates keys_only; failing the tick would stop reconciling.
			logging.FromContext(ctx).Warn("storage did not honour keys_only, re-listing full objects")
		case errors.Is(err, errRelistFullObjects):
			logging.FromContext(ctx).Info("keys-only re-list fell back to full objects", "reason", err)
		default:
			return nil, 0, err
		}
		return full(ctx)
	}
}

// A read-back costs about twenty times an object inside a list, and the keys path
// needs two requests where the list needs one (BenchmarkRelistStrategies). So up
// to hydrationBreakEven repositories any drift is cheaper as one list, and above
// it one key in hydrationShare may be read back.
//
// Assumes client-side throttling is off (flowcontrol.NewFakeAlwaysRateLimiter in
// pkg/operators/provisioning); under client-go's default 5 QPS these numbers do
// not hold.
const (
	hydrationBreakEven = 100
	hydrationShare     = 32
)

// maxHydrations is how many keys this re-list will read back before it takes a
// single full list instead.
func maxHydrations(snapshot int) int {
	if snapshot <= hydrationBreakEven {
		return 0
	}

	return (snapshot - hydrationBreakEven) / hydrationShare
}

// errRelistFullObjects tells the caller to list full objects instead. Not a
// failure.
var errRelistFullObjects = errors.New("keys-only re-list needs the full objects")

// listRepositoryKeys collects a keys-only re-list, reading back only what prev
// cannot answer for.
func listRepositoryKeys(ctx context.Context, c typedclient.ProvisioningV0alpha1Interface, keys keysapi.Lister, prev map[string]*repositoryProjection, recorder RelistRecorder) ([]runtime.Object, int64, error) {
	listRV, seq := keys.ListKeys(ctx)

	// Drained before any read: the drift decides whether reading it back beats
	// a full list.
	var (
		objs    []runtime.Object
		drifted []keysapi.Key
	)
	for k, err := range seq {
		if err != nil {
			return nil, 0, err
		}
		if projected, ok := prev[repositoryKey(k.Namespace, k.Name)]; ok && projected.ResourceVersion == k.ResourceVersion {
			objs = append(objs, projected)
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
			// Deleted since the keys list; Replace reports the removal.
			continue
		}
		if err != nil {
			// Dropping the key would look like a delete, so take the full list.
			return nil, 0, fmt.Errorf("%w: reading back %s/%s: %w", errRelistFullObjects, k.Namespace, k.Name, err)
		}
		objs = append(objs, projectRepository(repo))
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

// NewClientRepositoryGetter backs Get with the API client, fresh for the
// reconcile, and the count with the NATS informer's snapshot, which avoids an API
// LIST on every quota check. Each reconcile Get is written back into the snapshot
// (or removed on NotFound), keeping the count warm between re-lists.
func NewClientRepositoryGetter(c typedclient.ProvisioningV0alpha1Interface, snapshot *RepositorySnapshot) RepositoryGetter {
	return clientRepositoryGetter{client: c, snapshot: snapshot}
}

type clientRepositoryGetter struct {
	client   typedclient.ProvisioningV0alpha1Interface
	snapshot *RepositorySnapshot
}

func (g clientRepositoryGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
	repo, err := g.client.Repositories(namespace).Get(ctx, name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		g.snapshot.Delete(ctx, namespace, name)
		return nil, err
	}
	if err != nil {
		return nil, err
	}
	g.snapshot.Update(ctx, projectRepository(repo))
	return repo, nil
}

func (g clientRepositoryGetter) CountActiveRepositories(_ context.Context, namespace string) (int, error) {
	return g.snapshot.CountActive(namespace), nil
}

// repositoryProjection is what the snapshot holds instead of a whole repository:
// the identity the Store's diff keys off, and the deletionTimestamp the active
// count reads.
type repositoryProjection = metav1.PartialObjectMetadata

// projectIdentity builds a projection from an identity alone.
func projectIdentity(namespace, name, resourceVersion string) *repositoryProjection {
	return &repositoryProjection{ObjectMeta: metav1.ObjectMeta{
		Namespace:       namespace,
		Name:            name,
		ResourceVersion: resourceVersion,
	}}
}

// projectRepository builds a projection from a whole repository.
func projectRepository(repo *provisioningapis.Repository) *repositoryProjection {
	projected := projectIdentity(repo.Namespace, repo.Name, repo.ResourceVersion)
	if ts := repo.DeletionTimestamp; ts != nil {
		projected.DeletionTimestamp = ts.DeepCopy()
	}
	return projected
}

// projectRepositories projects a full list in place.
func projectRepositories(objs []runtime.Object) []runtime.Object {
	for i, obj := range objs {
		if repo, ok := obj.(*provisioningapis.Repository); ok {
			objs[i] = projectRepository(repo)
		}
	}
	return objs
}

// indexProjections keys a snapshot by namespace/name.
func indexProjections(objs []runtime.Object) map[string]*repositoryProjection {
	out := make(map[string]*repositoryProjection, len(objs))
	for _, obj := range objs {
		if projected, ok := obj.(*repositoryProjection); ok {
			out[repositoryKey(projected.Namespace, projected.Name)] = projected
		}
	}
	return out
}

func repositoryKey(namespace, name string) string {
	return namespace + "/" + name
}
