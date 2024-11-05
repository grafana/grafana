package zipkin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	client, err := s.getDSInfo(ctx, backend.PluginConfigFromContext(ctx))
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: err.Error(),
		}, nil
	}
	if _, err = client.ZipkinClient.Services(); err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: err.Error(),
		}, nil
	}
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Data source is working",
	}, nil
}
