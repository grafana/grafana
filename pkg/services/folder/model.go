package folder

import (
	"time"

	"github.com/grafana/grafana/pkg/util/errutil"
)

const MAXIMUM_DEPTH = 8

var ErrMaximumDepthReached = errutil.NewBase(errutil.StatusBadRequest, "folder.maximum-depth-reached", errutil.WithPublicMessage("Maximum nested folder depth reached"))

type Folder struct {
	ID          int64
	UID         string
	Title       string
	Description string
	URL         string

	Created time.Time
	Updated time.Time

	UpdatedBy int64
	CreatedBy int64
	HasACL    bool
}

// NewFolder tales a title and returns a Folder with the Created and Updated
// fields set to the current time.
func NewFolder(title string, description string) *Folder {
	return &Folder{
		Title:       title,
		Description: description,
		Created:     time.Now(),
		Updated:     time.Now(),
	}
}

// CreateFolderCommand captures the information required by the folder service
// to create a folder.
type CreateFolderCommand struct {
	UID         string `json:"uid"`
	Title       string `json:"title"`
	Description string `json:"description"`
	ParentUID   string `json:"parent_uid"`
}

// UpdateFolderCommand captures the information required by the folder service
// to update a folder.
type UpdateFolderCommand struct {
	Folder      *Folder `json:"folder"` // The extant folder
	UID         string  `json:"uid"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
}

// MoveFolderCommand captures the information required by the folder service
// to move a folder.
type MoveFolderCommand struct {
	UID          string `json:"uid"`
	NewParentUID string `json:"new_parent_uid"`
}

// DeleteFolderCommand captures the information required by the folder service
// to delete a folder.
type DeleteFolderCommand struct {
	UID string `json:"uid"`
}

// GetFolderCommand is used for all folder Get requests. Only one of UID, ID, or
// Title should be set; if multilpe fields are set by the caller the dashboard
// service will select the field with the most specificity, in order: ID, UID,
// Title.
type GetFolderCommand struct {
	UID   *string
	ID    *int
	Title *string
}

// GetParentsCommand captures the information required by the folder service to
// return a list of all parent folders of a given folder.
type GetParentsCommand struct {
	UID string
}

// GetTreeCommand captures the information required by the folder service to
// return a list of child folders of the given folder.

type GetTreeCommand struct {
	UID   string
	Depth int64

	// Pagination options
	Limit int64
	Page  int64
}
