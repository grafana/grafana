package definitions

// swagger:route GET /api/provisioning/policies provisioning RouteGetPolicyTree
//
// Get the notification policy tree.
//
//     Responses:
//       200: Route
//       400: ValidationError

// swagger:route PUT /api/provisioning/policies provisioning RoutePutPolicyTree
//
// Sets the notification policy tree.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Accepted
//       400: ValidationError

// swagger:parameters RoutePutPolicyTree
type Policytree struct {
	// in:body
	Body Route
}
