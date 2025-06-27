package api

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/brokenpanels"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/web"
)

// BrokenPanelsAPI provides API endpoints for finding broken panels
type BrokenPanelsAPI struct {
	brokenPanelsService brokenpanels.Service
	dashboardService    dashboards.DashboardService
}

// NewBrokenPanelsAPI creates a new BrokenPanelsAPI
func NewBrokenPanelsAPI(brokenPanelsService brokenpanels.Service, dashboardService dashboards.DashboardService) *BrokenPanelsAPI {
	return &BrokenPanelsAPI{
		brokenPanelsService: brokenPanelsService,
		dashboardService:    dashboardService,
	}
}

// swagger:route GET /api/brokenpanels/dashboard/{dashboardUID} brokenpanels findBrokenPanelsInDashboard
//
// Find broken panels in a specific dashboard.
//
// Responses:
// 200: brokenPanelsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (api *BrokenPanelsAPI) FindBrokenPanelsInDashboard(c *contextmodel.ReqContext) response.Response {
	dashboardUID := web.Params(c.Req)[":dashboardUID"]
	if dashboardUID == "" {
		return response.Error(http.StatusBadRequest, "Dashboard UID is required", nil)
	}

	query := &brokenpanels.FindBrokenPanelsQuery{
		DashboardUID: dashboardUID,
		OrgID:        c.OrgID,
	}

	result, err := api.brokenPanelsService.FindBrokenPanels(c.Req.Context(), query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to find broken panels", err)
	}

	return response.JSON(http.StatusOK, result)
}

// swagger:route GET /api/brokenpanels/org brokenpanels findBrokenPanelsInOrg
//
// Find broken panels across all dashboards in an organization.
//
// Responses:
// 200: brokenPanelsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (api *BrokenPanelsAPI) FindBrokenPanelsInOrg(c *contextmodel.ReqContext) response.Response {
	query := &brokenpanels.FindBrokenPanelsInOrgQuery{
		OrgID: c.OrgID,
	}

	// Parse optional query parameters
	if dashboardUIDs := c.QueryStrings("dashboardUIDs"); len(dashboardUIDs) > 0 {
		query.DashboardUIDs = dashboardUIDs
	}
	if panelTypes := c.QueryStrings("panelTypes"); len(panelTypes) > 0 {
		query.PanelTypes = panelTypes
	}
	if errorTypes := c.QueryStrings("errorTypes"); len(errorTypes) > 0 {
		query.ErrorTypes = errorTypes
	}

	result, err := api.brokenPanelsService.FindBrokenPanelsInOrg(c.Req.Context(), query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to find broken panels", err)
	}

	return response.JSON(http.StatusOK, result)
}

// swagger:route POST /api/brokenpanels/validate brokenpanels validatePanel
//
// Validate a specific panel in a dashboard.
//
// Responses:
// 200: panelValidationResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (api *BrokenPanelsAPI) ValidatePanel(c *contextmodel.ReqContext) response.Response {
	var req struct {
		DashboardUID string `json:"dashboardUID" binding:"Required"`
		PanelID      int64  `json:"panelID" binding:"Required"`
	}

	if err := web.Bind(c.Req, &req); err != nil {
		return response.Error(http.StatusBadRequest, "Invalid request body", err)
	}

	// Get the dashboard first
	dashboardQuery := &dashboards.GetDashboardQuery{
		UID:   req.DashboardUID,
		OrgID: c.OrgID,
	}

	dashboard, err := api.dashboardService.GetDashboard(c.Req.Context(), dashboardQuery)
	if err != nil {
		return response.Error(http.StatusNotFound, "Dashboard not found", err)
	}

	query := &brokenpanels.ValidatePanelQuery{
		Dashboard: dashboard,
		PanelID:   req.PanelID,
		OrgID:     c.OrgID,
	}

	result, err := api.brokenPanelsService.ValidatePanel(c.Req.Context(), query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to validate panel", err)
	}

	return response.JSON(http.StatusOK, result)
}

// swagger:route DELETE /api/brokenpanels/cache/dashboard/{dashboardUID} brokenpanels invalidateDashboardCache
//
// Invalidate cache for a specific dashboard.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (api *BrokenPanelsAPI) InvalidateDashboardCache(c *contextmodel.ReqContext) response.Response {
	dashboardUID := web.Params(c.Req)[":dashboardUID"]
	if dashboardUID == "" {
		return response.Error(http.StatusBadRequest, "Dashboard UID is required", nil)
	}

	api.brokenPanelsService.InvalidateDashboardCache(c.Req.Context(), dashboardUID, c.OrgID)

	return response.JSON(http.StatusOK, map[string]string{
		"message":      "Dashboard cache invalidated successfully",
		"dashboardUID": dashboardUID,
	})
}

// swagger:route DELETE /api/brokenpanels/cache/org brokenpanels invalidateOrgCache
//
// Invalidate cache for the current organization.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (api *BrokenPanelsAPI) InvalidateOrgCache(c *contextmodel.ReqContext) response.Response {
	api.brokenPanelsService.InvalidateOrgCache(c.Req.Context(), c.OrgID)

	return response.JSON(http.StatusOK, map[string]string{
		"message": "Organization cache invalidation requested",
		"orgID":   fmt.Sprintf("%d", c.OrgID),
	})
}

// swagger:route DELETE /api/brokenpanels/cache/all brokenpanels clearAllCache
//
// Clear all broken panels cache.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (api *BrokenPanelsAPI) ClearAllCache(c *contextmodel.ReqContext) response.Response {
	api.brokenPanelsService.ClearAll(c.Req.Context())

	return response.JSON(http.StatusOK, map[string]string{
		"message": "All cache clear requested",
	})
}

// swagger:response brokenPanelsResponse
type BrokenPanelsResponse struct {
	// in:body
	Body *brokenpanels.BrokenPanelsResult
}

// swagger:response panelValidationResponse
type PanelValidationResponse struct {
	// in:body
	Body *brokenpanels.PanelValidationResult
}
