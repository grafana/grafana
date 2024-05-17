package testdatasource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

	switch settings.APIVersion {
	case "", "v0alpha1":
		// OK!
	default:
		return getBadRequest(fmt.Sprintf("expected apiVersion: v0alpha1, got: %s", settings.APIVersion)), nil
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
			Reason:  string(metav1.StatusReasonBadRequest),
			Code:    http.StatusBadRequest,
		},
	}
}
