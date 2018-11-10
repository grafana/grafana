package models

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gosimple/slug"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/setting"
)

// Typed errors
var (
	ErrDashboardNotFound                       = errors.New("Dashboard not found")
	ErrDashboardFolderNotFound                 = errors.New("Folder not found")
	ErrDashboardSnapshotNotFound               = errors.New("Dashboard snapshot not found")
	ErrDashboardWithSameUIDExists              = errors.New("A dashboard with the same uid already exists")
	ErrDashboardWithSameNameInFolderExists     = errors.New("A dashboard with the same name in the folder already exists")
	ErrDashboardVersionMismatch                = errors.New("The dashboard has been changed by someone else")
	ErrDashboardTitleEmpty                     = errors.New("Dashboard title cannot be empty")
	ErrDashboardFolderCannotHaveParent         = errors.New("A Dashboard Folder cannot be added to another folder")
	ErrDashboardFailedToUpdateAlertData        = errors.New("Failed to save alert data")
	ErrDashboardsWithSameSlugExists            = errors.New("Multiple dashboards with the same slug exists")
	ErrDashboardFailedGenerateUniqueUid        = errors.New("Failed to generate unique dashboard id")
	ErrDashboardTypeMismatch                   = errors.New("Dashboard cannot be changed to a folder")
	ErrDashboardFolderWithSameNameAsDashboard  = errors.New("Folder name cannot be the same as one of its dashboards")
	ErrDashboardWithSameNameAsFolder           = errors.New("Dashboard name cannot be the same as folder")
	ErrDashboardFolderNameExists               = errors.New("A folder with that name already exists")
	ErrDashboardUpdateAccessDenied             = errors.New("Access denied to save dashboard")
	ErrDashboardInvalidUid                     = errors.New("uid contains illegal characters")
	ErrDashboardUidToLong                      = errors.New("uid to long. max 40 characters")
	ErrDashboardCannotSaveProvisionedDashboard = errors.New("Cannot save provisioned dashboard")
	RootFolderName                             = "General"
)

type UpdatePluginDashboardError struct {
	PluginId string
}

func (d UpdatePluginDashboardError) Error() string {
	return "Dashboard belong to plugin"
}

var (
	DashTypeJson     = "file"
	DashTypeDB       = "db"
	DashTypeScript   = "script"
	DashTypeSnapshot = "snapshot"
)

// Dashboard model
type Dashboard struct {
	Id       int64
	Uid      string
	Slug     string
	OrgId    int64
	GnetId   int64
	Version  int
	PluginId string

	Created time.Time
	Updated time.Time

	UpdatedBy int64
	CreatedBy int64
	FolderId  int64
	IsFolder  bool
	HasAcl    bool

	Title string
	Data  *simplejson.Json
}

func (d *Dashboard) SetId(id int64) {
	d.Id = id
	d.Data.Set("id", id)
}

func (d *Dashboard) SetUid(uid string) {
	d.Uid = uid
	d.Data.Set("uid", uid)
}

func (d *Dashboard) SetVersion(version int) {
	d.Version = version
	d.Data.Set("version", version)
}

// GetDashboardIdForSavePermissionCheck return the dashboard id to be used for checking permission of dashboard
func (d *Dashboard) GetDashboardIdForSavePermissionCheck() int64 {
	if d.Id == 0 {
		return d.FolderId
	}

	return d.Id
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
	folder.Data.Set("schemaVersion", 16)
	folder.Data.Set("version", 0)
	folder.IsFolder = true
	return folder
}

// GetTags turns the tags in data json into go string array
func (dash *Dashboard) GetTags() []string {
	return dash.Data.Get("tags").MustStringArray()
}

func NewDashboardFromJson(data *simplejson.Json) *Dashboard {
	dash := &Dashboard{}
	dash.Data = data
	dash.Title = dash.Data.Get("title").MustString()
	dash.UpdateSlug()
	update := false

	if id, err := dash.Data.Get("id").Float64(); err == nil {
		dash.Id = int64(id)
		update = true
	}

	if uid, err := dash.Data.Get("uid").String(); err == nil {
		dash.Uid = uid
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
		dash.GnetId = int64(gnetId)
	}

	return dash
}

// GetDashboardModel turns the command into the saveable model
func (cmd *SaveDashboardCommand) GetDashboardModel() *Dashboard {
	dash := NewDashboardFromJson(cmd.Dashboard)
	userId := cmd.UserId

	if userId == 0 {
		userId = -1
	}

	dash.UpdatedBy = userId
	dash.OrgId = cmd.OrgId
	dash.PluginId = cmd.PluginId
	dash.IsFolder = cmd.IsFolder
	dash.FolderId = cmd.FolderId
	dash.UpdateSlug()
	return dash
}

// GetString a
func (dash *Dashboard) GetString(prop string, defaultValue string) string {
	return dash.Data.Get(prop).MustString(defaultValue)
}

// UpdateSlug updates the slug
func (dash *Dashboard) UpdateSlug() {
	title := dash.Data.Get("title").MustString()
	dash.Slug = SlugifyTitle(title)
}

func SlugifyTitle(title string) string {
	return slug.Make(strings.ToLower(title))
}

// GetUrl return the html url for a folder if it's folder, otherwise for a dashboard
func (dash *Dashboard) GetUrl() string {
	return GetDashboardFolderUrl(dash.IsFolder, dash.Uid, dash.Slug)
}

// Return the html url for a dashboard
func (dash *Dashboard) GenerateUrl() string {
	return GetDashboardUrl(dash.Uid, dash.Slug)
}

// GetDashboardFolderUrl return the html url for a folder if it's folder, otherwise for a dashboard
func GetDashboardFolderUrl(isFolder bool, uid string, slug string) string {
	if isFolder {
		return GetFolderUrl(uid, slug)
	}

	return GetDashboardUrl(uid, slug)
}

// GetDashboardUrl return the html url for a dashboard
func GetDashboardUrl(uid string, slug string) string {
	return fmt.Sprintf("%s/d/%s/%s", setting.AppSubUrl, uid, slug)
}

// GetFullDashboardUrl return the full url for a dashboard
func GetFullDashboardUrl(uid string, slug string) string {
	return fmt.Sprintf("%sd/%s/%s", setting.AppUrl, uid, slug)
}

// GetFolderUrl return the html url for a folder
func GetFolderUrl(folderUid string, slug string) string {
	return fmt.Sprintf("%s/dashboards/f/%s/%s", setting.AppSubUrl, folderUid, slug)
}

type ValidateDashboardBeforeSaveResult struct {
	IsParentFolderChanged bool
}

//
// COMMANDS
//

type SaveDashboardCommand struct {
	Dashboard    *simplejson.Json `json:"dashboard" binding:"Required"`
	UserId       int64            `json:"userId"`
	Overwrite    bool             `json:"overwrite"`
	Message      string           `json:"message"`
	OrgId        int64            `json:"-"`
	RestoredFrom int              `json:"-"`
	PluginId     string           `json:"-"`
	FolderId     int64            `json:"folderId"`
	IsFolder     bool             `json:"isFolder"`

	UpdatedAt time.Time

	Result *Dashboard
}

type DashboardProvisioning struct {
	Id          int64
	DashboardId int64
	Name        string
	ExternalId  string
	CheckSum    string
	Updated     int64
}

type SaveProvisionedDashboardCommand struct {
	DashboardCmd          *SaveDashboardCommand
	DashboardProvisioning *DashboardProvisioning

	Result *Dashboard
}

type DeleteDashboardCommand struct {
	Id    int64
	OrgId int64
}

type ValidateDashboardBeforeSaveCommand struct {
	OrgId     int64
	Dashboard *Dashboard
	Overwrite bool
	Result    *ValidateDashboardBeforeSaveResult
}

//
// QUERIES
//

type GetDashboardQuery struct {
	Slug  string // required if no Id or Uid is specified
	Id    int64  // optional if slug is set
	Uid   string // optional if slug is set
	OrgId int64

	Result *Dashboard
}

type DashboardTagCloudItem struct {
	Term  string `json:"term"`
	Count int    `json:"count"`
}

type GetDashboardTagsQuery struct {
	OrgId  int64
	Result []*DashboardTagCloudItem
}

type GetDashboardsQuery struct {
	DashboardIds []int64
	Result       []*Dashboard
}

type GetDashboardPermissionsForUserQuery struct {
	DashboardIds []int64
	OrgId        int64
	UserId       int64
	OrgRole      RoleType
	Result       []*DashboardPermissionForUser
}

type GetDashboardsByPluginIdQuery struct {
	OrgId    int64
	PluginId string
	Result   []*Dashboard
}

type GetDashboardSlugByIdQuery struct {
	Id     int64
	Result string
}

type IsDashboardProvisionedQuery struct {
	DashboardId int64

	Result bool
}

type GetProvisionedDashboardDataQuery struct {
	Name string

	Result []*DashboardProvisioning
}

type GetDashboardsBySlugQuery struct {
	OrgId int64
	Slug  string

	Result []*Dashboard
}

type DashboardPermissionForUser struct {
	DashboardId    int64          `json:"dashboardId"`
	Permission     PermissionType `json:"permission"`
	PermissionName string         `json:"permissionName"`
}

type DashboardRef struct {
	Uid  string
	Slug string
}

type GetDashboardRefByIdQuery struct {
	Id     int64
	Result *DashboardRef
}
