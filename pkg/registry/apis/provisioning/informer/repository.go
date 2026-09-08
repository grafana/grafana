package informer

import (
	"context"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	typedclient "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/nats"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// RepositoryGetter is the read seam the repository controller reconciles
// against. It exposes exactly what the controller needs — the single repository
// under reconciliation, and a namespace-wide list for the quota count — so the
// source can be swapped without touching the controller.
//
// Get must return a current object (the reconcile acts on its spec): under NATS
// it enforces the freshness floor the informer events announce, returning
// usinformer.ErrStaleRead when the API cannot yet serve the object at that
// version. List backs the quota count, which tolerates staleness.
type RepositoryGetter interface {
	Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error)
	List(ctx context.Context, namespace string) ([]*provisioningapis.Repository, error)
}

// NewRepositoryDeltaSource returns the repository delta source and the getter it
// backs. Under NATS the getter reads reconcile state fresh from the API and the
// quota count from the informer's shared snapshot (written back on each reconcile
// read); otherwise the getter reads the informer's cache lister.
//
// The NATS pair shares a freshness floor: each delivered event raises the floor
// to the resource version it announced, and the getter refuses to hand the
// controller anything older (a NATS notification is published after the write
// commits, but the read may land on a replica that has not seen it yet — an
// apiserver watch never has this gap because the event carries the object).
// Floor enforcement outcomes are counted on reg (nil disables them).
func NewRepositoryDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration, reg prometheus.Registerer) (DeltaSource, RepositoryGetter) {
	if nats.Enabled(subscriber) {
		store := usinformer.NewStore()
		floor := usinformer.NewRVFloor()
		staleReads := usinformer.NewStaleReadMetrics(reg, provisioningapis.RepositoryResourceInfo.GroupVersionResource().Resource)
		source := NewRepositoryInformer(subscriber, client, "", resync, store)
		// The informer is the repository controller's only feed, and everything
		// that creates provisioning work lives in its reconcile: scheduled syncs,
		// health checks, webhook create/rotate, quota. Gating the initial list on
		// the subscription would stall all of it while NATS is unavailable — and
		// gating buys no safety here, since reconcile reads come fresh from the
		// API and the re-list (not the live stream) is what keeps a replica
		// reconciled under round-robin delivery. In degraded mode only the
		// live-event latency is lost until the subscription opens.
		source.AllowDegradedStart()
		// Every delivered event raises the floor before the controller's handler
		// enqueues the key, so the getter can refuse reconcile reads staler than
		// the event that triggered them.
		source.TrackFloor(floor)
		return source, NewClientGetCachedListRepositoryGetter(client.ProvisioningV0alpha1(), store, floor, staleReads)
	}
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Repositories()
	return inf.Informer(), NewCachedRepositoryGetter(inf.Lister())
}

// NewRepositoryInformer builds an Informer for repositories.
func NewRepositoryInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, store usinformer.Store) *usinformer.Informer {
	c := client.ProvisioningV0alpha1()
	newObject := func(ns, name string) runtime.Object {
		return &provisioningapis.Repository{ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: name}}
	}
	list := func(ctx context.Context) ([]runtime.Object, int64, error) {
		return listAllPages(ctx, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
			return c.Repositories(namespace).List(ctx, opts)
		})
	}
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

func (g cachedRepositoryGetter) List(_ context.Context, namespace string) ([]*provisioningapis.Repository, error) {
	return g.lister.Repositories(namespace).List(labels.Everything())
}

// NewClientGetCachedListRepositoryGetter backs Get with the API client — fresh,
// for the reconcile — and List with the NATS informer's snapshot (a
// unified-storage informer Cache). The quota count is the only List caller and
// tolerates the snapshot's staleness (as stale as the resync interval), so
// reading it avoids an API LIST on every quota check. Each successful reconcile
// Get is written back into the store, keeping the count warm between re-lists
// rather than only as fresh as the last resync; a NotFound writes nothing —
// eviction belongs to the informer (a dated DeleteAt on a live delete, or the
// next re-list), and the count's tolerance covers the gap.
//
// floor is the freshness floor the informer events raise; Get refuses to return
// a read below it (retrying briefly, then usinformer.ErrStaleRead). A nil floor
// disables the check; metrics counts the enforcement outcomes (nil disables).
func NewClientGetCachedListRepositoryGetter(c typedclient.ProvisioningV0alpha1Interface, store usinformer.Cache, floor *usinformer.RVFloor, metrics *usinformer.StaleReadMetrics) RepositoryGetter {
	return clientGetCachedListRepositoryGetter{client: c, store: store, reader: usinformer.NewFreshReader(floor, metrics)}
}

type clientGetCachedListRepositoryGetter struct {
	client typedclient.ProvisioningV0alpha1Interface
	store  usinformer.Cache
	reader usinformer.FreshReader
}

func (g clientGetCachedListRepositoryGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
	repo, err := usinformer.GetFresh(ctx, g.reader, namespace, name, func(ctx context.Context) (*provisioningapis.Repository, error) {
		return g.client.Repositories(namespace).Get(ctx, name, metav1.GetOptions{})
	})
	if err != nil {
		return nil, err
	}
	g.store.Update(ctx, repo)
	return repo, nil
}

func (g clientGetCachedListRepositoryGetter) List(ctx context.Context, namespace string) ([]*provisioningapis.Repository, error) {
	var out []*provisioningapis.Repository
	for _, obj := range g.store.List(ctx) {
		repo, ok := obj.(*provisioningapis.Repository)
		if !ok || repo.Namespace != namespace {
			continue
		}
		out = append(out, repo)
	}
	return out, nil
}
