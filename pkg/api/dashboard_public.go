package api

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/web"
)

// gets public dashboard
func (hs *HTTPServer) GetPublicDashboard(c *models.ReqContext) response.Response {
	dash, err := hs.dashboardService.GetPublicDashboard(c.Req.Context(), web.Params(c.Req)[":uid"])
	if err != nil {
		return handleDashboardErr(http.StatusInternalServerError, "Failed to get public dashboard", err)
	}
	return response.JSON(http.StatusOK, dash)
}

// gets public dashboard configuration for dashboard
func (hs *HTTPServer) GetPublicDashboardConfig(c *models.ReqContext) response.Response {
	pdc, err := hs.dashboardService.GetPublicDashboardConfig(c.Req.Context(), c.OrgId, web.Params(c.Req)[":uid"])
	if err != nil {
		return handleDashboardErr(http.StatusInternalServerError, "Failed to get public dashboard config", err)
	}
	return response.JSON(http.StatusOK, pdc)
}

// sets public dashboard configuration for dashboard
func (hs *HTTPServer) SavePublicDashboardConfig(c *models.ReqContext) response.Response {
	pdc := &models.PublicDashboardConfig{}
	if err := web.Bind(c.Req, pdc); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	dto := dashboards.SavePublicDashboardConfigDTO{
		OrgId:                 c.OrgId,
		DashboardUid:          web.Params(c.Req)[":uid"],
		PublicDashboardConfig: pdc,
	}

	pdc, err := hs.dashboardService.SavePublicDashboardConfig(c.Req.Context(), &dto)
	if err != nil {
		return handleDashboardErr(http.StatusInternalServerError, "Failed to save public dashboard configuration", err)
	}

	return response.JSON(http.StatusOK, pdc)
}

// QueryPublicDashboard returns all results for the panels on a public dashboard
// POST /api/public/dashboard/:publicUid/query
func (hs *HTTPServer) QueryPublicDashboard(c *models.ReqContext) response.Response {
	timeRangeDTO := dtos.TimeRangeOnlyMetricRequest{}
	if err := web.Bind(c.Req, &timeRangeDTO); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	dashboard, err := hs.dashboardService.GetPublicDashboard(c.Req.Context(), web.Params(c.Req)[":uid"])
	if err != nil {
		return handleDashboardErr(http.StatusInternalServerError, "Failed to get public dashboard", err)
	}

	queries := models.GetQueriesFromDashboard(dashboard.Data)

	reqDTO := dtos.MetricRequest{
		To:      timeRangeDTO.To,
		From:    timeRangeDTO.From,
		Queries: nil,
	}

	for _, panel := range queries {
		for _, query := range panel {
			reqDTO.Queries = append(reqDTO.Queries, query)
		}
	}

	resp, err := hs.queryDataService.QueryData(c.Req.Context(), c.SignedInUser, c.SkipCache, reqDTO, true)
	if err != nil {
		return hs.handleQueryMetricsError(err)
	}
	return hs.toJsonStreamingResponse(resp)
}

// util to help us unpack a dashboard err or use default http code and message
func handleDashboardErr(defaultCode int, defaultMsg string, err error) response.Response {
	var dashboardErr models.DashboardErr

	if ok := errors.As(err, &dashboardErr); ok {
		return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), dashboardErr)
	}

	return response.Error(defaultCode, defaultMsg, err)
}
