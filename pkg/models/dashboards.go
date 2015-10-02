package models

import (
	"errors"
	"strings"
	"time"

	"github.com/gosimple/slug"
)

// Typed errors
var (
	ErrDashboardNotFound           = errors.New("Dashboard not found")
	ErrDashboardSnapshotNotFound   = errors.New("Dashboard snapshot not found")
	ErrDashboardWithSameNameExists = errors.New("A dashboard with the same name already exists")
	ErrDashboardVersionMismatch    = errors.New("The dashboard has been changed by someone else")
)

var (
	DashTypeJson     = "file"
	DashTypeDB       = "db"
	DashTypeScript   = "script"
	DashTypeSnapshot = "snapshot"
)

// Dashboard model
type Dashboard struct {
	Id      int64
	Slug    string
	OrgId   int64
	Version int

	Created time.Time
	Updated time.Time

	Title string
	Data  map[string]interface{}
}

// NewDashboard creates a new dashboard
func NewDashboard(title string) *Dashboard {
	dash := &Dashboard{}
	dash.Data = make(map[string]interface{})
	dash.Data["title"] = title
	dash.Title = title
	dash.UpdateSlug()
	return dash
}

// GetTags turns the tags in data json into go string array
func (dash *Dashboard) GetTags() []string {
	jsonTags := dash.Data["tags"]
	if jsonTags == nil || jsonTags == "" {
		return []string{}
	}

	arr := jsonTags.([]interface{})
	b := make([]string, len(arr))
	for i := range arr {
		b[i] = arr[i].(string)
	}
	return b
}

func NewDashboardFromJson(data map[string]interface{}) *Dashboard {
	dash := &Dashboard{}
	dash.Data = data
	dash.Title = dash.Data["title"].(string)
	dash.UpdateSlug()

	if dash.Data["id"] != nil {
		dash.Id = int64(dash.Data["id"].(float64))

		if dash.Data["version"] != nil {
			dash.Version = int(dash.Data["version"].(float64))
		}
	} else {
		dash.Data["version"] = 0
	}

	return dash
}

// GetDashboardModel turns the command into the savable model
func (cmd *SaveDashboardCommand) GetDashboardModel() *Dashboard {
	dash := NewDashboardFromJson(cmd.Dashboard)
	dash.OrgId = cmd.OrgId
	dash.UpdateSlug()
	return dash
}

// GetString a
func (dash *Dashboard) GetString(prop string) string {
	return dash.Data[prop].(string)
}

// UpdateSlug updates the slug
func (dash *Dashboard) UpdateSlug() {
	title := strings.ToLower(dash.Data["title"].(string))
	dash.Slug = slug.Make(title)
}

//
// COMMANDS
//

type SaveDashboardCommand struct {
	Dashboard map[string]interface{} `json:"dashboard" binding:"Required"`
	Overwrite bool                   `json:"overwrite"`
	OrgId     int64                  `json:"-"`

	Result *Dashboard
}

type DeleteDashboardCommand struct {
	Slug  string
	OrgId int64
}

//
// QUERIES
//

type GetDashboardQuery struct {
	Slug  string
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
