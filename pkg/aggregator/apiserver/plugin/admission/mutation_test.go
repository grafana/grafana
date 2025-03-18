package admission_test

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/aggregator/apiserver/plugin/admission"
	"github.com/stretchr/testify/require"
	admissionv1 "k8s.io/api/admission/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestFromMutationResponse(t *testing.T) {
	warnings := []string{"warning 1", "warning 2"}

	exampleObj := []byte(`{"key": "value"}`)

	result := &backend.StatusResult{
		Status:  "Failure",
		Message: "message",
		Reason:  "reason",
		Code:    200,
	}

	t.Run("should return expected patch", func(t *testing.T) {
		response := &backend.MutationResponse{
			Allowed:     true,
			Warnings:    warnings,
			ObjectBytes: []byte(`{"key": "value2"}`),
		}
		pt := admissionv1.PatchTypeJSONPatch
		expectedAdmissionResponse := &admissionv1.AdmissionResponse{
			Allowed:   true,
			Warnings:  warnings,
			Patch:     []byte(`[{"op":"replace","path":"/key","value":"value2"}]`),
			PatchType: &pt,
		}
		expectedAdmissionReview := &admissionv1.AdmissionReview{
			Response: expectedAdmissionResponse,
		}
		actualAdmissionReview, err := admission.FromMutationResponse(exampleObj, response)
		require.NoError(t, err)
		require.Equal(t, expectedAdmissionReview, actualAdmissionReview)
	})

	t.Run("should error if MutationResponse has empty ObjectBytes", func(t *testing.T) {
		response := &backend.MutationResponse{
			Allowed:  true,
			Warnings: warnings,
		}
		_, err := admission.FromMutationResponse(exampleObj, response)
		require.Error(t, err)
	})

	t.Run("should include Result in AdmissionResponse when not allowed", func(t *testing.T) {
		response := &backend.MutationResponse{
			Allowed:  false,
			Warnings: warnings,
			Result:   result,
		}
		expectedAdmissionResponse := &admissionv1.AdmissionResponse{
			Allowed:  false,
			Warnings: warnings,
			Result: &metav1.Status{
				Status:  result.Status,
				Message: result.Message,
				Reason:  metav1.StatusReason(result.Reason),
				Code:    result.Code,
			},
		}
		expectedAdmissionReview := &admissionv1.AdmissionReview{
			Response: expectedAdmissionResponse,
		}
		actualAdmissionReview, err := admission.FromMutationResponse(exampleObj, response)
		require.NoError(t, err)
		require.Equal(t, expectedAdmissionReview, actualAdmissionReview)
	})

	t.Run("should handle nil Warnings and Result", func(t *testing.T) {
		response := &backend.MutationResponse{
			Allowed: false,
		}
		expectedAdmissionResponse := &admissionv1.AdmissionResponse{
			Allowed: false,
			Result: &metav1.Status{
				Status:  metav1.StatusFailure,
				Message: "Internal error",
				Reason:  metav1.StatusReasonInternalError,
				Code:    500,
			},
		}
		expectedAdmissionReview := &admissionv1.AdmissionReview{
			Response: expectedAdmissionResponse,
		}
		actualAdmissionReview, err := admission.FromMutationResponse(exampleObj, response)
		require.NoError(t, err)
		require.Equal(t, expectedAdmissionReview, actualAdmissionReview)
	})
}
