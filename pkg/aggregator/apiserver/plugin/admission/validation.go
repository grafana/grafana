package admission

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	admissionv1 "k8s.io/api/admission/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func FromValidationResponse(r *backend.ValidationResponse) *admissionv1.AdmissionReview {
	res := &admissionv1.AdmissionResponse{
		Allowed: r.Allowed,
		Result: &metav1.Status{
			Status:  r.Result.Status,
			Message: r.Result.Message,
			Reason:  metav1.StatusReason(r.Result.Reason),
			Code:    r.Result.Code,
		},
		Warnings: r.Warnings,
	}

	resAR := &admissionv1.AdmissionReview{
		Response: res,
	}

	return resAR
}
