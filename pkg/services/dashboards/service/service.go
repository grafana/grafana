package service

import (
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/k8saccess"
)

func ProvideSimpleDashboardService(
	features featuremgmt.FeatureToggles,
	svc *DashboardServiceImpl,
	k8s k8saccess.K8SAccess,
	store entity.EntityStoreServer,
) dashboards.DashboardService {
	if features.IsEnabled(featuremgmt.FlagK8sDashboards) {
		if k8s.GetSystemClient() == nil {
			panic("k8s dashboards requires the k8s client registered")
		}
		return k8saccess.NewDashboardService(svc, store)
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
