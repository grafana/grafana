package api

import (
	"errors"
	"fmt"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/web"
	"net/http"
)

// Sets sharing configuration for dashboard
func (hs *HTTPServer) ShareDashboard(c *models.ReqContext) response.Response {
	pdc := models.PublicDashboardConfig{}
	fmt.Println("test1")

	if err := web.Bind(c.Req, &pdc); err != nil {
		fmt.Println(err)
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	dto := dashboards.SavePublicDashboardConfigDTO{
		OrgId:                 c.OrgId,
		Uid:                   web.Params(c.Req)[":uid"],
		PublicDashboardConfig: pdc,
	}

	sharingConfig, err := hs.dashboardService.SavePublicDashboardConfig(c.Req.Context(), &dto)

	if errors.Is(err, models.ErrDataSourceNotFound) {
		return response.Error(http.StatusNotFound, "dashboard not found", err)
	}

	if err != nil {
		return response.Error(http.StatusInternalServerError, "error updating public dashboard config", err)
	}

	return response.JSON(http.StatusOK, sharingConfig)
}
