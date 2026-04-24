// Package resources holds identifiers for the Kubernetes resources that
// provisioning manages. GVR/GVK values are re-derived from the source-of-truth
// ResourceInfo registrations in apps/dashboard so renames and version bumps
// propagate automatically.
package resources

import (
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashboardV2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

var (
	DashboardResource         = dashboardV1.DashboardResourceInfo.GroupVersionResource()
	DashboardKind             = dashboardV1.DashboardResourceInfo.GroupVersionKind()
	DashboardResourceV2alpha1 = dashboardV2alpha1.DashboardResourceInfo.GroupVersionResource()
	DashboardResourceV2beta1  = dashboardV2beta1.DashboardResourceInfo.GroupVersionResource()
)
