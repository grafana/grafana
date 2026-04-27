// Package resources holds identifiers for the Kubernetes resources that
// provisioning manages. GVR/GVK values are re-derived from the source-of-truth
// ResourceInfo registrations in apps/dashboard and apps/folder so renames and
// version bumps propagate automatically.
package resources

import (
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashboardV2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashboardV2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	folderV1beta1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
)

var (
	DashboardResource         = dashboardV1.DashboardResourceInfo.GroupVersionResource()
	DashboardKind             = dashboardV1.DashboardResourceInfo.GroupVersionKind()
	DashboardResourceV2       = dashboardV2.DashboardResourceInfo.GroupVersionResource()
	DashboardResourceV2alpha1 = dashboardV2alpha1.DashboardResourceInfo.GroupVersionResource()
	DashboardResourceV2beta1  = dashboardV2beta1.DashboardResourceInfo.GroupVersionResource()

	FolderResource = folderV1beta1.FolderResourceInfo.GroupVersionResource()
	FolderKind     = folderV1beta1.FolderResourceInfo.GroupVersionKind()
)
