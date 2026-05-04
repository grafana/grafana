package correlations

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	v0alpha1 "github.com/grafana/grafana/apps/correlations/pkg/apis/correlation/v0alpha1"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver"
	apiClient "github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	resource2 "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/open-feature/go-sdk/openfeature"
)

func ProvideService(ctx context.Context, sqlStore db.DB, routeRegister routing.RouteRegister, ds datasources.DataSourceService, ac accesscontrol.AccessControl, bus bus.Bus, qs quota.Service, cfg *setting.Cfg, clientGen resource.ClientGenerator, restConfig apiserver.RestConfigProvider, userService user.Service, resourceClient resource2.ResourceClient,
) (Service, error) {
	client := openfeature.NewDefaultClient()
	if client.Boolean(ctx, featuremgmt.FlagGrafanaCorrelationsSkipLegacy, false, openfeature.TransactionContext(ctx)) {
		k8sHandler := apiClient.NewK8sHandler(
			request.GetNamespaceMapper(cfg),
			v0alpha1.CorrelationKind().GroupVersionResource(),
			restConfig.GetRestConfig,
			userService,
			resourceClient,
		)

		s := &CorrelationsK8sService{
			RouteRegister: routeRegister,
			log:           logger,
			AccessControl: ac,
			QuotaService:  qs,
			clientGen:     clientGen,
			k8sClient:     k8sHandler,
		}

		s.registerAPIEndpoints()
		bus.AddEventListener(s.handleDatasourceDeletion)

		defaultLimits, err := readQuotaConfig(cfg)
		if err != nil {
			return s, err
		}

		if err := qs.RegisterQuotaReporter(&quota.NewUsageReporter{
			TargetSrv:     QuotaTargetSrv,
			DefaultLimits: defaultLimits,
			Reporter:      s.Usage,
		}); err != nil {
			return s, err
		}

		return s, nil
	} else {
		s := &CorrelationsService{
			SQLStore:          sqlStore,
			RouteRegister:     routeRegister,
			log:               logger,
			DataSourceService: ds,
			AccessControl:     ac,
			QuotaService:      qs,
		}

		s.registerAPIEndpoints()

		bus.AddEventListener(s.handleDatasourceDeletion)

		defaultLimits, err := readQuotaConfig(cfg)
		if err != nil {
			return s, err
		}

		if err := qs.RegisterQuotaReporter(&quota.NewUsageReporter{
			TargetSrv:     QuotaTargetSrv,
			DefaultLimits: defaultLimits,
			Reporter:      s.Usage,
		}); err != nil {
			return s, err
		}

		return s, nil
	}
}

// this is for K8s to use if the dual write mode requires writing to legacy
// all endpoints, quotas, etc is handled from the K8s service called in the first place, so it's not needed here
func ProvideLegacyService(
	sqlStore db.DB,
	routeRegister routing.RouteRegister,
	ds datasources.DataSourceService,
	ac accesscontrol.AccessControl,
	qs quota.Service,
) (*CorrelationsService, error) {
	s := &CorrelationsService{
		SQLStore:          sqlStore,
		RouteRegister:     routeRegister,
		log:               logger,
		DataSourceService: ds,
		AccessControl:     ac,
		QuotaService:      qs,
	}
	return s, nil
}
