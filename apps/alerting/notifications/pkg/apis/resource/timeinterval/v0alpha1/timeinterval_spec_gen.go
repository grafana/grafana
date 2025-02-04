package v0alpha1

// Interval defines model for Interval.
// +k8s:openapi-gen=true
type Interval struct {
	DaysOfMonth []string    `json:"days_of_month,omitempty"`
	Location    *string     `json:"location,omitempty"`
	Months      []string    `json:"months,omitempty"`
	Times       []TimeRange `json:"times,omitempty"`
	Weekdays    []string    `json:"weekdays,omitempty"`
	Years       []string    `json:"years,omitempty"`
}

// Spec defines model for Spec.
// +k8s:openapi-gen=true
type Spec struct {
	Name          string     `json:"name"`
	TimeIntervals []Interval `json:"time_intervals"`
}

// TimeRange defines model for TimeRange.
// +k8s:openapi-gen=true
type TimeRange struct {
	EndTime   string `json:"end_time"`
	StartTime string `json:"start_time"`
}
