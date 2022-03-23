package definitions

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
)

// swagger:route GET /dashboards/id/{DashboardID}/permissions dashboard_permissions getDashboardPermissions
//
// Gets all existing permissions for the given dashboard.
//
// Responses:
// 200: getDashboardPermissionsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route POST /dashboards/id/{DashboardID}/permissions dashboard_permissions postDashboardPermissions
//
// Updates permissions for a dashboard.
//
// This operation will remove existing permissions if they’re not included in the request.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:parameters postDashboardPermissions updateFolderPermissions
type PostDashboardPermissionsParam struct {
	// in:body
	// required:true
	Body dtos.UpdateDashboardAclCommand
}

// swagger:response getDashboardPermissionsResponse
type GetDashboardPermissionsResponse struct {
	// in: body
	Body []*models.DashboardAclInfoDTO `json:"body"`
}
