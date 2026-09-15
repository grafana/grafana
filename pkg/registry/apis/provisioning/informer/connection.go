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
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
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
//
// A non-nil keys makes the NATS re-list keys-only (identity, no bodies); nil
// keeps the full-object list. The operator passes nil (no in-process client).
func NewConnectionDeltaSource(subscriber nats.Subscriber, client versioned.Interface, keys KeysLister, resync time.Duration) (DeltaSource, ConnectionGetter) {
	if nats.Enabled(subscriber) {
		source := NewConnectionInformer(subscriber, client, "", resync, usinformer.NewStore(), keys)
		// Same as the repository informer: the controller's only feed, with
		// connection health checks driven by the re-list, so it must keep
		// operating at the re-list cadence while NATS is unavailable rather
		// than gate on the subscription.
		source.AllowDegradedStart()
		return source, NewClientConnectionGetter(client.ProvisioningV0alpha1())
	}
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Connections()
	return inf.Informer(), NewCachedConnectionGetter(inf.Lister())
}

// NewGRPCConnectionKeysLister lists connection keys from unified storage over
// gRPC, for the in-process server.
func NewGRPCConnectionKeysLister(store resourcepb.ResourceStoreClient) KeysLister {
	return NewGRPCKeysLister(store, provisioningapis.ConnectionResourceInfo.GroupVersionResource())
}

// NewConnectionInformer builds an Informer for connections. When keys is
// non-nil the periodic re-list is keys-only; otherwise it lists full objects.
func NewConnectionInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, store usinformer.Store, keys KeysLister) *usinformer.Informer {
	c := client.ProvisioningV0alpha1()
	newObject := func(ns, name string) runtime.Object {
		return &provisioningapis.Connection{ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: name}}
	}
	list := func(ctx context.Context) ([]runtime.Object, int64, error) {
		if keys != nil {
			// The informer's Store diffs the full set, so collect the key stream
			// into the minimal objects it keys on; the reconcile re-fetches bodies.
			listRV, seq := keys.ListKeys(ctx)
			var objs []runtime.Object
			for k, err := range seq {
				if err != nil {
					return nil, 0, err
				}
				objs = append(objs, &provisioningapis.Connection{ObjectMeta: metav1.ObjectMeta{
					Namespace:       k.Namespace,
					Name:            k.Name,
					ResourceVersion: k.ResourceVersion,
				}})
			}
			return objs, listRV, nil
		}
		return listAllPages(ctx, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
			return c.Connections(namespace).List(ctx, opts)
		})
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
