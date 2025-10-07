package dashver

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

var (
	ErrDashboardVersionNotFound = errors.New("dashboard version not found")
	ErrNoVersionsForDashboardID = errors.New("no dashboard versions found for the given DashboardId")
)

// DashboardVersion represents a dashboard version in the database. Ideally this
// will be moved into dashverimpl and unexported, but there are a few test
// fixtures that insert DashboardVersions directly into a database which must be
// refactored first.
type DashboardVersion struct {
	ID            int64  `json:"id" xorm:"pk autoincr 'id'" db:"id"`
	DashboardID   int64  `json:"dashboardId"  xorm:"dashboard_id" db:"dashboard_id"`
	ParentVersion int    `json:"parentVersion" db:"parent_version"`
	RestoredFrom  int    `json:"restoredFrom" db:"restored_from"`
	Version       int    `json:"version" db:"version"`
	APIVersion    string `json:"apiVersion" xorm:"api_version" db:"api_version"`

	Created   time.Time `json:"created" db:"created"`
	CreatedBy int64     `json:"createdBy" db:"created_by"`

	Message string           `json:"message" db:"message"`
	Data    *simplejson.Json `json:"data" db:"data"`
}

// ToDTO converts a DashboardVersion to a DashboardVersionDTO.
func (v *DashboardVersion) ToDTO(dashUid string) *DashboardVersionDTO {
	return &DashboardVersionDTO{
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

// GetDashboardVersionQuery is used to Get a dashboard version. Only one of
// DashboardID and DashboardUID are required.
type GetDashboardVersionQuery struct {
	DashboardID  int64
	DashboardUID string
	OrgID        int64
	Version      int64
}

type DeleteExpiredVersionsCommand struct {
	DeletedRows int64
}

// RestoreVersionCommand is used to restore a dashboard version.
// Only one of DashboardID and DashboardUID are required.
type RestoreVersionCommand struct {
	Requester    identity.Requester
	DashboardUID string
	DashboardID  int64
	Version      int64
}

type ListDashboardVersionsQuery struct {
	DashboardID   int64
	DashboardUID  string
	OrgID         int64
	Limit         int
	Start         int
	ContinueToken string
}

type DashboardVersionResponse struct {
	ContinueToken string                 `json:"continueToken"`
	Versions      []*DashboardVersionDTO `json:"versions"`
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

type DashboardVersionResponseMeta struct {
	ContinueToken string                 `json:"continueToken"`
	Versions      []DashboardVersionMeta `json:"versions"`
}
