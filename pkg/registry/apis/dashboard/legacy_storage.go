package dashboard

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type dashboardStorage struct {
	resource       utils.ResourceInfo
	access         legacy.DashboardAccess
	tableConverter rest.TableConvertor

	server resource.ResourceServer
}

func (s *dashboardStorage) newStore(scheme *runtime.Scheme, defaultOptsGetter generic.RESTOptionsGetter) (grafanarest.LegacyStorage, error) {
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend: s.access,
		Index:   s.access,
		// WriteAccess: resource.WriteAccessHooks{
		// 	Folder: func(ctx context.Context, user identity.Requester, uid string) bool {
		// 		// ???
		// 	},
		// },
	})
	if err != nil {
		return nil, err
	}
	s.server = server

	resourceInfo := s.resource
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
