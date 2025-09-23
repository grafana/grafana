package definitions

import "github.com/grafana/grafana-plugin-sdk-go/data"

// swagger:route GET /v1/rules/history history RouteGetStateHistory
//
// Query state history.
//
// Allows to query alerting state history.
// In addition to defined query parameters it accepts filter by labels. The query parameter name must start with 'labels_'
//   Example: /v1/rules/history?labels_myKey1=myValue1&labels_myKey2=myValue2
//
//     Produces:
//     - application/json
//
//     Responses:
//       200: StateHistory
//       404: NotFound
//       403: ForbiddenError
//       500: Failure

// swagger:response StateHistory
type StateHistory struct {
	// in:body
	Results *data.Frame `json:"results"`
}

// StateHistoryParams is the struct used as parameters for the RouteGetStateHistory endpoint.
//
// swagger:parameters RouteGetStateHistory
type StateHistoryParams struct {
	// The timestamp of the start point of the time range the history is obtained.
	// in:query
	// required: false
	From int64 `json:"from"`
	// The timestamp of the end point of the time range the history is obtained.
	// in:query
	// required: false
	To int64 `json:"to"`
	// Limits the number of records that needs to be returned.
	// in:query
	// required: false
	Limit int `json:"limit"`
	// Filter by rule UID. Required the state history is configured to use annotations for storage.
	// in:query
	// required: false
	RuleUID string `json:"ruleUID"`
	// Filter by rules that are or were assigned to the specific dashboard.
	// required: false
	DashboardUID string
	// Filter by dashboard's panel ID. Requires Dashboard UID to be specified.
	PanelID int64
}
