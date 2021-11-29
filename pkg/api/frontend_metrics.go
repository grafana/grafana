package api

import (
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) PostFrontendMetrics(c *models.ReqContext) response.Response {
	cmd := metrics.PostFrontendMetricsCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	for _, event := range cmd.Events {
		name := strings.Replace(event.Name, "-", "_", -1)
		if recorder, ok := metrics.FrontendMetrics[name]; ok {
			recorder(event)
		} else {
			c.Logger.Debug("Received unknown frontend metric", "metric", name)
		}
	}
	return response.Empty(200)
}
