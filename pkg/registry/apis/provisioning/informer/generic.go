package informer

import (
	"context"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/nats"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// newDeltaSourceInformer builds a NATS-backed informer for one resource kind from
// its ResourceInfo, so a kind supplies only its ResourceInfo and a list source —
// not a hand-written live-event builder or a []runtime.Object copy loop. When
// liveObjects is true the informer subscribes and, on each notification, delivers
// the kind's concrete type (from info); when false it is driven only by the
// periodic re-list (see NewHistoricJobInformer).
func newDeltaSourceInformer(subscriber nats.Subscriber, info utils.ResourceInfo, namespace string, resync time.Duration, store usinformer.Store, liveObjects bool, list usinformer.ListFunc) *usinformer.Informer {
	var newObject usinformer.ObjectFunc
	if liveObjects {
		newObject = newObjectFunc(info)
	}
	return usinformer.NewInformer(subscriber, info.GroupVersionResource(), namespace, resync, queueGroup, store, newObject, list)
}

// newObjectFunc builds the minimal live-event object for a kind: the kind's
// concrete type (from info.NewFunc) carrying just the notification's identity.
// The controllers key off the concrete Go type and re-fetch in their reconcile,
// so only namespace and name are set.
func newObjectFunc(info utils.ResourceInfo) usinformer.ObjectFunc {
	return func(namespace, name string) runtime.Object {
		obj := info.NewFunc()
		if accessor, err := meta.Accessor(obj); err == nil {
			accessor.SetNamespace(namespace)
			accessor.SetName(name)
		}
		return obj
	}
}

// typedListFunc adapts a typed LIST (returning the kind's *XList) into the
// flattened []runtime.Object the informer consumes, replacing the per-kind copy
// loop with meta.ExtractList.
func typedListFunc(list func(ctx context.Context) (runtime.Object, error)) usinformer.ListFunc {
	return func(ctx context.Context) ([]runtime.Object, error) {
		l, err := list(ctx)
		if err != nil {
			return nil, err
		}
		return meta.ExtractList(l)
	}
}

// NewDynamicListFunc is the GVR-driven alternative to a typed LIST: it lists via a
// dynamic client keyed on the kind's GVR and converts each item into the kind's
// concrete type (from info.NewFunc), so a kind can be wired without a typed
// clientset accessor while still delivering the concrete objects the controllers
// key off. The typed getters still need a typed client, so this replaces the
// informer's list adapter, not the getter. namespace scopes the LIST; pass "" to
// list every namespace.
func NewDynamicListFunc(client dynamic.Interface, info utils.ResourceInfo, namespace string) usinformer.ListFunc {
	gvr := info.GroupVersionResource()
	return func(ctx context.Context) ([]runtime.Object, error) {
		var lister dynamic.ResourceInterface = client.Resource(gvr)
		if namespace != "" {
			lister = client.Resource(gvr).Namespace(namespace)
		}
		list, err := lister.List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		out := make([]runtime.Object, len(list.Items))
		for i := range list.Items {
			obj := info.NewFunc()
			if err := runtime.DefaultUnstructuredConverter.FromUnstructured(list.Items[i].Object, obj); err != nil {
				return nil, err
			}
			out[i] = obj
		}
		return out, nil
	}
}

// typedGetter is the read seam a controller reconciles against, generic over the
// resource's concrete pointer type. One type serves every kind and satisfies both
// the Get-only and the Get+List controller getter interfaces, in three shapes
// selected by which fields are set:
//   - cache-backed: get and list read the informer's generated lister.
//   - client-backed with write-through: get reads the API and writes the result
//     into store (dropping the key on NotFound); List reads store — the
//     staleness-tolerant quota count kept warm between re-lists.
//   - client-backed, Get-only: get reads the API; List is unused (nil list, nil
//     store) and returns nothing.
type typedGetter[T runtime.Object] struct {
	get   func(ctx context.Context, namespace, name string) (T, error)
	list  func(ctx context.Context, namespace string) ([]T, error)
	store usinformer.Cache
}

func (g typedGetter[T]) Get(ctx context.Context, namespace, name string) (T, error) {
	obj, err := g.get(ctx, namespace, name)
	if g.store == nil {
		return obj, err
	}
	// Keep the shared snapshot warm between re-lists: write a successful read
	// through, and drop the key when the object has vanished, so the quota count
	// reflects this reconcile without waiting for the next re-list.
	if apierrors.IsNotFound(err) {
		g.store.Delete(ctx, namespace, name)
		return obj, err
	}
	if err != nil {
		return obj, err
	}
	g.store.Update(ctx, obj)
	return obj, nil
}

func (g typedGetter[T]) List(ctx context.Context, namespace string) ([]T, error) {
	if g.list != nil {
		return g.list(ctx, namespace)
	}
	if g.store == nil {
		return nil, nil
	}
	var out []T
	for _, obj := range g.store.List(ctx) {
		t, ok := obj.(T)
		if !ok {
			continue
		}
		if accessor, err := meta.Accessor(t); err != nil || accessor.GetNamespace() != namespace {
			continue
		}
		out = append(out, t)
	}
	return out, nil
}
