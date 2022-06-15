package api

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
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
		Type:               models.DashTypeDB,
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
		IsEnabled:          true,
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
	pubdash := &models.PublicDashboard{}
	if err := web.Bind(c.Req, pubdash); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	// Always set the org id to the current auth session orgId
	pubdash.OrgId = c.OrgId

	dto := dashboards.SavePublicDashboardConfigDTO{
		OrgId:           c.OrgId,
		DashboardUid:    web.Params(c.Req)[":uid"],
		PublicDashboard: pubdash,
	}

	pubdash, err := hs.dashboardService.SavePublicDashboardConfig(c.Req.Context(), &dto)
	if err != nil {
		return handleDashboardErr(http.StatusInternalServerError, "Failed to save public dashboard configuration", err)
	}

	return response.JSON(http.StatusOK, pubdash)
}

// QueryPublicDashboard returns all results for a given panel on a public dashboard
// POST /api/public/dashboard/:uid/panels/:panelId/query
func (hs *HTTPServer) QueryPublicDashboard(c *models.ReqContext) response.Response {
	panelId, err := strconv.ParseInt(web.Params(c.Req)[":panelId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "invalid panel ID", err)
	}

	dashboard, err := hs.dashboardService.GetPublicDashboard(c.Req.Context(), web.Params(c.Req)[":uid"])
	if err != nil {
		return response.Error(http.StatusInternalServerError, "could not fetch dashboard", err)
	}

	publicDashboard, err := hs.dashboardService.GetPublicDashboardConfig(c.Req.Context(), dashboard.OrgId, dashboard.Uid)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "could not fetch public dashboard", err)
	}

	reqDTO, err := hs.dashboardService.BuildPublicDashboardMetricRequest(
		c.Req.Context(),
		dashboard,
		publicDashboard,
		panelId,
	)
	if err != nil {
		return handleDashboardErr(http.StatusInternalServerError, "Failed to get queries for public dashboard", err)
	}

	// Get all needed datasource UIDs from queries
	var uids []string
	for _, query := range reqDTO.Queries {
		uids = append(uids, query.Get("datasource").Get("uid").MustString())
	}

	// Create a temp user with read-only datasource permissions
	anonymousUser := &models.SignedInUser{OrgId: dashboard.OrgId, Permissions: make(map[int64]map[string][]string)}
	permissions := make(map[string][]string)
	datasourceScope := fmt.Sprintf("datasources:uid:%s", strings.Join(uids, ","))
	permissions[datasources.ActionQuery] = []string{datasourceScope}
	permissions[datasources.ActionRead] = []string{datasourceScope}
	anonymousUser.Permissions[dashboard.OrgId] = permissions

	resp, err := hs.queryDataService.QueryDataMultipleSources(c.Req.Context(), anonymousUser, c.SkipCache, reqDTO, true)

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
