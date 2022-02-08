package definitions

import "github.com/grafana/grafana/pkg/models"

// swagger:route GET /dashboards/id/{DashboardID}/versions dashboard_versions getDashboardVersions
//
// Gets all existing versions for the dashboard.
//
// Responses:
// 200: dashboardVersionsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /dashboards/id/{DashboardID}/versions/{DashboardVersionID} dashboard_versions getDashboardVersion
//
// Get a specific dashboard version.
//
// Responses:
// 200: dashboardVersionResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route POST /dashboards/id/{DashboardID}/restore dashboard_versions restoreDashboardVersion
//
// Restore a dashboard to a given dashboard version.
//
// Responses:
// 200: postDashboardResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:parameters getDashboardVersions getDashboardVersion restoreDashboardVersion
// swagger:parameters getDashboardPermissions postDashboardPermissions
// swagger:parameters renderReportPDF
type DashboardIdParam struct {
	// in:path
	DashboardID int64
}

// swagger:parameters getDashboardVersion
type DashboardVersionIdParam struct {
	// in:path
	DashboardVersionID int64
}

// swagger:parameters getDashboardVersions
type GetDashboardVersionsParams struct {
	// Maximum number of results to return
	// in:query
	// required:false
	// default:0
	Limit int `json:"limit"`

	// Version to start from when returning queries
	// in:query
	// required:false
	// default:0
	Start int `json:"start"`
}

// swagger:response dashboardVersionsResponse
type DashboardVersionsResponse struct {
	// in: body
	Body []*models.DashboardVersionDTO `json:"body"`
}

// swagger:response dashboardVersionResponse
type DashboardVersionResponse struct {
	// in: body
	Body *models.DashboardVersionMeta `json:"body"`
}
