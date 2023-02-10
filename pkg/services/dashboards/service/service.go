package service

import (
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	k8sDashboards "github.com/grafana/grafana/pkg/services/k8s/resources/dashboards"
)

func ProvideSimpleDashboardService(
	features featuremgmt.FeatureToggles,
	svc *DashboardServiceImpl,
	k8sDashboards *k8sDashboards.Service,
) dashboards.DashboardService {
	if features.IsEnabled(featuremgmt.FlagK8s) {
		return k8sDashboards.WithDashboardService(svc)
	}
	return svc
}

func ProvideDashboardProvisioningService(
	features featuremgmt.FeatureToggles, orig *DashboardServiceImpl,
) dashboards.DashboardProvisioningService {
	return orig
}

func ProvideDashboardPluginService(
	features featuremgmt.FeatureToggles, orig *DashboardServiceImpl,
) dashboards.PluginService {
	return orig
}
