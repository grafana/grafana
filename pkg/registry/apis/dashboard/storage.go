package dashboard

import (
	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"k8s.io/apimachinery/pkg/runtime"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
)

var _ grafanarest.Storage = (*storage)(nil)

type storage struct {
	*genericregistry.Store
}

func newStorage(scheme *runtime.Scheme) (*storage, error) {
	resourceInfo := dashboard.DashboardResourceInfo
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

	return &storage{Store: store}, nil
}
