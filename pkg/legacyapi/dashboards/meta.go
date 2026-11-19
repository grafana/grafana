package dashboards

import (
	"time"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
)

// Meta is the "meta" object of the legacy GET /api/dashboards/uid/:uid
// response. Its fields and JSON names match dtos.DashboardMeta in
// pkg/api/dtos, which single-tenant Grafana returns.
type Meta struct {
	IsSnapshot bool      `json:"isSnapshot,omitempty"`
	Type       string    `json:"type,omitempty"`
	CanSave    bool      `json:"canSave"`
	CanEdit    bool      `json:"canEdit"`
	CanAdmin   bool      `json:"canAdmin"`
	CanStar    bool      `json:"canStar"`
	CanDelete  bool      `json:"canDelete"`
	Slug       string    `json:"slug"`
	Url        string    `json:"url"`
	Expires    time.Time `json:"expires"`
	Created    time.Time `json:"created"`
	Updated    time.Time `json:"updated"`
	UpdatedBy  string    `json:"updatedBy"`
	CreatedBy  string    `json:"createdBy"`
	Version    int       `json:"version"`
	HasACL     bool      `json:"hasAcl"`
	IsFolder   bool      `json:"isFolder"`
	APIVersion string    `json:"apiVersion,omitempty"`
	// Deprecated: use FolderUid instead
	FolderId               int64                             `json:"folderId"`
	FolderUid              string                            `json:"folderUid"`
	FolderTitle            string                            `json:"folderTitle"`
	FolderUrl              string                            `json:"folderUrl"`
	Provisioned            bool                              `json:"provisioned"`
	ProvisionedExternalId  string                            `json:"provisionedExternalId"`
	AnnotationsPermissions *dashboardv1.AnnotationPermission `json:"annotationsPermissions"`
	PublicDashboardEnabled bool                              `json:"publicDashboardEnabled,omitempty"`
}

// DashboardWithMeta is the legacy GET /api/dashboards/uid/:uid response.
type DashboardWithMeta struct {
	Meta      Meta           `json:"meta"`
	Dashboard map[string]any `json:"dashboard"`
}
