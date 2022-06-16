package api

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/web"
)

// gets public dashboard
func (hs *HTTPServer) GetPublicDashboard(c *models.ReqContext) response.Response {
	publicDashboardUid := web.Params(c.Req)[":uid"]

	dash, err := hs.dashboardService.GetPublicDashboard(c.Req.Context(), publicDashboardUid)
	if err != nil {
		return handleDashboardErr(http.StatusInternalServerError, "Failed to get public dashboard", err)
	}

	meta := dtos.DashboardMeta{
		Slug:               dash.Slug,
		Type:               dashboards.DashTypeDB,
		CanStar:            false,
		CanSave:            false,
		CanEdit:            false,
		CanAdmin:           false,
		CanDelete:          false,
		Created:            dash.Created,
		Updated:            dash.Updated,
		Version:            dash.Version,
		IsFolder:           false,
		FolderId:           dash.FolderId,
		IsPublic:           dash.IsPublic,
		PublicDashboardUid: publicDashboardUid,
	}

	dto := dtos.DashboardFullWithMeta{Meta: meta, Dashboard: dash.Data}

	return response.JSON(http.StatusOK, dto)
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
	pdc := &dashboards.PublicDashboardConfig{}
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

// QueryPublicDashboard returns all results for a given panel on a public dashboard
// POST /api/public/dashboard/:uid/panels/:panelId/query
func (hs *HTTPServer) QueryPublicDashboard(c *models.ReqContext) response.Response {
	panelId, err := strconv.ParseInt(web.Params(c.Req)[":panelId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "invalid panel ID", err)
	}

	reqDTO, err := hs.dashboardService.BuildPublicDashboardMetricRequest(
		c.Req.Context(),
		web.Params(c.Req)[":uid"],
		panelId,
	)
	if err != nil {
		return handleDashboardErr(http.StatusInternalServerError, "Failed to get queries for public dashboard", err)
	}

	resp, err := hs.queryDataService.QueryDataMultipleSources(c.Req.Context(), nil, c.SkipCache, reqDTO, true)

	if err != nil {
		return hs.handleQueryMetricsError(err)
	}
	return hs.toJsonStreamingResponse(resp)
}

// util to help us unpack a dashboard err or use default http code and message
func handleDashboardErr(defaultCode int, defaultMsg string, err error) response.Response {
	var dashboardErr dashboards.DashboardErr

	if ok := errors.As(err, &dashboardErr); ok {
		return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), dashboardErr)
	}

	return response.Error(defaultCode, defaultMsg, err)
}
