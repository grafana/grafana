package dtos

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type DashboardMeta struct {
	IsStarred   bool      `json:"isStarred,omitempty"`
	IsHome      bool      `json:"isHome,omitempty"`
	IsSnapshot  bool      `json:"isSnapshot,omitempty"`
	CanSave     bool      `json:"canSave"`
	CanEdit     bool      `json:"canEdit"`
	CanAdmin    bool      `json:"canAdmin"`
	CanStar     bool      `json:"canStar"`
	HasAcl      bool      `json:"hasAcl"`
	IsFolder    bool      `json:"isFolder"`
	Provisioned bool      `json:"provisioned"`
	Type        string    `json:"type,omitempty"`
	Slug        string    `json:"slug"`
	Url         string    `json:"url"`
	UpdatedBy   string    `json:"updatedBy"`
	CreatedBy   string    `json:"createdBy"`
	FolderTitle string    `json:"folderTitle"`
	FolderUrl   string    `json:"folderUrl"`
	Expires     time.Time `json:"expires"`
	Created     time.Time `json:"created"`
	Updated     time.Time `json:"updated"`
	Version     int       `json:"version"`
	FolderId    int64     `json:"folderId"`
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
	Version          int              `json:"version"`
	UnsavedDashboard *simplejson.Json `json:"unsavedDashboard"`
}

type RestoreDashboardVersionCommand struct {
	Version int `json:"version" binding:"Required"`
}
