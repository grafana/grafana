package testdatasource

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/util/errutil"
)

// Testdata has empty configuration
func (s *Service) ProcessInstanceSettings(ctx context.Context, req *backend.ProcessInstanceSettingsRequest) (*backend.ProcessInstanceSettingsResponse, error) {
	settings := req.PluginContext.DataSourceInstanceSettings
	if settings == nil {
		return getBadRequest("missing datasource settings"), nil
	}
	if req.PluginContext.AppInstanceSettings != nil {
		return getBadRequest("not expecting app instance settings"), nil
	}

	if settings.JSONData != nil {
		anything := map[string]any{}
		err := json.Unmarshal(settings.JSONData, &anything)
		if err != nil || len(anything) > 0 {
			return getBadRequest("Expected empty jsonData settings"), nil
		}
	}

	if len(settings.DecryptedSecureJSONData) > 0 {
		return getBadRequest("found unsupported secure json fields"), nil
	}

	return &backend.ProcessInstanceSettingsResponse{
		Allowed:                    true,
		DataSourceInstanceSettings: settings,
	}, nil
}

func getBadRequest(msg string) *backend.ProcessInstanceSettingsResponse {
	return &backend.ProcessInstanceSettingsResponse{
		Allowed: false,
		Result: &backend.StatusResult{
			Status:  "Failure",
			Message: msg,
			Reason:  string(errutil.StatusBadRequest),
			Code:    http.StatusBadRequest,
		},
	}
}
