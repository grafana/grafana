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
	return newDeltaSourceInformer(subscriber, provisioningapis.ConnectionResourceInfo, namespace, resync, store, true,
		typedListFunc(func(ctx context.Context) (runtime.Object, error) {
			return c.Connections(namespace).List(ctx, metav1.ListOptions{})
		}))
}

// NewCachedConnectionGetter backs a ConnectionGetter with the informer's
// generated lister, i.e. the informer's local cache.
func NewCachedConnectionGetter(lister listers.ConnectionLister) ConnectionGetter {
	return typedGetter[*provisioningapis.Connection]{
		get: func(_ context.Context, namespace, name string) (*provisioningapis.Connection, error) {
			return lister.Connections(namespace).Get(name)
		},
	}
}

// NewClientConnectionGetter backs a ConnectionGetter with the API client, for
// the NATS watch where there is no informer cache to serve a fresh reconcile read.
func NewClientConnectionGetter(c typedclient.ProvisioningV0alpha1Interface) ConnectionGetter {
	return typedGetter[*provisioningapis.Connection]{
		get: func(ctx context.Context, namespace, name string) (*provisioningapis.Connection, error) {
			return c.Connections(namespace).Get(ctx, name, metav1.GetOptions{})
		},
	}
}
