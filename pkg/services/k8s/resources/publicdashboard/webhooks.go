package publicdashboard

import (
	"encoding/json"
	"io"
	k8sTypes "k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/k8s/admission"
	k8sAdmission "k8s.io/api/admission/v1"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type WebhooksAPI struct {
	RouteRegister        routing.RouteRegister
	AccessControl        accesscontrol.AccessControl
	Features             *featuremgmt.FeatureManager
	Log                  log.Logger
	ValidationController admission.ValidatingAdmissionController
}

func ProvideWebhooks(
	rr routing.RouteRegister,
	ac accesscontrol.AccessControl,
	features *featuremgmt.FeatureManager,
	vc admission.ValidatingAdmissionController,
) *WebhooksAPI {
	webhooksAPI := &WebhooksAPI{
		RouteRegister:        rr,
		AccessControl:        ac,
		Log:                  log.New("k8s.publicdashboard.webhooks.admission.create"),
		ValidationController: vc,
	}

	webhooksAPI.RegisterAPIEndpoints()

	return webhooksAPI
}

func (api *WebhooksAPI) RegisterAPIEndpoints() {
	api.RouteRegister.Post("/k8s/publicdashboards/admission/create", api.Create)
}

func makeSuccessfulAdmissionReview(uid k8sTypes.UID, typeMeta metaV1.TypeMeta, code int32) *k8sAdmission.AdmissionReview {
	return &k8sAdmission.AdmissionReview{
		TypeMeta: typeMeta,
		Response: &k8sAdmission.AdmissionResponse{
			UID:     uid,
			Allowed: true,
			Result: &metaV1.Status{
				Status: "Success",
				Code:   code,
			},
		},
	}
}

func makeFailureAdmissionReview(uid k8sTypes.UID, typeMeta metaV1.TypeMeta, err error, code int32) *k8sAdmission.AdmissionReview {
	return &k8sAdmission.AdmissionReview{
		TypeMeta: typeMeta,
		Response: &k8sAdmission.AdmissionResponse{
			UID:     uid,
			Allowed: false,
			Result: &metaV1.Status{
				Status:  "Failure",
				Message: err.Error(),
				Code:    code,
			},
		},
	}
}

func (api *WebhooksAPI) Create(c *contextmodel.ReqContext) response.Response {
	api.Log.Debug("admission controller create fired")
	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		api.Log.Error("error reading request body")
	}
	api.Log.Debug("create", "body", string(body))

	var rev k8sAdmission.AdmissionReview
	err = json.Unmarshal(body, &rev)
	if err != nil {
		api.Log.Error("error unmarshalling request body")
		return response.Error(500, "error unmarshalling request body", err)
	}

	obj := &PublicDashboard{}
	err = obj.UnmarshalJSON(rev.Request.Object.Raw)
	if err != nil {
		api.Log.Error("error unmarshalling request body")
		return response.Error(500, "error unmarshalling request body", err)
	}

	oldObj := &PublicDashboard{}
	err = oldObj.UnmarshalJSON(rev.Request.OldObject.Raw)
	if err != nil {
		api.Log.Error("error unmarshalling request body")
		return response.Error(500, "error unmarshalling request body", err)
	}

	// THIS IS BROKEN
	// TODO: convert error to k8sAdmission.AdmissionResponse and then to response.Response
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

	var resp *k8sAdmission.AdmissionReview

	err = api.ValidationController.Validate(c.Req.Context(), req)
	if err != nil {
		// auth status code to start, maybe change this to bad request
		resp = makeFailureAdmissionReview(rev.Request.UID, rev.TypeMeta, err, 403)
	} else {
		resp = makeSuccessfulAdmissionReview(rev.Request.UID, rev.TypeMeta, 200)
	}

	return response.JSON(int(resp.Response.Result.Code), resp)
}
