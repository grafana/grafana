package generic

import (
	"context"

	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/names"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// SelectableFieldsOptions allows customizing field selector behavior for a resource.
type SelectableFieldsOptions struct {
	// GetAttrs returns labels and fields for the object.
	// If nil, the default GetAttrs is used which only exposes metadata.name.
	GetAttrs func(obj runtime.Object) (labels.Set, fields.Set, error)
}

// StoreOptions allows per-resource customization of the registry store; naming mirrors grafana-app-sdk.
type StoreOptions struct {
	// NameGenerator is used when metadata.generateName is set; defaults to names.SimpleNameGenerator.
	NameGenerator names.NameGenerator
}

// Option configures a registry store created by NewRegistryStore.
type Option func(*storeConfig)

type storeConfig struct {
	nameGenerator names.NameGenerator
	getAttrs      func(obj runtime.Object) (labels.Set, fields.Set, error)
}

// WithNameGenerator sets the name generator used when metadata.generateName is set.
func WithNameGenerator(ng names.NameGenerator) Option {
	return func(c *storeConfig) { c.nameGenerator = ng }
}

// WithGetAttrs sets a custom GetAttrs func for field-selector filtering.
func WithGetAttrs(fn func(obj runtime.Object) (labels.Set, fields.Set, error)) Option {
	return func(c *storeConfig) { c.getAttrs = fn }
}

// NewRegistryStore creates a registry store, optionally customized via Options.
func NewRegistryStore(scheme *runtime.Scheme, resourceInfo utils.ResourceInfo, optsGetter generic.RESTOptionsGetter, opts ...Option) (*registry.Store, error) {
	cfg := &storeConfig{}
	for _, o := range opts {
		o(cfg)
	}

	gv := resourceInfo.GroupVersion()
	gv.Version = runtime.APIVersionInternal
	strategy := NewStrategy(scheme, gv).WithNameGenerator(cfg.nameGenerator)
	if resourceInfo.IsClusterScoped() {
		strategy = strategy.WithClusterScope()
	}

	// Use custom GetAttrs if provided, otherwise use default
	var attrFunc storage.AttrFunc
	var predicateFunc func(label labels.Selector, field fields.Selector) storage.SelectionPredicate
	if cfg.getAttrs != nil {
		attrFunc = cfg.getAttrs
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
	storeOpts := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: attrFunc}
	if err := store.CompleteWithOptions(storeOpts); err != nil {
		return nil, err
	}
	return store, nil
}

// Deprecated: use NewRegistryStore with WithGetAttrs.
func NewRegistryStoreWithSelectableFields(scheme *runtime.Scheme, resourceInfo utils.ResourceInfo, optsGetter generic.RESTOptionsGetter, fieldOpts SelectableFieldsOptions) (*registry.Store, error) {
	return NewRegistryStore(scheme, resourceInfo, optsGetter, WithGetAttrs(fieldOpts.GetAttrs))
}

// Deprecated: use NewRegistryStore with WithNameGenerator and/or WithGetAttrs.
func NewRegistryStoreWithOptions(scheme *runtime.Scheme, resourceInfo utils.ResourceInfo, optsGetter generic.RESTOptionsGetter, storeOpts StoreOptions, fieldOpts SelectableFieldsOptions) (*registry.Store, error) {
	return NewRegistryStore(scheme, resourceInfo, optsGetter, WithNameGenerator(storeOpts.NameGenerator), WithGetAttrs(fieldOpts.GetAttrs))
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
