package definitions

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
)

// swagger:route GET /alerts legacy_alerts getAlerts
//
// Get legacy alerts.
//
// Responses:
// 200: getAlertsResponse
// 401: unauthorisedError
// 500: internalServerError

// swagger:route GET /alerts/{alert_id} legacy_alerts getAlertByID
//
// Get alert by ID.
//
// “evalMatches” data in the response is cached in the db when and only when the state of the alert changes (e.g. transitioning from “ok” to “alerting” state).
// If data from one server triggers the alert first and, before that server is seen leaving alerting state, a second server also enters a state that would trigger the alert, the second server will not be visible in “evalMatches” data.
//
// Responses:
// 200: getAlertResponse
// 401: unauthorisedError
// 500: internalServerError

// swagger:route POST /alerts/{alert_id}/pause legacy_alerts pauseAlert
//
// Pause/unpause alert by id.
//
// Responses:
// 200: pauseAlertResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route POST /alerts/test legacy_alerts testAlert
//
// Test alert.
//
// Responses:
// 200: testAlertResponse
// 400: badRequestError
// 422: unprocessableEntityError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /alerts/states-for-dashboard legacy_alerts getDashboardStates
//
// Get alert states for a dashboard.
//
// Responses:
// Responses:
// 200: getDashboardStatesResponse
// 400: badRequestError
// 500: internalServerError

// swagger:parameters getAlertByID
type GetAlertByIDParams struct {
	// in:path
	// required:true
	AlertID string `json:"alert_id"`
}

// swagger:parameters pauseAlert
type PauseAlertParams struct {
	// in:path
	// required:true
	AlertID string `json:"alert_id"`
	// in:body
	// required:true
	Body dtos.PauseAlertCommand `json:"body"`
}

// swagger:parameters getAlerts
type GetAlertsParams struct {
	// Limit response to alerts in specified dashboard(s). You can specify multiple dashboards.
	// in:query
	// required:false
	DashboardID []string `json:"dashboardId"`
	//  Limit response to alert for a specified panel on a dashboard.
	// in:query
	// required:false
	PanelID int64 `json:"panelId"`
	// Limit response to alerts having a name like this value.
	// in:query
	// required: false
	Query string `json:"query"`
	// Return alerts with one or more of the following alert states
	// in:query
	// required:false
	// Description:
	// * `all`
	// * `no_data`
	// * `paused`
	// * `alerting`
	// * `ok`
	// * `pending`
	// * `unknown`
	// enum: all,no_data,paused,alerting,ok,pending,unknown
	State string `json:"state"`
	// Limit response to X number of alerts.
	// in:query
	// required:false
	Limit int64 `json:"limit"`
	// Limit response to alerts of dashboards in specified folder(s). You can specify multiple folders
	// in:query
	// required:false
	// type array
	// collectionFormat: multi
	FolderID []string `json:"folderId"`
	// Limit response to alerts having a dashboard name like this value./ Limit response to alerts having a dashboard name like this value.
	// in:query
	// required:false
	DashboardQuery string `json:"dashboardQuery"`
	// Limit response to alerts of dashboards with specified tags. To do an “AND” filtering with multiple tags, specify the tags parameter multiple times
	// in:query
	// required:false
	// type: array
	// collectionFormat: multi
	DashboardTag []string `json:"dashboardTag"`
}

// swagger:parameters testAlert
type TestAlertParams struct {
	// in:body
	Body dtos.AlertTestCommand `json:"body"`
}

// swagger:parameters getDashboardStates
type GetDashboardStatesParams struct {
	// in:query
	// required: true
	DashboardID int64 `json:"dashboardId"`
}

// swagger:response getAlertsResponse
type GetAlertsResponse struct {
	// The response message
	// in: body
	Body []*models.AlertListItemDTO `json:"body"`
}

// swagger:response getAlertResponse
type GetAlertResponse struct {
	// The response message
	// in: body
	Body *models.Alert `json:"body"`
}

// swagger:response pauseAlertResponse
type PauseAlertResponse struct {
	// in:body
	Body struct {
		// required: true
		AlertID int64 `json:"alertId"`
		// required: true
		Message string `json:"message"`
		// Alert result state
		// required true
		State string `json:"state"`
	} `json:"body"`
}

// swagger:response testAlertResponse
type TestAlertResponse struct {
	// The response message
	// in: body
	Body *dtos.AlertTestResult `json:"body"`
}

// swagger:response getDashboardStatesResponse
type GetDashboardStatesResponse struct {
	// The response message
	// in: body
	Body []*models.AlertStateInfoDTO `json:"body"`
}
