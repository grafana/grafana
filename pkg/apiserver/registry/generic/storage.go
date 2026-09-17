package generic

import (
	"context"

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
	var attrFunc storage.AttrFunc
	var predicateFunc func(label labels.Selector, field fields.Selector) storage.SelectionPredicate
	if fieldOpts.GetAttrs != nil {
		attrFunc = fieldOpts.GetAttrs
		// Pass nil predicateFunc to use default behavior with custom attrFunc
		predicateFunc = nil
	} else {
		attrFunc = GetAttrs
		predicateFunc = Matcher
	}

	var keyFunc func(ctx context.Context, name string) (string, error)
	if resourceInfo.IsClusterScoped() {
		keyFunc = ClusterScopedKeyFunc(resourceInfo.GroupResource())
	} else {
		keyFunc = NamespaceKeyFunc(resourceInfo.GroupResource())
	}

	store := &registry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		KeyRootFunc:               KeyRootFunc(resourceInfo.GroupResource()),
		KeyFunc:                   keyFunc,
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

// StatusStoreOptions configures the status strategy built by
// NewRegistryStatusStore. Populated via StatusStoreOption funcs so new
// options can be added without changing NewRegistryStatusStore's signature.
type StatusStoreOptions struct {
	AllowBundlingSpec   bool
	AllowBundlingSecure bool
}

// StatusStoreOption mutates StatusStoreOptions; construct one with a With...
// func below rather than setting fields directly.
type StatusStoreOption func(*StatusStoreOptions)

// WithAllowBundlingSpec allows a status-subresource update to also change
// spec, skipping genericStatusStrategy's reset-to-old-value guard. Only for
// kinds whose callers are already trusted to validate their own spec
// changes: admission never sees or validates a spec change smuggled in
// through /status, guard or not.
func WithAllowBundlingSpec() StatusStoreOption {
	return func(o *StatusStoreOptions) { o.AllowBundlingSpec = true }
}

// WithAllowBundlingSecure is the same, for secure values.
func WithAllowBundlingSecure() StatusStoreOption {
	return func(o *StatusStoreOptions) { o.AllowBundlingSecure = true }
}

func NewRegistryStatusStore(scheme *runtime.Scheme, specStore *registry.Store, opts ...StatusStoreOption) *StatusREST {
	var options StatusStoreOptions
	for _, opt := range opts {
		opt(&options)
	}

	gv := specStore.New().GetObjectKind().GroupVersionKind().GroupVersion()
	strategy := NewStatusStrategy(scheme, gv)
	if options.AllowBundlingSpec {
		strategy = strategy.WithAllowBundlingSpec()
	}
	if options.AllowBundlingSecure {
		strategy = strategy.WithAllowBundlingSecure()
	}
	return NewStatusREST(specStore, strategy)
}
