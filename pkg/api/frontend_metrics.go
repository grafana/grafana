package api

import (
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
)

func (hs *HTTPServer) PostFrontendMetrics(c *models.ReqContext, cmd metrics.PostFrontendMetricsCommand) response.Response {
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
