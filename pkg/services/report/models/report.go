package models

import (
	"time"

	reporting "github.com/grafana/grafana/pkg/apis/reporting/v0alpha1"
)

// Report is model representation of the report resource
// TODO: ScheduleDay, ScheduleHour, ScheduleMinute can be removed from config types and database, as they can be extracted from ScheduleStart field
type Report struct {
	ID                        int64  `xorm:"'id' autoincr pk"`
	UID                       string `xorm:"uid"`
	UserID                    int64  `xorm:"user_id"`
	OrgID                     int64  `xorm:"org_id"`
	DashboardID               int64  `xorm:"dashboard_id"` // DEPRECATED TODO: Remove NOT NULL constraint OR add DEFAULT value in DB before removing
	Name                      string
	Recipients                string
	ReplyTo                   string
	Message                   string
	ScheduleStart             int64
	ScheduleEnd               *int64
	ScheduleFrequency         string
	ScheduleIntervalFrequency string
	ScheduleIntervalAmount    int64
	ScheduleWorkdaysOnly      bool
	ScheduleDayOfMonth        string // DEPRECATED TODO: Should be replaced with boolean LastDayOfMonth flag
	ScheduleDay               string // DEPRECATED
	ScheduleHour              int64  // DEPRECATED
	ScheduleMinute            int64  // DEPRECATED
	ScheduleTimezone          string
	TimeFrom                  string           // DEPRECATED
	TimeTo                    string           // DEPRECATED
	PDFOrientation            string           `xorm:"pdf_orientation"`
	PDFLayout                 string           `xorm:"pdf_layout"`
	EnableDashboardURL        bool             `xorm:"enable_dashboard_url"`
	EnableCSV                 bool             `xorm:"enable_csv"` // DEPRECATED
	State                     reporting.State  `xorm:"state"`
	Formats                   []reporting.Type `xorm:"formats"`
	ScaleFactor               int
	PDFShowTemplateVariables  bool `xorm:"pdf_show_template_variables"`
	PDFCombineOneFile         bool `xorm:"pdf_combine_one_file"`

	Created time.Time `xorm:"created"`
	Updated time.Time `xorm:"updated"`

	LoadedTimezone *time.Location `xorm:"-"`
}

func (r Report) GetTimezone() *time.Location {
	if r.LoadedTimezone == nil {
		tz, err := time.LoadLocation(r.ScheduleTimezone)
		if err != nil {
			r.LoadedTimezone = time.UTC
		} else {
			r.LoadedTimezone = tz
		}
	}

	return r.LoadedTimezone
}

// TableName returns name of the table.
// Needed primarily for xorm ORM
func (Report) TableName() string {
	return "report"
}

type ReportFile struct {
	Name    string
	Content []byte
	Type    reporting.Type
}
