package webhooks

import (
	"encoding/json"
	"io"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/k8s/admission"
	"github.com/grafana/grafana/pkg/services/k8s/resources/publicdashboard"
	k8sAdmission "k8s.io/api/admission/v1"
)

func (api *WebhooksAPI) Validate(c *contextmodel.ReqContext) response.Response {
	var resp *k8sAdmission.AdmissionReview

	api.Log.Debug("admission controller validate fired")
	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		api.Log.Error("error reading request body")
	}
	api.Log.Debug("validate", "body", string(body))

	var rev k8sAdmission.AdmissionReview
	err = json.Unmarshal(body, &rev)
	if err != nil {
		api.Log.Error("error unmarshalling request body")
		return response.Error(500, "error unmarshalling request body", err)
	}

	obj := &publicdashboard.PublicDashboard{}
	err = obj.UnmarshalJSON(rev.Request.Object.Raw)
	if err != nil {
		api.Log.Error("error unmarshalling request body")
		return response.Error(500, "error unmarshalling request body", err)
	}

	oldObj := &publicdashboard.PublicDashboard{}
	err = oldObj.UnmarshalJSON(rev.Request.OldObject.Raw)
	if err != nil {
		api.Log.Error("error unmarshalling request body")
		return response.Error(500, "error unmarshalling request body", err)
	}

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
		OldObject: oldObj,
	}

	err = api.ValidationController.Validate(c.Req.Context(), req)
	if err != nil {
		// auth status code to start, maybe change this to bad request
		resp = makeFailureAdmissionReview(rev.Request.UID, rev.TypeMeta, err, 403)
	} else {
		resp = makeSuccessfulAdmissionReview(rev.Request.UID, rev.TypeMeta)
	}

	return response.JSON(int(resp.Response.Result.Code), resp)
}
