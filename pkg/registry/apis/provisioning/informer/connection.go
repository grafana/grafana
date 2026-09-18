package informer

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"

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
// keeps the full-object list. Both callers follow [provisioning]
// keys_only_relist, in process over storage and in the operator over HTTP.
func NewConnectionDeltaSource(subscriber nats.Subscriber, client versioned.Interface, keys KeysLister, resync time.Duration, reg prometheus.Registerer) (DeltaSource, ConnectionGetter) {
	if nats.Enabled(subscriber) {
		resourceName := provisioningapis.ConnectionResourceInfo.GroupVersionResource().Resource
		onProjection := newRelistProjectionRecorder(reg, resourceName)
		source := NewConnectionInformer(subscriber, client, "", resync, usinformer.NewStore(), keys, onProjection)
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

// NewHTTPConnectionKeysLister lists connection keys through the apiserver, for
// the out-of-process operator.
func NewHTTPConnectionKeysLister(client rest.Interface) KeysLister {
	return NewHTTPKeysLister(client, provisioningapis.ConnectionResourceInfo.GroupVersionResource())
}

// NewConnectionInformer builds an Informer for connections. When keys is
// non-nil the periodic re-list is keys-only; otherwise it lists full objects.
func NewConnectionInformer(subscriber nats.Subscriber, client versioned.Interface, namespace string, resync time.Duration, store usinformer.Store, keys KeysLister, onProjection func(keysOnly bool)) *usinformer.Informer {
	c := client.ProvisioningV0alpha1()
	newObject := func(ns, name string) runtime.Object {
		return &provisioningapis.Connection{ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: name}}
	}
	return usinformer.NewInformer(subscriber, provisioningapis.ConnectionResourceInfo.GroupVersionResource(), namespace, resync, queueGroup, store, newObject, connectionList(c, namespace, keys, onProjection))
}

// connectionList builds the informer's re-list. With a keys lister it asks
// storage for identities only; without one, or against storage too old to honour
// the projection, it lists full objects.
func connectionList(c typedclient.ProvisioningV0alpha1Interface, namespace string, keys KeysLister, onProjection func(keysOnly bool)) func(context.Context) ([]runtime.Object, int64, error) {
	observe := func(keysOnly bool) {
		if onProjection != nil {
			onProjection(keysOnly)
		}
	}
	return func(ctx context.Context) ([]runtime.Object, int64, error) {
		if keys != nil {
			objs, listRV, err := listConnectionKeys(ctx, keys)
			if err == nil {
				observe(true)
				return objs, listRV, nil
			}
			if !errors.Is(err, ErrKeysOnlyUnsupported) {
				return nil, 0, err
			}
			// Storage predates keys_only. The full list is still correct, and
			// failing the tick would stop reconciling altogether.
			logging.FromContext(ctx).Warn("storage did not honour keys_only, re-listing full objects")
		}
		objs, listRV, err := listAllPages(ctx, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
			return c.Connections(namespace).List(ctx, opts)
		})
		if err == nil {
			observe(false)
		}
		return objs, listRV, err
	}
}

// listConnectionKeys collects a keys-only re-list into the minimal objects the
// informer's Store keys on. The Store diffs the whole set, so the stream has to
// be drained; the reconcile re-fetches the bodies it needs.
func listConnectionKeys(ctx context.Context, keys KeysLister) ([]runtime.Object, int64, error) {
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
