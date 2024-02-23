package definitions

import (
	"github.com/prometheus/alertmanager/config"
)

// swagger:route GET /v1/provisioning/time-intervals provisioning stable RouteGetTimeIntervals
//
// Get all the time intervals.
//
//     Responses:
//       200: TimeIntervals

// swagger:route GET /v1/provisioning/time-intervals/{name} provisioning stable RouteGetTimeInterval
//
// Get a time interval.
//
//     Responses:
//       200: TimeInterval
//       404: description: Not found.

// swagger:route POST /v1/provisioning/time-intervals provisioning stable RoutePostTimeInterval
//
// Create a new time interval.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       201: TimeInterval
//       400: ValidationError

// swagger:route PUT /v1/provisioning/time-intervals/{name} provisioning stable RoutePutTimeInterval
//
// Replace an existing time interval.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: TimeInterval
//       400: ValidationError

// swagger:route DELETE /v1/provisioning/time-intervals/{name} provisioning stable RouteDeleteTimeInterval
//
// Delete a time interval.
//
//     Responses:
//       204: description: The time interval was deleted successfully.
//       409: GenericPublicError

// swagger:model
type TimeIntervals []TimeInterval

// swagger:parameters RouteGetTimeInterval RoutePutTimeInterval stable RouteDeleteTimeInterval
type RouteGetTimeIntervalParam struct {
	// Mute timing name
	// in:path
	Name string `json:"name"`
}

// swagger:parameters RoutePostTimeInterval RoutePutTimeInterval
type TimeIntervalPayload struct {
	// in:body
	Body TimeInterval
}

// swagger:parameters RoutePostTimeInterval RoutePutTimeInterval
type TimeIntervalHeaders struct {
	// in:header
	XDisableProvenance string `json:"X-Disable-Provenance"`
}

// swagger:model
type TimeInterval struct {
	config.TimeInterval `json:",inline" yaml:",inline"`
	Provenance          Provenance `json:"provenance,omitempty"`
}

func (ti *TimeInterval) ResourceType() string {
	return "timeInterval"
}

func (ti *TimeInterval) ResourceID() string {
	return ti.TimeInterval.Name
}
