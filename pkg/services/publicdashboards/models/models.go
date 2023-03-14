package models

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

// PublicDashboardErr represents a dashboard error.
type PublicDashboardErr struct {
	StatusCode int
	Status     string
	Reason     string
}

// Error returns the error message.
func (e PublicDashboardErr) Error() string {
	if e.Reason != "" {
		return e.Reason
	}
	return "Dashboard Error"
}

const (
	QuerySuccess              = "success"
	QueryFailure              = "failure"
	EmailShareType  ShareType = "email"
	PublicShareType ShareType = "public"
)

var (
	QueryResultStatuses = []string{QuerySuccess, QueryFailure}
	ValidShareTypes     = []ShareType{EmailShareType, PublicShareType}
)

type ShareType string

type PublicDashboard struct {
	Uid                  string        `json:"uid" xorm:"pk uid"`
	DashboardUid         string        `json:"dashboardUid" xorm:"dashboard_uid"`
	OrgId                int64         `json:"-" xorm:"org_id"` // Don't ever marshal orgId to Json
	TimeSettings         *TimeSettings `json:"timeSettings" xorm:"time_settings"`
	IsEnabled            bool          `json:"isEnabled" xorm:"is_enabled"`
	AccessToken          string        `json:"accessToken" xorm:"access_token"`
	AnnotationsEnabled   bool          `json:"annotationsEnabled" xorm:"annotations_enabled"`
	TimeSelectionEnabled bool          `json:"timeSelectionEnabled" xorm:"time_selection_enabled"`
	Share                ShareType     `json:"share" xorm:"share"`
	Recipients           []EmailDTO    `json:"recipients,omitempty" xorm:"-"`
	CreatedBy            int64         `json:"createdBy" xorm:"created_by"`
	UpdatedBy            int64         `json:"updatedBy" xorm:"updated_by"`
	CreatedAt            time.Time     `json:"createdAt" xorm:"created_at"`
	UpdatedAt            time.Time     `json:"updatedAt" xorm:"updated_at"`
}

type EmailDTO struct {
	Uid       string `json:"uid"`
	Recipient string `json:"recipient"`
}

// Alias the generated type
type DashAnnotation = dashboard.AnnotationQuery

type AnnotationsDto struct {
	Annotations struct {
		List []DashAnnotation `json:"list"`
	}
}

type AnnotationEvent struct {
	Id          int64                     `json:"id"`
	DashboardId int64                     `json:"dashboardId"`
	PanelId     int64                     `json:"panelId"`
	Tags        []string                  `json:"tags"`
	IsRegion    bool                      `json:"isRegion"`
	Text        string                    `json:"text"`
	Color       string                    `json:"color"`
	Time        int64                     `json:"time"`
	TimeEnd     int64                     `json:"timeEnd"`
	Source      dashboard.AnnotationQuery `json:"source"`
}

func (pd PublicDashboard) TableName() string {
	return "dashboard_public"
}

type PublicDashboardListResponse struct {
	Uid          string `json:"uid" xorm:"uid"`
	AccessToken  string `json:"accessToken" xorm:"access_token"`
	Title        string `json:"title" xorm:"title"`
	DashboardUid string `json:"dashboardUid" xorm:"dashboard_uid"`
	IsEnabled    bool   `json:"isEnabled" xorm:"is_enabled"`
}

type TimeSettings struct {
	From string `json:"from,omitempty"`
	To   string `json:"to,omitempty"`
}

func (ts *TimeSettings) FromDB(data []byte) error {
	return json.Unmarshal(data, ts)
}

func (ts *TimeSettings) ToDB() ([]byte, error) {
	return json.Marshal(ts)
}

// BuildTimeSettings build time settings object using selected values if enabled and are valid or dashboard default values
func (pd PublicDashboard) BuildTimeSettings(dashboard *dashboards.Dashboard, reqDTO PublicDashboardQueryDTO) TimeSettings {
	from := dashboard.Data.GetPath("time", "from").MustString()
	to := dashboard.Data.GetPath("time", "to").MustString()

	if pd.TimeSelectionEnabled {
		from = reqDTO.TimeRange.From
		to = reqDTO.TimeRange.To
	}

	timeRange := legacydata.NewDataTimeRange(from, to)

	// Were using epoch ms because this is used to build a MetricRequest, which is used by query caching, which expected the time range in epoch milliseconds.
	return TimeSettings{
		From: strconv.FormatInt(timeRange.GetFromAsMsEpoch(), 10),
		To:   strconv.FormatInt(timeRange.GetToAsMsEpoch(), 10),
	}
}

// DTO for transforming user input in the api
type SavePublicDashboardDTO struct {
	DashboardUid    string
	OrgId           int64
	UserId          int64
	PublicDashboard *PublicDashboard
}

type PublicDashboardQueryDTO struct {
	IntervalMs      int64
	MaxDataPoints   int64
	QueryCachingTTL int64
	TimeRange       TimeSettings
}

type AnnotationsQueryDTO struct {
	From int64
	To   int64
}

//
// COMMANDS
//

type SavePublicDashboardCommand struct {
	PublicDashboard PublicDashboard
}
