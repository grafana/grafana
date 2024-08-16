package admission

import (
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/mattbaird/jsonpatch"
	admissionv1 "k8s.io/api/admission/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func FromMutationResponse(current []byte, r *backend.MutationResponse) (*admissionv1.AdmissionReview, error) {
	res := admissionv1.AdmissionResponse{
		Allowed: r.Allowed,
		Result: &metav1.Status{
			Status:  r.Result.Status,
			Message: r.Result.Message,
			Reason:  metav1.StatusReason(r.Result.Reason),
			Code:    r.Result.Code,
		},
		Warnings: r.Warnings,
	}

	patch, err := jsonpatch.CreatePatch(current, r.ObjectBytes)
	if err != nil {
		return nil, err
	}

	raw, err := json.Marshal(patch)
	if err != nil {
		return nil, err
	}

	res.Patch = raw
	pt := admissionv1.PatchTypeJSONPatch
	res.PatchType = &pt

	resAR := &admissionv1.AdmissionReview{
		Response: &res,
	}

	return resAR, nil
}
