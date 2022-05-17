package api

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/web"
)

// Sets sharing configuration for dashboard
func (hs *HTTPServer) GetPublicDashboard(c *models.ReqContext) response.Response {
	pdc, err := hs.dashboardService.GetPublicDashboardConfig(c.Req.Context(), c.OrgId, web.Params(c.Req)[":uid"])

	if errors.Is(err, models.ErrDashboardNotFound) {
		return response.Error(http.StatusNotFound, "dashboard not found", err)
	}

	if err != nil {
		return response.Error(http.StatusInternalServerError, "error retrieving public dashboard config", err)
	}

	return response.JSON(http.StatusOK, pdc)
}

// Sets sharing configuration for dashboard
func (hs *HTTPServer) SavePublicDashboard(c *models.ReqContext) response.Response {
	pdc := &models.PublicDashboardConfig{}

	if err := web.Bind(c.Req, pdc); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	dto := dashboards.SavePublicDashboardConfigDTO{
		OrgId:                 c.OrgId,
		Uid:                   web.Params(c.Req)[":uid"],
		PublicDashboardConfig: *pdc,
	}

	pdc, err := hs.dashboardService.SavePublicDashboardConfig(c.Req.Context(), &dto)

	fmt.Println("err:", err)

	if errors.Is(err, models.ErrDashboardNotFound) {
		return response.Error(http.StatusNotFound, "dashboard not found", err)
	}

	if err != nil {
		return response.Error(http.StatusInternalServerError, "error updating public dashboard config", err)
	}

	return response.JSON(http.StatusOK, pdc)
}
