package definitions

// swagger:route GET /api/v1/provisioning/mute-timings provisioning RouteGetMuteTimings
//
// Get all the mute timings.
//
//     Responses:
//       200: MuteTimings
//       400: ValidationError

// swagger:route GET /api/v1/provisioning/mute-timings/{name} provisioning RouteGetMuteTiming
//
// Get a mute timing.
//
//     Responses:
//       200: MuteTimeInterval
//       400: ValidationError

// swagger:route POST /api/v1/provisioning/mute-timings provisioning RoutePostMuteTiming
//
// Create a new mute timing.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       201: MuteTimeInterval
//       400: ValidationError

// swagger:route PUT /api/v1/provisioning/mute-timings/{name} provisioning RoutePutMuteTiming
//
// Replace an existing mute timing.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       200: MuteTimeInterval
//       400: ValidationError

// swagger:route DELETE /api/v1/provisioning/mute-timings/{name} provisioning RouteDeleteMuteTiming
//
// Delete a mute timing.
//
//     Responses:
//       204: Ack

// swagger:route

// swagger:model
type MuteTimings []MuteTimeInterval

// swagger:parameters RouteGetTemplate RouteGetMuteTiming RoutePutMuteTiming RouteDeleteMuteTiming
type RouteGetMuteTimingParam struct {
	// Template Name
	// in:path
	Name string `json:"name"`
}

// swagger:parameters RoutePostMuteTiming RoutePutMuteTiming
type MuteTimingPayload struct {
	// in:body
	Body MuteTimeInterval
}
