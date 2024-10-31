package models

import (
	"encoding/json"
	"time"

	reporting "github.com/grafana/grafana/pkg/apis/reporting/v0alpha1"
)

// swagger:model Report
type ReportDTO struct {
	ID                 int64            `json:"id"`
	UID                string           `json:"uid"`
	UserID             int64            `json:"userId"`
	OrgID              int64            `json:"orgId"`
	Name               string           `json:"name"`
	Recipients         string           `json:"recipients"`
	ReplyTo            string           `json:"replyTo"`
	Message            string           `json:"message"`
	Schedule           ScheduleDTO      `json:"schedule"`
	Options            ReportOptionsDTO `json:"options"`
	EnableDashboardURL bool             `json:"enableDashboardUrl"`
	EnableCSV          bool             `json:"enableCsv"` // DEPRECATED
	State              reporting.State  `json:"state"`
	Dashboards         []DashboardDTO   `json:"dashboards"`
	Formats            []reporting.Type `json:"formats"`
	ScaleFactor        int              `json:"scaleFactor"`

	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`
}

// swagger:model ReportSettings
type SettingsDTO struct {
	ID       int64              `json:"id"`
	UserID   int64              `json:"userId"`
	OrgID    int64              `json:"orgId"`
	Branding BrandingOptionsDTO `json:"branding"`
}

// swagger:model ReportEmail
type ReportEmailDTO struct {
	// Send the report to the emails specified in the report. Required if emails is not present.
	Id int64 `json:"id,string"`
	// Comma-separated list of emails to which to send the report to.
	Emails string `json:"emails"`
	// Send the report to the emails specified in the report. Required if emails is not present.
	UseEmailsFromReport bool `json:"useEmailsFromReport"`
}

// swagger:model ReportSchedule
type ScheduleDTO struct {
	StartDate         *time.Time `json:"startDate"`
	EndDate           *time.Time `json:"endDate"`
	Frequency         string     `json:"frequency"`
	IntervalFrequency string     `json:"intervalFrequency"`
	IntervalAmount    int64      `json:"intervalAmount"`
	WorkdaysOnly      bool       `json:"workdaysOnly"`
	DayOfMonth        string     `json:"dayOfMonth"` // In the new schedule format DayOfMonth must be either empty, or "last"
	TimeZone          string     `json:"timeZone"`
}

// swagger:model ReportDashboard
type DashboardDTO struct {
	Dashboard       DashboardReportDTO `json:"dashboard"`
	TimeRange       TimeRangeDTO       `json:"timeRange"`
	ReportVariables json.RawMessage    `json:"reportVariables,omitempty"`
}

// swagger:model ReportDashboardID
type DashboardReportDTO struct {
	ID   int64  `json:"id"`
	UID  string `json:"uid"`
	Name string `json:"name"`
}

// swagger:model ReportBrandingOptions
type BrandingOptionsDTO struct {
	ReportLogo      string `json:"reportLogoUrl"`
	EmailLogo       string `json:"emailLogoUrl"`
	EmailFooterMode string `json:"emailFooterMode"`
	EmailFooterText string `json:"emailFooterText"`
	EmailFooterLink string `json:"emailFooterLink"`
}

// swagger:model ReportOptions
type ReportOptionsDTO struct {
	Orientation              string       `json:"orientation"`
	Layout                   string       `json:"layout"`
	TimeRange                TimeRangeDTO `json:"timeRange"` // DEPRECATED
	PDFShowTemplateVariables bool         `json:"pdfShowTemplateVariables"`
	PDFCombineOneFile        bool         `json:"pdfCombineOneFile"`
}

// swagger:model CreateOrUpdateReport
type CreateOrUpdateReportDTO struct {
	ID                 int64             `json:"-"`
	UserID             int64             `json:"-"`
	OrgID              int64             `json:"-"`
	Name               string            `json:"name"`
	Recipients         string            `json:"recipients"` // Should this be a string or an array?
	ReplyTo            string            `json:"replyTo"`
	Message            string            `json:"message"`
	Schedule           ScheduleDTO       `json:"schedule"`
	Options            ReportOptionsDTO  `json:"options"`
	EnableDashboardURL bool              `json:"enableDashboardUrl"`
	EnableCSV          bool              `json:"enableCsv"` // DEPRECATED
	State              reporting.State   `json:"state"`
	Formats            *[]reporting.Type `json:"formats"` // Pointer is used to be backward-compatible
	Dashboards         []DashboardDTO    `json:"dashboards"`
	ScaleFactor        int               `json:"scaleFactor"`
}

// swagger:model ReportTimeRange
type TimeRangeDTO struct {
	From string `json:"from"`
	To   string `json:"to"`
}
