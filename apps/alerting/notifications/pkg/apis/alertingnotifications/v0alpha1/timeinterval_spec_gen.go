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

// OpenAPIModelName returns the OpenAPI model name for TimeIntervalInterval.
func (TimeIntervalInterval) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.TimeIntervalInterval"
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

// OpenAPIModelName returns the OpenAPI model name for TimeIntervalTimeRange.
func (TimeIntervalTimeRange) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.TimeIntervalTimeRange"
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

// OpenAPIModelName returns the OpenAPI model name for TimeIntervalSpec.
func (TimeIntervalSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.TimeIntervalSpec"
}
