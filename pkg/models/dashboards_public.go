package models

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type PublicDashboard struct {
	Uid          string           `json:"uid" xorm:"pk uid"`
	DashboardUid string           `json:"dashboardUid" xorm:"dashboard_uid"`
	OrgId        int64            `json:"-" xorm:"org_id"` // Don't ever marshal orgId to Json
	TimeSettings *simplejson.Json `json:"timeSettings" xorm:"time_settings"`
	IsEnabled    bool             `json:"isEnabled" xorm:"is_enabled"`
	AccessToken  string           `json:"accessToken" xorm:"access_token"`

	CreatedBy int64 `json:"createdBy" xorm:"created_by"`
	UpdatedBy int64 `json:"updatedBy" xorm:"updated_by"`

	CreatedAt time.Time `json:"createdAt" xorm:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" xorm:"updated_at"`
}

func (pd PublicDashboard) TableName() string {
	return "dashboard_public"
}

type TimeSettings struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// build time settings object from json on public dashboard. If empty, use
// defaults on the dashboard
func (pd PublicDashboard) BuildTimeSettings(dashboard *Dashboard) *TimeSettings {
	ts := &TimeSettings{
		From: dashboard.Data.GetPath("time", "from").MustString(),
		To:   dashboard.Data.GetPath("time", "to").MustString(),
	}

	if pd.TimeSettings == nil {
		return ts
	}

	// merge time settings from public dashboard
	to := pd.TimeSettings.Get("to").MustString("")
	from := pd.TimeSettings.Get("from").MustString("")
	if to != "" && from != "" {
		ts.From = from
		ts.To = to
	}

	return ts
}

//
// COMMANDS
//

type SavePublicDashboardConfigCommand struct {
	DashboardUid    string
	OrgId           int64
	PublicDashboard PublicDashboard
}
