// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type TimeIntervalInterval struct {
	Times       []TimeIntervalTimeRange `json:"times,omitempty"`
	Weekdays    []string                `json:"weekdays,omitempty"`
	DaysOfMonth []string                `json:"days_of_month,omitempty"`
	Months      []string                `json:"months,omitempty"`
	Years       []string                `json:"years,omitempty"`
	Location    *string                 `json:"location,omitempty"`
}

// NewTimeIntervalInterval creates a new TimeIntervalInterval object.
func NewTimeIntervalInterval() *TimeIntervalInterval {
	return &TimeIntervalInterval{}
}

// +k8s:openapi-gen=true
type TimeIntervalTimeRange struct {
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
}

// NewTimeIntervalTimeRange creates a new TimeIntervalTimeRange object.
func NewTimeIntervalTimeRange() *TimeIntervalTimeRange {
	return &TimeIntervalTimeRange{}
}

// +k8s:openapi-gen=true
type TimeIntervalSpec struct {
	Name          string                 `json:"name"`
	TimeIntervals []TimeIntervalInterval `json:"time_intervals"`
}

// NewTimeIntervalSpec creates a new TimeIntervalSpec object.
func NewTimeIntervalSpec() *TimeIntervalSpec {
	return &TimeIntervalSpec{
		TimeIntervals: []TimeIntervalInterval{},
	}
}
