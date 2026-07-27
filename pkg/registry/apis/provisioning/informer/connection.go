package informer

import (
	"context"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	typedclient "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/nats"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// ConnectionGetter is the read seam the connection controller reconciles
// against. It exposes only the single connection under reconciliation, so the
// source can be swapped without touching the controller.
type ConnectionGetter interface {
	Get(ctx context.Context, namespace, name string) (*provisioningapis.Connection, error)
}

// NewConnectionDeltaSource returns the connection delta source and the getter it
// backs. Under NATS the getter reads reconcile state fresh from the API;
// otherwise it reads the informer's cache lister.
func NewConnectionDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration) (DeltaSource, ConnectionGetter) {
	if nats.Enabled(subscriber) {
		source := NewConnectionInformer(subscriber, client, "", resync, usinformer.NewStore())
		return source, NewClientConnectionGetter(client.ProvisioningV0alpha1())
	}
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Connections()
	return inf.Informer(), NewCachedConnectionGetter(inf.Lister())
}

// NewConnectionInformer builds an Informer for connections.
func NewConnectionInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, store usinformer.Store) *usinformer.Informer {
	c := client.ProvisioningV0alpha1()
	newObject := func(ns, name string) runtime.Object {
		return &provisioningapis.Connection{ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: name}}
	}
	list := func(ctx context.Context) ([]runtime.Object, error) {
		l, err := c.Connections(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		out := make([]runtime.Object, len(l.Items))
		for i := range l.Items {
			out[i] = &l.Items[i]
		}
		return out, nil
	}
	return usinformer.NewInformer(subscriber, provisioningapis.ConnectionResourceInfo.GroupVersionResource(), namespace, resync, queueGroup, store, newObject, list)
}

// NewCachedConnectionGetter backs a ConnectionGetter with the informer's
// generated lister, i.e. the informer's local cache.
func NewCachedConnectionGetter(lister listers.ConnectionLister) ConnectionGetter {
	return cachedConnectionGetter{lister: lister}
}

type cachedConnectionGetter struct {
	lister listers.ConnectionLister
}

func (g cachedConnectionGetter) Get(_ context.Context, namespace, name string) (*provisioningapis.Connection, error) {
	return g.lister.Connections(namespace).Get(name)
}

// NewClientConnectionGetter backs a ConnectionGetter with the API client, for
// the NATS watch where there is no informer cache to serve a fresh reconcile read.
func NewClientConnectionGetter(c typedclient.ProvisioningV0alpha1Interface) ConnectionGetter {
	return clientConnectionGetter{client: c}
}

type clientConnectionGetter struct {
	client typedclient.ProvisioningV0alpha1Interface
}

func (g clientConnectionGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Connection, error) {
	return g.client.Connections(namespace).Get(ctx, name, metav1.GetOptions{})
}
