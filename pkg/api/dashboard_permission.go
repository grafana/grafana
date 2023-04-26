package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route GET /dashboards/uid/{uid}/permissions dashboard_permissions getDashboardPermissionsListByUID
//
// Gets all existing permissions for the given dashboard.
//
// Responses:
// 200: getDashboardPermissionsListResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /dashboards/id/{DashboardID}/permissions dashboard_permissions getDashboardPermissionsListByID
//
// Gets all existing permissions for the given dashboard.
//
// Please refer to [updated API](#/dashboard_permissions/getDashboardPermissionsListByUID) instead
//
// Deprecated: true
//
// Responses:
// 200: getDashboardPermissionsListResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetDashboardPermissionList(c *contextmodel.ReqContext) response.Response {
	var dashID int64
	var err error
	dashUID := web.Params(c.Req)[":uid"]
	if dashUID == "" {
		dashID, err = strconv.ParseInt(web.Params(c.Req)[":dashboardId"], 10, 64)
		if err != nil {
			return response.Error(http.StatusBadRequest, "dashboardId is invalid", err)
		}
	}

	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.OrgID, dashID, dashUID)
	if rsp != nil {
		return rsp
	}

	g, err := guardian.NewByDashboard(c.Req.Context(), dash, c.OrgID, c.SignedInUser)
	if err != nil {
		return response.Err(err)
	}

	if canAdmin, err := g.CanAdmin(); err != nil || !canAdmin {
		return dashboardGuardianResponse(err)
	}

	acl, err := g.GetACLWithoutDuplicates()
	if err != nil {
		return response.Error(500, "Failed to get dashboard permissions", err)
	}

	filteredACLs := make([]*dashboards.DashboardACLInfoDTO, 0, len(acl))
	for _, perm := range acl {
		if perm.UserID > 0 && dtos.IsHiddenUser(perm.UserLogin, c.SignedInUser, hs.Cfg) {
			continue
		}

		perm.UserAvatarURL = dtos.GetGravatarUrl(perm.UserEmail)

		if perm.TeamID > 0 {
			perm.TeamAvatarURL = dtos.GetGravatarUrlWithDefault(perm.TeamEmail, perm.Team)
		}
		if perm.Slug != "" {
			perm.URL = dashboards.GetDashboardFolderURL(perm.IsFolder, perm.UID, perm.Slug)
		}

		filteredACLs = append(filteredACLs, perm)
	}

	return response.JSON(http.StatusOK, filteredACLs)
}

// swagger:route POST /dashboards/uid/{uid}/permissions dashboard_permissions updateDashboardPermissionsByUID
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

// swagger:route POST /dashboards/id/{DashboardID}/permissions dashboard_permissions updateDashboardPermissionsByID
//
// Updates permissions for a dashboard.
//
// Please refer to [updated API](#/dashboard_permissions/updateDashboardPermissionsByUID) instead
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
func (hs *HTTPServer) UpdateDashboardPermissions(c *contextmodel.ReqContext) response.Response {
	var dashID int64
	var err error
	apiCmd := dtos.UpdateDashboardACLCommand{}
	if err := web.Bind(c.Req, &apiCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if err := validatePermissionsUpdate(apiCmd); err != nil {
		return response.Error(400, err.Error(), err)
	}

	dashUID := web.Params(c.Req)[":uid"]
	if dashUID == "" {
		dashID, err = strconv.ParseInt(web.Params(c.Req)[":dashboardId"], 10, 64)
		if err != nil {
			return response.Error(http.StatusBadRequest, "dashboardId is invalid", err)
		}
	}

	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.OrgID, dashID, dashUID)
	if rsp != nil {
		return rsp
	}

	g, err := guardian.NewByDashboard(c.Req.Context(), dash, c.OrgID, c.SignedInUser)
	if err != nil {
		return response.Err(err)
	}

	if canAdmin, err := g.CanAdmin(); err != nil || !canAdmin {
		return dashboardGuardianResponse(err)
	}

	items := make([]*dashboards.DashboardACL, 0, len(apiCmd.Items))
	for _, item := range apiCmd.Items {
		items = append(items, &dashboards.DashboardACL{
			OrgID:       c.OrgID,
			DashboardID: dashID,
			UserID:      item.UserID,
			TeamID:      item.TeamID,
			Role:        item.Role,
			Permission:  item.Permission,
			Created:     time.Now(),
			Updated:     time.Now(),
		})
	}

	hiddenACL, err := g.GetHiddenACL(hs.Cfg)
	if err != nil {
		return response.Error(500, "Error while retrieving hidden permissions", err)
	}
	items = append(items, hiddenACL...)

	if okToUpdate, err := g.CheckPermissionBeforeUpdate(dashboards.PERMISSION_ADMIN, items); err != nil || !okToUpdate {
		if err != nil {
			if errors.Is(err, guardian.ErrGuardianPermissionExists) || errors.Is(err, guardian.ErrGuardianOverride) {
				return response.Error(400, err.Error(), err)
			}

			return response.Error(500, "Error while checking dashboard permissions", err)
		}

		return response.Error(403, "Cannot remove own admin permission for a folder", nil)
	}

	if !hs.AccessControl.IsDisabled() {
		old, err := g.GetACL()
		if err != nil {
			return response.Error(500, "Error while checking dashboard permissions", err)
		}
		if err := hs.updateDashboardAccessControl(c.Req.Context(), dash.OrgID, dash.UID, false, items, old); err != nil {
			return response.Error(500, "Failed to update permissions", err)
		}
		return response.Success("Dashboard permissions updated")
	}

	if err := hs.DashboardService.UpdateDashboardACL(c.Req.Context(), dashID, items); err != nil {
		if errors.Is(err, dashboards.ErrDashboardACLInfoMissing) ||
			errors.Is(err, dashboards.ErrDashboardPermissionDashboardEmpty) {
			return response.Error(409, err.Error(), err)
		}
		return response.Error(500, "Failed to create permission", err)
	}

	return response.Success("Dashboard permissions updated")
}

// updateDashboardAccessControl is used for api backward compatibility
func (hs *HTTPServer) updateDashboardAccessControl(ctx context.Context, orgID int64, uid string, isFolder bool, items []*dashboards.DashboardACL, old []*dashboards.DashboardACLInfoDTO) error {
	commands := []accesscontrol.SetResourcePermissionCommand{}
	for _, item := range items {
		permissions := item.Permission.String()
		role := ""
		if item.Role != nil {
			role = string(*item.Role)
		}

		commands = append(commands, accesscontrol.SetResourcePermissionCommand{
			UserID:      item.UserID,
			TeamID:      item.TeamID,
			BuiltinRole: role,
			Permission:  permissions,
		})
	}

	for _, o := range old {
		shouldRemove := true
		for _, item := range items {
			if item.UserID != 0 && item.UserID == o.UserID {
				shouldRemove = false
				break
			}
			if item.TeamID != 0 && item.TeamID == o.TeamID {
				shouldRemove = false
				break
			}
			if item.Role != nil && o.Role != nil && *item.Role == *o.Role {
				shouldRemove = false
				break
			}
		}
		if shouldRemove {
			role := ""
			if o.Role != nil {
				role = string(*o.Role)
			}

			commands = append(commands, accesscontrol.SetResourcePermissionCommand{
				UserID:      o.UserID,
				TeamID:      o.TeamID,
				BuiltinRole: role,
				Permission:  "",
			})
		}
	}

	if isFolder {
		if _, err := hs.folderPermissionsService.SetPermissions(ctx, orgID, uid, commands...); err != nil {
			return err
		}
		return nil
	}

	if _, err := hs.dashboardPermissionsService.SetPermissions(ctx, orgID, uid, commands...); err != nil {
		return err
	}
	return nil
}

func validatePermissionsUpdate(apiCmd dtos.UpdateDashboardACLCommand) error {
	for _, item := range apiCmd.Items {
		if item.UserID > 0 && item.TeamID > 0 {
			return dashboards.ErrPermissionsWithUserAndTeamNotAllowed
		}

		if (item.UserID > 0 || item.TeamID > 0) && item.Role != nil {
			return dashboards.ErrPermissionsWithRoleNotAllowed
		}
	}
	return nil
}

// swagger:parameters getDashboardPermissionsListByUID
type GetDashboardPermissionsListByUIDParams struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters getDashboardPermissionsListByID
type GetDashboardPermissionsListByIDParams struct {
	// in:path
	DashboardID int64
}

// swagger:parameters updateDashboardPermissionsByID
type UpdateDashboardPermissionsByIDParams struct {
	// in:body
	// required:true
	Body dtos.UpdateDashboardACLCommand
	// in:path
	DashboardID int64
}

// swagger:parameters updateDashboardPermissionsByUID
type UpdateDashboardPermissionsByUIDParams struct {
	// in:body
	// required:true
	Body dtos.UpdateDashboardACLCommand
	// in:path
	// required:true
	// description: The dashboard UID
	UID string `json:"uid"`
}

// swagger:response getDashboardPermissionsListResponse
type GetDashboardPermissionsResponse struct {
	// in: body
	Body []*dashboards.DashboardACLInfoDTO `json:"body"`
}
