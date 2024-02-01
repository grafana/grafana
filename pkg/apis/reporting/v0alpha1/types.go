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

	Spec ReportSpec `json:"spec,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ReportList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Report `json:"items,omitempty"`
}

type Type string

const (
	PDF               Type = "pdf"
	CSV               Type = "csv"
	Image             Type = "image"
	PDFTables         Type = "pdf-tables"
	PDFTablesAppendix Type = "pdf-tables-appendix"
)

type State string

const (
	Paused       State = "paused"
	NotScheduled State = "not scheduled"
	Expired      State = "expired"
	Scheduled    State = "scheduled"
	Draft        State = "draft"
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

// Config is model representation of the report resource
type ReportSpec struct {
	Title              string               `json:"title"` // was name (but that is now UID)
	Recipients         string               `json:"recipients"`
	ReplyTo            string               `json:"replyTo"`
	Message            string               `json:"message"`
	Schedule           Schedule             `json:"schedule"`
	Options            ReportOptions        `json:"options"`
	EnableDashboardURL bool                 `json:"enableDashboardUrl"`
	State              State                `json:"state"`
	Dashboards         []DashboardReference `json:"dashboards"`
	Formats            []Type               `json:"formats"`
	ScaleFactor        int                  `json:"scaleFactor"`
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
