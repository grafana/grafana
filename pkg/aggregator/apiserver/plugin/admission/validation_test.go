package admission_test

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/aggregator/apiserver/plugin/admission"
	"github.com/stretchr/testify/require"
	admissionv1 "k8s.io/api/admission/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestFromValidationResponse(t *testing.T) {
	warnings := []string{"warning 1", "warning 2"}

	result := &backend.StatusResult{
		Status:  "Failure",
		Message: "message",
		Reason:  "reason",
		Code:    200,
	}

	t.Run("should include Result in AdmissionResponse when not allowed", func(t *testing.T) {
		response := &backend.ValidationResponse{
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
		actualAdmissionReview := admission.FromValidationResponse(response)
		require.Equal(t, expectedAdmissionReview, actualAdmissionReview)
	})

	t.Run("should not include Result in AdmissionResponse when allowed", func(t *testing.T) {
		response := &backend.ValidationResponse{
			Allowed:  true,
			Warnings: warnings,
			Result:   result,
		}
		expectedAdmissionResponse := &admissionv1.AdmissionResponse{
			Allowed:  true,
			Warnings: warnings,
		}
		expectedAdmissionReview := &admissionv1.AdmissionReview{
			Response: expectedAdmissionResponse,
		}
		actualAdmissionReview := admission.FromValidationResponse(response)
		require.Equal(t, expectedAdmissionReview, actualAdmissionReview)
	})

	t.Run("should handle nil Warnings and Result", func(t *testing.T) {
		response := &backend.ValidationResponse{
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
		actualAdmissionReview := admission.FromValidationResponse(response)
		require.Equal(t, expectedAdmissionReview, actualAdmissionReview)
	})
}
