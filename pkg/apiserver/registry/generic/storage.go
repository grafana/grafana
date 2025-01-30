package generic

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/generic/registry"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func NewRegistryStore(scheme *runtime.Scheme, resourceInfo utils.ResourceInfo, optsGetter generic.RESTOptionsGetter) (*registry.Store, error) {
	strategy := NewStrategy(scheme, resourceInfo.GroupVersion())
	store := &registry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		KeyRootFunc:               KeyRootFunc(resourceInfo.GroupResource()),
		KeyFunc:                   NamespaceKeyFunc(resourceInfo.GroupResource()),
		PredicateFunc:             Matcher,
		DefaultQualifiedResource:  resourceInfo.GroupResource(),
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

func NewRegistryStatusStore(scheme *runtime.Scheme, specStore *registry.Store) *StatusREST {
	gv := specStore.New().GetObjectKind().GroupVersionKind().GroupVersion()
	strategy := NewStatusStrategy(scheme, gv)
	return NewStatusREST(specStore, strategy)
}
