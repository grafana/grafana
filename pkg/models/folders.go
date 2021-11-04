package models

import (
	"errors"
	"strings"
	"time"
)

// Typed errors
var (
	ErrFolderNotFound                = errors.New("folder not found")
	ErrFolderVersionMismatch         = errors.New("the folder has been changed by someone else")
	ErrFolderTitleEmpty              = errors.New("folder title cannot be empty")
	ErrFolderWithSameUIDExists       = errors.New("a folder/dashboard with the same uid already exists")
	ErrFolderSameNameExists          = errors.New("a folder or dashboard in the general folder with the same name already exists")
	ErrFolderFailedGenerateUniqueUid = errors.New("failed to generate unique folder ID")
	ErrFolderAccessDenied            = errors.New("access denied to folder")
	ErrFolderContainsAlertRules      = errors.New("folder contains alert rules")
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

	Result *Folder
}

type UpdateFolderCommand struct {
	Uid       string `json:"uid"`
	Title     string `json:"title"`
	Version   int    `json:"version"`
	Overwrite bool   `json:"overwrite"`

	Result *Folder
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
