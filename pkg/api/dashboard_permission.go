package api

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route GET /dashboards/uid/{uid}/permissions dashboards permissions getDashboardPermissionsListByUID
//
// Gets all existing permissions for the given dashboard.
//
// Responses:
// 200: getDashboardPermissionsListResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /dashboards/id/{DashboardID}/permissions dashboards permissions getDashboardPermissionsListByID
//
// Gets all existing permissions for the given dashboard.
//
// Please refer to [updated API](#/dashboards/getDashboardPermissionsListByUID) instead
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
	ctx, span := tracer.Start(c.Req.Context(), "api.GetDashboardPermissionList")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	var dashID int64
	var err error
	dashUID := web.Params(c.Req)[":uid"]
	if dashUID == "" {
		dashID, err = strconv.ParseInt(web.Params(c.Req)[":dashboardId"], 10, 64)
		if err != nil {
			return response.Error(http.StatusBadRequest, "dashboardId is invalid", err)
		}
	}

	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.GetOrgID(), dashID, dashUID)
	if rsp != nil {
		return rsp
	}

	acl, err := hs.getDashboardACL(c.Req.Context(), c.SignedInUser, dash)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get dashboard permissions", err)
	}

	filteredACLs := make([]*dashboards.DashboardACLInfoDTO, 0, len(acl))
	for _, perm := range acl {
		if perm.UserID > 0 && dtos.IsHiddenUser(perm.UserLogin, c.SignedInUser, hs.Cfg) {
			continue
		}

		perm.UserAvatarURL = dtos.GetGravatarUrl(hs.Cfg, perm.UserEmail)

		if perm.TeamID > 0 {
			perm.TeamAvatarURL = dtos.GetGravatarUrlWithDefault(hs.Cfg, perm.TeamEmail, perm.Team)
		}
		if perm.Slug != "" {
			perm.URL = dashboards.GetDashboardFolderURL(perm.IsFolder, perm.UID, perm.Slug)
		}

		filteredACLs = append(filteredACLs, perm)
	}

	return response.JSON(http.StatusOK, filteredACLs)
}

// swagger:route POST /dashboards/uid/{uid}/permissions dashboards permissions updateDashboardPermissionsByUID
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

// swagger:route POST /dashboards/id/{DashboardID}/permissions dashboards permissions updateDashboardPermissionsByID
//
// Updates permissions for a dashboard.
//
// Please refer to [updated API](#/dashboards/updateDashboardPermissionsByUID) instead
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
	ctx, span := tracer.Start(c.Req.Context(), "api.UpdateDashboardPermissions")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	var dashID int64
	var err error
	apiCmd := dtos.UpdateDashboardACLCommand{}
	if err := web.Bind(c.Req, &apiCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if err := validatePermissionsUpdate(apiCmd); err != nil {
		return response.Error(http.StatusBadRequest, err.Error(), err)
	}

	dashUID := web.Params(c.Req)[":uid"]
	if dashUID == "" {
		dashID, err = strconv.ParseInt(web.Params(c.Req)[":dashboardId"], 10, 64)
		if err != nil {
			return response.Error(http.StatusBadRequest, "dashboardId is invalid", err)
		}
	}

	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.GetOrgID(), dashID, dashUID)
	if rsp != nil {
		return rsp
	}

	items := make([]*dashboards.DashboardACL, 0, len(apiCmd.Items))
	for _, item := range apiCmd.Items {
		items = append(items, &dashboards.DashboardACL{
			OrgID:       c.GetOrgID(),
			DashboardID: dashID,
			UserID:      item.UserID,
			TeamID:      item.TeamID,
			Role:        item.Role,
			Permission:  item.Permission,
			Created:     time.Now(),
			Updated:     time.Now(),
		})
	}

	acl, err := hs.getDashboardACL(c.Req.Context(), c.SignedInUser, dash)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error while checking dashboard permissions", err)
	}

	items = append(items, hs.filterHiddenACL(c.SignedInUser, acl)...)

	if err := hs.updateDashboardAccessControl(c.Req.Context(), dash.OrgID, dash.UID, false, items, acl); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update permissions", err)
	}

	return response.Success("Dashboard permissions updated")
}

var dashboardPermissionMap = map[string]dashboardaccess.PermissionType{
	"View":  dashboardaccess.PERMISSION_VIEW,
	"Edit":  dashboardaccess.PERMISSION_EDIT,
	"Admin": dashboardaccess.PERMISSION_ADMIN,
}

func (hs *HTTPServer) getDashboardACL(ctx context.Context, user identity.Requester, dashboard *dashboards.Dashboard) ([]*dashboards.DashboardACLInfoDTO, error) {
	ctx, span := tracer.Start(ctx, "api.getDashboardACL")
	defer span.End()

	permissions, err := hs.dashboardPermissionsService.GetPermissions(ctx, user, dashboard.UID)
	if err != nil {
		return nil, err
	}

	acl := make([]*dashboards.DashboardACLInfoDTO, 0, len(permissions))
	for _, p := range permissions {
		if !p.IsManaged {
			continue
		}

		var role *org.RoleType
		if p.BuiltInRole != "" {
			tmp := org.RoleType(p.BuiltInRole)
			role = &tmp
		}

		permission := dashboardPermissionMap[hs.dashboardPermissionsService.MapActions(p)]

		metrics.MFolderIDsAPICount.WithLabelValues(metrics.GetDashboardACL).Inc()
		acl = append(acl, &dashboards.DashboardACLInfoDTO{
			OrgID:          dashboard.OrgID,
			DashboardID:    dashboard.ID,
			FolderID:       dashboard.FolderID, // nolint:staticcheck
			Created:        p.Created,
			Updated:        p.Updated,
			UserID:         p.UserID,
			UserLogin:      p.UserLogin,
			UserEmail:      p.UserEmail,
			TeamID:         p.TeamID,
			TeamEmail:      p.TeamEmail,
			Team:           p.Team,
			Role:           role,
			Permission:     permission,
			PermissionName: permission.String(),
			UID:            dashboard.UID,
			Title:          dashboard.Title,
			Slug:           dashboard.Slug,
			IsFolder:       dashboard.IsFolder,
			URL:            dashboard.GetURL(),
			Inherited:      false,
		})
	}

	return acl, nil
}

func (hs *HTTPServer) filterHiddenACL(user identity.Requester, acl []*dashboards.DashboardACLInfoDTO) []*dashboards.DashboardACL {
	var hiddenACL []*dashboards.DashboardACL

	if user.GetIsGrafanaAdmin() {
		return hiddenACL
	}

	for _, item := range acl {
		if item.Inherited || item.UserLogin == user.GetLogin() {
			continue
		}

		if _, hidden := hs.Cfg.HiddenUsers[item.UserLogin]; hidden {
			hiddenACL = append(hiddenACL, &dashboards.DashboardACL{
				OrgID:       item.OrgID,
				DashboardID: item.DashboardID,
				UserID:      item.UserID,
				TeamID:      item.TeamID,
				Role:        item.Role,
				Permission:  item.Permission,
				Created:     item.Created,
				Updated:     item.Updated,
			})
		}
	}

	return hiddenACL
}

// updateDashboardAccessControl is used for api backward compatibility
func (hs *HTTPServer) updateDashboardAccessControl(ctx context.Context, orgID int64, uid string, isFolder bool, items []*dashboards.DashboardACL, old []*dashboards.DashboardACLInfoDTO) error {
	ctx, span := tracer.Start(ctx, "api.updateDashboardAccessControl")
	defer span.End()

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
			return dashboardaccess.ErrPermissionsWithUserAndTeamNotAllowed
		}

		if (item.UserID > 0 || item.TeamID > 0) && item.Role != nil {
			return dashboardaccess.ErrPermissionsWithRoleNotAllowed
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
