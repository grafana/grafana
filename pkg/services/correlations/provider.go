package correlations

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
)

// ProvideService is the wire provider that switches based on feature flag
/*func ProvideService(
    cfg *setting.Cfg,
    features featuremgmt.FeatureToggles,
    // ... other dependencies both implementations need
) (Service, error) {
    // Check if the feature flag is enabled
    if features.IsEnabledGlobally(featuremgmt.FlagYourFeatureName) {
        // Return app platform version
        return &AppPlatformService{
            // ... initialize with dependencies
        }, nil
    }

    // Return legacy version
    return &LegacyService{
        // ... initialize with dependencies
    }, nil
} */

/*
	RouteRegister     routing.RouteRegister
	log               log.Logger
	AccessControl     accesscontrol.AccessControl
	QuotaService      quota.Service
	clientGen         resource.ClientGenerator
	xk8sClient         *v0alpha1.CorrelationClient
	xk8sClientInitErr  error
*/

func ProvideService(ctx context.Context, sqlStore db.DB, routeRegister routing.RouteRegister, ds datasources.DataSourceService, ac accesscontrol.AccessControl, bus bus.Bus, qs quota.Service, cfg *setting.Cfg, clientGen resource.ClientGenerator,
) (Service, error) {
	client := openfeature.NewDefaultClient()
	if client.Boolean(ctx, featuremgmt.FlagGrafanaCorrelationsSkipLegacy, false, openfeature.TransactionContext(ctx)) {
		s := &CorrelationsK8sService{
			RouteRegister: routeRegister,
			log:           logger,
			AccessControl: ac,
			QuotaService:  qs,
			clientGen:     clientGen,
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

// this is available if we need to call the legacy service directly
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
	// NOTE: Do NOT register HTTP endpoints - those are handled by ProvideService
	// NOTE: Do NOT register event listeners - only the main service should listen
	// NOTE: Do NOT register quota - the main service handles quota reporting
	return s, nil
}
