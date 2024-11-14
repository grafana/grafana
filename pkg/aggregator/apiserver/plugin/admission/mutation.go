package admission

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/mattbaird/jsonpatch"
	admissionv1 "k8s.io/api/admission/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func FromMutationResponse(current []byte, r *backend.MutationResponse) (*admissionv1.AdmissionReview, error) {
	res := &admissionv1.AdmissionReview{
		Response: &admissionv1.AdmissionResponse{
			Allowed:  r.Allowed,
			Warnings: r.Warnings,
		},
	}

	if !r.Allowed {
		res.Response.Result = &metav1.Status{
			Status:  metav1.StatusFailure,
			Message: "Internal error",
			Reason:  metav1.StatusReasonInternalError,
			Code:    http.StatusInternalServerError,
		}
		if r.Result != nil {
			res.Response.Result.Message = r.Result.Message
			res.Response.Result.Reason = metav1.StatusReason(r.Result.Reason)
			res.Response.Result.Code = r.Result.Code
		}
		return res, nil
	}

	if r.Allowed && len(r.ObjectBytes) == 0 {
		return nil, errors.New("empty mutation response object bytes")
	}

	patch, err := jsonpatch.CreatePatch(current, r.ObjectBytes)
	if err != nil {
		return nil, err
	}

	raw, err := json.Marshal(patch)
	if err != nil {
		return nil, err
	}

	res.Response.Patch = raw
	pt := admissionv1.PatchTypeJSONPatch
	res.Response.PatchType = &pt

	return res, nil
}
