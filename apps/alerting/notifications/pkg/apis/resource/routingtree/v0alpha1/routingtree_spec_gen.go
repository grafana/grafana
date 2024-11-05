package v0alpha1

// Defines values for MatcherType.
const (
	MatcherTypeEmpty      MatcherType = "!="
	MatcherTypeEqual      MatcherType = "="
	MatcherTypeEqualTilde MatcherType = "=~"
	MatcherTypeN1         MatcherType = "!~"
)

// LeafRoute is a route that does not have any sub-routes
// +k8s:openapi-gen=true
type LeafRoute struct {
	Continue          bool      `json:"continue"`
	GroupBy           []string  `json:"group_by,omitempty"`
	GroupInterval     *string   `json:"group_interval,omitempty"`
	GroupWait         *string   `json:"group_wait,omitempty"`
	Matchers          []Matcher `json:"matchers,omitempty"`
	MuteTimeIntervals []string  `json:"mute_time_intervals,omitempty"`
	Receiver          *string   `json:"receiver,omitempty"`
	RepeatInterval    *string   `json:"repeat_interval,omitempty"`
}

// Matcher defines model for Matcher.
// +k8s:openapi-gen=true
type Matcher struct {
	Label string      `json:"label"`
	Type  MatcherType `json:"type"`
	Value string      `json:"value"`
}

// MatcherType defines model for Matcher.Type.
// +k8s:openapi-gen=true
type MatcherType string

// Route defines model for Route.
// +k8s:openapi-gen=true
type Route struct {
	Continue          bool      `json:"continue"`
	GroupBy           []string  `json:"group_by,omitempty"`
	GroupInterval     *string   `json:"group_interval,omitempty"`
	GroupWait         *string   `json:"group_wait,omitempty"`
	Matchers          []Matcher `json:"matchers,omitempty"`
	MuteTimeIntervals []string  `json:"mute_time_intervals,omitempty"`
	Receiver          *string   `json:"receiver,omitempty"`
	RepeatInterval    *string   `json:"repeat_interval,omitempty"`
	Routes            []Route2  `json:"routes,omitempty"`
}

// Route2 defines model for Route2.
// +k8s:openapi-gen=true
type Route2 struct {
	Continue          bool      `json:"continue"`
	GroupBy           []string  `json:"group_by,omitempty"`
	GroupInterval     *string   `json:"group_interval,omitempty"`
	GroupWait         *string   `json:"group_wait,omitempty"`
	Matchers          []Matcher `json:"matchers,omitempty"`
	MuteTimeIntervals []string  `json:"mute_time_intervals,omitempty"`
	Receiver          *string   `json:"receiver,omitempty"`
	RepeatInterval    *string   `json:"repeat_interval,omitempty"`
	Routes            []Route3  `json:"routes,omitempty"`
}

// Route3 defines model for Route3.
// +k8s:openapi-gen=true
type Route3 struct {
	Continue          bool      `json:"continue"`
	GroupBy           []string  `json:"group_by,omitempty"`
	GroupInterval     *string   `json:"group_interval,omitempty"`
	GroupWait         *string   `json:"group_wait,omitempty"`
	Matchers          []Matcher `json:"matchers,omitempty"`
	MuteTimeIntervals []string  `json:"mute_time_intervals,omitempty"`
	Receiver          *string   `json:"receiver,omitempty"`
	RepeatInterval    *string   `json:"repeat_interval,omitempty"`
	Routes            []Route4  `json:"routes,omitempty"`
}

// Route4 defines model for Route4.
// +k8s:openapi-gen=true
type Route4 struct {
	Continue          bool      `json:"continue"`
	GroupBy           []string  `json:"group_by,omitempty"`
	GroupInterval     *string   `json:"group_interval,omitempty"`
	GroupWait         *string   `json:"group_wait,omitempty"`
	Matchers          []Matcher `json:"matchers,omitempty"`
	MuteTimeIntervals []string  `json:"mute_time_intervals,omitempty"`
	Receiver          *string   `json:"receiver,omitempty"`
	RepeatInterval    *string   `json:"repeat_interval,omitempty"`
	Routes            []Route5  `json:"routes,omitempty"`
}

// Route5 defines model for Route5.
// +k8s:openapi-gen=true
type Route5 struct {
	Continue          bool      `json:"continue"`
	GroupBy           []string  `json:"group_by,omitempty"`
	GroupInterval     *string   `json:"group_interval,omitempty"`
	GroupWait         *string   `json:"group_wait,omitempty"`
	Matchers          []Matcher `json:"matchers,omitempty"`
	MuteTimeIntervals []string  `json:"mute_time_intervals,omitempty"`
	Receiver          *string   `json:"receiver,omitempty"`
	RepeatInterval    *string   `json:"repeat_interval,omitempty"`
	Routes            []Route6  `json:"routes,omitempty"`
}

// Route6 defines model for Route6.
// +k8s:openapi-gen=true
type Route6 struct {
	Continue          bool        `json:"continue"`
	GroupBy           []string    `json:"group_by,omitempty"`
	GroupInterval     *string     `json:"group_interval,omitempty"`
	GroupWait         *string     `json:"group_wait,omitempty"`
	Matchers          []Matcher   `json:"matchers,omitempty"`
	MuteTimeIntervals []string    `json:"mute_time_intervals,omitempty"`
	Receiver          *string     `json:"receiver,omitempty"`
	RepeatInterval    *string     `json:"repeat_interval,omitempty"`
	Routes            []LeafRoute `json:"routes,omitempty"`
}

// RouteDefaults defines model for RouteDefaults.
// +k8s:openapi-gen=true
type RouteDefaults struct {
	GroupBy        []string `json:"group_by,omitempty"`
	GroupInterval  *string  `json:"group_interval,omitempty"`
	GroupWait      *string  `json:"group_wait,omitempty"`
	Receiver       string   `json:"receiver"`
	RepeatInterval *string  `json:"repeat_interval,omitempty"`
}

// Spec defines model for Spec.
// +k8s:openapi-gen=true
type Spec struct {
	Defaults RouteDefaults `json:"defaults"`
	Routes   []Route       `json:"routes"`
}
