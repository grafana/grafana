package folder

import (
	"time"

	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var ErrMaximumDepthReached = errutil.NewBase(errutil.StatusBadRequest, "folder.maximum-depth-reached", errutil.WithPublicMessage("Maximum nested folder depth reached"))
var ErrBadRequest = errutil.NewBase(errutil.StatusBadRequest, "folder.bad-request")
var ErrDatabaseError = errutil.NewBase(errutil.StatusInternal, "folder.database-error")
var ErrInternal = errutil.NewBase(errutil.StatusInternal, "folder.internal")
var ErrFolderTooDeep = errutil.NewBase(errutil.StatusInternal, "folder.too-deep")
var ErrCircularReference = errutil.NewBase(errutil.StatusBadRequest, "folder.circular-reference", errutil.WithPublicMessage("Circular reference detected"))
var ErrTargetRegistrySrvConflict = errutil.NewBase(errutil.StatusInternal, "folder.target-registry-srv-conflict")

const (
	GeneralFolderUID     = "general"
	RootFolderUID        = ""
	MaxNestedFolderDepth = 8
)

var ErrFolderNotFound = errutil.NewBase(errutil.StatusNotFound, "folder.notFound")

type Folder struct {
	ID          int64  `xorm:"pk autoincr 'id'"`
	OrgID       int64  `xorm:"org_id"`
	UID         string `xorm:"uid"`
	ParentUID   string `xorm:"parent_uid"`
	Title       string
	Description string

	Created time.Time
	Updated time.Time

	// TODO: validate if this field is required/relevant to folders.
	// currently there is no such column
	Version   int
	URL       string
	UpdatedBy int64
	CreatedBy int64
	HasACL    bool
}

var GeneralFolder = Folder{ID: 0, Title: "General"}

func (f *Folder) IsGeneral() bool {
	return f.ID == GeneralFolder.ID && f.Title == GeneralFolder.Title
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
	OrgID       int64  `json:"-"`
	Title       string `json:"title"`
	Description string `json:"description"`
	ParentUID   string `json:"parentUid"`

	SignedInUser *user.SignedInUser `json:"-"`
}

// UpdateFolderCommand captures the information required by the folder service
// to update a folder. Use Move to update a folder's parent folder.
type UpdateFolderCommand struct {
	UID   string `json:"-"`
	OrgID int64  `json:"-"`
	// NewUID it's an optional parameter used for overriding the existing folder UID
	NewUID *string `json:"uid"` // keep same json tag with the legacy command for not breaking the existing APIs
	// NewTitle it's an optional parameter used for overriding the existing folder title
	NewTitle *string `json:"title"` // keep same json tag with the legacy command for not breaking the existing APIs
	// NewDescription it's an optional parameter used for overriding the existing folder description
	NewDescription *string `json:"description"` // keep same json tag with the legacy command for not breaking the existing APIs
	NewParentUID   *string `json:"-"`

	// Version only used by the legacy folder implementation
	Version int `json:"version"`
	// Overwrite only used by the legacy folder implementation
	Overwrite bool `json:"overwrite"`

	SignedInUser *user.SignedInUser `json:"-"`
}

// MoveFolderCommand captures the information required by the folder service
// to move a folder.
type MoveFolderCommand struct {
	UID          string `json:"-"`
	NewParentUID string `json:"parentUid"`
	OrgID        int64  `json:"-"`

	SignedInUser *user.SignedInUser `json:"-"`
}

// DeleteFolderCommand captures the information required by the folder service
// to delete a folder.
type DeleteFolderCommand struct {
	UID              string `json:"uid" xorm:"uid"`
	OrgID            int64  `json:"orgId" xorm:"org_id"`
	ForceDeleteRules bool   `json:"forceDeleteRules"`

	SignedInUser *user.SignedInUser `json:"-"`
}

// GetFolderQuery is used for all folder Get requests. Only one of UID, ID, or
// Title should be set; if multilpe fields are set by the caller the dashboard
// service will select the field with the most specificity, in order: ID, UID,
// Title.
type GetFolderQuery struct {
	UID   *string
	ID    *int64
	Title *string
	OrgID int64

	SignedInUser *user.SignedInUser `json:"-"`
}

// GetParentsQuery captures the information required by the folder service to
// return a list of all parent folders of a given folder.
type GetParentsQuery struct {
	UID   string `xorm:"uid"`
	OrgID int64  `xorm:"org_id"`
}

// GetChildrenQuery captures the information required by the folder service to
// return a list of child folders of the given folder.

type GetChildrenQuery struct {
	UID   string `xorm:"uid"`
	OrgID int64  `xorm:"org_id"`
	Depth int64

	// Pagination options
	Limit int64
	Page  int64

	SignedInUser *user.SignedInUser `json:"-"`
}

type HasEditPermissionInFoldersQuery struct {
	SignedInUser *user.SignedInUser
}

type HasAdminPermissionInDashboardsOrFoldersQuery struct {
	SignedInUser *user.SignedInUser
}
