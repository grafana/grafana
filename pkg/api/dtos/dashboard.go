package dtos

import (
	"time"

	dashboardsV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

type DashboardMeta struct {
	IsStarred  bool      `json:"isStarred,omitempty"`
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
	HasACL     bool      `json:"hasAcl" xorm:"has_acl"`
	IsFolder   bool      `json:"isFolder"`
	APIVersion string    `json:"apiVersion,omitempty"` // v0alpha1, v1, v2beta1 etc -- the version things were *saved* at
	// Deprecated: use FolderUID instead
	FolderId               int64                              `json:"folderId"`
	FolderUid              string                             `json:"folderUid"`
	FolderTitle            string                             `json:"folderTitle"`
	FolderUrl              string                             `json:"folderUrl"`
	Provisioned            bool                               `json:"provisioned"`
	ProvisionedExternalId  string                             `json:"provisionedExternalId"`
	AnnotationsPermissions *dashboardsV1.AnnotationPermission `json:"annotationsPermissions"`
	PublicDashboardEnabled bool                               `json:"publicDashboardEnabled,omitempty"`
}

type DashboardFullWithMeta struct {
	Meta      DashboardMeta    `json:"meta"`
	Dashboard *simplejson.Json `json:"dashboard"`
}

type DashboardRedirect struct {
	RedirectUri string `json:"redirectUri"`
}

type CalculateDiffOptions struct {
	Base     CalculateDiffTarget `json:"base" binding:"Required"`
	New      CalculateDiffTarget `json:"new" binding:"Required"`
	DiffType string              `json:"diffType" binding:"Required"`
}

type CalculateDiffTarget struct {
	DashboardId      int64            `json:"dashboardId"`
	Version          int64            `json:"version"`
	UnsavedDashboard *simplejson.Json `json:"unsavedDashboard"`
}

type RestoreDashboardVersionCommand struct {
	Version int64 `json:"version" binding:"Required"`
}
