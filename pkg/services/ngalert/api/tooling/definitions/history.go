package definitions

import "github.com/grafana/grafana-plugin-sdk-go/backend"

// TODO: how do we want to organize history requests for Prometheus? I like the
// pattern we have for the ruler API where "grafana" is special and we
// otherwise use the DatasourceUID. Should we reserve that path already? Are we
// sure that we'll build similar queries for Prometheus datasources?

// swagger:route GET /api/v1/ngalert/history/grafana/rules/{UID} history RouteGetAlertStateHistory
//
// Get the alerting state history for a specific Grafana Alerting Rule
//
// Responses:
// 200: GetAlertStateHistoryResponse

// swagger:parameters RouteGetAlertStateHistory
type StateHistoryParameters struct {
	// Alert rule UID
	// in:path
	UID string

	// Start time, in Unix seconds
	// in:query
	Start float64
	// End time, in Unix seconds
	// in:query
	End float64

	// Maximum # of series to return
	// in:query
	Limit int
}

// swagger:parameters RouteGetAlertStateHistory
type StateHistoryQueryParameters struct {

	// TODO: RuleName for Prometheus sources.
}

// swagger: response GetAlertStateHistoryResponse
type GetAlertStateHistoryResponse struct {
	// The response message
	// in: body
	Body GetAlertStateHistoryBodyParams
}

// swagger:model
type GetAlertStateHistoryBodyParams struct {
	RuleUID      string                `json:"rule_uid"`
	InstanceData *backend.DataResponse `json:"data"`

	// Reserving "RuleData" for a set of frames that define the derived state of
	// the Alerting Rule based on its instances.

	// The series limit passed in the request.
	Limit int

	// The # of series found.
	Found int

	// A human-readable message describing the response.
	Message string `json:"message"`
}
