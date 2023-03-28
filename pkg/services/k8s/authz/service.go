package authz

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	"github.com/grafana/grafana/pkg/services/k8s/authn"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"io"
	"net/http"
)

type AuthorizationResponse struct {
	APIVersion string               `json:"apiVersion,omitempty"`
	Kind       string               `json:"kind,omitempty"`
	Status     *AuthorizationStatus `json:"status,omitempty"`
}

type AuthorizationStatus struct {
	Allowed bool   `json:"allowed,omitempty"`
	Denied  bool   `json:"denied,omitempty"`
	Reason  string `json:"reason,omitempty"`
}

type K8sAuthzAPI interface {
	Authorize(c *contextmodel.ReqContext) response.Response
}

type K8sAuthzAPIImpl struct {
	// *services.BasicService
	RouteRegister routing.RouteRegister
	AccessControl accesscontrol.AccessControl
	Features      *featuremgmt.FeatureManager
	ApiKey        clients.APIKey
	Log           log.Logger
}

func ProvideService(
	rr routing.RouteRegister,
	ac accesscontrol.AccessControl,
	features *featuremgmt.FeatureManager,
) *K8sAuthzAPIImpl {
	k8sAuthnAPI := &K8sAuthzAPIImpl{
		RouteRegister: rr,
		AccessControl: ac,
		Log:           log.New("k8s.webhooks.authz"),
	}

	k8sAuthnAPI.RegisterAPIEndpoints()

	return k8sAuthnAPI
}

func (api *K8sAuthzAPIImpl) RegisterAPIEndpoints() {
	api.RouteRegister.Post("/k8s/authz", api.Authorize)
}

func (api *K8sAuthzAPIImpl) makeDenied(allowed bool, denied bool, reason string) *AuthorizationResponse {
	return &AuthorizationResponse{
		APIVersion: "authorization.k8s.io/v1",
		Kind:       "SubjectAccessReview",
		Status: &AuthorizationStatus{
			Allowed: allowed,
			Denied:  denied,
			Reason:  reason,
		},
	}
}

func (api *K8sAuthzAPIImpl) makeAllowed() *AuthorizationResponse {
	return &AuthorizationResponse{
		APIVersion: "authorization.k8s.io/v1",
		Kind:       "SubjectAccessReview",
		Status: &AuthorizationStatus{
			Allowed: true,
		},
	}
}

func (api *K8sAuthzAPIImpl) Authorize(c *contextmodel.ReqContext) response.Response {
	req, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.JSON(http.StatusOK, api.makeDenied(false, false, "Could not read the HTTP request"))
	}

	reqJSON, err := simplejson.NewJson(req)
	if err != nil {
		return response.JSON(http.StatusOK, api.makeDenied(false, false, "Could not marshall the HTTP request into JSON"))
	}

	metadata := reqJSON.Get("metadata")
	api.Log.Log("metadata", metadata)

	spec := reqJSON.Get("spec")
	spec.Get("resourceAttributes").MustMap()
	api.Log.Log("resourceAttributes", spec.Get("resourceAttributes"))
	user := spec.Get("user").MustString()
	spec.Get("groups").MustStringArray()
	api.Log.Log("groups", spec.Get("groups"))

	subjectAccessReview := AuthorizationResponse{
		APIVersion: "authorization.k8s.io/v1",
		Kind:       "SubjectAccessReview",
	}
	if user == authn.GrafanaAdminK8sUser {
		return response.JSON(http.StatusOK, api.makeAllowed())
	} else {
		return response.JSON(http.StatusOK, api.makeDenied(false, false, "Provided service account doesn't have Admin role"))
	}
	return response.JSON(http.StatusOK, subjectAccessReview)
}
