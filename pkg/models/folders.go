package models

import (
	"errors"
	"strings"
	"time"
)

// Typed errors
var (
	ErrFolderNotFound                = errors.New("Folder not found")
	ErrFolderVersionMismatch         = errors.New("The folder has been changed by someone else")
	ErrFolderTitleEmpty              = errors.New("Folder title cannot be empty")
	ErrFolderWithSameUIDExists       = errors.New("A folder/dashboard with the same uid already exists")
	ErrFolderSameNameExists          = errors.New("A folder or dashboard in the general folder with the same name already exists")
	ErrFolderFailedGenerateUniqueUid = errors.New("Failed to generate unique folder id")
)

type Folder struct {
	Id      int64
	Uid     string
	Title   string
	Url     string
	OrgId   int64
	Version int

	Created time.Time
	Updated time.Time

	UpdatedBy int64
	CreatedBy int64
	HasAcl    bool
}

// GetDashboardModel turns the command into the savable model
func (cmd *CreateFolderCommand) GetDashboardModel() *Dashboard {
	dashFolder := NewDashboardFolder(strings.TrimSpace(cmd.Title))
	dashFolder.OrgId = cmd.OrgId
	dashFolder.Uid = strings.TrimSpace(cmd.Uid)
	dashFolder.Data.Set("uid", cmd.Uid)

	userId := cmd.UserId

	if userId == 0 {
		userId = -1
	}

	dashFolder.CreatedBy = userId
	dashFolder.UpdatedBy = userId
	dashFolder.UpdateSlug()

	return dashFolder
}

// UpdateDashboardModel updates an existing model from command into model for update
func (cmd *UpdateFolderCommand) UpdateDashboardModel(dashFolder *Dashboard) {
	dashFolder.Title = strings.TrimSpace(cmd.Title)
	dashFolder.Data.Set("title", cmd.Title)
	dashFolder.Uid = dashFolder.Data.MustString("uid")
	dashFolder.Data.Set("version", cmd.Version)
	dashFolder.Version = cmd.Version
	dashFolder.IsFolder = true

	userId := cmd.UserId

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
	OrgId  int64  `json:"-"`
	UserId int64  `json:"userId"`
	Uid    string `json:"uid"`
	Title  string `json:"title"`

	Result *Folder
}

type UpdateFolderCommand struct {
	OrgId     int64  `json:"-"`
	UserId    int64  `json:"userId"`
	Title     string `json:"title"`
	Version   int    `json:"version"`
	Overwrite bool   `json:"overwrite"`

	Result *Folder
}
