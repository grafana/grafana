package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/infra/metrics"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/publicdashboards/validation"
	"github.com/grafana/grafana/pkg/web"
)

// SetPublicDashboardOrgIdOnContext Adds orgId to context based on org of public dashboard
func SetPublicDashboardOrgIdOnContext(publicDashboardService publicdashboards.Service) func(c *contextmodel.ReqContext) {
	return func(c *contextmodel.ReqContext) {
		accessToken, ok := web.Params(c.Req)[":accessToken"]
		if !ok || !validation.IsValidAccessToken(accessToken) {
			return
		}

		// Get public dashboard
		orgId, err := publicDashboardService.GetOrgIdByAccessToken(c.Req.Context(), accessToken)
		if err != nil {
			return
		}

		c.OrgID = orgId
	}
}

// SetPublicDashboardFlag Adds public dashboard flag on context
func SetPublicDashboardFlag(c *contextmodel.ReqContext) {
	c.IsPublicDashboardView = true
}

// RequiresExistingAccessToken Middleware to enforce that a public dashboards exists before continuing to handler. This
// method will query the database to ensure that it exists.
// Use when we want to enforce a public dashboard is valid on an endpoint we do not maintain
func RequiresExistingAccessToken(publicDashboardService publicdashboards.Service) func(c *contextmodel.ReqContext) {
	return func(c *contextmodel.ReqContext) {
		accessToken, ok := web.Params(c.Req)[":accessToken"]

		if !ok {
			c.JsonApiErr(http.StatusBadRequest, "No access token provided", nil)
			return
		}

		if !validation.IsValidAccessToken(accessToken) {
			c.JsonApiErr(http.StatusBadRequest, "Invalid access token", nil)
		}

		// Check that the access token references an enabled public dashboard
		exists, err := publicDashboardService.ExistsEnabledByAccessToken(c.Req.Context(), accessToken)
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

func CountPublicDashboardRequest() func(c *contextmodel.ReqContext) {
	return func(c *contextmodel.ReqContext) {
		metrics.MPublicDashboardRequestCount.Inc()
	}
}
