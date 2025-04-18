// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type Interval struct {
	Times       []TimeRange `json:"times,omitempty"`
	Weekdays    []string    `json:"weekdays,omitempty"`
	DaysOfMonth []string    `json:"days_of_month,omitempty"`
	Months      []string    `json:"months,omitempty"`
	Years       []string    `json:"years,omitempty"`
	Location    *string     `json:"location,omitempty"`
}

// NewInterval creates a new Interval object.
func NewInterval() *Interval {
	return &Interval{}
}

// +k8s:openapi-gen=true
type TimeRange struct {
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
}

// NewTimeRange creates a new TimeRange object.
func NewTimeRange() *TimeRange {
	return &TimeRange{}
}

// +k8s:openapi-gen=true
type Spec struct {
	Name          string     `json:"name"`
	TimeIntervals []Interval `json:"time_intervals"`
}

// NewSpec creates a new Spec object.
func NewSpec() *Spec {
	return &Spec{}
}
