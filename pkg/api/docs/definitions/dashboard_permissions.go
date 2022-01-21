package definitions

import (
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
	Body UpdateDashboardAclCommand
}

// swagger:response getDashboardPermissionsResponse
type GetDashboardPermissionsResponse struct {
	// in: body
	Body []*models.DashboardAclInfoDTO `json:"body"`
}

// UpdateDashboardAclCommand is same as dtos.UpdateDashboardAclCommand but with swagger annotations
// swagger:model
type UpdateDashboardAclCommand struct {
	// The permission items to add/update. Items that are omitted from the list will be removed.
	Items []DashboardAclUpdateItem `json:"items"`
}

// DashboardAclUpdateItem is same as dtos.DashboardAclUpdateItem but with swagger annotations
// swagger:model
type DashboardAclUpdateItem struct {
	UserID int64            `json:"userId"`
	TeamID int64            `json:"teamId"`
	Role   *models.RoleType `json:"role,omitempty"`
	// Permission level
	// Description:
	// * `1` - View
	// * `2` - Edit
	// * `4` - Admin
	// Enum: 1,2,4
	Permission int `json:"permission"`
}
