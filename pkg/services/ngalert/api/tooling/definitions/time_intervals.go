package definitions

// NOTE: These structs are needed to support the MuteTimings provisioning api in the open api client

// swagger:model
type TimeIntervalItem struct {
	Times       []TimeIntervalTimeRange `json:"times,omitempty" hcl:"times,block"`
	Weekdays    *[]string               `json:"weekdays,omitempty" hcl:"weekdays"`
	DaysOfMonth *[]string               `json:"days_of_month,omitempty" hcl:"days_of_month"`
	Months      *[]string               `json:"months,omitempty" hcl:"months"`
	Years       *[]string               `json:"years,omitempty" hcl:"years"`
	Location    *string                 `json:"location,omitempty" hcl:"location"`
}

// swagger:model
type TimeIntervalTimeRange struct {
	StartMinute string `json:"start_time" hcl:"start"`
	EndMinute   string `json:"end_time" hcl:"end"`
}
