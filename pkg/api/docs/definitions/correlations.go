package definitions

import (
	"github.com/grafana/grafana/pkg/services/correlations"
)

// swagger:route POST /datasources/uid/{uid}/correlations correlations createCorrelation
//
// Add correlation.
//
// Responses:
// 200: createCorrelationResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:parameters createCorrelation
type CreateCorrelationParams struct {
	// in:body
	// required:true
	Body correlations.CreateCorrelationCommand `json:"body"`
	// in:path
	// required:true
	SourceUID string `json:"uid"`
}

//swagger:response createCorrelationResponse
type CreateCorrelationResponse struct {
	// in: body
	Body correlations.CreateCorrelationResponse `json:"body"`
}
