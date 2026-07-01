package controller

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

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
// round-robin across replicas and the cache only fully re-syncs on the resync
// interval, so a cache-backed getter can be arbitrarily stale for the reconcile
// Get. Each call uses context.Background() because the getter seam carries no
// context.

// NewClientRepositoryGetter backs a RepositoryGetter with the API client.
func NewClientRepositoryGetter(c client.ProvisioningV0alpha1Interface) RepositoryGetter {
	return clientRepositoryGetter{client: c}
}

type clientRepositoryGetter struct {
	client client.ProvisioningV0alpha1Interface
}

func (g clientRepositoryGetter) Get(namespace, name string) (*provisioning.Repository, error) {
	return g.client.Repositories(namespace).Get(context.Background(), name, metav1.GetOptions{})
}

func (g clientRepositoryGetter) List(namespace string) ([]*provisioning.Repository, error) {
	list, err := g.client.Repositories(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]*provisioning.Repository, len(list.Items))
	for i := range list.Items {
		out[i] = &list.Items[i]
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
