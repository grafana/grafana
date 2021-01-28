package api

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
)

func (hs *HTTPServer) GetDashboardPermissionList(c *models.ReqContext) response.Response {
	dashID := c.ParamsInt64(":dashboardId")

	_, rsp := getDashboardHelper(c.OrgId, "", dashID, "")
	if rsp != nil {
		return rsp
	}

	g := guardian.New(dashID, c.OrgId, c.SignedInUser)

	if canAdmin, err := g.CanAdmin(); err != nil || !canAdmin {
		return dashboardGuardianResponse(err)
	}

	acl, err := g.GetAcl()
	if err != nil {
		return response.Error(500, "Failed to get dashboard permissions", err)
	}

	filteredAcls := make([]*models.DashboardAclInfoDTO, 0, len(acl))
	for _, perm := range acl {
		if dtos.IsHiddenUser(perm.UserLogin, c.SignedInUser, hs.Cfg) {
			continue
		}

		perm.UserAvatarUrl = dtos.GetGravatarUrl(perm.UserEmail)

		if perm.TeamId > 0 {
			perm.TeamAvatarUrl = dtos.GetGravatarUrlWithDefault(perm.TeamEmail, perm.Team)
		}
		if perm.Slug != "" {
			perm.Url = models.GetDashboardFolderUrl(perm.IsFolder, perm.Uid, perm.Slug)
		}

		filteredAcls = append(filteredAcls, perm)
	}

	return response.JSON(200, filteredAcls)
}

func (hs *HTTPServer) UpdateDashboardPermissions(c *models.ReqContext, apiCmd dtos.UpdateDashboardAclCommand) response.Response {
	if err := validatePermissionsUpdate(apiCmd); err != nil {
		return response.Error(400, err.Error(), err)
	}

	dashID := c.ParamsInt64(":dashboardId")

	_, rsp := getDashboardHelper(c.OrgId, "", dashID, "")
	if rsp != nil {
		return rsp
	}

	g := guardian.New(dashID, c.OrgId, c.SignedInUser)
	if canAdmin, err := g.CanAdmin(); err != nil || !canAdmin {
		return dashboardGuardianResponse(err)
	}

	cmd := models.UpdateDashboardAclCommand{}
	cmd.DashboardID = dashID

	for _, item := range apiCmd.Items {
		cmd.Items = append(cmd.Items, &models.DashboardAcl{
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
	cmd.Items = append(cmd.Items, hiddenACL...)

	if okToUpdate, err := g.CheckPermissionBeforeUpdate(models.PERMISSION_ADMIN, cmd.Items); err != nil || !okToUpdate {
		if err != nil {
			if errors.Is(err, guardian.ErrGuardianPermissionExists) || errors.Is(err, guardian.ErrGuardianOverride) {
				return response.Error(400, err.Error(), err)
			}

			return response.Error(500, "Error while checking dashboard permissions", err)
		}

		return response.Error(403, "Cannot remove own admin permission for a folder", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if errors.Is(err, models.ErrDashboardAclInfoMissing) ||
			errors.Is(err, models.ErrDashboardPermissionDashboardEmpty) {
			return response.Error(409, err.Error(), err)
		}
		return response.Error(500, "Failed to create permission", err)
	}

	return response.Success("Dashboard permissions updated")
}

func validatePermissionsUpdate(apiCmd dtos.UpdateDashboardAclCommand) error {
	for _, item := range apiCmd.Items {
		if (item.UserID > 0 || item.TeamID > 0) && item.Role != nil {
			return models.ErrPermissionsWithRoleNotAllowed
		}
	}
	return nil
}
