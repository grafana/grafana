package v0alpha1

// TimeIntervalInterval defines model for TimeIntervalInterval.
type TimeIntervalInterval struct {
	DaysOfMonth []string                `json:"daysOfMonth,omitempty"`
	Location    *string                 `json:"location,omitempty"`
	Months      []string                `json:"months,omitempty"`
	Times       []TimeIntervalTimeRange `json:"times,omitempty"`
	Weekdays    []string                `json:"weekdays,omitempty"`
	Years       []string                `json:"years,omitempty"`
}

// TimeIntervalSpec defines model for TimeIntervalSpec.
type TimeIntervalSpec struct {
	Intervals []TimeIntervalInterval `json:"intervals"`
}

// TimeIntervalTimeRange defines model for TimeIntervalTimeRange.
type TimeIntervalTimeRange struct {
	EndMinute   string `json:"endMinute"`
	StartMinute string `json:"startMinute"`
}
