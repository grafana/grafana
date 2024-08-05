package v0alpha1

// +enum
type OperationType string

var (
	OperationTypeEqual        OperationType = "="
	OperationTypeNotEqual     OperationType = "!="
	OperationTypeRegexMatch   OperationType = "=~"
	OperationTypeRegexNoMatch OperationType = "!~"
)

// Spec defines model for Spec.
// +k8s:openapi-gen=true
type RouteSpec struct {
	Receiver string `json:"receiver"`
	// +listType=atomic
	GroupBy []string `json:"group_by,omitempty"`

	GroupWait      string `json:"group_wait,omitempty"`
	GroupInterval  string `json:"group_interval,omitempty"`
	RepeatInterval string `json:"repeat_interval,omitempty"`
	// +listType=atomic
	Routes []SubRoute `json:"routes,omitempty"`
}

// +k8s:openapi-gen=true
type SubRoute struct {
	Receiver string `json:"receiver,omitempty"`
	// +listType=atomic
	GroupBy []string `json:"group_by,omitempty"`
	// +listType=atomic
	MuteTimeIntervals []string `json:"mute_time_intervals,omitempty"`
	// +listType=atomic
	Matchers       []Matcher `json:"matchers,omitempty"`
	Continue       bool      `json:"continue,omitempty"`
	GroupWait      string    `json:"group_wait,omitempty"`
	GroupInterval  string    `json:"group_interval,omitempty"`
	RepeatInterval string    `json:"repeat_interval,omitempty"`
	// +listType=atomic
	Routes []SubRoute `json:"routes,omitempty"`
}

// TODO this will likely change in future. Decide what format to support
type Matcher struct {
	Label string        `json:"label"`
	Type  OperationType `json:"type"`
	Value string        `json:"value"`
}
