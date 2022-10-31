package folder

import (
	"time"

	"github.com/grafana/grafana/pkg/util/errutil"
)

const (
	GeneralFolderUID     = "general"
	MaxNestedFolderDepth = 8
)

var ErrFolderNotFound = errutil.NewBase(errutil.StatusNotFound, "folder.notFound")
var ErrFolderTooDeep = errutil.NewBase(errutil.StatusInternal, "folder.tooDeep")

type Folder struct {
	ID          int64  `xorm:"'id' pk autoincr"`
	OrgID       int64  `xorm:"org_id"`
	UID         string `xorm:"uid"`
	ParentUID   string `xorm:"parent_uid"`
	Title       string `xorm:"title"`
	Description string `xorm:"description"`

	Created time.Time `xorm:"created"`
	Updated time.Time `xorm:"updated"`

	// TODO: validate if this field is required/relevant to folders.
	// UpdatedBy int64
}

// CreateFolderCommand captures the information required by the folder service
// to create a folder.
type CreateFolderCommand struct {
	UID         string `json:"uid" xorm:"uid"`
	OrgID       int64  `json:"orgId" xorm:"org_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	ParentUID   string `json:"parent_uid" xorm:"parent_uid"`
}

// UpdateFolderCommand captures the information required by the folder service
// to update a folder. Use Move to update a folder's parent folder.
type UpdateFolderCommand struct {
	Folder         *Folder `json:"folder"` // The extant folder
	NewUID         *string `json:"uid" xorm:"uid"`
	NewTitle       *string `json:"title"`
	NewDescription *string `json:"description"`
}

// MoveFolderCommand captures the information required by the folder service
// to move a folder.
type MoveFolderCommand struct {
	OrgID        int64  `xorm:"org_id"`
	UID          string `json:"uid"`
	NewParentUID string `json:"new_parent_uid"`
}

// DeleteFolderCommand captures the information required by the folder service
// to delete a folder.
type DeleteFolderCommand struct {
	OrgID int64  `xorm:"org_id"`
	UID   string `json:"uid" xorm:"uid"`
}

// GetFolderQuery is used for all folder Get requests. Only one of UID, ID, or
// Title should be set; if multilpe fields are set by the caller the dashboard
// service will select the field with the most specificity, in order: ID, UID,
// Title.
type GetFolderQuery struct {
	OrgID int64 `xorm:"org_id"'`
	UID   *string
	ID    *int
	Title *string
}

// GetParentsQuery captures the information required by the folder service to
// return a list of all parent folders of a given folder.
type GetParentsQuery struct {
	OrgID int64  `xorm:"org_id"`
	UID   string `xorm:"uid"`
}

// GetTreeCommand captures the information required by the folder service to
// return a list of child folders of the given folder.

type GetTreeQuery struct {
	UID   string `xorm:"uid"`
	OrgID int64  `xorm:"org_id"`
	Depth int64

	// Pagination options
	Limit int64
	Page  int64
}
