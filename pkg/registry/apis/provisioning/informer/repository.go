package informer

import (
	"context"
	"fmt"
	"strconv"
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
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// RepositoryGetter is the read seam the repository controller reconciles
// against. It exposes exactly what the controller needs — the single repository
// under reconciliation, and a namespace-wide list for the quota count — so the
// source can be swapped without touching the controller.
//
// Get must return a current object (the reconcile acts on its spec): under NATS
// it enforces the freshness floor the informer events announce, returning
// ErrStaleRead when the API cannot yet serve the object at that version. List
// backs the quota count, which tolerates staleness.
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
func NewRepositoryDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration) (DeltaSource, RepositoryGetter) {
	if nats.Enabled(subscriber) {
		store := usinformer.NewStore()
		floor := NewRVFloor()
		source := NewRepositoryInformer(subscriber, client, "", resync, store)
		return withRVFloor(source, floor), NewClientGetCachedListRepositoryGetter(client.ProvisioningV0alpha1(), store, floor)
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
	list := func(ctx context.Context) ([]runtime.Object, error) {
		l, err := c.Repositories(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		out := make([]runtime.Object, len(l.Items))
		for i := range l.Items {
			out[i] = &l.Items[i]
		}
		return out, nil
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

const (
	// staleReadRetries and staleReadBackoff bound how long a reconcile Get waits
	// in place for the API to catch up to an announced resource version. They
	// cover the common case of a short replication lag; anything longer surfaces
	// as ErrStaleRead so the controller's workqueue (and ultimately the periodic
	// re-list) takes over the retrying.
	staleReadRetries = 4
	staleReadBackoff = 250 * time.Millisecond
)

// NewClientGetCachedListRepositoryGetter backs Get with the API client — fresh,
// for the reconcile — and List with the NATS informer's snapshot (a
// unified-storage informer Cache). The quota count is the only List caller and
// tolerates the snapshot's staleness (as stale as the resync interval), so
// reading it avoids an API LIST on every quota check. Each reconcile Get is
// written back into the store (or removed on NotFound), keeping the count warm
// between re-lists rather than only as fresh as the last resync.
//
// floor is the freshness floor the informer events raise; Get refuses to return
// a read below it (retrying briefly, then ErrStaleRead). A nil floor disables
// the check.
func NewClientGetCachedListRepositoryGetter(c typedclient.ProvisioningV0alpha1Interface, store usinformer.Cache, floor *RVFloor) RepositoryGetter {
	return clientGetCachedListRepositoryGetter{client: c, store: store, floor: floor, retries: staleReadRetries, backoff: staleReadBackoff}
}

type clientGetCachedListRepositoryGetter struct {
	client  typedclient.ProvisioningV0alpha1Interface
	store   usinformer.Cache
	floor   *RVFloor
	retries int
	backoff time.Duration
}

func (g clientGetCachedListRepositoryGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
	var floor int64
	if g.floor != nil {
		floor = g.floor.Floor(namespace, name)
	}

	for attempt := 0; ; attempt++ {
		repo, err := g.client.Repositories(namespace).Get(ctx, name, metav1.GetOptions{})
		switch {
		case apierrors.IsNotFound(err) && floor == 0:
			// No outstanding floor, so the 404 is trusted: the object is gone, not
			// invisible. Drop it from the snapshot so the quota count stops counting
			// it without waiting for the next re-list.
			g.store.Delete(ctx, namespace, name)
			return nil, err
		case err != nil && !apierrors.IsNotFound(err):
			return nil, err
		case err == nil:
			rv := readRV(repo)
			// rv == 0 means the version did not parse (not a unified-storage
			// object); enforcement cannot apply, so fail open rather than spin.
			if floor == 0 || rv == 0 || rv >= floor {
				if g.floor != nil {
					g.floor.Settle(namespace, name, rv)
				}
				g.store.Update(ctx, repo)
				return repo, nil
			}
		}

		// Below the floor (or 404 while an event says the object exists): the
		// announced write is committed but not visible to this read path yet.
		if attempt+1 >= g.retries {
			return nil, fmt.Errorf("%w: repository %s/%s not visible at resource version %d after %d reads",
				ErrStaleRead, namespace, name, floor, attempt+1)
		}
		logging.FromContext(ctx).Info("reconcile read below announced resource version; retrying",
			"namespace", namespace, "repository", name, "floor", floor, "attempt", attempt+1)
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(g.backoff):
		}
	}
}

// readRV parses the object's resource version normalized to snowflake form, the
// same space RVFloor stores, so reads of rows that still carry legacy-format
// versions compare correctly against floors from the wire. Returns 0 when the
// version does not parse.
func readRV(repo *provisioningapis.Repository) int64 {
	rv, err := strconv.ParseInt(repo.ResourceVersion, 10, 64)
	if err != nil || rv <= 0 {
		return 0
	}
	return resource.ToSnowflakeRV(rv)
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
