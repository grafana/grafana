// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RouteDefaults struct {
	Receiver       string   `json:"receiver"`
	GroupBy        []string `json:"group_by,omitempty"`
	GroupWait      *string  `json:"group_wait,omitempty"`
	GroupInterval  *string  `json:"group_interval,omitempty"`
	RepeatInterval *string  `json:"repeat_interval,omitempty"`
}

// NewRouteDefaults creates a new RouteDefaults object.
func NewRouteDefaults() *RouteDefaults {
	return &RouteDefaults{}
}

// +k8s:openapi-gen=true
type Route struct {
	Receiver          *string   `json:"receiver,omitempty"`
	Matchers          []Matcher `json:"matchers,omitempty"`
	Continue          bool      `json:"continue"`
	GroupBy           []string  `json:"group_by,omitempty"`
	MuteTimeIntervals []string  `json:"mute_time_intervals,omitempty"`
	Routes            []Route   `json:"routes,omitempty"`
	GroupWait         *string   `json:"group_wait,omitempty"`
	GroupInterval     *string   `json:"group_interval,omitempty"`
	RepeatInterval    *string   `json:"repeat_interval,omitempty"`
}

// NewRoute creates a new Route object.
func NewRoute() *Route {
	return &Route{}
}

// +k8s:openapi-gen=true
type Matcher struct {
	Type  MatcherType `json:"type"`
	Label string      `json:"label"`
	Value string      `json:"value"`
}

// NewMatcher creates a new Matcher object.
func NewMatcher() *Matcher {
	return &Matcher{}
}

// +k8s:openapi-gen=true
type Spec struct {
	Defaults RouteDefaults `json:"defaults"`
	Routes   []Route       `json:"routes"`
}

// NewSpec creates a new Spec object.
func NewSpec() *Spec {
	return &Spec{
		Defaults: *NewRouteDefaults(),
	}
}

// +k8s:openapi-gen=true
type MatcherType string

const (
	MatcherTypeEqual         MatcherType = "="
	MatcherTypeNotEqual      MatcherType = "!="
	MatcherTypeEqualRegex    MatcherType = "=~"
	MatcherTypeNotEqualRegex MatcherType = "!~"
)
