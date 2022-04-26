package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/web"
	"net/http"
)

// Sets sharing configuration for dashboard
func (hs *HTTPServer) ShareDashboard(c *models.ReqContext) response.Response {
	dsc := models.DashboardSharingConfig{}

	if err := web.Bind(c.Req, &dsc); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	dto := dashboards.SaveDashboardSharingConfigDTO{
		OrgId:                  c.OrgId,
		Uid:                    web.Params(c.Req)[":uid"],
		DashboardSharingConfig: dsc,
	}

	sharingConfig, err := hs.dashboardService.SaveDashboardSharingConfig(c.Req.Context(), &dto)

	if err != nil {
		return response.Error(500, "yer a potato", err)
	}

	return response.JSON(http.StatusOK, sharingConfig)
}
