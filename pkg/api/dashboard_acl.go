package api

import (
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
)

func GetDashboardAclList(c *middleware.Context) Response {
	dashId := c.ParamsInt64(":dashboardId")

	guardian := guardian.NewDashboardGuardian(dashId, c.OrgId, c.SignedInUser)

	if canView, err := guardian.CanView(); err != nil || !canView {
		return dashboardGuardianResponse(err)
	}

	acl, err := guardian.GetAcl()
	if err != nil {
		return ApiError(500, "Failed to get dashboard acl", err)
	}

	return Json(200, acl)
}

func UpdateDashboardAcl(c *middleware.Context, apiCmd dtos.UpdateDashboardAclCommand) Response {
	dashId := c.ParamsInt64(":dashboardId")

	guardian := guardian.NewDashboardGuardian(dashId, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	cmd := m.UpdateDashboardAclCommand{}
	cmd.DashboardId = dashId

	for _, item := range apiCmd.Items {
		cmd.Items = append(cmd.Items, &m.DashboardAcl{
			OrgId:       c.OrgId,
			DashboardId: dashId,
			UserId:      item.UserId,
			UserGroupId: item.UserGroupId,
			Role:        item.Role,
			Permission:  item.Permission,
			Created:     time.Now(),
			Updated:     time.Now(),
		})
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrDashboardAclInfoMissing || err == m.ErrDashboardPermissionDashboardEmpty {
			return ApiError(409, err.Error(), err)
		}
		return ApiError(500, "Failed to create permission", err)
	}

	metrics.M_Api_Dashboard_Acl_Update.Inc(1)
	return ApiSuccess("Dashboard acl updated")
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
