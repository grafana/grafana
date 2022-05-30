package dashver

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type DashboardVersion struct {
	ID            int64 `json:"id"`
	DashboardID   int64 `json:"dashboardId"`
	ParentVersion int   `json:"parentVersion"`
	RestoredFrom  int   `json:"restoredFrom"`
	Version       int   `json:"version"`

	Created   time.Time `json:"created"`
	CreatedBy int64     `json:"createdBy"`

	Message string           `json:"message"`
	Data    *simplejson.Json `json:"data"`
}

type GetDashboardVersionQuery struct {
	DashboardID int64
	OrgID       int64
	Version     int
}
