package definitions

// swagger:route GET /api/v1/provisioning/policies provisioning stable RouteGetPolicyTree
//
// Get the notification policy tree.
//
//     Responses:
//       200: Route
//         description: The currently active notification routing tree

// swagger:route PUT /api/v1/provisioning/policies provisioning stable RoutePutPolicyTree
//
// Sets the notification policy tree.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Ack
//       400: ValidationError

// swagger:route DELETE /api/v1/provisioning/policies provisioning stable RouteResetPolicyTree
//
// Clears the notification policy tree.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Ack

// swagger:parameters RoutePutPolicyTree
type Policytree struct {
	// The new notification routing tree to use
	// in:body
	Body Route
}
