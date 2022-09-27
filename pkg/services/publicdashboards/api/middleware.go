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
		// Check access token is present on the request
		accessToken, _ := web.Params(c.Req)[":accessToken"]
		if accessToken == "" {
			return
		}

		// Get public dashboard
		pd, _, err := publicDashboardService.GetPublicDashboard(c.Req.Context(), accessToken)
		if err != nil || pd == nil {
			return
		}

		if pd.IsEnabled {
			c.OrgID = pd.OrgId
		}
	}
}

// Adds public dashboard flag on context
func SetPublicDashboardFlag(c *models.ReqContext) {
	c.IsPublicDashboardView = true
}

func RequiresValidAccessToken(publicDashboardService publicdashboards.Service) func(c *models.ReqContext) {
	return func(c *models.ReqContext) {
		accessToken, ok := web.Params(c.Req)[":accessToken"]

		// Check access token is present on the request
		if !ok || !tokens.IsValidAccessToken(accessToken) {
			c.JsonApiErr(http.StatusNotFound, "Invalid access token", nil)
			return
		}

		// Check that the access token references an enabled public dashboard
		exists, err := publicDashboardService.AccessTokenExists(c.Req.Context(), accessToken)

		if err != nil {
			c.JsonApiErr(http.StatusInternalServerError, "Error validating access token", nil)
			return
		}

		if !exists {
			c.JsonApiErr(http.StatusNotFound, "Invalid access token", nil)
			return
		}
	}
}

func CountPublicDashboardRequest() func(c *models.ReqContext) {
	return func(c *models.ReqContext) {
		metrics.MPublicDashboardRequestCount.Inc()
	}
}
