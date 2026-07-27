package informer

import (
	"context"
	"fmt"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
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

// NewConnectionDeltaSource returns the connection delta source and the getter it
// backs. Under NATS the informer warms an authoritative Store (fetch + validate
// before dispatch) and the getter reads that Store; otherwise it reads the
// informer's cache lister.
func NewConnectionDeltaSource(subscriber nats.Subscriber, client versioned.Interface, resync time.Duration) (DeltaSource, ConnectionGetter) {
	if nats.Enabled(subscriber) {
		store := usinformer.NewStore()
		source := NewConnectionInformer(subscriber, client, "", resync, store)
		return source, NewStoreConnectionGetter(store)
	}
	inf := informers.NewSharedInformerFactory(client, resync).Provisioning().V0alpha1().Connections()
	return inf.Informer(), NewCachedConnectionGetter(inf.Lister())
}

// NewConnectionInformer builds an Informer for connections. Under NATS it warms:
// the informer fetches and validates each notified connection into the Store
// before dispatching, so the reconcile reads a present, current object.
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
	get := func(ctx context.Context, ns, name string) (runtime.Object, error) {
		conn, err := c.Connections(ns).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		return conn, nil
	}
	return usinformer.NewInformer(subscriber, provisioningapis.ConnectionResourceInfo.GroupVersionResource(), namespace, resync, queueGroup, store, newObject, list, usinformer.WithGet(get))
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

// NewStoreConnectionGetter backs a ConnectionGetter with the NATS informer's
// warmed Store. Because the informer fetches and validates each notified object
// into the Store before dispatching, the Store is authoritative for the
// reconcile: a present object is current, and an absent one is genuinely gone.
func NewStoreConnectionGetter(store usinformer.Cache) ConnectionGetter {
	return storeConnectionGetter{store: store}
}

type storeConnectionGetter struct {
	store usinformer.Cache
}

func (g storeConnectionGetter) Get(ctx context.Context, namespace, name string) (*provisioningapis.Connection, error) {
	obj, ok := g.store.Get(ctx, namespace, name)
	if !ok {
		return nil, apierrors.NewNotFound(provisioningapis.ConnectionResourceInfo.GroupResource(), name)
	}
	conn, ok := obj.(*provisioningapis.Connection)
	if !ok {
		return nil, fmt.Errorf("unexpected object type %T in connection store", obj)
	}
	return conn, nil
}
