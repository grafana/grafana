package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetDashboardPermissionList(c *models.ReqContext) response.Response {
	var dashID int64
	var err error
	dashUID := web.Params(c.Req)[":uid"]
	if dashUID == "" {
		dashID, err = strconv.ParseInt(web.Params(c.Req)[":dashboardId"], 10, 64)
		if err != nil {
			return response.Error(http.StatusBadRequest, "dashboardId is invalid", err)
		}
	}

	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.OrgId, dashID, dashUID)
	if rsp != nil {
		return rsp
	}

	if dashID == 0 {
		dashID = dash.Id
	}

	g := guardian.New(c.Req.Context(), dashID, c.OrgId, c.SignedInUser)

	if canAdmin, err := g.CanAdmin(); err != nil || !canAdmin {
		return dashboardGuardianResponse(err)
	}

	acl, err := g.GetACLWithoutDuplicates()
	if err != nil {
		return response.Error(500, "Failed to get dashboard permissions", err)
	}

	filteredACLs := make([]*models.DashboardACLInfoDTO, 0, len(acl))
	for _, perm := range acl {
		if perm.UserId > 0 && dtos.IsHiddenUser(perm.UserLogin, c.SignedInUser, hs.Cfg) {
			continue
		}

		perm.UserAvatarUrl = dtos.GetGravatarUrl(perm.UserEmail)

		if perm.TeamId > 0 {
			perm.TeamAvatarUrl = dtos.GetGravatarUrlWithDefault(perm.TeamEmail, perm.Team)
		}
		if perm.Slug != "" {
			perm.Url = models.GetDashboardFolderUrl(perm.IsFolder, perm.Uid, perm.Slug)
		}

		filteredACLs = append(filteredACLs, perm)
	}

	return response.JSON(http.StatusOK, filteredACLs)
}

func (hs *HTTPServer) UpdateDashboardPermissions(c *models.ReqContext) response.Response {
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

	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.OrgId, dashID, dashUID)
	if rsp != nil {
		return rsp
	}

	if dashUID != "" {
		dashID = dash.Id
	}

	g := guardian.New(c.Req.Context(), dashID, c.OrgId, c.SignedInUser)
	if canAdmin, err := g.CanAdmin(); err != nil || !canAdmin {
		return dashboardGuardianResponse(err)
	}

	var items []*models.DashboardACL
	for _, item := range apiCmd.Items {
		items = append(items, &models.DashboardACL{
			OrgID:       c.OrgId,
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

	if okToUpdate, err := g.CheckPermissionBeforeUpdate(models.PERMISSION_ADMIN, items); err != nil || !okToUpdate {
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
		if err := hs.updateDashboardAccessControl(c.Req.Context(), dash.OrgId, dash.Uid, false, items, old); err != nil {
			return response.Error(500, "Failed to update permissions", err)
		}
		return response.Success("Dashboard permissions updated")
	}

	if err := hs.DashboardService.UpdateDashboardACL(c.Req.Context(), dashID, items); err != nil {
		if errors.Is(err, models.ErrDashboardACLInfoMissing) ||
			errors.Is(err, models.ErrDashboardPermissionDashboardEmpty) {
			return response.Error(409, err.Error(), err)
		}
		return response.Error(500, "Failed to create permission", err)
	}

	return response.Success("Dashboard permissions updated")
}

// updateDashboardAccessControl is used for api backward compatibility
func (hs *HTTPServer) updateDashboardAccessControl(ctx context.Context, orgID int64, uid string, isFolder bool, items []*models.DashboardACL, old []*models.DashboardACLInfoDTO) error {
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
			if item.UserID != 0 && item.UserID == o.UserId {
				shouldRemove = false
				break
			}
			if item.TeamID != 0 && item.TeamID == o.TeamId {
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
				UserID:      o.UserId,
				TeamID:      o.TeamId,
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
			return models.ErrPermissionsWithUserAndTeamNotAllowed
		}

		if (item.UserID > 0 || item.TeamID > 0) && item.Role != nil {
			return models.ErrPermissionsWithRoleNotAllowed
		}
	}
	return nil
}
