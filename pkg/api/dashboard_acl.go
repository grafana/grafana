package api

import (
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
)

func GetDashboardAclList(c *middleware.Context) Response {
	dashId := c.ParamsInt64(":dashboardId")

	_, rsp := getDashboardHelper(c.OrgId, "", dashId, "")
	if rsp != nil {
		return rsp
	}

	guardian := guardian.NewDashboardGuardian(dashId, c.OrgId, c.SignedInUser)

	if canAdmin, err := guardian.CanAdmin(); err != nil || !canAdmin {
		return dashboardGuardianResponse(err)
	}

	acl, err := guardian.GetAcl()
	if err != nil {
		return ApiError(500, "Failed to get dashboard acl", err)
	}

	for _, perm := range acl {
		if perm.Slug != "" {
			perm.Url = m.GetDashboardFolderUrl(perm.IsFolder, perm.Uid, perm.Slug)
		}
	}

	return Json(200, acl)
}

func UpdateDashboardAcl(c *middleware.Context, apiCmd dtos.UpdateDashboardAclCommand) Response {
	dashId := c.ParamsInt64(":dashboardId")

	_, rsp := getDashboardHelper(c.OrgId, "", dashId, "")
	if rsp != nil {
		return rsp
	}

	guardian := guardian.NewDashboardGuardian(dashId, c.OrgId, c.SignedInUser)
	if canAdmin, err := guardian.CanAdmin(); err != nil || !canAdmin {
		return dashboardGuardianResponse(err)
	}

	cmd := m.UpdateDashboardAclCommand{}
	cmd.DashboardId = dashId

	for _, item := range apiCmd.Items {
		cmd.Items = append(cmd.Items, &m.DashboardAcl{
			OrgId:       c.OrgId,
			DashboardId: dashId,
			UserId:      item.UserId,
			TeamId:      item.TeamId,
			Role:        item.Role,
			Permission:  item.Permission,
			Created:     time.Now(),
			Updated:     time.Now(),
		})
	}

	if okToUpdate, err := guardian.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, cmd.Items); err != nil || !okToUpdate {
		if err != nil {
			return ApiError(500, "Error while checking dashboard permissions", err)
		}

		return ApiError(403, "Cannot remove own admin permission for a folder", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrDashboardAclInfoMissing || err == m.ErrDashboardPermissionDashboardEmpty {
			return ApiError(409, err.Error(), err)
		}
		return ApiError(500, "Failed to create permission", err)
	}

	return ApiSuccess("Dashboard acl updated")
}

func DeleteDashboardAcl(c *middleware.Context) Response {
	dashId := c.ParamsInt64(":dashboardId")
	aclId := c.ParamsInt64(":aclId")

	_, rsp := getDashboardHelper(c.OrgId, "", dashId, "")
	if rsp != nil {
		return rsp
	}

	guardian := guardian.NewDashboardGuardian(dashId, c.OrgId, c.SignedInUser)
	if canAdmin, err := guardian.CanAdmin(); err != nil || !canAdmin {
		return dashboardGuardianResponse(err)
	}

	if okToDelete, err := guardian.CheckPermissionBeforeRemove(m.PERMISSION_ADMIN, aclId); err != nil || !okToDelete {
		if err != nil {
			return ApiError(500, "Error while checking dashboard permissions", err)
		}

		return ApiError(403, "Cannot remove own admin permission for a folder", nil)
	}

	cmd := m.RemoveDashboardAclCommand{OrgId: c.OrgId, AclId: aclId}
	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to delete permission for user", err)
	}

	return Json(200, "")
}
