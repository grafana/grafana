package v0alpha1

import (
	"time"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	GROUP      = "alerting.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var AlertResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"alertrules", "alertrule", "AlertRule",
	func() runtime.Object { return &AlertRule{} },
	func() runtime.Object { return &AlertRuleList{} },
)

type AlertingState string

const (
	Alerting AlertingState = "Alerting"
	NoData   AlertingState = "NoData"
	OK       AlertingState = "OK"
)

// This is called state so we don't confuse it with standard "status"
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AlertState struct {
	metav1.TypeMeta `json:",inline"`

	// TODO... real fields here
	Dummy string        `json:"dummy"`
	State AlertingState `json:"state"`
	// last ran?? etc
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AlertRule struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// TODO, structure so the name is not in spec
	Spec Spec `json:"spec,omitempty"`
}

type Spec struct {
	// Alert rule title
	Title string `json:"title"`

	// The alert rule description
	Description string `json:"description,omitempty"`

	// The rule group
	RuleGroup string `json:"group,omitempty"`

	// Interval (in seconds) that the alert should run
	Interval int64 `json:"interval,omitempty"`

	// Time (in seconds) that the state must be active before changing
	For time.Duration `json:"for,omitempty"`

	// Queries to execute (target in dashboards)
	Query []data.DataQuery `json:"query"`

	// The RefID for the query that defines alert status
	Condition string `json:"condition"`

	// The alert exists, but should not be run
	Paused bool `json:"paused"`

	// The state to use when queries do not return values
	NoDataState AlertingState `json:"noDataState"`

	// The state to use when query execution fails
	ExecErrState AlertingState `json:"execErrState"`

	// TODO... we can do better than this, right?
	// {
	//   "__dashboardUid__": "vmie2cmWz",
	//   "__panelId__": "6",
	//   "description": "add anno description (optional)",
	//   "runbook_url": "https://asgasdga",
	//   "summary": "add anno summary"
	// }
	Annotations map[string]string `json:"annotations"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AlertRuleList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []AlertRule `json:"items,omitempty"`
}
