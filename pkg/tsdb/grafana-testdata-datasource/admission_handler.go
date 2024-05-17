package testdatasource

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func (s *Service) ProcessInstanceSettings(ctx context.Context, req *backend.ProcessInstanceSettingsRequest) (*backend.ProcessInstanceSettingsResponse, error) {
	// NOOP
	return &backend.ProcessInstanceSettingsResponse{
		Allowed:                    true,
		DataSourceInstanceSettings: req.PluginContext.DataSourceInstanceSettings,
	}, nil
}
