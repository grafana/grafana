package dashverimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
)

type store interface {
	Get(context.Context, *dashver.GetDashboardVersionQuery) (*dashboardVersion, error)
	GetBatch(context.Context, *dashver.DeleteExpiredVersionsCommand, int, int) ([]interface{}, error)
	DeleteBatch(context.Context, *dashver.DeleteExpiredVersionsCommand, []interface{}) (int64, error)
	List(context.Context, *dashver.ListDashboardVersionsQuery) ([]*dashboardVersion, error)
}

// dashboardVersion represents a dashboard version in the database.
type dashboardVersion struct {
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

// ToDTO converts a DashboardVersion to a DashboardVersionDTO.
func (v *dashboardVersion) ToDTO(dashUid string) *dashver.DashboardVersionDTO {
	return &dashver.DashboardVersionDTO{
		ID:            v.ID,
		DashboardID:   v.DashboardID,
		DashboardUID:  dashUid,
		ParentVersion: v.ParentVersion,
		RestoredFrom:  v.RestoredFrom,
		Version:       v.Version,
		Created:       v.Created,
		CreatedBy:     v.CreatedBy,
		Message:       v.Message,
		Data:          v.Data,
	}
}
