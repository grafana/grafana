package definitions

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
)

// swagger:route GET /dashboards/id/{DashboardID}/versions dashboard_versions getDashboardVersions
//
// Gets all existing versions for the dashboard.
//
// Please refer to [updated API](#/dashboard_versions/getDashboardVersionsByUID) instead
//
// Deprecated: true
//
// Responses:
// 200: dashboardVersionsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /dashboards/uid/{uid}/versions dashboard_versions getDashboardVersionsByUID
//
// Gets all existing versions for the dashboard using UID.
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
// Please refer to [updated API](#/dashboard_versions/getDashboardVersionByUID) instead
//
// Deprecated: true
//
// Responses:
// 200: dashboardVersionResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /dashboards/uid/{uid}/versions/{DashboardVersionID} dashboard_versions getDashboardVersionByUID
//
// Get a specific dashboard version using UID.
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
// Please refer to [updated API](#/dashboard_versions/restoreDashboardVersionByUID) instead
//
// Deprecated: true
//
// Responses:
// 200: postDashboardResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route POST /dashboards/uid/{uid}/restore dashboard_versions restoreDashboardVersionByUID
//
// Restore a dashboard to a given dashboard version using UID.
//
// Responses:
// 200: postDashboardResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:parameters getDashboardVersions getDashboardVersion restoreDashboardVersion
// swagger:parameters getDashboardPermissions
// swagger:parameters renderReportPDF
type DashboardIdParam struct {
	// in:path
	DashboardID int64
}

// swagger:parameters getDashboardVersion getDashboardVersionByUID
type DashboardVersionIdParam struct {
	// in:path
	DashboardVersionID int64
}

// swagger:parameters restoreDashboardVersion restoreDashboardVersionByUID
type RestoreVersionBodyParam struct {
	// in:body
	// required:true
	Body dtos.RestoreDashboardVersionCommand
}

// swagger:parameters getDashboardVersions getDashboardVersionsByUID
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
	Body []*dashver.DashboardVersionDTO `json:"body"`
}

// swagger:response dashboardVersionResponse
type DashboardVersionResponse struct {
	// in: body
	Body *dashver.DashboardVersionMeta `json:"body"`
}
