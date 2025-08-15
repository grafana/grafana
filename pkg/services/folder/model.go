package folder

import (
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/setting"
)

var ErrMaximumDepthReached = errutil.BadRequest("folder.maximum-depth-reached", errutil.WithPublicMessage("Maximum nested folder depth reached"))
var ErrBadRequest = errutil.BadRequest("folder.bad-request")
var ErrDatabaseError = errutil.Internal("folder.database-error")
var ErrConflict = errutil.Conflict("folder.conflict")
var ErrInternal = errutil.Internal("folder.internal")
var ErrCircularReference = errutil.BadRequest("folder.circular-reference", errutil.WithPublicMessage("Circular reference detected"))
var ErrTargetRegistrySrvConflict = errutil.Internal("folder.target-registry-srv-conflict")
var ErrFolderNotEmpty = errutil.BadRequest("folder.not-empty", errutil.WithPublicMessage("Folder cannot be deleted: folder is not empty"))
var ErrFolderCannotBeParentOfItself = errors.New("folder cannot be parent of itself")

const (
	GeneralFolderUID      = "general"
	RootFolderUID         = ""
	MaxNestedFolderDepth  = 4
	SharedWithMeFolderUID = "sharedwithme"
)

var ErrFolderNotFound = errutil.NotFound("folder.notFound")

type Folder struct {
	// Deprecated: use UID instead
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
	Version      int
	URL          string
	UpdatedBy    int64
	CreatedBy    int64
	UpdatedByUID string
	CreatedByUID string
	HasACL       bool
	Fullpath     string `xorm:"fullpath"`
	FullpathUIDs string `xorm:"fullpath_uids"`

	// The folder is managed by an external process
	// NOTE: this is only populated when folders are managed by unified storage
	// This is not ever used by xorm, but the translation functions flow through this type
	ManagedBy utils.ManagerKind `json:"managedBy,omitempty"`
}

type FolderReference struct {
	// Deprecated: use UID instead
	ID        int64  `xorm:"pk autoincr 'id'"`
	UID       string `xorm:"uid"`
	Title     string
	ParentUID string `xorm:"parent_uid"`

	// When the folder belongs to a repository
	// NOTE: this is only populated when folders are managed by unified storage
	ManagedBy utils.ManagerKind `json:"managedBy,omitempty"`
}

var GeneralFolder = Folder{ID: 0, Title: "General"}
var RootFolder = &Folder{ID: 0, Title: "Dashboards", UID: GeneralFolderUID, ParentUID: ""}
var SharedWithMeFolder = Folder{
	Title:       "Shared with me",
	Description: "Dashboards and folders shared with me",
	UID:         SharedWithMeFolderUID,
	ParentUID:   "",
	ID:          -1,
}

func (f *Folder) IsGeneral() bool {
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()
	// nolint:staticcheck
	return f.ID == GeneralFolder.ID && f.Title == GeneralFolder.Title
}

func (f *Folder) WithURL() *Folder {
	if f == nil || f.URL != "" {
		return f
	}

	// copy of dashboards.GetFolderURL()
	f.URL = fmt.Sprintf("%s/dashboards/f/%s/%s", setting.AppSubUrl, f.UID, slugify.Slugify(f.Title))
	return f
}

func (f *Folder) ToFolderReference() *FolderReference {
	return &FolderReference{
		ID:        f.ID,
		UID:       f.UID,
		Title:     f.Title,
		ParentUID: f.ParentUID,
		ManagedBy: f.ManagedBy,
	}
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

	SignedInUser identity.Requester `json:"-"`
}

// UpdateFolderCommand captures the information required by the folder service
// to update a folder. Use Move to update a folder's parent folder.
type UpdateFolderCommand struct {
	UID   string `json:"-"`
	OrgID int64  `json:"-"`
	// NewTitle it's an optional parameter used for overriding the existing folder title
	NewTitle *string `json:"title"` // keep same json tag with the legacy command for not breaking the existing APIs
	// NewDescription it's an optional parameter used for overriding the existing folder description
	NewDescription *string `json:"description"` // keep same json tag with the legacy command for not breaking the existing APIs
	NewParentUID   *string `json:"-"`

	// Version only used by the legacy folder implementation
	Version int `json:"version"`
	// Overwrite only used by the legacy folder implementation
	Overwrite bool `json:"overwrite"`

	SignedInUser identity.Requester `json:"-"`
}

// MoveFolderCommand captures the information required by the folder service
// to move a folder.
type MoveFolderCommand struct {
	UID          string `json:"-"`
	NewParentUID string `json:"parentUid"`
	OrgID        int64  `json:"-"`

	SignedInUser identity.Requester `json:"-"`
}

// DeleteFolderCommand captures the information required by the folder service
// to delete a folder.
type DeleteFolderCommand struct {
	UID              string `json:"uid" xorm:"uid"`
	OrgID            int64  `json:"orgId" xorm:"org_id"`
	ForceDeleteRules bool   `json:"forceDeleteRules"`

	SignedInUser          identity.Requester `json:"-"`
	SkipRemovePermissions bool               `json:"-"`
}

// GetFolderQuery is used for all folder Get requests. Only one of UID, ID, or
// Title should be set; if multiple fields are set by the caller the dashboard
// service will select the field with the most specificity, in order: ID, UID,
// Title.
type GetFolderQuery struct {
	UID *string
	// Deprecated: use FolderUID instead
	ID               *int64
	Title            *string
	ParentUID        *string
	OrgID            int64
	WithFullpath     bool
	WithFullpathUIDs bool

	SignedInUser identity.Requester `json:"-"`
}

type GetFoldersQuery struct {
	OrgID            int64
	UIDs             []string
	WithFullpath     bool
	WithFullpathUIDs bool
	BatchSize        uint64

	// Pagination options
	Limit int64
	Page  int64

	// OrderByTitle is used to sort the folders by title
	// Set to true when ordering is meaningful (used for listing folders)
	// otherwise better to keep it false since ordering can have a performance impact
	OrderByTitle bool
	SignedInUser identity.Requester `json:"-"`
}

type SearchFoldersQuery struct {
	OrgID        int64
	UIDs         []string
	IDs          []int64
	Title        string
	Limit        int64
	SignedInUser identity.Requester `json:"-"`
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
	UID   string
	OrgID int64
	Depth int64

	// Pagination options
	Limit int64
	Page  int64

	// Permission to filter by
	Permission dashboardaccess.PermissionType

	SignedInUser identity.Requester `json:"-"`

	// array of folder uids to filter by
	FolderUIDs []string `json:"-"`
}

type HasEditPermissionInFoldersQuery struct {
	SignedInUser identity.Requester
}

type HasAdminPermissionInDashboardsOrFoldersQuery struct {
	SignedInUser identity.Requester
}

// GetDescendantCountsQuery captures the information required by the folder service
// to return the count of descendants (direct and indirect) in a folder.
type GetDescendantCountsQuery struct {
	UID   *string
	OrgID int64

	SignedInUser identity.Requester `json:"-"`
}

type DescendantCounts map[string]int64
