package models

import (
	"time"

	"github.com/grafana/grafana/pkg/services/user"
)

type Folder struct {
	Id      int64
	Uid     string
	Title   string
	Url     string
	Version int

	Created time.Time
	Updated time.Time

	UpdatedBy int64
	CreatedBy int64
	HasACL    bool
}

// NewFolder creates a new Folder
func NewFolder(title string) *Folder {
	folder := &Folder{}
	folder.Title = title
	folder.Created = time.Now()
	folder.Updated = time.Now()
	return folder
}

// DashboardToFolder converts Dashboard to Folder
func DashboardToFolder(dash *Dashboard) *Folder {
	return &Folder{
		Id:        dash.Id,
		Uid:       dash.Uid,
		Title:     dash.Title,
		HasACL:    dash.HasACL,
		Url:       dash.GetUrl(),
		Version:   dash.Version,
		Created:   dash.Created,
		CreatedBy: dash.CreatedBy,
		Updated:   dash.Updated,
		UpdatedBy: dash.UpdatedBy,
	}
}

//
// COMMANDS
//

type CreateFolderCommand struct {
	Uid   string `json:"uid"`
	Title string `json:"title"`

	Result *Folder `json:"-"`
}

type MoveFolderCommand struct {
	ParentUID *string `json:"parentUid"`
}

//
// QUERIES
//

type HasEditPermissionInFoldersQuery struct {
	SignedInUser *user.SignedInUser
	Result       bool
}

type HasAdminPermissionInDashboardsOrFoldersQuery struct {
	SignedInUser *user.SignedInUser
	Result       bool
}
