package testdatasource

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func (s *Service) ProcessInstanceSettings(ctx context.Context, req *backend.ProcessInstanceSettingsRequest) (*backend.ProcessInstanceSettingsResponse, error) {
	// NOOP
	return &backend.ProcessInstanceSettingsResponse{
		Allowed:                    true,
		DataSourceInstanceSettings: req.PluginContext.DataSourceInstanceSettings,
	}, nil
}

func (s *Service) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.AdmissionResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *Service) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.AdmissionResponse, error) {
	return nil, fmt.Errorf("not implemented")
}
