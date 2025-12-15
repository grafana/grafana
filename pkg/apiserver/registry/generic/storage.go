package generic

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type registryStoreOptions struct {
	attrFunc storage.AttrFunc
}

type OptionFn func(*registryStoreOptions)

func WithAttrFunc(attrFunc storage.AttrFunc) OptionFn {
	return func(opts *registryStoreOptions) {
		opts.attrFunc = attrFunc
	}
}

func NewRegistryStore(scheme *runtime.Scheme, resourceInfo utils.ResourceInfo, optsGetter generic.RESTOptionsGetter, options ...OptionFn) (*registry.Store, error) {
	gv := resourceInfo.GroupVersion()
	gv.Version = runtime.APIVersionInternal
	strategy := NewStrategy(scheme, gv)
	if resourceInfo.IsClusterScoped() {
		strategy = strategy.WithClusterScope()
	}
	store := &registry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		KeyRootFunc:               KeyRootFunc(resourceInfo.GroupResource()),
		KeyFunc:                   NamespaceKeyFunc(resourceInfo.GroupResource()),
		//PredicateFunc:             Matcher,
		DefaultQualifiedResource:  resourceInfo.GroupResource(),
		SingularQualifiedResource: resourceInfo.SingularGroupResource(),
		TableConvertor:            resourceInfo.TableConverter(),
		CreateStrategy:            strategy,
		UpdateStrategy:            strategy,
		DeleteStrategy:            strategy,
	}

	opts := &registryStoreOptions{
		attrFunc: GetAttrs,
	}
	for _, opt := range options {
		opt(opts)
	}

	o := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: opts.attrFunc}
	if err := store.CompleteWithOptions(o); err != nil {
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
