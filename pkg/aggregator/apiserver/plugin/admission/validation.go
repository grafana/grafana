package admission

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	admissionv1 "k8s.io/api/admission/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func FromValidationResponse(r *backend.ValidationResponse) *admissionv1.AdmissionReview {
	res := &admissionv1.AdmissionResponse{
		Allowed:  r.Allowed,
		Warnings: r.Warnings,
	}

	if !r.Allowed {
		res.Result = &metav1.Status{
			Status:  metav1.StatusFailure,
			Message: "Internal error",
			Reason:  metav1.StatusReasonInternalError,
			Code:    http.StatusInternalServerError,
		}
		if r.Result != nil {
			res.Result.Message = r.Result.Message
			res.Result.Reason = metav1.StatusReason(r.Result.Reason)
			res.Result.Code = r.Result.Code
		}
	}

	resAR := &admissionv1.AdmissionReview{
		Response: res,
	}

	return resAR
}
