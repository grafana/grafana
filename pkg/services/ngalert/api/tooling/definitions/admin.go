package definitions

// swagger:route GET /api/v1/ngalert/admin_config configuration RouteGetNGalertConfig
//
//  Get the NGalert configuration of the user's organization, returns 404 if no configuration is present.
//
//     Produces:
//     - application/json
//
//     Responses:
//		 200: GettableNGalertConfig
//		 404: Failure
//		 500: Failure

// swagger:route POST /api/v1/ngalert/admin_config configuration RoutePostNGalertConfig
//
// Creates or updates the NGalert configuration of the user's organization.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       201: Ack
//       400: ValidationError

// swagger:route DELETE /api/v1/ngalert/admin_config configuration RouteDeleteNGalertConfig
//
// Deletes the NGalert configuration of the user's organization.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       200: Ack
//       500: Failure

// swagger:parameters RoutePostNGalertConfig
type NGalertConfig struct {
	// in:body
	Body PostableNGalertConfig
}

// swagger:model
type PostableNGalertConfig struct {
	Alertmanagers []string `json:"alertmanagers"`
}

// swagger:model
type GettableNGalertConfig struct {
	Alertmanagers []string `json:"alertmanagers"`
}
