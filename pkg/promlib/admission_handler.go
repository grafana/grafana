package promlib

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var (
	_ backend.AdmissionHandler = (*Service)(nil)
)

// ValidateAdmission implements backend.AdmissionHandler.
func (s *Service) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	rsp, err := s.MutateAdmission(ctx, req)
	if rsp != nil {
		return &backend.ValidationResponse{
			Allowed:  rsp.Allowed,
			Result:   rsp.Result,
			Warnings: rsp.Warnings,
		}, err
	}
	return nil, err
}

// MutateAdmission implements backend.AdmissionHandler.
func (s *Service) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
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
	if settings.URL == "" {
		return getBadRequest("missing URL value"), nil
	}

	pb, err := backend.DataSourceInstanceSettingsToProtoBytes(settings)
	return &backend.MutationResponse{
		Allowed:     true,
		ObjectBytes: pb,
	}, err
}

func getBadRequest(msg string) *backend.MutationResponse {
	return &backend.MutationResponse{
		Allowed: false,
		Result: &backend.StatusResult{
			Status:  "Failure",
			Message: msg,
			Reason:  string(metav1.StatusReasonBadRequest),
			Code:    http.StatusBadRequest,
		},
	}
}
