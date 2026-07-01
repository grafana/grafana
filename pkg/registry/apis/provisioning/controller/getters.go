package controller

import (
	"k8s.io/apimachinery/pkg/labels"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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
