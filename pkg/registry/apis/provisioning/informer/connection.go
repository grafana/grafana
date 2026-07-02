package informer

import (
	"context"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
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

// NewConnectionDeltaSource returns the connection delta source and the read seam
// it backs as one Source: the informer the controller registers its handler on,
// merged with the ConnectionGetter it reconciles against. Under NATS, Get reads
// fresh from the API (there is no cache); otherwise it reads the informer's
// generated cache lister.
func NewConnectionDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration) *Source[*provisioningapis.Connection] {
	c := client.ProvisioningV0alpha1()
	if nats.Enabled(subscriber) {
		return &Source[*provisioningapis.Connection]{
			DeltaSource: NewConnectionInformer(subscriber, client, "", resync, usinformer.NewStore()),
			Getter: Getter[*provisioningapis.Connection]{
				get: func(ctx context.Context, namespace, name string) (*provisioningapis.Connection, error) {
					return c.Connections(namespace).Get(ctx, name, metav1.GetOptions{})
				},
			},
		}
	}
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Connections()
	return &Source[*provisioningapis.Connection]{
		DeltaSource: inf.Informer(),
		Getter:      NewCachedConnectionGetter(inf.Lister()),
	}
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
// generated lister, i.e. the informer's local cache. It is the getter the
// non-NATS delta source embeds, and is exposed for controllers that reconcile
// against a lister in tests.
func NewCachedConnectionGetter(lister listers.ConnectionLister) Getter[*provisioningapis.Connection] {
	return Getter[*provisioningapis.Connection]{
		get: func(_ context.Context, namespace, name string) (*provisioningapis.Connection, error) {
			return lister.Connections(namespace).Get(name)
		},
	}
}
