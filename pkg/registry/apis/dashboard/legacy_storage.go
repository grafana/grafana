package dashboard

import (
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type DashboardStorage struct {
	Resource       utils.ResourceInfo
	Access         legacy.DashboardAccess
	TableConverter rest.TableConvertor

	Server   resource.ResourceServer
	Features featuremgmt.FeatureToggles
}

func (s *DashboardStorage) NewStore(scheme *runtime.Scheme, defaultOptsGetter generic.RESTOptionsGetter, reg prometheus.Registerer) (grafanarest.LegacyStorage, error) {
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend: s.Access,
		Index:   s.Access,
		Reg:     reg,
		// WriteAccess: resource.WriteAccessHooks{
		// 	Folder: func(ctx context.Context, user identity.Requester, uid string) bool {
		// 		// ???
		// 	},
		// },
	})
	if err != nil {
		return nil, err
	}
	s.Server = server

	resourceInfo := s.Resource
	defaultOpts, err := defaultOptsGetter.GetRESTOptions(resourceInfo.GroupResource(), nil)
	if err != nil {
		return nil, err
	}
	client := resource.NewLocalResourceClient(server)
	optsGetter := apistore.NewRESTOptionsGetterForClient(client,
		defaultOpts.StorageConfig.Config,
	)
	return grafanaregistry.NewRegistryStore(scheme, resourceInfo, optsGetter)
}
