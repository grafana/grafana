package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/web"
)

func SetPublicDashboardFlag() func(c *models.ReqContext) {
	return func(c *models.ReqContext) {
		c.IsPublicDashboardView = true
	}
}

func RequiresValidAccessToken(publicDashboardService publicdashboards.Service) func(c *models.ReqContext) {
	return func(c *models.ReqContext) {
		accessToken, ok := web.Params(c.Req)[":accessToken"]

		// Check access token is present on the request
		if !ok || accessToken == "" {
			c.JsonApiErr(http.StatusBadRequest, "Invalid access token", nil)
			return
		}

		// Check that the access token references an enabled public dashboard
		exists, err := publicDashboardService.AccessTokenExists(c.Req.Context(), accessToken)

		if err != nil {
			c.JsonApiErr(http.StatusInternalServerError, "Error validating access token", nil)
			return
		}

		if !exists {
			c.JsonApiErr(http.StatusBadRequest, "Invalid access token", nil)
			return
		}
	}
}

func CountPublicDashboardRequest() func(c *models.ReqContext) {
	return func(c *models.ReqContext) {
		metrics.MPublicDashboardRequestCount.Inc()
	}
}
