package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func GetOrgQuotas(c *models.ReqContext) response.Response {
	if !setting.Quota.Enabled {
		return response.Error(http.StatusNotFound, "Quotas not enabled", nil)
	}
	query := models.GetOrgQuotasQuery{OrgId: c.ParamsInt64(":orgId")}

	if err := bus.Dispatch(&query); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get org quotas", err)
	}

	return response.JSON(http.StatusOK, query.Result)
}

func UpdateOrgQuota(c *models.ReqContext, cmd models.UpdateOrgQuotaCmd) response.Response {
	if !setting.Quota.Enabled {
		return response.Error(http.StatusNotFound, "Quotas not enabled", nil)
	}
	cmd.OrgId = c.ParamsInt64(":orgId")
	cmd.Target = c.Params(":target")

	if _, ok := setting.Quota.Org.ToMap()[cmd.Target]; !ok {
		return response.Error(http.StatusNotFound, "Invalid quota target", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update org quotas", err)
	}
	return response.Success("Organization quota updated")
}

func GetUserQuotas(c *models.ReqContext) response.Response {
	if !setting.Quota.Enabled {
		return response.Error(http.StatusNotFound, "Quotas not enabled", nil)
	}
	query := models.GetUserQuotasQuery{UserId: c.ParamsInt64(":id")}

	if err := bus.Dispatch(&query); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get org quotas", err)
	}

	return response.JSON(http.StatusOK, query.Result)
}

func UpdateUserQuota(c *models.ReqContext, cmd models.UpdateUserQuotaCmd) response.Response {
	if !setting.Quota.Enabled {
		return response.Error(http.StatusNotFound, "Quotas not enabled", nil)
	}
	cmd.UserId = c.ParamsInt64(":id")
	cmd.Target = c.Params(":target")

	if _, ok := setting.Quota.User.ToMap()[cmd.Target]; !ok {
		return response.Error(http.StatusNotFound, "Invalid quota target", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update org quotas", err)
	}
	return response.Success("Organization quota updated")
}
