package controller

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
)

// RepositoryGetter is the read seam the repository controller reconciles
// against. It exposes exactly what the controller needs — the single repository
// under reconciliation, and a namespace-wide list for the quota count — so the
// source can be swapped without touching the controller.
//
// Get must return a current object (the reconcile acts on its spec); List backs
// the quota count, which tolerates staleness.
type RepositoryGetter interface {
	Get(namespace, name string) (*provisioning.Repository, error)
	List(namespace string) ([]*provisioning.Repository, error)
}

// ConnectionGetter is the read seam the connection controller reconciles
// against. It exposes only the single connection under reconciliation, so the
// source can be swapped without touching the controller.
type ConnectionGetter interface {
	Get(namespace, name string) (*provisioning.Connection, error)
}

// NewCachedRepositoryGetter backs a RepositoryGetter with the informer's
// generated lister, i.e. the informer's local cache.
func NewCachedRepositoryGetter(lister listers.RepositoryLister) RepositoryGetter {
	return cachedRepositoryGetter{lister: lister}
}

type cachedRepositoryGetter struct {
	lister listers.RepositoryLister
}

func (g cachedRepositoryGetter) Get(namespace, name string) (*provisioning.Repository, error) {
	return g.lister.Repositories(namespace).Get(name)
}

func (g cachedRepositoryGetter) List(namespace string) ([]*provisioning.Repository, error) {
	return g.lister.Repositories(namespace).List(labels.Everything())
}

// NewCachedConnectionGetter backs a ConnectionGetter with the informer's
// generated lister, i.e. the informer's local cache.
func NewCachedConnectionGetter(lister listers.ConnectionLister) ConnectionGetter {
	return cachedConnectionGetter{lister: lister}
}

type cachedConnectionGetter struct {
	lister listers.ConnectionLister
}

func (g cachedConnectionGetter) Get(namespace, name string) (*provisioning.Connection, error) {
	return g.lister.Connections(namespace).Get(name)
}

// The client-backed getters read straight through to the apiserver instead of an
// informer cache. They are used with the NATS-backed watch, where notifications
// round-robin across replicas and there is no cache to serve a fresh reconcile
// read. Each call uses context.Background() because the getter seam carries no
// context.

// RepositorySnapshotStore is the NATS informer's snapshot the getter reads the
// quota list from and writes fresh reconcile reads back into. It is a
// staleness-tolerant store — refreshed wholesale on each re-list — not a source
// of truth for the reconcile read.
type RepositorySnapshotStore interface {
	List() []runtime.Object
	Update(obj runtime.Object)
	Delete(namespace, name string)
}

// NewSnapshotListRepositoryGetter backs Get with the API client — fresh, for the
// reconcile — and List with the NATS informer's snapshot. The quota count is the
// only List caller and tolerates the snapshot's staleness (as stale as the
// resync interval), so reading it avoids an API LIST on every quota check. Each
// reconcile Get is written back into the store (or removed on NotFound), keeping
// the count warm between re-lists rather than only as fresh as the last resync.
func NewSnapshotListRepositoryGetter(c client.ProvisioningV0alpha1Interface, store RepositorySnapshotStore) RepositoryGetter {
	return snapshotListRepositoryGetter{client: c, store: store}
}

type snapshotListRepositoryGetter struct {
	client client.ProvisioningV0alpha1Interface
	store  RepositorySnapshotStore
}

func (g snapshotListRepositoryGetter) Get(namespace, name string) (*provisioning.Repository, error) {
	repo, err := g.client.Repositories(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		g.store.Delete(namespace, name)
		return nil, err
	}
	if err != nil {
		return nil, err
	}
	g.store.Update(repo)
	return repo, nil
}

func (g snapshotListRepositoryGetter) List(namespace string) ([]*provisioning.Repository, error) {
	var out []*provisioning.Repository
	for _, obj := range g.store.List() {
		repo, ok := obj.(*provisioning.Repository)
		if !ok || repo.Namespace != namespace {
			continue
		}
		out = append(out, repo)
	}
	return out, nil
}

// NewClientConnectionGetter backs a ConnectionGetter with the API client.
func NewClientConnectionGetter(c client.ProvisioningV0alpha1Interface) ConnectionGetter {
	return clientConnectionGetter{client: c}
}

type clientConnectionGetter struct {
	client client.ProvisioningV0alpha1Interface
}

func (g clientConnectionGetter) Get(namespace, name string) (*provisioning.Connection, error) {
	return g.client.Connections(namespace).Get(context.Background(), name, metav1.GetOptions{})
}
