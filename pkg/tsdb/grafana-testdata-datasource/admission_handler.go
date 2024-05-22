package testdatasource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ValidateAdmission implements backend.AdmissionHandler.
func (s *Service) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.AdmissionResponse, error) {
	expected := (&backend.DataSourceInstanceSettings{}).GVK()
	if req.Kind.Kind != expected.Kind && req.Kind.Group != expected.Group {
		return getBadRequest("expected DataSourceInstanceSettings protobuf payload"), nil
	}

	// Convert the payload from protobuf to an SDK struct
	settings, err := backend.DataSourceInstanceSettingsFromProto(req.ObjectBytes, "")
	if err != nil {
		return nil, err
	}
	if settings == nil {
		return getBadRequest("missing datasource settings"), nil
	}

	switch settings.APIVersion {
	case "", "v0alpha1":
		// OK!
	default:
		return getBadRequest(fmt.Sprintf("expected apiVersion: v0alpha1, found: %s", settings.APIVersion)), nil
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
	return &backend.AdmissionResponse{Allowed: true}, nil
}

// MutateAdmission implements backend.AdmissionHandler.
func (s *Service) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.AdmissionResponse, error) {
	rsp, err := s.ValidateAdmission(ctx, req)
	if err != nil && rsp.Allowed {
		rsp.ObjectBytes = req.ObjectBytes // For this case they are the same!
	}
	return rsp, err
}

// ConvertObject implements backend.AdmissionHandler.
func (s *Service) ConvertObject(ctx context.Context, req *backend.ConversionRequest) (*backend.AdmissionResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func getBadRequest(msg string) *backend.AdmissionResponse {
	return &backend.AdmissionResponse{
		Allowed: false,
		Result: &backend.StatusResult{
			Status:  "Failure",
			Message: msg,
			Reason:  string(metav1.StatusReasonBadRequest),
			Code:    http.StatusBadRequest,
		},
	}
}
