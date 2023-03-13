package definitions

import "github.com/grafana/grafana-plugin-sdk-go/data"

// swagger:route GET /api/v1/rules/history history RouteGetStateHistory
//
// Query state history.
//
//     Produces:
//     - application/json
//
//     Responses:
//       200: StateHistory

type StateHistory struct {
	Results *data.Frame `json:"results"`
}
