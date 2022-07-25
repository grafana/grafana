package definitions

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
)

// swagger:route GET /dashboards/id/{DashboardID}/permissions dashboard_permissions getDashboardPermissions
//
// Gets all existing permissions for the given dashboard.
//
// Please refer to [updated API](#/dashboard_permissions/getDashboardPermissionsWithUid) instead
//
// Deprecated: true
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
// Please refer to [updated API](#/dashboard_permissions/postDashboardPermissionsWithUid) instead
//
// This operation will remove existing permissions if they’re not included in the request.
//
// Deprecated: true
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /dashboards/uid/{uid}/permissions dashboard_permissions getDashboardPermissionsWithUid
//
// Gets all existing permissions for the given dashboard.
//
// Responses:
// 200: getDashboardPermissionsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route POST /dashboards/uid/{uid}/permissions dashboard_permissions postDashboardPermissionsWithUid
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

// swagger:parameters getDashboardPermissions
type GetDashboardPermissionsParams struct {
	// in:path
	DashboardID int64
}

// swagger:parameters postDashboardPermissions
type PostDashboardPermissionsParams struct {
	// in:body
	// required:true
	Body dtos.UpdateDashboardACLCommand
	// in:path
	DashboardID int64
}

// swagger:parameters postDashboardPermissionsWithUid
type PostDashboardPermissionsWithUIDParams struct {
	// in:body
	// required:true
	Body dtos.UpdateDashboardACLCommand
	// in:path
	// required:true
	// description: The dashboard UID
	UID string `json:"uid"`
}

// swagger:response getDashboardPermissionsResponse
type GetDashboardPermissionsResponse struct {
	// in: body
	Body []*models.DashboardACLInfoDTO `json:"body"`
}
