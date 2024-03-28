package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Report struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// Report definition
	Spec ReportSpec `json:"spec,omitempty"`

	// Report status
	Status *ReportStatus `json:"status,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ReportList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Report `json:"items,omitempty"`
}

// +enum
type Type string

const (
	PDF               Type = "pdf"
	CSV               Type = "csv"
	Image             Type = "image"
	PDFTables         Type = "pdf-tables"
	PDFTablesAppendix Type = "pdf-tables-appendix"
)

// +enum
type State string

const (
	// Comment on paused
	Paused State = "paused"
	// Ready, but not scheduled
	NotScheduled State = "not scheduled"
	Expired      State = "expired"
	Scheduled    State = "scheduled"
	// Work in progress
	Draft State = "draft"
)

var WeekDays = map[string]int{
	"sunday":    0,
	"monday":    1,
	"tuesday":   2,
	"wednesday": 3,
	"thursday":  4,
	"friday":    5,
	"saturday":  6,
}

const (
	Monthly string = "monthly"
	Weekly  string = "weekly"
	Daily   string = "daily"
	Hourly  string = "hourly"
	Never   string = "never" // DEPRECATED
	Once    string = "once"
	Last    string = "last"
	Custom  string = "custom"

	HoursInterval  string = "hours"
	DaysInterval   string = "days"
	WeeksInterval  string = "weeks"
	MonthsInterval string = "months"
)

// ReportSpec defines the report generation behavior
type ReportSpec struct {
	// Report title
	Title string `json:"title"`

	// Send report to
	Recipients string `json:"recipients"`

	// Reply email address
	ReplyTo string `json:"replyTo"`

	// Message body
	Message string `json:"message"`

	// Reporting schedule
	Schedule Schedule `json:"schedule"`

	// Layout options for the report
	Options ReportOptions `json:"options"`

	// Adds a dashboard url to the bottom of the report email.
	EnableDashboardURL bool `json:"enableDashboardUrl"`

	// The current edit state
	State State `json:"state"`

	// Dashboards used to render the report
	// +listType=map
	// +listMapKey=uid
	Dashboards []DashboardReference `json:"dashboards"`

	// +listType=set
	Formats []Type `json:"formats"`

	// Scale the dashboard
	ScaleFactor int `json:"scaleFactor"`
}

// Dummy
type ReportStatus struct {
	Scheduled int `json:"scheduled"`
}

type Schedule struct {
	StartDate         *metav1.Time `json:"startDate"`
	EndDate           *metav1.Time `json:"endDate"`
	Frequency         string       `json:"frequency"`
	IntervalFrequency string       `json:"intervalFrequency"`
	IntervalAmount    int64        `json:"intervalAmount"`
	WorkdaysOnly      bool         `json:"workdaysOnly"`
	TimeZone          string       `json:"timeZone"`
}

type DashboardReference struct {
	// Dashboard UID (name in apiserver)
	UID string `json:"uid"`

	// Query time range
	TimeRange query.TimeRange `json:"timeRange"`

	// Variables used while rendering the report
	Variables *common.Unstructured `json:"variables,omitempty"`
}

type ReportOptions struct {
	Orientation string `json:"orientation"`
	Layout      string `json:"layout"`
}
