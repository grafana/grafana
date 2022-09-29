package api

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/web"
)

func SetPublicDashboardFlag() func(c *models.ReqContext) {
	return func(c *models.ReqContext) {
		// TODO: Find a better place to set this, or rename this function
		orgIDValue := c.Req.URL.Query().Get("orgId")
		orgID, err := strconv.ParseInt(orgIDValue, 10, 64)
		if err == nil && orgID > 0 && orgID != c.OrgID {
			c.OrgID = orgID
		}
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
