package plugindashboards

import (
	"context"

	"github.com/grafana/grafana/pkg/services/dashboards"
)

// PluginDashboard plugin dashboard model..
type PluginDashboard struct {
	UID              string `json:"uid"`
	PluginId         string `json:"pluginId"`
	Title            string `json:"title"`
	Imported         bool   `json:"imported"`
	ImportedUri      string `json:"importedUri"`
	ImportedUrl      string `json:"importedUrl"`
	Slug             string `json:"slug"`
	DashboardId      int64  `json:"dashboardId"`
	FolderId         int64  `json:"folderId"`
	ImportedRevision int64  `json:"importedRevision"`
	Revision         int64  `json:"revision"`
	Description      string `json:"description"`
	Reference        string `json:"path"`
	Removed          bool   `json:"removed"`
}

// ListPluginDashboardsRequest request object for listing plugin dashboards.
type ListPluginDashboardsRequest struct {
	OrgID    int64
	PluginID string
}

// ListPluginDashboardsResponse response object for listing plugin dashboards.
type ListPluginDashboardsResponse struct {
	Items []*PluginDashboard
}

// LoadPluginDashboardRequest request object for loading a plugin dashboard.
type LoadPluginDashboardRequest struct {
	PluginID  string
	Reference string
}

// LoadPluginDashboardResponse response object for loading a plugin dashboard.
type LoadPluginDashboardResponse struct {
	Dashboard *dashboards.Dashboard
}

// Service interface for listing plugin dashboards.
type Service interface {
	// ListPluginDashboards list plugin dashboards identified by org/plugin.
	ListPluginDashboards(ctx context.Context, req *ListPluginDashboardsRequest) (*ListPluginDashboardsResponse, error)

	// LoadPluginDashboard loads a plugin dashboard identified by plugin and reference.
	LoadPluginDashboard(ctx context.Context, req *LoadPluginDashboardRequest) (*LoadPluginDashboardResponse, error)
}
