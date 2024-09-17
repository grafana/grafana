package datasource

import (
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
)

var (
	_ rest.Storage = (*settingsStorage)(nil)
)

type settingsStorage struct {
	resourceInfo utils.ResourceInfo
	*genericregistry.Store
}

func newSettingsStorage(scheme *runtime.Scheme, resourceInfo utils.ResourceInfo, optsGetter generic.RESTOptionsGetter) (*settingsStorage, error) {
	strategy := grafanaregistry.NewStrategy(scheme, resourceInfo.GroupVersion())
	store := &genericregistry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		KeyRootFunc:               grafanaregistry.KeyRootFunc(resourceInfo.GroupResource()),
		KeyFunc:                   grafanaregistry.NamespaceKeyFunc(resourceInfo.GroupResource()),
		PredicateFunc:             grafanaregistry.Matcher,
		DefaultQualifiedResource:  resourceInfo.GroupResource(),
		SingularQualifiedResource: resourceInfo.SingularGroupResource(),
		CreateStrategy:            strategy,
		UpdateStrategy:            strategy,
		DeleteStrategy:            strategy,
		TableConvertor:            resourceInfo.TableConverter(),
	}

	options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: grafanaregistry.GetAttrs}
	err := store.CompleteWithOptions(options)
	return &settingsStorage{
		resourceInfo: resourceInfo,
		Store:        store,
	}, err
}

func (s *settingsStorage) ShortNames() []string {
	return s.resourceInfo.GetShortNames()
}
