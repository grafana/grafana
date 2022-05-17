package definitions

// swagger:route GET /api/provisioning/v1/policies provisioning RouteGetPolicyTree
//
// Get the notification policy tree.
//
//     Responses:
//       200: Route
//       400: ValidationError

// swagger:route PUT /api/provisioning/v1/policies provisioning RoutePutPolicyTree
//
// Sets the notification policy tree.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Ack
//       400: ValidationError

// swagger:parameters RoutePutPolicyTree
type Policytree struct {
	// in:body
	Body Route
}
