package api

import (
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
)

func GetDashboardPermissionList(c *models.ReqContext) Response {
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
		return Error(500, "Failed to get dashboard permissions", err)
	}

	for _, perm := range acl {
		perm.UserAvatarUrl = dtos.GetGravatarUrl(perm.UserEmail)

		if perm.TeamId > 0 {
			perm.TeamAvatarUrl = dtos.GetGravatarUrlWithDefault(perm.TeamEmail, perm.Team)
		}
		if perm.Slug != "" {
			perm.Url = models.GetDashboardFolderUrl(perm.IsFolder, perm.Uid, perm.Slug)
		}
	}

	return JSON(200, acl)
}

func UpdateDashboardPermissions(c *models.ReqContext, apiCmd dtos.UpdateDashboardAclCommand) Response {
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
	cmd.DashboardId = dashID

	for _, item := range apiCmd.Items {
		cmd.Items = append(cmd.Items, &models.DashboardAcl{
			OrgId:       c.OrgId,
			DashboardId: dashID,
			UserId:      item.UserId,
			TeamId:      item.TeamId,
			Role:        item.Role,
			Permission:  item.Permission,
			Created:     time.Now(),
			Updated:     time.Now(),
		})
	}

	if okToUpdate, err := g.CheckPermissionBeforeUpdate(models.PERMISSION_ADMIN, cmd.Items); err != nil || !okToUpdate {
		if err != nil {
			if err == guardian.ErrGuardianPermissionExists ||
				err == guardian.ErrGuardianOverride {
				return Error(400, err.Error(), err)
			}

			return Error(500, "Error while checking dashboard permissions", err)
		}

		return Error(403, "Cannot remove own admin permission for a folder", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if err == models.ErrDashboardAclInfoMissing || err == models.ErrDashboardPermissionDashboardEmpty {
			return Error(409, err.Error(), err)
		}
		return Error(500, "Failed to create permission", err)
	}

	return Success("Dashboard permissions updated")
}
