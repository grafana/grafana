package definitions

import (
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/prometheus/alertmanager/config"
)

// swagger:route GET /api/v1/provisioning/mute-timings provisioning stable RouteGetMuteTimings
//
// Get all the mute timings.
//
//     Responses:
//       200: MuteTimings

// swagger:route GET /api/v1/provisioning/mute-timings/{name} provisioning stable RouteGetMuteTiming
//
// Get a mute timing.
//
//     Responses:
//       200: MuteTimeInterval
//       404: description: Not found.

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
type MuteTimings []MuteTimeInterval

// swagger:parameters RouteGetTemplate RouteGetMuteTiming RoutePutMuteTiming stable RouteDeleteMuteTiming
type RouteGetMuteTimingParam struct {
	// Mute timing name
	// in:path
	Name string `json:"name"`
}

// swagger:parameters RoutePostMuteTiming RoutePutMuteTiming
type MuteTimingPayload struct {
	// in:body
	Body MuteTimeInterval
}

// swagger:model
type MuteTimeInterval struct {
	config.MuteTimeInterval `json:",inline" yaml:",inline"`
	Provenance              models.Provenance `json:"provenance,omitempty"`
}

func (mt *MuteTimeInterval) ResourceType() string {
	return "muteTimeInterval"
}

func (mt *MuteTimeInterval) ResourceID() string {
	return mt.MuteTimeInterval.Name
}
