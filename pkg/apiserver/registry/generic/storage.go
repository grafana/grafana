package generic

import (
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// SelectableFieldsOptions allows customizing field selector behavior for a resource.
type SelectableFieldsOptions struct {
	// GetAttrs returns labels and fields for the object.
	// If nil, the default GetAttrs is used which only exposes metadata.name.
	GetAttrs func(obj runtime.Object) (labels.Set, fields.Set, error)
}

func NewRegistryStore(scheme *runtime.Scheme, resourceInfo utils.ResourceInfo, optsGetter generic.RESTOptionsGetter) (*registry.Store, error) {
	return NewRegistryStoreWithSelectableFields(scheme, resourceInfo, optsGetter, SelectableFieldsOptions{})
}

// NewRegistryStoreWithSelectableFields creates a registry store with custom selectable fields support.
// Use this when you need to filter resources by custom fields like spec.connection.name.
func NewRegistryStoreWithSelectableFields(scheme *runtime.Scheme, resourceInfo utils.ResourceInfo, optsGetter generic.RESTOptionsGetter, fieldOpts SelectableFieldsOptions) (*registry.Store, error) {
	gv := resourceInfo.GroupVersion()
	gv.Version = runtime.APIVersionInternal
	strategy := NewStrategy(scheme, gv)
	if resourceInfo.IsClusterScoped() {
		strategy = strategy.WithClusterScope()
	}

	// Use custom GetAttrs if provided, otherwise use default
	attrFunc := GetAttrs
	predicateFunc := Matcher
	if fieldOpts.GetAttrs != nil {
		attrFunc = fieldOpts.GetAttrs
		// Create a matcher that uses the custom GetAttrs
		predicateFunc = func(label labels.Selector, field fields.Selector) storage.SelectionPredicate {
			return storage.SelectionPredicate{
				Label:    label,
				Field:    field,
				GetAttrs: attrFunc,
			}
		}
	}

	store := &registry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		KeyRootFunc:               KeyRootFunc(resourceInfo.GroupResource()),
		KeyFunc:                   NamespaceKeyFunc(resourceInfo.GroupResource()),
		PredicateFunc:             predicateFunc,
		DefaultQualifiedResource:  resourceInfo.GroupResource(),
		SingularQualifiedResource: resourceInfo.SingularGroupResource(),
		TableConvertor:            resourceInfo.TableConverter(),
		CreateStrategy:            strategy,
		UpdateStrategy:            strategy,
		DeleteStrategy:            strategy,
	}
	options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: attrFunc}
	if err := store.CompleteWithOptions(options); err != nil {
		return nil, err
	}
	return store, nil
}

func NewCompleteRegistryStore(scheme *runtime.Scheme, resourceInfo utils.ResourceInfo, optsGetter generic.RESTOptionsGetter) (*registry.Store, error) {
	registryStore, err := NewRegistryStore(scheme, resourceInfo, optsGetter)
	if err != nil {
		return nil, err
	}
	strategy := NewCompleteStrategy(scheme, resourceInfo.GroupVersion())
	registryStore.CreateStrategy = strategy
	registryStore.UpdateStrategy = strategy
	registryStore.DeleteStrategy = strategy
	return registryStore, nil
}

func NewRegistryStatusStore(scheme *runtime.Scheme, specStore *registry.Store) *StatusREST {
	gv := specStore.New().GetObjectKind().GroupVersionKind().GroupVersion()
	strategy := NewStatusStrategy(scheme, gv)
	return NewStatusREST(specStore, strategy)
}
