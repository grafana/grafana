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
// backs. Under NATS the informer warms an authoritative Store (fetch + validate
// before dispatch) and the getter reads that Store; otherwise the getter reads
// the informer's cache lister.
func NewRepositoryDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration) (DeltaSource, RepositoryGetter) {
	if nats.Enabled(subscriber) {
		store := usinformer.NewStore()
		source := NewRepositoryInformer(subscriber, client, "", resync, store)
		return source, NewStoreRepositoryGetter(store)
	}
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Repositories()
	return inf.Informer(), NewCachedRepositoryGetter(inf.Lister())
}

// NewRepositoryInformer builds an Informer for repositories. Under NATS it warms:
// the informer fetches and validates each notified repository into the Store
// before dispatching, so the reconcile reads a present, current object.
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
	get := func(ctx context.Context, ns, name string) (runtime.Object, error) {
		repo, err := c.Repositories(ns).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		return repo, nil
	}
	return usinformer.NewInformer(subscriber, provisioningapis.RepositoryResourceInfo.GroupVersionResource(), namespace, resync, queueGroup, store, newObject, list, usinformer.WithGet(get))
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

// NewStoreRepositoryGetter backs a RepositoryGetter with the NATS informer's
// warmed Store. Because the informer fetches and validates each notified object
// into the Store before dispatching, the Store is authoritative for the
// reconcile: a present object is current, and an absent one is genuinely gone
// rather than merely not-yet-fetched. List serves the quota count from the same
// Store.
func NewStoreRepositoryGetter(store usinformer.Cache) RepositoryGetter {
	return storeRepositoryGetter{store: store}
}

type storeRepositoryGetter struct {
	store usinformer.Cache
}

func (g storeRepositoryGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Repository, error) {
	obj, ok := g.store.Get(ctx, namespace, name)
	if !ok {
		return nil, apierrors.NewNotFound(provisioningapis.RepositoryResourceInfo.GroupResource(), name)
	}
	repo, ok := obj.(*provisioningapis.Repository)
	if !ok {
		return nil, fmt.Errorf("unexpected object type %T in repository store", obj)
	}
	return repo, nil
}

func (g storeRepositoryGetter) List(ctx context.Context, namespace string) ([]*provisioningapis.Repository, error) {
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
