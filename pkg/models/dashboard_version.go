package models

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type DiffType int

const (
	DiffJSON DiffType = iota
	DiffBasic
	DiffDelta
)

var (
	ErrDashboardVersionNotFound = errors.New("Dashboard version not found")
	ErrNoVersionsForDashboardId = errors.New("No dashboard versions found for the given DashboardId")
)

// A DashboardVersion represents the comparable data in a dashboard, allowing
// diffs of the dashboard to be performed.
type DashboardVersion struct {
	Id            int64 `json:"id"`
	DashboardId   int64 `json:"dashboardId"`
	ParentVersion int   `json:"parentVersion"`
	RestoredFrom  int   `json:"restoredFrom"`
	Version       int   `json:"version"`

	Created   time.Time `json:"created"`
	CreatedBy int64     `json:"createdBy"`

	Message string           `json:"message"`
	Data    *simplejson.Json `json:"data"`
}

// DashboardVersionMeta extends the dashboard version model with the names
// associated with the UserIds, overriding the field with the same name from
// the DashboardVersion model.
type DashboardVersionMeta struct {
	DashboardVersion
	CreatedBy string `json:"createdBy"`
}

// DashboardVersionDTO represents a dashboard version, without the dashboard
// map.
type DashboardVersionDTO struct {
	Id            int64     `json:"id"`
	DashboardId   int64     `json:"dashboardId"`
	ParentVersion int       `json:"parentVersion"`
	RestoredFrom  int       `json:"restoredFrom"`
	Version       int       `json:"version"`
	Created       time.Time `json:"created"`
	CreatedBy     string    `json:"createdBy"`
	Message       string    `json:"message"`
}

//
// Queries
//

type GetDashboardVersionQuery struct {
	DashboardId int64
	OrgId       int64
	Version     int

	Result *DashboardVersion
}

type GetDashboardVersionsQuery struct {
	DashboardId int64
	OrgId       int64
	Limit       int
	Start       int

	Result []*DashboardVersionDTO
}

//
// Commands
//

// RestoreDashboardVersionCommand creates a new dashboard version.
type RestoreDashboardVersionCommand struct {
	DashboardId int64 `json:"dashboardId"`
	Version     int   `json:"version" binding:"Required"`
	UserId      int64 `json:"-"`
	OrgId       int64 `json:"-"`

	Result *Dashboard
}

// CompareDashboardVersionsCommand is used to compare two versions.
type CompareDashboardVersionsCommand struct {
	OrgId       int64
	DashboardId int64
	Original    int
	New         int
	DiffType    DiffType

	Delta []byte `json:"delta"`
}
