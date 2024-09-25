package search

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

var _ grafanarest.Storage = (*storage)(nil)

type storage struct {
	*genericregistry.Store
}

func newStorage(scheme *runtime.Scheme, optsGetter generic.RESTOptionsGetter) (*storage, error) {
	gr := schema.GroupResource{
		Group:    "search.grafana.app",
		Resource: "search",
	}
	singularGR := schema.GroupResource{
		Group:    "search.grafana.app",
		Resource: "search",
	}
	groupVersion := schema.GroupVersion{
		Group:   "search.grafana.app",
		Version: "v0alpha1",
	}
	strategy := grafanaregistry.NewStrategy(scheme, groupVersion)
	store := &genericregistry.Store{
		//NewFunc:                   resourceInfo.NewFunc,
		//NewListFunc:               resourceInfo.NewListFunc,
		KeyRootFunc:               grafanaregistry.KeyRootFunc(gr),
		KeyFunc:                   grafanaregistry.NamespaceKeyFunc(gr),
		PredicateFunc:             grafanaregistry.Matcher,
		DefaultQualifiedResource:  gr,
		SingularQualifiedResource: singularGR,
		TableConvertor:            rest.NewDefaultTableConvertor(gr),

		CreateStrategy: strategy,
		UpdateStrategy: strategy,
		DeleteStrategy: strategy,
	}
	options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: grafanaregistry.GetAttrs}
	if err := store.CompleteWithOptions(options); err != nil {
		return nil, err
	}
	return &storage{Store: store}, nil
}
