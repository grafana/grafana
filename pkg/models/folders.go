package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrFolderNotFound           = errors.New("Folder not found")
	ErrFolderVersionMismatch    = errors.New("The folder has been changed by someone else")
	ErrFolderTitleEmpty         = errors.New("Folder title cannot be empty")
	ErrFolderWithSameNameExists = errors.New("A folder/dashboard with the same title already exists")
)

type Folder struct {
	Id      int64
	Title   string
	Slug    string
	OrgId   int64
	Version int

	Created time.Time
	Updated time.Time

	UpdatedBy int64
	CreatedBy int64
	HasAcl    bool
}

type GetFoldersQueryHitResult struct {
	Id    int64  `json:"id"`
	Title string `json:"title"`
	Slug  string `json:"slug"`
}

//
// COMMANDS
//

type CreateFolderCommand struct {
	OrgId  int64  `json:"-"`
	UserId int64  `json:"userId"`
	Title  string `json:"title"`

	Result *Folder
}

type UpdateFolderCommand struct {
	OrgId   int64  `json:"-"`
	UserId  int64  `json:"userId"`
	Title   string `json:"title"`
	Version int    `json:"version"`

	Result *Folder
}

type GetFoldersQuery struct {
	OrgId        int64
	SignedInUser *SignedInUser
	Title        string
	Result       []*GetFoldersQueryHitResult
}
