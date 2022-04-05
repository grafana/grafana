package definitions

import "github.com/grafana/grafana/pkg/services/ngalert/models"

// swagger:route GET /api/provisioning/contactpoints provisioning RouteGetContactpoints
//
// Get all the contactpoints.
//
//     Responses:
//       200: Route
//       400: ValidationError

// swagger:route POST /api/provisioning/contactpoints provisioning RoutePostContactpoints
//
// Create a contactpoint
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Accepted
//       400: ValidationError

// swagger:route PUT /api/provisioning/contactpoints provisioning RoutePutContactpoints
//
// Create a contactpoint
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Accepted
//       400: ValidationError

// swagger:route DELETE /api/provisioning/contactpoints/{ID} provisioning RouteDeleteContactpoints
//
// Create a contactpoint
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Accepted
//       400: ValidationError

type Contactpoint models.EmbeddedContactPoint

// swagger:parameters RoutePostContactpoints RoutePutContactpoints
type ContactpointPayload struct {
	// in:body
	Body Contactpoint
}
