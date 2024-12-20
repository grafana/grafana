package plugincheck

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"

	advisor "github.com/grafana/grafana/pkg/apis/advisor/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

var _ grafanarest.Storage = (*storage)(nil)

type storage struct {
	*genericregistry.Store
}

func NewStorage(scheme *runtime.Scheme, optsGetter generic.RESTOptionsGetter, pluginStore pluginstore.Store, pluginRepo repo.Service) (*storage, error) {
	resourceInfo := advisor.PluginCheckResourceInfo
	strategy := grafanaregistry.NewStrategy(scheme, resourceInfo.GroupVersion())
	storageStrategy := newStrategy(scheme, resourceInfo.GroupVersion(), pluginStore, pluginRepo)

	store := &genericregistry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		KeyRootFunc:               grafanaregistry.KeyRootFunc(resourceInfo.GroupResource()),
		KeyFunc:                   grafanaregistry.NamespaceKeyFunc(resourceInfo.GroupResource()),
		PredicateFunc:             grafanaregistry.Matcher,
		DefaultQualifiedResource:  resourceInfo.GroupResource(),
		SingularQualifiedResource: resourceInfo.SingularGroupResource(),
		TableConvertor:            resourceInfo.TableConverter(),
		CreateStrategy:            storageStrategy,
		UpdateStrategy:            strategy,
		DeleteStrategy:            strategy,
	}
	options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: grafanaregistry.GetAttrs}
	if err := store.CompleteWithOptions(options); err != nil {
		return nil, err
	}
	return &storage{Store: store}, nil
}
