package informer

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
)

// GetFunc fetches the current typed object for a name in a namespace. A
// metadata-only watch transport (e.g. NATS) calls it to materialize the object
// after a change notification. Each per-resource wrapper supplies its own, bound
// to its typed client.
type GetFunc func(ctx context.Context, name string, opts metav1.GetOptions) (runtime.Object, error)

// WatchFunc produces the delta source (a watch.Interface) for a single resource
// type and namespace. It is the callback WrapClient routes every typed Watch
// through, so an informer's watch transport can be replaced without changing how
// its cache is seeded by LIST. get resolves the current object by name at the
// informer's own version, so a metadata-only transport can materialize
// notifications into the objects the SharedInformer expects.
type WatchFunc func(ctx context.Context, gvr schema.GroupVersionResource, namespace string, get GetFunc, opts metav1.ListOptions) (watch.Interface, error)
