package api

import (
	"net/http"
	"strconv"

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
	orgId, err := strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
	return hs.getOrgQuotasHelper(c, orgId)
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
	var err error
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if !hs.Cfg.Quota.Enabled {
		return response.Error(404, "Quotas not enabled", nil)
	}
	cmd.OrgId, err = strconv.ParseInt(web.Params(c.Req)[":orgId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "orgId is invalid", err)
	}
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

	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	query := models.GetUserQuotasQuery{UserId: id}

	if err := bus.Dispatch(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to get org quotas", err)
	}

	return response.JSON(200, query.Result)
}

func UpdateUserQuota(c *models.ReqContext) response.Response {
	cmd := models.UpdateUserQuotaCmd{}
	var err error
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if !setting.Quota.Enabled {
		return response.Error(404, "Quotas not enabled", nil)
	}
	cmd.UserId, err = strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	cmd.Target = web.Params(c.Req)[":target"]

	if _, ok := setting.Quota.User.ToMap()[cmd.Target]; !ok {
		return response.Error(404, "Invalid quota target", nil)
	}

	if err := bus.Dispatch(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to update org quotas", err)
	}
	return response.Success("Organization quota updated")
}
