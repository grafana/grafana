package folder

import (
	"time"

	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var ErrMaximumDepthReached = errutil.NewBase(errutil.StatusBadRequest, "folder.maximum-depth-reached", errutil.WithPublicMessage("Maximum nested folder depth reached"))
var ErrBadRequest = errutil.NewBase(errutil.StatusBadRequest, "folder.bad-request")
var ErrDatabaseError = errutil.NewBase(errutil.StatusInternal, "folder.database-error")
var ErrInternal = errutil.NewBase(errutil.StatusInternal, "folder.internal")
var ErrFolderTooDeep = errutil.NewBase(errutil.StatusInternal, "folder.too-deep")

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
	Url       string
	UpdatedBy int64
	CreatedBy int64
	HasACL    bool
}

type FolderDTO struct {
	Folder

	Children []FolderDTO
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
	Folder         *Folder `json:"folder"` // The extant folder
	NewUID         *string `json:"uid" xorm:"uid"`
	NewTitle       *string `json:"title"`
	NewDescription *string `json:"description"`

	SignedInUser *user.SignedInUser `json:"-"`
}

// MoveFolderCommand captures the information required by the folder service
// to move a folder.
type MoveFolderCommand struct {
	UID          string `json:"uid"`
	NewParentUID string `json:"newParentUid"`
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

// ToLegacyModel is temporary until the two folder services are merged
func (f *Folder) ToLegacyModel() *models.Folder {
	return &models.Folder{
		Id:        f.ID,
		Uid:       f.UID,
		Title:     f.Title,
		Url:       models.GetFolderUrl(f.UID, slugify.Slugify(f.Title)),
		Version:   0,
		Created:   f.Created,
		Updated:   f.Updated,
		UpdatedBy: 0,
		CreatedBy: 0,
		HasACL:    false,
	}
}

func FromDashboard(dash *models.Dashboard) *Folder {
	return &Folder{
		ID:        dash.Id,
		UID:       dash.Uid,
		Title:     dash.Title,
		HasACL:    dash.HasACL,
		Url:       models.GetFolderUrl(dash.Uid, dash.Slug),
		Version:   dash.Version,
		Created:   dash.Created,
		CreatedBy: dash.CreatedBy,
		Updated:   dash.Updated,
		UpdatedBy: dash.UpdatedBy,
	}
}
