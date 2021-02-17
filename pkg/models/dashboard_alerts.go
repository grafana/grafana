// Documentation of the API.
//
//     Schemes: http, https
//     BasePath: /api/v1
//
//     Consumes:
//     - application/json
//
//     Produces:
//     - application/json
//
//     Security:
//     - basic
//
//    SecurityDefinitions:
//    basic:
//      type: basic
//
// swagger:meta
package models

import "github.com/grafana/grafana/pkg/models"

// swagger:route POST /api/dashboards/db RoutePostGrDashboards
//
// creates a dashboard with alerts
//
//     Schemes: http, https
//
//     Responses:
//       200: Ok
//		 400: BadRequest
//		 401: Unauthorized
//       403: QuotaExceeded
//		 412: PreconditionFailed
//       500: Err

// swagger:parameters RoutePostGrDashboards
type RoutePostGrDashboardsConfig struct {
	// in:body
	Body SaveDashboardCommand
}

// swagger:model
type SaveDashboardCommand models.SaveDashboardCommand

// swagger:model
type Ok struct{}

// swagger:model
type BadRequest struct{}

// swagger:model
type Unauthorized struct{}

// swagger:model
type QuotaExceeded struct{}

// swagger:model
type PreconditionFailed struct{}

// swagger:model
type Err struct {
	Message string
	Error   error
}
