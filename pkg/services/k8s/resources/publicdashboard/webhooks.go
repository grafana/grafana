package publicdashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	//jsonpatch "github.com/evanphx/json-patch"
	k8sTypes "k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/k8s/admission"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	k8sAdmission "k8s.io/api/admission/v1"
	admissionregistrationV1 "k8s.io/api/admissionregistration/v1"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type WebhooksAPI struct {
	RouteRegister        routing.RouteRegister
	AccessControl        accesscontrol.AccessControl
	Features             *featuremgmt.FeatureManager
	Log                  log.Logger
	ValidationController admission.ValidatingAdmissionController
	MutationController   admission.MutatingAdmissionController
}

var ValidationWebhookConfigs = []client.ShortWebhookConfig{
	{
		Resource:   "publicdashboard",
		Operations: []admissionregistrationV1.OperationType{admissionregistrationV1.Create},
		Url:        "https://host.docker.internal:3443/k8s/publicdashboards/admission/create",
		Timeout:    int32(5),
	},
}

var MutationWebhookConfigs = []client.ShortWebhookConfig{
	{
		Resource:   "publicdashboard",
		Operations: []admissionregistrationV1.OperationType{admissionregistrationV1.Create},
		Url:        "https://host.docker.internal:3443/k8s/publicdashboards/mutation/create",
		Timeout:    int32(5),
	},
}

func ProvideWebhooks(
	rr routing.RouteRegister,
	clientset *client.Clientset,
	ac accesscontrol.AccessControl,
	features *featuremgmt.FeatureManager,
	vc admission.ValidatingAdmissionController,
	mc admission.MutatingAdmissionController,
) *WebhooksAPI {
	webhooksAPI := &WebhooksAPI{
		RouteRegister:        rr,
		AccessControl:        ac,
		Log:                  log.New("k8s.publicdashboard.webhooks.admission.create"),
		ValidationController: vc,
		MutationController:   mc,
	}

	// Register webhooks on grafana api server
	webhooksAPI.RegisterAPIEndpoints()

	// Register admission hooks with k8s api server
	err := clientset.RegisterValidation(context.Background(), ValidationWebhookConfigs)
	if err != nil {
		panic(err)
	}

	// Register mutation hooks with k8s api server
	err = clientset.RegisterMutation(context.Background(), MutationWebhookConfigs)
	if err != nil {
		panic(err)
	}

	return webhooksAPI
}

func (api *WebhooksAPI) RegisterAPIEndpoints() {
	api.RouteRegister.Post("/k8s/publicdashboards/admission/create", api.AdmissionCreate)
	api.RouteRegister.Post("/k8s/publicdashboards/mutation/create", api.MutationCreate)
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

func (api *WebhooksAPI) AdmissionCreate(c *contextmodel.ReqContext) response.Response {
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

func (api *WebhooksAPI) MutationCreate(c *contextmodel.ReqContext) response.Response {
	fmt.Println("POTATO")
	api.Log.Debug("mutation controller create fired")
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

	// Current state of object
	obj := &PublicDashboard{}
	err = obj.UnmarshalJSON(rev.Request.Object.Raw)
	if err != nil {
		api.Log.Error("error unmarshalling request body")
		return response.Error(500, "error unmarshalling request body", err)
	}

	// Previous state of object for update or delete
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
	mutationResponse, err := api.MutationController.Mutate(c.Req.Context(), req)
	if err != nil {
		// auth status code to start, maybe change this to bad request
		resp = makeFailureAdmissionReview(rev.Request.UID, rev.TypeMeta, err, 403)
	} else {
		resp = makeSuccessfulAdmissionReview(rev.Request.UID, rev.TypeMeta, 200)
	}

	// compare original and defaulted version
	//ops, err := jsonpatch.CreatePatch(rev.Request.OldObject.Raw, rev.Request.Object.Raw)
	if err != nil {
		//responsewriters.InternalError(w, req, fmt.Errorf("unexpected diff error: %v", err))
		//return
	}
	//review.Response.Patch, err = json.Marshal(ops)
	if err != nil {
		//responsewriters.InternalError(w, req, fmt.Errorf("unexpected patch encoding error: %v", err))
		//return
	}

	return response.JSON(int(resp.Response.Result.Code), mutationResponse)
}

func makeSuccessfulMutationReview(uid k8sTypes.UID, typeMeta metaV1.TypeMeta, code int32) *k8sAdmission.AdmissionReview {

	// patch data: json marshalled to bytes -> base64 encoded

	return &k8sAdmission.AdmissionReview{
		TypeMeta: typeMeta,
		Response: &k8sAdmission.AdmissionResponse{
			UID:       uid,
			Allowed:   true,
			PatchType: pontificate(k8sAdmission.PatchTypeJSONPatch),
			Result: &metaV1.Status{
				Status: "Success",
				Code:   code,
			},
		},
	}
}

// lol
func pontificate[T any](s T) *T {
	return &s
}

//func makeFailureMutationReview(uid k8sTypes.UID, typeMeta metaV1.TypeMeta, err error, code int32) *k8sAdmission.AdmissionReview {
//return &k8sAdmission.AdmissionReview{
//TypeMeta: typeMeta,
//Response: &k8sAdmission.AdmissionResponse{
//UID:     uid,
//Allowed: false,
//Result: &metaV1.Status{
//Status:  "Failure",
//Message: err.Error(),
//Code:    code,
//},
//},
//}
//}
