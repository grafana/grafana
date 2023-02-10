package service

import (
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func ProvideSimpleDashboardService(
	features featuremgmt.FeatureToggles,
	svc dashboards.OriginalDashboardService,
	k8sDashboards dashboards.K8sDashboardService,
) dashboards.DashboardService {
	if features.IsEnabled(featuremgmt.FlagK8s) {
		return k8sDashboards
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
