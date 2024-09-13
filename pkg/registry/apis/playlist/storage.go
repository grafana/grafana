package playlist

import (
	"strings"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"

	playlist "github.com/grafana/grafana/apps/playlist/apis/playlist/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

var _ grafanarest.Storage = (*storage)(nil)

type storage struct {
	*genericregistry.Store
}

func newStorage(scheme *runtime.Scheme, optsGetter generic.RESTOptionsGetter, legacy *legacyStorage) (*storage, error) {
	gr := schema.GroupResource{
		Group:    playlist.PlaylistKind().Group(),
		Resource: playlist.PlaylistKind().Plural(),
	}
	singularGR := schema.GroupResource{
		Group:    playlist.PlaylistKind().Group(),
		Resource: strings.ToLower(playlist.PlaylistKind().Kind()),
	}
	strategy := grafanaregistry.NewStrategy(scheme, gr.WithVersion(playlist.PlaylistKind().Version()).GroupVersion())
	store := &genericregistry.Store{
		NewFunc: func() runtime.Object {
			return playlist.PlaylistKind().ZeroValue()
		},
		NewListFunc: func() runtime.Object {
			return playlist.PlaylistKind().ZeroListValue()
		},
		KeyRootFunc:               grafanaregistry.KeyRootFunc(gr),
		KeyFunc:                   grafanaregistry.NamespaceKeyFunc(gr),
		PredicateFunc:             grafanaregistry.Matcher,
		DefaultQualifiedResource:  gr,
		SingularQualifiedResource: singularGR,
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
