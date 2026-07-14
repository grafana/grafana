package generic

import (
	"context"

	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic/registry"
)

// VersionedStore wraps a registry.Store and overrides List to re-stamp each
// item's GroupVersionKind so it matches the API version being served. This is
// needed when the same Go types are registered under multiple API versions.
type VersionedStore struct {
	*registry.Store
	targetGV schema.GroupVersion
}

// NewVersionedStore creates a VersionedStore that re-stamps list items to
// match targetGV. Use this when the underlying store may return items whose
// GVK differs from the API version being served (shared-type multi-version
// pattern).
func NewVersionedStore(store *registry.Store, targetGV schema.GroupVersion) *VersionedStore {
	return &VersionedStore{Store: store, targetGV: targetGV}
}

func (v *VersionedStore) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	obj, err := v.Store.List(ctx, options)
	if err != nil {
		return nil, err
	}

	items, err := meta.ExtractList(obj)
	if err != nil {
		return obj, nil
	}

	for _, item := range items {
		gvk := item.GetObjectKind().GroupVersionKind()
		if gvk.Group == v.targetGV.Group && gvk.Version != v.targetGV.Version {
			item.GetObjectKind().SetGroupVersionKind(v.targetGV.WithKind(gvk.Kind))
		}
	}

	return obj, nil
}
