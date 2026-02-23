package promlib

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/stretchr/testify/assert"
	"google.golang.org/protobuf/proto"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func Test_ValidateAdmission(t *testing.T) {
	t.Run("should return error when MutateAdmission fails and response is nil", func(t *testing.T) {
		httpProvider := getMockProvider[*healthCheckSuccessRoundTripper]()
		logger := backend.NewLoggerWith("logger", "test")
		s := &Service{
			im:     datasource.NewInstanceManager(newInstanceSettings(httpProvider, logger, mockExtendClientOpts)),
			logger: logger,
		}

		req := &backend.AdmissionRequest{
			Kind: backend.GroupVersionKind{
				Group: "grafana-plugin-sdk-go",
				Kind:  "DataSourceInstanceSettings",
			},
			ObjectBytes: []byte(`{"foo":"bar"}`),
		}

		actual, err := s.ValidateAdmission(context.Background(), req)
		assert.ErrorContains(t, err, "cannot parse invalid")
		assert.Nil(t, actual)
	})

	t.Run("should return ValidationResponse when MutateAdmission succeeds", func(t *testing.T) {
		httpProvider := getMockProvider[*healthCheckSuccessRoundTripper]()
		logger := backend.NewLoggerWith("logger", "test")
		s := &Service{
			im:     datasource.NewInstanceManager(newInstanceSettings(httpProvider, logger, mockExtendClientOpts)),
			logger: logger,
		}

		pb := &pluginv2.DataSourceInstanceSettings{
			ApiVersion: "v0alpha1",
			Url:        "https://grafana.example.com/",
		}
		data, err := proto.Marshal(pb)
		assert.NoError(t, err)

		expected := &backend.ValidationResponse{
			Allowed: true,
		}

		req := &backend.AdmissionRequest{
			Kind: backend.GroupVersionKind{
				Group: "grafana-plugin-sdk-go",
				Kind:  "DataSourceInstanceSettings",
			},
			ObjectBytes: data,
		}

		actual, err := s.ValidateAdmission(context.Background(), req)
		assert.NoError(t, err)
		assert.Equal(t, expected, actual)
	})
}

func Test_MutateAdmission(t *testing.T) {
	t.Run("should fail when Kind and Group do not match expected values", func(t *testing.T) {
		httpProvider := getMockProvider[*healthCheckSuccessRoundTripper]()
		logger := backend.NewLoggerWith("logger", "test")
		s := &Service{
			im:     datasource.NewInstanceManager(newInstanceSettings(httpProvider, logger, mockExtendClientOpts)),
			logger: logger,
		}

		expected := getBadRequest("expected DataSourceInstanceSettings protobuf payload")

		req := &backend.AdmissionRequest{
			Kind: backend.GroupVersionKind{
				Group: "example.k8s.io",
				Kind:  "Pod",
			},
		}

		actual, err := s.MutateAdmission(context.Background(), req)
		assert.NoError(t, err)
		assert.Equal(t, expected, actual)
	})

	t.Run("should return an error when object bytes is nil", func(t *testing.T) {
		httpProvider := getMockProvider[*healthCheckSuccessRoundTripper]()
		logger := backend.NewLoggerWith("logger", "test")
		s := &Service{
			im:     datasource.NewInstanceManager(newInstanceSettings(httpProvider, logger, mockExtendClientOpts)),
			logger: logger,
		}

		expected := getBadRequest("missing datasource settings")

		req := &backend.AdmissionRequest{
			Kind: backend.GroupVersionKind{
				Group: "grafana-plugin-sdk-go",
				Kind:  "DataSourceInstanceSettings",
			},
		}

		actual, err := s.MutateAdmission(context.Background(), req)
		assert.NoError(t, err)
		assert.Equal(t, expected, actual)
	})

	t.Run("should return an error when protobuf payload conversion fails", func(t *testing.T) {
		httpProvider := getMockProvider[*healthCheckSuccessRoundTripper]()
		logger := backend.NewLoggerWith("logger", "test")
		s := &Service{
			im:     datasource.NewInstanceManager(newInstanceSettings(httpProvider, logger, mockExtendClientOpts)),
			logger: logger,
		}

		req := &backend.AdmissionRequest{
			Kind: backend.GroupVersionKind{
				Group: "grafana-plugin-sdk-go",
				Kind:  "DataSourceInstanceSettings",
			},
			ObjectBytes: []byte(`{"foo":"bar"}`),
		}

		actual, err := s.MutateAdmission(context.Background(), req)
		assert.ErrorContains(t, err, "cannot parse invalid")
		assert.Nil(t, actual)
	})

	t.Run("should return bad request error when settings APIVersion is invalid", func(t *testing.T) {
		httpProvider := getMockProvider[*healthCheckSuccessRoundTripper]()
		logger := backend.NewLoggerWith("logger", "test")
		s := &Service{
			im:     datasource.NewInstanceManager(newInstanceSettings(httpProvider, logger, mockExtendClientOpts)),
			logger: logger,
		}

		pb := &pluginv2.DataSourceInstanceSettings{
			ApiVersion: "v0alpha2",
		}
		data, err := proto.Marshal(pb)
		assert.NoError(t, err)

		expected := getBadRequest(fmt.Sprintf("expected apiVersion: v0alpha1, found: %s", pb.ApiVersion))

		req := &backend.AdmissionRequest{
			Kind: backend.GroupVersionKind{
				Group: "grafana-plugin-sdk-go",
				Kind:  "DataSourceInstanceSettings",
			},
			ObjectBytes: data,
		}

		actual, err := s.MutateAdmission(context.Background(), req)
		assert.NoError(t, err)
		assert.Equal(t, expected, actual)
	})

	t.Run("should return bad request error when settings URL is invalid", func(t *testing.T) {
		httpProvider := getMockProvider[*healthCheckSuccessRoundTripper]()
		logger := backend.NewLoggerWith("logger", "test")
		s := &Service{
			im:     datasource.NewInstanceManager(newInstanceSettings(httpProvider, logger, mockExtendClientOpts)),
			logger: logger,
		}

		pb := &pluginv2.DataSourceInstanceSettings{
			ApiVersion: "v0alpha1",
		}
		data, err := proto.Marshal(pb)
		assert.NoError(t, err)

		expected := getBadRequest("missing URL value")

		req := &backend.AdmissionRequest{
			Kind: backend.GroupVersionKind{
				Group: "grafana-plugin-sdk-go",
				Kind:  "DataSourceInstanceSettings",
			},
			ObjectBytes: data,
		}

		actual, err := s.MutateAdmission(context.Background(), req)
		assert.NoError(t, err)
		assert.Equal(t, expected, actual)
	})

	t.Run("should return successfully mutation response", func(t *testing.T) {
		httpProvider := getMockProvider[*healthCheckSuccessRoundTripper]()
		logger := backend.NewLoggerWith("logger", "test")
		s := &Service{
			im:     datasource.NewInstanceManager(newInstanceSettings(httpProvider, logger, mockExtendClientOpts)),
			logger: logger,
		}

		pb := &pluginv2.DataSourceInstanceSettings{
			ApiVersion: "v0alpha1",
			Url:        "https://grafana.example.com/",
		}
		data, err := proto.Marshal(pb)
		assert.NoError(t, err)

		expected := &backend.MutationResponse{
			Allowed:     true,
			ObjectBytes: data,
		}

		req := &backend.AdmissionRequest{
			Kind: backend.GroupVersionKind{
				Group: "grafana-plugin-sdk-go",
				Kind:  "DataSourceInstanceSettings",
			},
			ObjectBytes: data,
		}

		actual, err := s.MutateAdmission(context.Background(), req)
		assert.NoError(t, err)
		assert.Equal(t, expected, actual)
	})
}

func Test_getBadRequest(t *testing.T) {
	t.Run("should get a successful bad request", func(t *testing.T) {
		msg := "missing URL value"

		expected := &backend.MutationResponse{
			Allowed: false,
			Result: &backend.StatusResult{
				Status:  "Failure",
				Message: "missing URL value",
				Reason:  string(metav1.StatusReasonBadRequest),
				Code:    http.StatusBadRequest,
			},
		}

		actual := getBadRequest(msg)
		assert.Equal(t, expected, actual)
	})
}
