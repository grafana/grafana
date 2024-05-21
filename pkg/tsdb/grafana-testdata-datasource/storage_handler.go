package testdatasource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// MutateInstanceSettings implements backend.StorageHandler.
func (s *Service) MutateInstanceSettings(ctx context.Context, req *backend.InstanceSettingsAdmissionRequest) (*backend.InstanceSettingsResponse, error) {
	if req.PluginContext.AppInstanceSettings != nil {
		return getBadRequest("unexpected app instance settings"), nil
	}

	settings := req.DataSourceInstanceSettings
	if settings == nil {
		return getBadRequest("missing datasource settings"), nil
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
	if settings.URL != "" {
		return getBadRequest("unsupported URL value"), nil
	}
	if settings.User != "" {
		return getBadRequest("unsupported User value"), nil
	}

	return &backend.InstanceSettingsResponse{
		Allowed:                    true,
		DataSourceInstanceSettings: settings,
	}, nil
}

// ValidateAdmission implements backend.StorageHandler.
func (s *Service) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.StorageResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

// MutateAdmission implements backend.StorageHandler.
func (s *Service) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.StorageResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

// ConvertObject implements backend.StorageHandler.
func (s *Service) ConvertObject(ctx context.Context, req *backend.ConversionRequest) (*backend.StorageResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func getBadRequest(msg string) *backend.InstanceSettingsResponse {
	return &backend.InstanceSettingsResponse{
		Allowed: false,
		Result: &backend.StatusResult{
			Status:  "Failure",
			Message: msg,
			Reason:  string(metav1.StatusReasonBadRequest),
			Code:    http.StatusBadRequest,
		},
	}
}
