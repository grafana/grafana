package dashboardimport

import (
	"context"
	"encoding/json"

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
	FolderId  int64  `json:"folderId,omitempty"`
	FolderUid string `json:"folderUid,omitempty"`

	User identity.Requester `json:"-"`

	folderIdSet  bool
	folderUidSet bool
}

// UnmarshalJSON remembers whether folderId or folderUid were present in the request.
// An omitted folder means "use the folder from the dashboard resource." An explicit
// empty folderUid, or folderId: 0, means "save at root." Plain Go zero values cannot
// tell those cases apart after decoding.
func (r *ImportDashboardRequest) UnmarshalJSON(data []byte) error {
	type importDashboardRequest ImportDashboardRequest

	var decoded importDashboardRequest
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	*r = ImportDashboardRequest(decoded)

	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return err
	}
	_, r.folderIdSet = fields["folderId"]
	_, r.folderUidSet = fields["folderUid"]

	return nil
}

// HasFolderSelection reports whether the caller chose a folder, including root.
func (r *ImportDashboardRequest) HasFolderSelection() bool {
	return r.HasFolderUIDSelection() || r.folderIdSet || r.FolderId != 0
}

// HasFolderUIDSelection reports whether folderUid chose the folder. An empty
// folderUid still counts because it means "save at root" and overrides folderId.
func (r *ImportDashboardRequest) HasFolderUIDSelection() bool {
	return r.folderUidSet || r.FolderUid != ""
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
	InterpolateDashboard(ctx context.Context, req *ImportDashboardRequest) (*simplejson.Json, error)
}
