package definitions

// swagger:route GET /v1/notifications/receivers/{Name} notifications RouteGetReceiver
//
// Get a receiver by name.
//
// This API is designated to internal use only and can be removed or changed at any time without prior notice.
//
// Deprecated: true
//    Responses:
//      200: GetReceiverResponse
// 	    403: PermissionDenied
//      404: NotFound

// swagger:route GET /v1/notifications/receivers notifications RouteGetReceivers
//
// Get all receivers.
//
// This API is designated to internal use only and can be removed or changed at any time without prior notice.
//
// Deprecated: true
//    Responses:
//      200: GetReceiversResponse
//      403: PermissionDenied

// swagger:parameters RouteGetReceiver
type GetReceiverParams struct {
	// in:path
	// required: true
	Name string `json:"name"`
	// in:query
	// required: false
	Decrypt bool `json:"decrypt"`
}

// swagger:parameters RouteGetReceivers
type GetReceiversParams struct {
	// in:query
	// required: false
	Names []string `json:"names"`
	// in:query
	// required: false
	Limit int `json:"limit"`
	// in:query
	// required: false
	Offset int `json:"offset"`
	// in:query
	// required: false
	Decrypt bool `json:"decrypt"`
}

// swagger:response GetReceiverResponse
type GetReceiverResponse struct {
	// in:body
	Body GettableApiReceiver
}

// swagger:response GetReceiversResponse
type GetReceiversResponse struct {
	// in:body
	Body []GettableApiReceiver
}
