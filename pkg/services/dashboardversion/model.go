package dashver

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

var (
	ErrDashboardVersionNotFound = errors.New("dashboard version not found")
	ErrNoVersionsForDashboardID = errors.New("no dashboard versions found for the given DashboardId")
)

type DashboardVersion struct {
	ID            int64 `json:"id" xorm:"pk autoincr 'id'" db:"id"`
	DashboardID   int64 `json:"dashboardId"  xorm:"dashboard_id" db:"dashboard_id"`
	ParentVersion int   `json:"parentVersion" db:"parent_version"`
	RestoredFrom  int   `json:"restoredFrom" db:"restored_from"`
	Version       int   `json:"version" db:"version"`

	Created   time.Time `json:"created" db:"created"`
	CreatedBy int64     `json:"createdBy" db:"created_by"`

	Message string           `json:"message" db:"message"`
	Data    *simplejson.Json `json:"data" db:"data"`
}

type GetDashboardVersionQuery struct {
	DashboardID int64
	OrgID       int64
	Version     int
}

type DeleteExpiredVersionsCommand struct {
	DeletedRows int64
}

type ListDashboardVersionsQuery struct {
	DashboardID  int64
	DashboardUID string
	OrgID        int64
	Limit        int
	Start        int
}

type DashboardVersionDTO struct {
	ID            int64     `json:"id" xorm:"id" db:"id"`
	DashboardID   int64     `json:"dashboardId" xorm:"dashboard_id" db:"dashboard_id"`
	DashboardUID  string    `json:"dashboardUid" xorm:"dashboard_uid" db:"dashboard_uid"`
	ParentVersion int       `json:"parentVersion" db:"parent_version"`
	RestoredFrom  int       `json:"restoredFrom" db:"restored_from"`
	Version       int       `json:"version" db:"version"`
	Created       time.Time `json:"created" db:"created"`
	// Since we get created by with left join user table, this can be null technically,
	// but in reality it will always be set, when database is not corrupted.
	CreatedBy *string `json:"createdBy" db:"created_by_login"`
	Message   string  `json:"message" db:"message"`
}

// DashboardVersionMeta extends the dashboard version model with the names
// associated with the UserIds, overriding the field with the same name from
// the DashboardVersion model.
type DashboardVersionMeta struct {
	ID            int64            `json:"id"`
	DashboardID   int64            `json:"dashboardId"`
	DashboardUID  string           `json:"uid"`
	ParentVersion int              `json:"parentVersion"`
	RestoredFrom  int              `json:"restoredFrom"`
	Version       int              `json:"version"`
	Created       time.Time        `json:"created"`
	Message       string           `json:"message"`
	Data          *simplejson.Json `json:"data"`
	CreatedBy     string           `json:"createdBy"`
}
