package api

import (
	"context"
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
		if !ok || len(accessToken) < 1 {
			c.JsonApiErr(401, "Unauthorized: access token not provided", nil)
			return
		}

		// Check that the access token references an enabled public dashboard
		exists, err := publicDashboardService.PublicDashboardAccessTokenExists(context.Background(), accessToken)

		if err != nil {
			c.JsonApiErr(500, "Error verifying access token", nil)
			return
		}

		if !exists {
			c.JsonApiErr(401, "Unauthorized", nil)
			return
		}
	}
}

func CountPublicDashboardRequest() func(c *models.ReqContext) {
	return func(c *models.ReqContext) {
		metrics.MPublicDashboardRequestCount.Inc()
	}
}
