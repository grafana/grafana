package v0alpha1

// Defines values for MatcherType.
const (
	MatcherTypeNotEqual      MatcherType = "!="
	MatcherTypeEqual         MatcherType = "="
	MatcherTypeEqualRegex    MatcherType = "=~"
	MatcherTypeNotEqualRegex MatcherType = "!~"
)

// Matcher defines model for Matcher.
// +k8s:openapi-gen=true
type Matcher struct {
	Name  string      `json:"name"`
	Type  MatcherType `json:"type"`
	Value string      `json:"value"`
}

// MatcherType defines model for Matcher.Type.
// +k8s:openapi-gen=true
type MatcherType string

// Route defines model for Route.
// +k8s:openapi-gen=true
type Route struct {
	GroupBy        []string   `json:"group_by,omitempty"`
	GroupInterval  *string    `json:"group_interval,omitempty"`
	GroupWait      *string    `json:"group_wait,omitempty"`
	Receiver       string     `json:"receiver"`
	RepeatInterval *string    `json:"repeat_interval,omitempty"`
	Routes         []SubRoute `json:"routes,omitempty"`
}

// Spec defines model for Spec.
// +k8s:openapi-gen=true
type RoutingTreeSpec struct {
	Route Route `json:"route"`
}

// SubRoute defines model for SubRoute.
// +k8s:openapi-gen=true
type SubRoute struct {
	Continue          *bool      `json:"continue,omitempty"`
	GroupBy           []string   `json:"group_by,omitempty"`
	GroupInterval     *string    `json:"group_interval,omitempty"`
	GroupWait         *string    `json:"group_wait,omitempty"`
	Matchers          []Matcher  `json:"matchers,omitempty"`
	MuteTimeIntervals []string   `json:"mute_time_intervals,omitempty"`
	Receiver          *string    `json:"receiver,omitempty"`
	RepeatInterval    *string    `json:"repeat_interval,omitempty"`
	Routes            []SubRoute `json:"routes,omitempty"`
}
