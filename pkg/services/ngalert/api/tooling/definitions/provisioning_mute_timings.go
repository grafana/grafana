package definitions

import (
	"github.com/prometheus/alertmanager/config"
)

// swagger:route GET /api/v1/provisioning/mute-timings provisioning stable RouteGetMuteTimings
//
// Get all the mute timings.
//
//     Responses:
//       200: MuteTimingsAPIModel

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
//       200: MuteTimeIntervalAPIModel
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
//       201: MuteTimeIntervalAPIModel
//       400: ValidationError

// swagger:route PUT /api/v1/provisioning/mute-timings/{name} provisioning stable RoutePutMuteTiming
//
// Replace an existing mute timing.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       200: MuteTimeIntervalAPIModel
//       400: ValidationError

// swagger:route DELETE /api/v1/provisioning/mute-timings/{name} provisioning stable RouteDeleteMuteTiming
//
// Delete a mute timing.
//
//     Responses:
//       204: description: The mute timing was deleted successfully.

type MuteTimings []MuteTimeInterval

// swagger:parameters RouteGetTemplate RouteGetMuteTiming RoutePutMuteTiming stable RouteDeleteMuteTiming RouteExportMuteTiming
type RouteGetMuteTimingParam struct {
	// Mute timing name
	// in:path
	Name string `json:"name"`
}

// swagger:parameters RoutePostMuteTiming RoutePutMuteTiming
type MuteTimingPayload struct {
	// in:body
	Body MuteTimeIntervalAPIModel
}

// swagger:parameters RoutePostMuteTiming RoutePutMuteTiming
type MuteTimingHeaders struct {
	// in:header
	XDisableProvenance string `json:"X-Disable-Provenance"`
}

type MuteTimeInterval struct {
	config.MuteTimeInterval `json:",inline" yaml:",inline"`
	Provenance              Provenance `json:"provenance,omitempty"`
}

func (mt *MuteTimeInterval) ResourceType() string {
	return "muteTimeInterval"
}

func (mt *MuteTimeInterval) ResourceID() string {
	return mt.MuteTimeInterval.Name
}

type MuteTimeIntervalExport struct {
	OrgID                   int64 `json:"orgId" yaml:"orgId"`
	config.MuteTimeInterval `json:",inline" yaml:",inline"`
}

// MuteTimeIntervalAPIModel is a serialized representation of the MuteTimeInterval struct, as returned by the API
// swagger:model
type MuteTimeIntervalAPIModel struct {
	MuteTimeIntervalModel
	Provenance Provenance `json:"provenance,omitempty"` // TODO: This is never populated on GETs
}

// swagger:model
type MuteTimingsAPIModel []MuteTimeIntervalAPIModel

// MuteTimeIntervalModel is a serialized representation of the MuteTimeInterval struct
type MuteTimeIntervalModel struct {
	Name          string              `json:"name" hcl:"name"`
	TimeIntervals []TimeIntervalModel `json:"time_intervals" hcl:"intervals,block"`
}

// TimeIntervalModel is a serialized representation of the timeinterval.TimeInterval struct
type TimeIntervalModel struct {
	Times       []TimeRangeModel `json:"times,omitempty" hcl:"times,block"`
	Weekdays    *[]string        `json:"weekdays,omitempty" hcl:"weekdays"`
	DaysOfMonth *[]string        `json:"days_of_month,omitempty" hcl:"days_of_month"`
	Months      *[]string        `json:"months,omitempty" hcl:"months"`
	Years       *[]string        `json:"years,omitempty" hcl:"years"`
	Location    *string          `json:"location,omitempty" hcl:"location"`
}

// TimeRangeModel is a serialize representation of the timeinterval.TimeRange struct
type TimeRangeModel struct {
	StartMinute string `json:"start_time" hcl:"start"`
	EndMinute   string `json:"end_time" hcl:"end"`
}
