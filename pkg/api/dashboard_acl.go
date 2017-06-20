package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/util"
)

func GetDashboardAclList(c *middleware.Context) Response {
	dashId := c.ParamsInt64(":dashboardId")

	guardian := guardian.NewDashboardGuardian(dashId, c.OrgId, c.SignedInUser)

	if canView, err := guardian.CanView(); err != nil || !canView {
		return dashboardGuardianResponse(err)
	}

	query := m.GetDashboardAclInfoListQuery{DashboardId: dashId}
	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to get Dashboard ACL", err)
	}

	list := query.Result
	hasViewRoleAcl := false
	hasEditRoleAcl := false

	for _, item := range list {
		if item.Role == m.ROLE_EDITOR {
			hasEditRoleAcl = true
		}
		if item.Role == m.ROLE_VIEWER {
			hasViewRoleAcl = true
		}
	}

	if !hasEditRoleAcl {
		tmpList := append([]*m.DashboardAclInfoDTO{}, &m.DashboardAclInfoDTO{
			Id:             0,
			Role:           m.ROLE_EDITOR,
			Permissions:    m.PERMISSION_EDIT,
			PermissionName: "Edit",
		})
		list = append(tmpList, list...)
	}
	if !hasViewRoleAcl {
		tmpList := append([]*m.DashboardAclInfoDTO{}, &m.DashboardAclInfoDTO{
			Id:             0,
			Role:           m.ROLE_VIEWER,
			Permissions:    m.PERMISSION_VIEW,
			PermissionName: "View",
		})
		list = append(tmpList, list...)
	}

	return Json(200, list)
}

func PostDashboardAcl(c *middleware.Context, cmd m.SetDashboardAclCommand) Response {
	dashId := c.ParamsInt64(":dashboardId")

	guardian := guardian.NewDashboardGuardian(dashId, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	cmd.OrgId = c.OrgId
	cmd.DashboardId = dashId

	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrDashboardAclInfoMissing || err == m.ErrDashboardPermissionDashboardEmpty {
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

func DeleteDashboardAcl(c *middleware.Context) Response {
	dashId := c.ParamsInt64(":dashboardId")
	aclId := c.ParamsInt64(":aclId")

	guardian := guardian.NewDashboardGuardian(dashId, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	cmd := m.RemoveDashboardAclCommand{OrgId: c.OrgId, AclId: aclId}
	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to delete permission for user", err)
	}

	return Json(200, "")
}
