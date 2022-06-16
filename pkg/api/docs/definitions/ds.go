package definitions

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
)

// swagger:route POST /ds/query ds queryMetricsWithExpressions
//
// Query metrics with expressions
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:query`.
//
// Responses:
// 200: queryDataResponse
// 207: queryDataResponse
// 401: unauthorisedError
// 400: badRequestError
// 403: forbiddenError
// 500: internalServerError

// swagger:parameters queryMetricsWithExpressions
type QueryMetricsWithExpressionsBodyParam struct {
	// in:body
	// required:true
	Body dtos.MetricRequest `json:"body"`
}

// swagger:response queryDataResponse
type QueryDataResponseResponse struct {
	// The response message
	// in: body
	Body *backend.QueryDataResponse `json:"body"`
}
