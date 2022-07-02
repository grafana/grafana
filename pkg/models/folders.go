package models

import (
	"strings"
	"time"
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
	HasAcl    bool
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
		HasAcl:    dash.HasAcl,
		Url:       dash.GetUrl(),
		Version:   dash.Version,
		Created:   dash.Created,
		CreatedBy: dash.CreatedBy,
		Updated:   dash.Updated,
		UpdatedBy: dash.UpdatedBy,
	}
}

// UpdateDashboardModel updates an existing model from command into model for update
func (cmd *UpdateFolderCommand) UpdateDashboardModel(dashFolder *Dashboard, orgId int64, userId int64) {
	dashFolder.OrgId = orgId
	dashFolder.Title = strings.TrimSpace(cmd.Title)
	dashFolder.Data.Set("title", dashFolder.Title)

	if cmd.Uid != "" {
		dashFolder.SetUid(cmd.Uid)
	}

	dashFolder.SetVersion(cmd.Version)
	dashFolder.IsFolder = true

	if userId == 0 {
		userId = -1
	}

	dashFolder.UpdatedBy = userId
	dashFolder.UpdateSlug()
}

//
// COMMANDS
//

type CreateFolderCommand struct {
	Uid   string `json:"uid"`
	Title string `json:"title"`

	Result *Folder `json:"-"`
}

type UpdateFolderCommand struct {
	Uid       string `json:"uid"`
	Title     string `json:"title"`
	Version   int    `json:"version"`
	Overwrite bool   `json:"overwrite"`

	Result *Folder `json:"-"`
}

//
// QUERIES
//

type HasEditPermissionInFoldersQuery struct {
	SignedInUser *SignedInUser
	Result       bool
}

type HasAdminPermissionInFoldersQuery struct {
	SignedInUser *SignedInUser
	Result       bool
}
