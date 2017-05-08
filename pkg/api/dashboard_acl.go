package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/util"
)

func GetDashboardAcl(c *middleware.Context) Response {
	dashboardId := c.ParamsInt64(":id")

	hasPermission, err := guardian.CanViewAcl(dashboardId, c.OrgRole, c.IsGrafanaAdmin, c.OrgId, c.UserId)

	if err != nil {
		return ApiError(500, "Failed to get Dashboard ACL", err)
	}

	if !hasPermission {
		return Json(403, util.DynMap{"status": "Forbidden", "message": "Does not have access to this Dashboard ACL"})
	}

	query := m.GetDashboardPermissionsQuery{DashboardId: dashboardId}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to get Dashboard ACL", err)
	}

	return Json(200, &query.Result)
}
