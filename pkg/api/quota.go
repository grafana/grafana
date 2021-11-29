package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetCurrentOrgQuotas(c *models.ReqContext) response.Response {
	return hs.getOrgQuotasHelper(c, c.OrgId)
}

func (hs *HTTPServer) GetOrgQuotas(c *models.ReqContext) response.Response {
	return hs.getOrgQuotasHelper(c, c.ParamsInt64(":orgId"))
}

func (hs *HTTPServer) getOrgQuotasHelper(c *models.ReqContext, orgID int64) response.Response {
	if !hs.Cfg.Quota.Enabled {
		return response.Error(404, "Quotas not enabled", nil)
	}
	query := models.GetOrgQuotasQuery{OrgId: orgID}

	if err := hs.SQLStore.GetOrgQuotas(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to get org quotas", err)
	}

	return response.JSON(200, query.Result)
}

func (hs *HTTPServer) UpdateOrgQuota(c *models.ReqContext) response.Response {
	cmd := models.UpdateOrgQuotaCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if !hs.Cfg.Quota.Enabled {
		return response.Error(404, "Quotas not enabled", nil)
	}
	cmd.OrgId = c.ParamsInt64(":orgId")
	cmd.Target = web.Params(c.Req)[":target"]

	if _, ok := hs.Cfg.Quota.Org.ToMap()[cmd.Target]; !ok {
		return response.Error(404, "Invalid quota target", nil)
	}

	if err := hs.SQLStore.UpdateOrgQuota(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to update org quotas", err)
	}
	return response.Success("Organization quota updated")
}

func GetUserQuotas(c *models.ReqContext) response.Response {
	if !setting.Quota.Enabled {
		return response.Error(404, "Quotas not enabled", nil)
	}
	query := models.GetUserQuotasQuery{UserId: c.ParamsInt64(":id")}

	if err := bus.DispatchCtx(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to get org quotas", err)
	}

	return response.JSON(200, query.Result)
}

func UpdateUserQuota(c *models.ReqContext) response.Response {
	cmd := models.UpdateUserQuotaCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if !setting.Quota.Enabled {
		return response.Error(404, "Quotas not enabled", nil)
	}
	cmd.UserId = c.ParamsInt64(":id")
	cmd.Target = web.Params(c.Req)[":target"]

	if _, ok := setting.Quota.User.ToMap()[cmd.Target]; !ok {
		return response.Error(404, "Invalid quota target", nil)
	}

	if err := bus.DispatchCtx(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to update org quotas", err)
	}
	return response.Success("Organization quota updated")
}
