package informer

import (
	"context"
	"fmt"
	"time"

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
)

// RepositoryGetter is the read seam the repository controller reconciles
// against. It exposes exactly what the controller needs — the single repository
// under reconciliation, and a namespace-wide list for the quota count — so the
// source can be swapped without touching the controller.
//
// Get must return a current object (the reconcile acts on its spec); List backs
// the quota count, which tolerates staleness.
type RepositoryGetter interface {
	Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error)
	List(ctx context.Context, namespace string) ([]*provisioningapis.Repository, error)
}

// NewRepositoryDeltaSource returns the repository delta source and the getter it
// backs. Under NATS the getter reads reconcile state fresh from the API and the
// quota count from the informer's shared snapshot (written back on each reconcile
// read); otherwise the getter reads the informer's cache lister.
func NewRepositoryDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration) (DeltaSource, RepositoryGetter) {
	if nats.Enabled(subscriber) {
		store := usinformer.NewStore()
		source := NewRepositoryInformer(subscriber, client, "", resync, store)
		return source, NewClientGetCachedListRepositoryGetter(client.ProvisioningV0alpha1(), store)
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

// NewClientGetCachedListRepositoryGetter backs Get with the API client — fresh,
// for the reconcile — and List with the NATS informer's snapshot (a
// unified-storage informer Cache). The quota count is the only List caller and
// tolerates the snapshot's staleness (as stale as the resync interval), so
// reading it avoids an API LIST on every quota check. Each reconcile Get is
// written back into the store (or removed on NotFound), keeping the count warm
// between re-lists rather than only as fresh as the last resync.
func NewClientGetCachedListRepositoryGetter(c typedclient.ProvisioningV0alpha1Interface, store usinformer.Cache) RepositoryGetter {
	return clientGetCachedListRepositoryGetter{client: c, store: store}
}

type clientGetCachedListRepositoryGetter struct {
	client typedclient.ProvisioningV0alpha1Interface
	store  usinformer.Cache
}

func (g clientGetCachedListRepositoryGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
	repo, err := g.client.Repositories(namespace).Get(ctx, name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		g.store.Delete(ctx, namespace, name)
		// This read is decoupled from the NATS notification that enqueued the key,
		// so a 404 is usually a read-after-write race on a just-created repository,
		// not a deletion. Surface it as ErrNotObserved so the controller retries
		// (bounded) instead of dropping the key until the next resync; a genuine
		// delete exhausts the retries and is then forgotten.
		return nil, fmt.Errorf("%w: %s/%s", ErrNotObserved, namespace, name)
	}
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
