package webhooks

import (
	"encoding/json"
	"io"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/k8s/admission"
	"github.com/grafana/grafana/pkg/services/k8s/resources/publicdashboard"
	"gomodules.xyz/jsonpatch/v2"
	k8sAdmission "k8s.io/api/admission/v1"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sTypes "k8s.io/apimachinery/pkg/types"
)

func (api *WebhooksAPI) Mutate(c *contextmodel.ReqContext) response.Response {
	var resp *k8sAdmission.AdmissionReview

	// get body bytes
	api.Log.Debug("mutation controller fired")
	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		api.Log.Error("error reading request body")
		resp = makeFailureAdmissionReview("", metaV1.TypeMeta{}, err, 400)
		return response.JSON(int(resp.Response.Result.Code), resp)
	}

	// unmarshal body into review
	var rev k8sAdmission.AdmissionReview
	err = json.Unmarshal(body, &rev)
	if err != nil {
		api.Log.Error("error unmarshalling request body", err)
		resp = makeFailureAdmissionReview("", metaV1.TypeMeta{}, err, 400)
		return response.JSON(int(resp.Response.Result.Code), resp)
	}

	// Current state of object
	obj := &publicdashboard.PublicDashboard{}
	err = obj.UnmarshalJSON(rev.Request.Object.Raw)
	if err != nil {
		api.Log.Error("error unmarshalling request body")
		resp = makeFailureAdmissionReview(rev.Request.UID, rev.TypeMeta, err, 400)
		return response.JSON(int(resp.Response.Result.Code), resp)
	}

	// create webhook request
	req := &admission.AdmissionRequest{
		Action:  c.Req.Method,
		Kind:    rev.Kind,
		Group:   rev.GroupVersionKind().Group,
		Version: rev.GroupVersionKind().Version,
		UserInfo: admission.AdmissionUserInfo{
			Username: rev.Request.UserInfo.Username,
			UID:      rev.Request.UserInfo.UID,
			Groups:   rev.Request.UserInfo.Groups,
		},
		Object:    obj,
		OldObject: nil,
	}

	// do mutations
	mutationResponse, err := api.MutationController.Mutate(c.Req.Context(), req)
	if err != nil {
		api.Log.Error("error doing mutation", err)
		resp = makeFailureAdmissionReview(rev.Request.UID, rev.TypeMeta, err, 400)
		return response.JSON(int(resp.Response.Result.Code), resp)
	}

	// get mutation bytes
	jsonMutation, err := json.Marshal(mutationResponse.Raw)
	if err != nil {
		api.Log.Error("error marshaling mutation response", err)
		resp = makeFailureAdmissionReview(rev.Request.UID, rev.TypeMeta, err, 400)
		return response.JSON(int(resp.Response.Result.Code), resp)
	}

	// create patch from bytes
	ops, err := jsonpatch.CreatePatch(rev.Request.Object.Raw, jsonMutation)
	if err != nil {
		resp = makeFailureAdmissionReview(rev.Request.UID, rev.TypeMeta, err, 400)
		return response.JSON(int(resp.Response.Result.Code), resp)
	}

	// add patch to response
	marshalledOps, err := json.Marshal(ops)
	if err != nil {
		resp = makeFailureAdmissionReview(rev.Request.UID, rev.TypeMeta, err, 400)
		return response.JSON(int(resp.Response.Result.Code), resp)
	}

	resp = makeSuccessfulMutationReview(rev.Request.UID, rev.TypeMeta, marshalledOps)
	return response.JSON(int(resp.Response.Result.Code), resp)
}

func makeSuccessfulMutationReview(uid k8sTypes.UID, typeMeta metaV1.TypeMeta, patch []byte) *k8sAdmission.AdmissionReview {
	return &k8sAdmission.AdmissionReview{
		TypeMeta: typeMeta,
		Response: &k8sAdmission.AdmissionResponse{
			UID:       uid,
			Allowed:   true,
			PatchType: pontificate(k8sAdmission.PatchTypeJSONPatch),
			Patch:     patch,
			Result: &metaV1.Status{
				Status: "Success",
				Code:   200,
			},
		},
	}
}

// lol
func pontificate[T any](s T) *T {
	return &s
}
