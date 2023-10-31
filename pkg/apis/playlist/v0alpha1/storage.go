package v0alpha1

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"

	grafanaregistry "github.com/grafana/grafana/pkg/services/grafana-apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/services/grafana-apiserver/rest"
)

var _ grafanarest.Storage = (*storage)(nil)

type storage struct {
	*genericregistry.Store
}

func newStorage(scheme *runtime.Scheme, optsGetter generic.RESTOptionsGetter, legacy *legacyStorage) (*storage, error) {
	strategy := grafanaregistry.NewStrategy(scheme)

	store := &genericregistry.Store{
		NewFunc:                   func() runtime.Object { return &Playlist{} },
		NewListFunc:               func() runtime.Object { return &PlaylistList{} },
		PredicateFunc:             grafanaregistry.Matcher,
		DefaultQualifiedResource:  legacy.DefaultQualifiedResource,
		SingularQualifiedResource: legacy.SingularQualifiedResource,
		TableConvertor:            legacy.tableConverter,

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
