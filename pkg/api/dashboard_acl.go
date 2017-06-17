package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/util"
)

func GetDashboardAcl(c *middleware.Context) Response {
	dash, rsp := getDashboardHelper(c.OrgId, "", c.ParamsInt64(":id"))
	if rsp != nil {
		return rsp
	}

	guardian := guardian.NewDashboardGuardian(dash, c.SignedInUser)

	canView, err := guardian.CanView(dashboardId, c.OrgRole, c.IsGrafanaAdmin, c.OrgId, c.UserId)
	if err != nil {
		return ApiError(500, "Failed to get Dashboard ACL", err)
	} else if !hasPermission {
		return ApiError(403, "Does not have access to this Dashboard ACL")
	}

	query := m.GetDashboardPermissionsQuery{DashboardId: dashboardId}
	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to get Dashboard ACL", err)
	}

	return Json(200, &query.Result)
}

func PostDashboardAcl(c *middleware.Context, cmd m.AddOrUpdateDashboardPermissionCommand) Response {
	cmd.OrgId = c.OrgId
	cmd.DashboardId = c.ParamsInt64(":id")

	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrDashboardPermissionUserOrUserGroupEmpty {
			return ApiError(409, err.Error(), err)
		}
		return ApiError(500, "Failed to create permission", err)
	}

	metrics.M_Api_Dashboard_Acl_Create.Inc(1)

	return Json(200, &util.DynMap{
		"permissionId": cmd.Result.Id,
		"message":      "Permission created",
	})
}

func DeleteDashboardAclByUser(c *middleware.Context) Response {
	dashboardId := c.ParamsInt64(":id")
	userId := c.ParamsInt64(":userId")
	cmd := m.RemoveDashboardPermissionCommand{DashboardId: dashboardId, UserId: userId, OrgId: c.OrgId}

	hasPermission, err := guardian.CanDeleteFromAcl(dashboardId, c.OrgRole, c.IsGrafanaAdmin, c.OrgId, c.UserId)
	if err != nil {
		return ApiError(500, "Failed to delete from Dashboard ACL", err)
	}

	if !hasPermission {
		return Json(403, util.DynMap{"status": "Forbidden", "message": "Does not have access to this Dashboard ACL"})
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to delete permission for user", err)
	}

	return Json(200, "")
}

func DeleteDashboardAclByUserGroup(c *middleware.Context) Response {
	dashboardId := c.ParamsInt64(":id")
	userGroupId := c.ParamsInt64(":userGroupId")
	cmd := m.RemoveDashboardPermissionCommand{DashboardId: dashboardId, UserGroupId: userGroupId, OrgId: c.OrgId}

	hasPermission, err := guardian.CanDeleteFromAcl(dashboardId, c.OrgRole, c.IsGrafanaAdmin, c.OrgId, c.UserId)
	if err != nil {
		return ApiError(500, "Failed to delete from Dashboard ACL", err)
	}

	if !hasPermission {
		return Json(403, util.DynMap{"status": "Forbidden", "message": "Does not have access to this Dashboard ACL"})
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to delete permission for user", err)
	}

	return Json(200, "")
}
