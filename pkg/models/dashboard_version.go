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

	Created time.Time `json:"created"`

	CreatedBy int64 `json:"createdBy"`

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
// COMMANDS
//

// GetDashboardVersionCommand contains the data required to execute the
// sqlstore.GetDashboardVersionCommand, which returns the DashboardVersion for
// the given Version.
type GetDashboardVersionCommand struct {
	DashboardId int64 `json:"dashboardId" binding:"Required"`
	Version     int   `json:"version" binding:"Required"`

	Result *DashboardVersion
}

// GetDashboardVersionsCommand contains the data required to execute the
// sqlstore.GetDashboardVersionsCommand, which returns all dashboard versions.
type GetDashboardVersionsCommand struct {
	DashboardId int64  `json:"dashboardId" binding:"Required"`
	OrderBy     string `json:"orderBy"`
	Limit       int    `json:"limit"`
	Start       int    `json:"start"`

	Result []*DashboardVersion
}

// RestoreDashboardVersionCommand creates a new dashboard version.
type RestoreDashboardVersionCommand struct {
	DashboardId int64 `json:"dashboardId"`
	Version     int   `json:"version" binding:"Required"`
	UserId      int64 `json:"-"`

	Result *Dashboard
}

// CompareDashboardVersionsCommand is used to compare two versions.
type CompareDashboardVersionsCommand struct {
	DashboardId int64    `json:"dashboardId"`
	Original    int      `json:"original" binding:"Required"`
	New         int      `json:"new" binding:"Required"`
	DiffType    DiffType `json:"-"`

	Delta []byte `json:"delta"`
}
