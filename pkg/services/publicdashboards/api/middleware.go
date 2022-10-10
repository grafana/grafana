package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/tokens"
	"github.com/grafana/grafana/pkg/web"
)

// Adds orgId to context based on org of public dashboard
func SetPublicDashboardOrgIdOnContext(publicDashboardService publicdashboards.Service) func(c *models.ReqContext) {
	return func(c *models.ReqContext) {
		accessToken, ok := web.Params(c.Req)[":accessToken"]
		if !ok || !tokens.IsValidAccessToken(accessToken) {
			return
		}

		// Get public dashboard
		orgId, err := publicDashboardService.GetPublicDashboardOrgId(c.Req.Context(), accessToken)
		if err != nil {
			return
		}

		c.OrgID = orgId
	}
}

// Adds public dashboard flag on context
func SetPublicDashboardFlag(c *models.ReqContext) {
	c.IsPublicDashboardView = true
}

// Middleware to enforce that a public dashboards exists before continuing to
// handler
func RequiresValidAccessToken(publicDashboardService publicdashboards.Service) func(c *models.ReqContext) {
	return func(c *models.ReqContext) {
		accessToken, ok := web.Params(c.Req)[":accessToken"]

		if !ok {
			c.JsonApiErr(http.StatusBadRequest, "No access token provided", nil)
			return
		}

		if !tokens.IsValidAccessToken(accessToken) {
			c.JsonApiErr(http.StatusBadRequest, "Invalid access token", nil)
		}

		// Check that the access token references an enabled public dashboard
		exists, err := publicDashboardService.AccessTokenExists(c.Req.Context(), accessToken)
		if err != nil {
			c.JsonApiErr(http.StatusInternalServerError, "Failed to query access token", nil)
			return
		}
		if !exists {
			c.JsonApiErr(http.StatusNotFound, "Public dashboard not found", nil)
			return
		}
	}
}

func CountPublicDashboardRequest() func(c *models.ReqContext) {
	return func(c *models.ReqContext) {
		metrics.MPublicDashboardRequestCount.Inc()
	}
}
