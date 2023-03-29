package dashboards

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const RootFolderName = "General"

const (
	DashTypeDB       = "db"
	DashTypeSnapshot = "snapshot"
)

// Dashboard model
type Dashboard struct {
	ID       int64  `xorm:"pk autoincr 'id'"`
	UID      string `xorm:"uid"`
	Slug     string
	OrgID    int64 `xorm:"org_id"`
	GnetID   int64 `xorm:"gnet_id"`
	Version  int
	PluginID string `xorm:"plugin_id"`

	Created time.Time
	Updated time.Time

	UpdatedBy int64
	CreatedBy int64
	FolderID  int64 `xorm:"folder_id"`
	IsFolder  bool
	HasACL    bool `xorm:"has_acl"`

	Title string
	Data  *simplejson.Json
}

func (d *Dashboard) SetID(id int64) {
	d.ID = id
	d.Data.Set("id", id)
}

func (d *Dashboard) SetUID(uid string) {
	d.UID = uid
	d.Data.Set("uid", uid)
}

func (d *Dashboard) SetVersion(version int) {
	d.Version = version
	d.Data.Set("version", version)
}

// NewDashboard creates a new dashboard
func NewDashboard(title string) *Dashboard {
	dash := &Dashboard{}
	dash.Data = simplejson.New()
	dash.Data.Set("title", title)
	dash.Title = title
	dash.Created = time.Now()
	dash.Updated = time.Now()
	dash.UpdateSlug()
	return dash
}

// NewDashboardFolder creates a new dashboard folder
func NewDashboardFolder(title string) *Dashboard {
	folder := NewDashboard(title)
	folder.IsFolder = true
	folder.Data.Set("schemaVersion", 17)
	folder.Data.Set("version", 0)
	folder.IsFolder = true
	return folder
}

// GetTags turns the tags in data json into go string array
func (d *Dashboard) GetTags() []string {
	return d.Data.Get("tags").MustStringArray()
}

func NewDashboardFromJson(data *simplejson.Json) *Dashboard {
	dash := &Dashboard{}
	dash.Data = data
	dash.Title = dash.Data.Get("title").MustString()
	dash.UpdateSlug()
	update := false

	if id, err := dash.Data.Get("id").Float64(); err == nil {
		dash.ID = int64(id)
		update = true
	}

	if uid, err := dash.Data.Get("uid").String(); err == nil {
		dash.UID = uid
		update = true
	}

	if version, err := dash.Data.Get("version").Float64(); err == nil && update {
		dash.Version = int(version)
		dash.Updated = time.Now()
	} else {
		dash.Data.Set("version", 0)
		dash.Created = time.Now()
		dash.Updated = time.Now()
	}

	if gnetId, err := dash.Data.Get("gnetId").Float64(); err == nil {
		dash.GnetID = int64(gnetId)
	}

	return dash
}

// GetDashboardModel turns the command into the saveable model
func (cmd *SaveDashboardCommand) GetDashboardModel() *Dashboard {
	dash := NewDashboardFromJson(cmd.Dashboard)
	userID := cmd.UserID

	if userID == 0 {
		userID = -1
	}

	dash.UpdatedBy = userID
	dash.OrgID = cmd.OrgID
	dash.PluginID = cmd.PluginID
	dash.IsFolder = cmd.IsFolder
	dash.FolderID = cmd.FolderID
	dash.UpdateSlug()
	return dash
}

// UpdateSlug updates the slug
func (d *Dashboard) UpdateSlug() {
	title := d.Data.Get("title").MustString()
	d.Slug = slugify.Slugify(title)
}

// GetURL return the html url for a folder if it's folder, otherwise for a dashboard
func (d *Dashboard) GetURL() string {
	return GetDashboardFolderURL(d.IsFolder, d.UID, d.Slug)
}

// GetDashboardFolderURL return the html url for a folder if it's folder, otherwise for a dashboard
func GetDashboardFolderURL(isFolder bool, uid string, slug string) string {
	if isFolder {
		return GetFolderURL(uid, slug)
	}

	return GetDashboardURL(uid, slug)
}

// GetDashboardURL returns the HTML url for a dashboard.
func GetDashboardURL(uid string, slug string) string {
	return fmt.Sprintf("%s/d/%s/%s", setting.AppSubUrl, uid, slug)
}

// GetKioskModeDashboardUrl returns the HTML url for a dashboard in kiosk mode.
func GetKioskModeDashboardURL(uid string, slug string, theme models.Theme) string {
	return fmt.Sprintf("%s?kiosk&theme=%s", GetDashboardURL(uid, slug), string(theme))
}

// GetFullDashboardURL returns the full URL for a dashboard.
func GetFullDashboardURL(uid string, slug string) string {
	return fmt.Sprintf("%sd/%s/%s", setting.AppUrl, uid, slug)
}

// GetFolderURL returns the HTML url for a folder.
func GetFolderURL(folderUID string, slug string) string {
	return fmt.Sprintf("%s/dashboards/f/%s/%s", setting.AppSubUrl, folderUID, slug)
}

type ValidateDashboardBeforeSaveResult struct {
	IsParentFolderChanged bool
}

//
// COMMANDS
//

type SaveDashboardCommand struct {
	Dashboard    *simplejson.Json `json:"dashboard" binding:"Required"`
	UserID       int64            `json:"userId" xorm:"user_id"`
	Overwrite    bool             `json:"overwrite"`
	Message      string           `json:"message"`
	OrgID        int64            `json:"-" xorm:"org_id"`
	RestoredFrom int              `json:"-"`
	PluginID     string           `json:"-" xorm:"plugin_id"`
	FolderID     int64            `json:"folderId" xorm:"folder_id"`
	FolderUID    string           `json:"folderUid" xorm:"folder_uid"`
	IsFolder     bool             `json:"isFolder"`

	UpdatedAt time.Time
}

type ValidateDashboardCommand struct {
	Dashboard string `json:"dashboard" binding:"Required"`
}

type TrimDashboardCommand struct {
	Dashboard *simplejson.Json `json:"dashboard" binding:"Required"`
	Meta      *simplejson.Json `json:"meta"`
}

type DashboardProvisioning struct {
	ID          int64 `xorm:"pk autoincr 'id'"`
	DashboardID int64 `xorm:"dashboard_id"`
	Name        string
	ExternalID  string `xorm:"external_id"`
	CheckSum    string
	Updated     int64
}

type DeleteDashboardCommand struct {
	ID                     int64
	OrgID                  int64
	ForceDeleteFolderRules bool
}

type DeleteOrphanedProvisionedDashboardsCommand struct {
	ReaderNames []string
}

//
// QUERIES
//

// GetDashboardQuery is used to query for a single dashboard matching
// a unique constraint within the provided OrgID.
//
// Available constraints:
//   - ID uses Grafana's internal numeric database identifier to get a
//     dashboard.
//   - UID use the unique identifier to get a dashboard.
//   - Title + FolderID uses the combination of the dashboard's
//     human-readable title and its parent folder's ID
//     (or zero, for top level items). Both are required if no other
//     constraint is set.
//
// Multiple constraints can be combined.
type GetDashboardQuery struct {
	ID       int64
	UID      string
	Title    *string
	FolderID *int64
	OrgID    int64
}

type DashboardTagCloudItem struct {
	Term  string `json:"term"`
	Count int    `json:"count"`
}

type GetDashboardTagsQuery struct {
	OrgID int64
}

type GetDashboardsQuery struct {
	DashboardIDs  []int64
	DashboardUIDs []string
	OrgID         int64
}

type GetDashboardsByPluginIDQuery struct {
	OrgID    int64
	PluginID string
}

type DashboardRef struct {
	UID  string `xorm:"uid"`
	Slug string
}

type GetDashboardRefByIDQuery struct {
	ID int64
}

type SaveDashboardDTO struct {
	OrgID     int64
	UpdatedAt time.Time
	User      *user.SignedInUser
	Message   string
	Overwrite bool
	Dashboard *Dashboard
}

type DashboardSearchProjection struct {
	ID          int64  `xorm:"id"`
	UID         string `xorm:"uid"`
	Title       string
	Slug        string
	Term        string
	IsFolder    bool
	FolderID    int64  `xorm:"folder_id"`
	FolderUID   string `xorm:"folder_uid"`
	FolderSlug  string
	FolderTitle string
	SortMeta    int64
}

const (
	QuotaTargetSrv quota.TargetSrv = "dashboard"
	QuotaTarget    quota.Target    = "dashboard"
)

type CountDashboardsInFolderQuery struct {
	FolderUID string
	OrgID     int64
}

// TODO: CountDashboardsInFolderRequest is the request passed from the service
// to the store layer. The FolderID will be replaced with FolderUID when
// dashboards are updated with parent folder UIDs.
type CountDashboardsInFolderRequest struct {
	FolderID int64
	OrgID    int64
}

func FromDashboard(dash *Dashboard) *folder.Folder {
	return &folder.Folder{
		ID:        dash.ID,
		UID:       dash.UID,
		Title:     dash.Title,
		HasACL:    dash.HasACL,
		URL:       GetFolderURL(dash.UID, dash.Slug),
		Version:   dash.Version,
		Created:   dash.Created,
		CreatedBy: dash.CreatedBy,
		Updated:   dash.Updated,
		UpdatedBy: dash.UpdatedBy,
	}
}

//
// DASHBOARD ACL
//

// Dashboard ACL model
type DashboardACL struct {
	ID          int64 `xorm:"pk autoincr 'id'"`
	OrgID       int64 `xorm:"org_id"`
	DashboardID int64 `xorm:"dashboard_id"`

	UserID     int64         `xorm:"user_id"`
	TeamID     int64         `xorm:"team_id"`
	Role       *org.RoleType // pointer to be nullable
	Permission PermissionType

	Created time.Time
	Updated time.Time
}

func (p DashboardACL) TableName() string { return "dashboard_acl" }

type DashboardACLInfoDTO struct {
	OrgID       int64 `json:"-" xorm:"org_id"`
	DashboardID int64 `json:"dashboardId,omitempty" xorm:"dashboard_id"`
	FolderID    int64 `json:"folderId,omitempty" xorm:"folder_id"`

	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`

	UserID         int64          `json:"userId" xorm:"user_id"`
	UserLogin      string         `json:"userLogin"`
	UserEmail      string         `json:"userEmail"`
	UserAvatarURL  string         `json:"userAvatarUrl" xorm:"user_avatar_url"`
	TeamID         int64          `json:"teamId" xorm:"team_id"`
	TeamEmail      string         `json:"teamEmail"`
	TeamAvatarURL  string         `json:"teamAvatarUrl" xorm:"team_avatar_url"`
	Team           string         `json:"team"`
	Role           *org.RoleType  `json:"role,omitempty"`
	Permission     PermissionType `json:"permission"`
	PermissionName string         `json:"permissionName"`
	UID            string         `json:"uid" xorm:"uid"`
	Title          string         `json:"title"`
	Slug           string         `json:"slug"`
	IsFolder       bool           `json:"isFolder"`
	URL            string         `json:"url" xorm:"url"`
	Inherited      bool           `json:"inherited"`
}

func (dto *DashboardACLInfoDTO) hasSameRoleAs(other *DashboardACLInfoDTO) bool {
	if dto.Role == nil || other.Role == nil {
		return false
	}

	return dto.UserID <= 0 && dto.TeamID <= 0 && dto.UserID == other.UserID && dto.TeamID == other.TeamID && *dto.Role == *other.Role
}

func (dto *DashboardACLInfoDTO) hasSameUserAs(other *DashboardACLInfoDTO) bool {
	return dto.UserID > 0 && dto.UserID == other.UserID
}

func (dto *DashboardACLInfoDTO) hasSameTeamAs(other *DashboardACLInfoDTO) bool {
	return dto.TeamID > 0 && dto.TeamID == other.TeamID
}

// IsDuplicateOf returns true if other item has same role, same user or same team
func (dto *DashboardACLInfoDTO) IsDuplicateOf(other *DashboardACLInfoDTO) bool {
	return dto.hasSameRoleAs(other) || dto.hasSameUserAs(other) || dto.hasSameTeamAs(other)
}

// QUERIES
type GetDashboardACLInfoListQuery struct {
	DashboardID int64
	OrgID       int64
}

type FindPersistedDashboardsQuery struct {
	Title         string
	OrgId         int64
	SignedInUser  *user.SignedInUser
	IsStarred     bool
	DashboardIds  []int64
	DashboardUIDs []string
	Type          string
	FolderIds     []int64
	Tags          []string
	Limit         int64
	Page          int64
	Permission    PermissionType
	Sort          models.SortOption

	Filters []interface{}

	Result models.HitList
}
