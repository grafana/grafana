package informer

import (
	"context"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
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
// against: the single repository under reconciliation, and the count for the
// quota check. Get must return a current object; the count tolerates staleness.
type RepositoryGetter interface {
	Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error)
	// CountRepositories includes repositories awaiting their finalizers, so a
	// namespace stays at its quota until a deletion finishes. That keeps the
	// count answerable from identities alone.
	CountRepositories(ctx context.Context, namespace string) (int, error)
	// ConfirmRepositoryCount is CountRepositories from a source that cannot miss
	// repositories another replica saw. Slower; used before unblocking.
	ConfirmRepositoryCount(ctx context.Context, namespace string) (int, error)
}

// NewRepositoryDeltaSource returns the repository delta source and the getter it
// backs. Under NATS the getter reads reconcile state fresh from the API and the
// quota count from the informer's store; otherwise the getter reads the
// informer's cache lister.
//
// A non-nil keys makes the NATS re-list keys-only; nil keeps the full-object
// list.
//
// freshness instruments how the getter's reads compare to the notifications
// that triggered them (see freshness.go); nil disables the observation. It
// applies to the NATS path only — the apiserver path reads a cache the watch
// keeps current, so there is no cross-replica read visibility to measure.
func NewRepositoryDeltaSource(subscriber nats.Subscriber, client versioned.Interface, keys keysapi.Lister, resync time.Duration, metrics *RelistProjectionMetrics, freshness *FreshnessMetrics) (DeltaSource, RepositoryGetter) {
	if nats.Enabled(subscriber) {
		store := usinformer.NewStore()
		gvr := provisioningapis.RepositoryResourceInfo.GroupVersionResource()
		recorder := metrics.Recorder(gvr)
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
		announced := newAnnouncements()
		source.SetAnnouncements(announced)
		getter := NewClientRepositoryGetter(client.ProvisioningV0alpha1(), store)
		return source, observeRepositoryFreshness(getter, announced, freshness.Recorder(gvr.Resource))
	}
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Repositories()
	return inf.Informer(), NewCachedRepositoryGetter(inf.Lister())
}

// NewRepositoryInformer builds an Informer for repositories. When keys is
// non-nil the periodic re-list is keys-only; otherwise it lists full objects.
func NewRepositoryInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, store usinformer.Store, keys keysapi.Lister, recorder RelistRecorder) *usinformer.Informer {
	c := client.ProvisioningV0alpha1()
	newObject := func(ns, name string) runtime.Object {
		return identity(ns, name, "")
	}
	list := identityList(keys, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		return c.Repositories(namespace).List(ctx, opts)
	}, recorder)
	return usinformer.NewInformer(subscriber, provisioningapis.RepositoryResourceInfo.GroupVersionResource(), namespace, resync, queueGroup, store, newObject, list)
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

func (g cachedRepositoryGetter) CountRepositories(_ context.Context, namespace string) (int, error) {
	repos, err := g.lister.Repositories(namespace).List(labels.Everything())
	if err != nil {
		return 0, err
	}
	return len(repos), nil
}

// ConfirmRepositoryCount reads the same lister: the apiserver watch reaches every replica.
func (g cachedRepositoryGetter) ConfirmRepositoryCount(ctx context.Context, namespace string) (int, error) {
	return g.CountRepositories(ctx, namespace)
}

// NewClientRepositoryGetter backs Get with the API client, fresh for the
// reconcile, and the count with the NATS informer's store, which avoids an API
// LIST on every quota check. Each Get is written back into the store (or evicted
// on NotFound), so the count includes the repository the reconcile just read.
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
	// Under round-robin delivery the live ADDED may have reached another
	// replica, and live MODIFIED events are not stored, so this store may not
	// hold the repository yet. The quota check that follows has to count it.
	g.store.Update(ctx, identity(repo.Namespace, repo.Name, repo.ResourceVersion))
	return repo, nil
}

// CountRepositories walks the cluster-wide store. It holds identities only and
// one entry per repository, so the walk stays cheap next to the reconcile it
// serves.
func (g clientRepositoryGetter) CountRepositories(ctx context.Context, namespace string) (int, error) {
	count := 0
	for _, obj := range g.store.List(ctx) {
		if acc, err := meta.Accessor(obj); err == nil && acc.GetNamespace() == namespace {
			count++
		}
	}
	return count, nil
}

// ConfirmRepositoryCount lists the namespace from the API, which the store can lag.
func (g clientRepositoryGetter) ConfirmRepositoryCount(ctx context.Context, namespace string) (int, error) {
	objs, _, err := listAllPages(ctx, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		return g.client.Repositories(namespace).List(ctx, opts)
	})
	if err != nil {
		return 0, err
	}
	return len(objs), nil
}
