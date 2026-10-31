package app

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	v1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1"
)

// MergedName is the name of the preferences object that is the caller's
// preferences, merged. Nothing is stored under it.
const MergedName = "merged"

// MergedGetter answers a Get of MergedName from the preferences the caller
// owns, most specific first. The host calls it where the storage layer would
// look the name up, so a request is authorized as for any other name.
func (c *Config) MergedGetter() func(ctx context.Context, name string, owned []runtime.Object) (runtime.Object, error) {
	return func(_ context.Context, name string, owned []runtime.Object) (runtime.Object, error) {
		if name != MergedName {
			return nil, apierrors.NewNotFound(v1.PreferencesResourceInfo.GroupResource(), name)
		}
		items := make([]v1.Preferences, 0, len(owned))
		for _, obj := range owned {
			switch o := obj.(type) {
			case *v1.Preferences:
				items = append(items, *o)
			case *unstructured.Unstructured:
				var p v1.Preferences
				if err := runtime.DefaultUnstructuredConverter.FromUnstructured(o.Object, &p); err != nil {
					return nil, apierrors.NewInternalError(fmt.Errorf("reading preferences %q: %w", o.GetName(), err))
				}
				items = append(items, p)
			default:
				return nil, apierrors.NewInternalError(fmt.Errorf("expected preferences, got %T", obj))
			}
		}
		merged, err := c.Merge(items)
		if err != nil {
			return nil, apierrors.NewInternalError(err)
		}
		// The store serves unstructured objects, and its scheme has no typed ones.
		raw, err := runtime.DefaultUnstructuredConverter.ToUnstructured(merged)
		if err != nil {
			return nil, apierrors.NewInternalError(err)
		}
		return &unstructured.Unstructured{Object: raw}, nil
	}
}
