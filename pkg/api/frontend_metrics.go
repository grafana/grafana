package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
)

func (hs *HTTPServer) PostFrontendMetrics(c *models.ReqContext, cmd metrics.PostFrontendMetricsCommand) response.Response {
	for _, event := range cmd.Events {
		if recorder, ok := metrics.FrontendMetrics[event.Name]; ok {
			recorder(event)
		} else {
			c.Logger.Debug("Received unknown frontend metric", "metric", event.Name)
		}
	}
	return response.Empty(200)
}
