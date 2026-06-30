package informer

import (
	"context"
	"errors"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
)

// WatchFunc produces the delta source (a watch.Interface) for a single resource
// type and namespace. It is the injection point used to replace an informer's
// watch transport without changing how its cache is seeded by LIST.
type WatchFunc func(ctx context.Context, gvr schema.GroupVersionResource, namespace string, opts metav1.ListOptions) (watch.Interface, error)

// ErrNotImplemented is returned by NotImplemented.
var ErrNotImplemented = errors.New("informer watch: not implemented")

// NotImplemented is a placeholder WatchFunc that always fails. It lets callers
// wire up the watch-swap mechanism before a real transport (e.g. a NATS-based
// watch) exists.
func NotImplemented(context.Context, schema.GroupVersionResource, string, metav1.ListOptions) (watch.Interface, error) {
	return nil, ErrNotImplemented
}
