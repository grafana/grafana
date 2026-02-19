// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RoutingTreeRouteDefaults struct {
	Receiver       string   `json:"receiver"`
	GroupBy        []string `json:"group_by,omitempty"`
	GroupWait      *string  `json:"group_wait,omitempty"`
	GroupInterval  *string  `json:"group_interval,omitempty"`
	RepeatInterval *string  `json:"repeat_interval,omitempty"`
}

// NewRoutingTreeRouteDefaults creates a new RoutingTreeRouteDefaults object.
func NewRoutingTreeRouteDefaults() *RoutingTreeRouteDefaults {
	return &RoutingTreeRouteDefaults{}
}

// +k8s:openapi-gen=true
type RoutingTreeRoute struct {
	Receiver            *string              `json:"receiver,omitempty"`
	Matchers            []RoutingTreeMatcher `json:"matchers,omitempty"`
	Continue            bool                 `json:"continue"`
	GroupBy             []string             `json:"group_by,omitempty"`
	MuteTimeIntervals   []string             `json:"mute_time_intervals,omitempty"`
	ActiveTimeIntervals []string             `json:"active_time_intervals,omitempty"`
	Routes              []RoutingTreeRoute   `json:"routes,omitempty"`
	GroupWait           *string              `json:"group_wait,omitempty"`
	GroupInterval       *string              `json:"group_interval,omitempty"`
	RepeatInterval      *string              `json:"repeat_interval,omitempty"`
}

// NewRoutingTreeRoute creates a new RoutingTreeRoute object.
func NewRoutingTreeRoute() *RoutingTreeRoute {
	return &RoutingTreeRoute{}
}

// +k8s:openapi-gen=true
type RoutingTreeMatcher struct {
	Type  RoutingTreeMatcherType `json:"type"`
	Label string                 `json:"label"`
	Value string                 `json:"value"`
}

// NewRoutingTreeMatcher creates a new RoutingTreeMatcher object.
func NewRoutingTreeMatcher() *RoutingTreeMatcher {
	return &RoutingTreeMatcher{}
}

// +k8s:openapi-gen=true
type RoutingTreeSpec struct {
	Defaults RoutingTreeRouteDefaults `json:"defaults"`
	Routes   []RoutingTreeRoute       `json:"routes"`
}

// NewRoutingTreeSpec creates a new RoutingTreeSpec object.
func NewRoutingTreeSpec() *RoutingTreeSpec {
	return &RoutingTreeSpec{
		Defaults: *NewRoutingTreeRouteDefaults(),
		Routes:   []RoutingTreeRoute{},
	}
}

// +k8s:openapi-gen=true
type RoutingTreeMatcherType string

const (
	RoutingTreeMatcherTypeEqual         RoutingTreeMatcherType = "="
	RoutingTreeMatcherTypeNotEqual      RoutingTreeMatcherType = "!="
	RoutingTreeMatcherTypeEqualRegex    RoutingTreeMatcherType = "=~"
	RoutingTreeMatcherTypeNotEqualRegex RoutingTreeMatcherType = "!~"
)
