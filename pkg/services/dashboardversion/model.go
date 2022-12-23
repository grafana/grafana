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
	ID            int64            `json:"id"`
	DashboardID   int64            `json:"dashboardId"`
	DashboardUID  string           `json:"dashboardUid"`
	ParentVersion int              `json:"parentVersion"`
	RestoredFrom  int              `json:"restoredFrom"`
	Version       int              `json:"version"`
	Created       time.Time        `json:"created"`
	CreatedBy     int64            `json:"createdBy"`
	Message       string           `json:"message"`
	Data          *simplejson.Json `json:"data" db:"data"`
}

// DashboardVersionMeta extends the DashboardVersionDTO with the names
// associated with the UserIds, overriding the field with the same name from
// the DashboardVersionDTO model.
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
