package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func GetOrgQuotas(c *middleware.Context) Response {
	if !setting.Quota.Enabled {
		return ApiError(404, "Quotas not enabled", nil)
	}
	query := m.GetQuotasQuery{OrgId: c.ParamsInt64(":orgId")}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to get org quotas", err)
	}

	return Json(200, query.Result)
}

// allow users to query the quotas of their own org.
func GetQuotas(c *middleware.Context) Response {
	if !setting.Quota.Enabled {
		return ApiError(404, "Quotas not enabled", nil)
	}
	query := m.GetQuotasQuery{OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to get quotas", err)
	}

	return Json(200, query.Result)
}

func UpdateOrgQuota(c *middleware.Context, cmd m.UpdateQuotaCmd) Response {
	if !setting.Quota.Enabled {
		return ApiError(404, "Quotas not enabled", nil)
	}
	cmd.OrgId = c.ParamsInt64(":orgId")
	cmd.Target = m.QuotaTarget(c.Params(":target"))

	if !cmd.Target.IsValid() {
		return ApiError(404, "Invalid quota target", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to update org quotas", err)
	}
	return ApiSuccess("Organization quota updated")
}
