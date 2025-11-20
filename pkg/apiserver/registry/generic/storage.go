package generic

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/generic/registry"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func NewRegistryStore(scheme *runtime.Scheme, resourceInfo utils.ResourceInfo, optsGetter generic.RESTOptionsGetter) (*registry.Store, error) {
	gv := resourceInfo.GroupVersion()
	gv.Version = runtime.APIVersionInternal
	strategy := NewStrategy(scheme, gv)

	gr := resourceInfo.GroupResource()
	var keyRootFunc func(ctx context.Context) string
	var keyFunc func(ctx context.Context, name string) (string, error)

	if resourceInfo.IsClusterScoped() {
		strategy = strategy.WithClusterScope()
		keyRootFunc = ClusterScopedKeyRootFunc(gr)
		keyFunc = ClusterScopedKeyFunc(gr)
	} else {
		keyRootFunc = KeyRootFunc(gr)
		keyFunc = NamespaceKeyFunc(gr)
	}

	store := &registry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		KeyRootFunc:               keyRootFunc,
		KeyFunc:                   keyFunc,
		PredicateFunc:             Matcher,
		DefaultQualifiedResource:  gr,
		SingularQualifiedResource: resourceInfo.SingularGroupResource(),
		TableConvertor:            resourceInfo.TableConverter(),
		CreateStrategy:            strategy,
		UpdateStrategy:            strategy,
		DeleteStrategy:            strategy,
	}
	options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: GetAttrs}
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
