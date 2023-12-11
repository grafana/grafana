package definitions

// swagger:route GET /api/v1/provisioning/mute-timings provisioning stable RouteGetMuteTimings
//
// Get all the mute timings.
//
//     Responses:
//       200: MuteTimings

// swagger:route GET /api/v1/provisioning/mute-timings/export provisioning stable RouteExportMuteTimings
//
// Export all mute timings in provisioning format.
//
//     Responses:
//       200: AlertingFileExport
//       403: PermissionDenied

// swagger:route GET /api/v1/provisioning/mute-timings/{name} provisioning stable RouteGetMuteTiming
//
// Get a mute timing.
//
//     Responses:
//       200: MuteTimeInterval
//       404: description: Not found.

// swagger:route GET /api/v1/provisioning/mute-timings/{name}/export provisioning stable RouteExportMuteTiming
//
// Export a mute timing in provisioning format.
//
//     Responses:
//       200: AlertingFileExport
//       403: PermissionDenied

// swagger:route POST /api/v1/provisioning/mute-timings provisioning stable RoutePostMuteTiming
//
// Create a new mute timing.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       201: MuteTimeInterval
//       400: ValidationError

// swagger:route PUT /api/v1/provisioning/mute-timings/{name} provisioning stable RoutePutMuteTiming
//
// Replace an existing mute timing.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       200: MuteTimeInterval
//       400: ValidationError

// swagger:route DELETE /api/v1/provisioning/mute-timings/{name} provisioning stable RouteDeleteMuteTiming
//
// Delete a mute timing.
//
//     Responses:
//       204: description: The mute timing was deleted successfully.

// swagger:route

// swagger:model
type MuteTimings []MuteTiming

// swagger:parameters RouteGetTemplate RouteGetMuteTiming RoutePutMuteTiming stable RouteDeleteMuteTiming RouteExportMuteTiming
type RouteGetMuteTimingParam struct {
	// Mute timing name
	// in:path
	Name string `json:"name"`
}

// swagger:parameters RoutePostMuteTiming RoutePutMuteTiming
type MuteTimingPayload struct {
	// in:body
	Body MuteTiming
}

// swagger:model
type MuteTiming struct {
	Name          string               `yaml:"name" json:"name"`
	Provenance    Provenance           `yaml:"provenance,omitempty" json:"provenance,omitempty"`
	TimeIntervals []MuteTimingInterval `yaml:"time_intervals" json:"time_intervals"`
}

func (mt *MuteTiming) ResourceType() string {
	return "muteTiming"
}

func (mt *MuteTiming) ResourceID() string {
	return mt.Name
}

// swagger:model
// MuteTimeInterval represents a time interval during which alerts should be muted.
type MuteTimingInterval struct {
	// an inclusive range of times
	Times []MuteTimingTimeRange `yaml:"times,omitempty" json:"times,omitempty"`
	// an inclusive range of weekdays, e.g. "monday" or "tuesday:thursday".
	Weekdays []string `yaml:"weekdays,omitempty" json:"weekdays,omitempty"`
	// an inclusive range of days of month, e.g. "1" or "5:15".
	DaysOfMonth []string `yaml:"days_of_month,omitempty" json:"days_of_month,omitempty"`
	// an inclusive range of months, e.g. "january" or "february:april".
	Months []string `yaml:"months,omitempty" json:"months,omitempty"`
	// an inclusive range of years, e.g. "2019" or "2020:2022".
	Years []string `yaml:"years,omitempty" json:"years,omitempty"`
	// a location time zone for the time interval in the IANA Time Zone Database format, e.g. "America/New_York".
	Location string `yaml:"location,omitempty" json:"location,omitempty"`
}

// swagger:model
// MuteTimingInterval represents a time range during which alerts should be muted.
type MuteTimingTimeRange struct {
	// the start time of the range in the format HH:MM, e.g. "08:00".
	StartTime string `yaml:"start_time,omitempty" json:"start_time,omitempty"`
	// the end time of the range in the format HH:MM, e.g. "17:00".
	EndTime string `yaml:"end_time,omitempty" json:"end_time,omitempty"`
}

type MuteTimeIntervalExport struct {
	OrgID                   int64 `json:"orgId" yaml:"orgId"`
	config.MuteTimeInterval `json:",inline" yaml:",inline"`
}

// MuteTimeIntervalExportHcl is a representation of the MuteTimeInterval in HCL
type MuteTimeIntervalExportHcl struct {
	Name          string                  `json:"name" hcl:"name"`
	TimeIntervals []TimeIntervalExportHcl `json:"time_intervals" hcl:"intervals,block"`
}

// TimeIntervalExportHcl is a representation of the timeinterval.TimeInterval in HCL
type TimeIntervalExportHcl struct {
	Times       []TimeRangeExportHcl `json:"times,omitempty" hcl:"times,block"`
	Weekdays    *[]string            `json:"weekdays,omitempty" hcl:"weekdays"`
	DaysOfMonth *[]string            `json:"days_of_month,omitempty" hcl:"days_of_month"`
	Months      *[]string            `json:"months,omitempty" hcl:"months"`
	Years       *[]string            `json:"years,omitempty" hcl:"years"`
	Location    *string              `json:"location,omitempty" hcl:"location"`
}

// TimeRangeExportHcl is a representation of the timeinterval.TimeRange in HCL
type TimeRangeExportHcl struct {
	StartMinute string `json:"start_time" hcl:"start"`
	EndMinute   string `json:"end_time" hcl:"end"`
}
