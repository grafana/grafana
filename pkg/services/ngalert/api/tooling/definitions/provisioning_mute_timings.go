package definitions

import (
	"github.com/prometheus/alertmanager/config"
)

// swagger:route GET /v1/provisioning/mute-timings provisioning stable RouteGetMuteTimings
//
// Get all the mute timings.
//
//     Responses:
//       200: MuteTimings

// swagger:route GET /v1/provisioning/mute-timings/export provisioning stable RouteExportMuteTimings
//
// Export all mute timings in provisioning format.
//
//     Produces:
//     - application/json
//     - application/yaml
//     - application/terraform+hcl
//     - text/yaml
//     - text/hcl
//
//     Responses:
//       200: AlertingFileExport
//       403: PermissionDenied

// swagger:route GET /v1/provisioning/mute-timings/{name} provisioning stable RouteGetMuteTiming
//
// Get a mute timing.
//
//     Responses:
//       200: MuteTimeInterval
//       404: description: Not found.

// swagger:route GET /v1/provisioning/mute-timings/{name}/export provisioning stable RouteExportMuteTiming
//
// Export a mute timing in provisioning format.
//
//     Produces:
//     - application/json
//     - application/yaml
//     - application/terraform+hcl
//     - text/yaml
//     - text/hcl
//
//     Responses:
//       200: AlertingFileExport
//       403: PermissionDenied

// swagger:route POST /v1/provisioning/mute-timings provisioning stable RoutePostMuteTiming
//
// Create a new mute timing.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       201: MuteTimeInterval
//       400: ValidationError

// swagger:route PUT /v1/provisioning/mute-timings/{name} provisioning stable RoutePutMuteTiming
//
// Replace an existing mute timing.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: MuteTimeInterval
//       400: ValidationError
//       409: PublicError

// swagger:route DELETE /v1/provisioning/mute-timings/{name} provisioning stable RouteDeleteMuteTiming
//
// Delete a mute timing.
//
//     Responses:
//       204: description: The mute timing was deleted successfully.
//       409: PublicError

// swagger:model
type MuteTimings []MuteTimeInterval

// swagger:parameters RouteGetTemplate RouteGetMuteTiming RoutePutMuteTiming stable  RouteExportMuteTiming
type RouteGetMuteTimingParam struct {
	// Mute timing name
	// in:path
	Name string `json:"name"`
}

// swagger:parameters stable RouteDeleteMuteTiming
type RouteDeleteMuteTimingParam struct {
	// Mute timing name
	// in:path
	Name string `json:"name"`

	// Version of mute timing to use for optimistic concurrency. Leave empty to disable validation
	// in:query
	Version string `json:"version"`
}

// swagger:parameters RoutePostMuteTiming RoutePutMuteTiming
type MuteTimingPayload struct {
	// in:body
	Body MuteTimeInterval
}

// swagger:parameters RoutePostMuteTiming RoutePutMuteTiming RouteDeleteMuteTiming
type MuteTimingHeaders struct {
	// in:header
	XDisableProvenance string `json:"X-Disable-Provenance"`
}

// swagger:model
type MuteTimeInterval struct {
	UID                     string `json:"-" yaml:"-"`
	config.MuteTimeInterval `json:",inline" yaml:",inline"`
	Version                 string     `json:"version,omitempty"`
	Provenance              Provenance `json:"provenance,omitempty"`
}

func (mt *MuteTimeInterval) ResourceType() string {
	return "muteTimeInterval"
}

func (mt *MuteTimeInterval) ResourceID() string {
	return mt.Name
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
