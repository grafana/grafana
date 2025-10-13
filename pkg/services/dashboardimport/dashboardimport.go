package dashboardimport

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

// ImportDashboardInput definition of input parameters when importing a dashboard.
type ImportDashboardInput struct {
	Type     string `json:"type"`
	PluginId string `json:"pluginId"`
	Name     string `json:"name"`
	Value    string `json:"value"`
}

// ImportDashboardRequest request object for importing a dashboard.
type ImportDashboardRequest struct {
	PluginId  string                 `json:"pluginId"`
	Path      string                 `json:"path"`
	Overwrite bool                   `json:"overwrite"`
	Dashboard *simplejson.Json       `json:"dashboard"`
	Inputs    []ImportDashboardInput `json:"inputs"`
	// Deprecated: use FolderUID instead
	FolderId  int64  `json:"folderId"`
	FolderUid string `json:"folderUid"`

	User identity.Requester `json:"-"`
}

// ImportDashboardResponse response object returned when importing a dashboard.
type ImportDashboardResponse struct {
	UID         string `json:"uid"`
	PluginId    string `json:"pluginId"`
	Title       string `json:"title"`
	Imported    bool   `json:"imported"`
	ImportedUri string `json:"importedUri"`
	ImportedUrl string `json:"importedUrl"`
	Slug        string `json:"slug"`
	DashboardId int64  `json:"dashboardId"`
	// Deprecated: use FolderUID instead
	FolderId         int64  `json:"folderId"`
	FolderUID        string `json:"folderUid"`
	ImportedRevision int64  `json:"importedRevision,omitempty"` // Only used for plugin imports
	Revision         int64  `json:"revision,omitempty"`         // Only used for plugin imports
	Description      string `json:"description"`
	Path             string `json:"path"`
	Removed          bool   `json:"removed"`
}

// Service service interface for importing dashboards.
type Service interface {
	ImportDashboard(ctx context.Context, req *ImportDashboardRequest) (*ImportDashboardResponse, error)
}
