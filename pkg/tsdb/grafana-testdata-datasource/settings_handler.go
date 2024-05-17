package testdatasource

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// Testdata has empty configuration
func (s *Service) ProcessInstanceSettings(ctx context.Context, req *backend.ProcessInstanceSettingsRequest) (*backend.ProcessInstanceSettingsResponse, error) {
	if req.PluginContext.DataSourceInstanceSettings == nil {
		return getBadRequest("missing datasource settings"), nil
	}

	anything := map[string]any{}
	err := json.Unmarshal(req.PluginContext.DataSourceInstanceSettings.JSONData, &anything)
	if err != nil || len(anything) > 0 {
		return getBadRequest("Expected empty jsonData settings"), nil
	}

	if len(req.PluginContext.DataSourceInstanceSettings.DecryptedSecureJSONData) > 0 {
		return getBadRequest("found unsupported secure json fields"), nil
	}

	return &backend.ProcessInstanceSettingsResponse{
		Allowed:                    true,
		DataSourceInstanceSettings: req.PluginContext.DataSourceInstanceSettings,
	}, nil
}

func getBadRequest(reason string) *backend.ProcessInstanceSettingsResponse {
	return &backend.ProcessInstanceSettingsResponse{
		Allowed: false,
		Result: &backend.StatusResult{
			Reason: reason,
			Code:   http.StatusBadRequest,
		},
	}
}
