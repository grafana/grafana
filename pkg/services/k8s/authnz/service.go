package authnz

import (
	"context"
	"fmt"

	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
	authnV1 "k8s.io/api/authentication/v1"
	authzV1 "k8s.io/api/authorization/v1"
)

const GrafanaAdminK8sUser = "gl-admin"

type K8sAuthnzAPI struct {
	RouteRegister routing.RouteRegister
	accessControl accesscontrol.AccessControl
	apiKey        *clients.APIKey
	log           log.Logger
}

func ProvideService(
	rr routing.RouteRegister,
	apikeyService apikey.Service,
	userService user.Service,
	ac accesscontrol.AccessControl,
) *K8sAuthnzAPI {
	k8sAuthnzAPI := &K8sAuthnzAPI{
		RouteRegister: rr,
		accessControl: ac,
		apiKey:        clients.ProvideAPIKey(apikeyService, userService),
		log:           log.New("k8s.webhooks.authnz"),
	}

	k8sAuthnzAPI.registerAPIEndpoints()

	return k8sAuthnzAPI

}

func wrapStatusInTokenReview(status authnV1.TokenReviewStatus) authnV1.TokenReview {
	return authnV1.TokenReview{
		Status: status,
	}
}

func sendDeniedV1Response(errorMsg string) response.Response {
	return response.JSON(http.StatusOK, wrapStatusInTokenReview(authnV1.TokenReviewStatus{
		Authenticated: false,
		Error:         errorMsg,
	}))
}

func sendV1Response(userInfo authnV1.UserInfo) response.Response {
	return response.JSON(http.StatusOK, wrapStatusInTokenReview(authnV1.TokenReviewStatus{
		Authenticated: true,
		User:          userInfo,
	}))
}

func (api *K8sAuthnzAPI) registerAPIEndpoints() {
	api.RouteRegister.Post("/k8s/authn", api.authenticate)
	api.RouteRegister.Post("/k8s/authz", api.authorize)
}

func (api *K8sAuthnzAPI) parseToken(c *contextmodel.ReqContext) (*authn.Identity, error) {
	tokenReview := authnV1.TokenReview{}
	web.Bind(c.Req, &tokenReview)

	// K8s authn operates with a TokenReview construct. We use a slight hack below to set the Authorization header
	// to be able to use existing authentication methods in Grafana
	c.Req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", tokenReview.Spec.Token))
	return api.apiKey.Authenticate(context.Background(), &authn.Request{
		HTTPRequest: c.Req,
	})
}

func (api *K8sAuthnzAPI) authenticate(c *contextmodel.ReqContext) response.Response {
	identity, err := api.parseToken(c)

	if err != nil {
		api.log.Error("K8s authn webhook failed to authenticate a request", "error", err)

		return sendDeniedV1Response("authorization token is invalid")
	}

	user := identity.SignedInUser()
	// We currently only allow glsa-prefixed serviceaccount tokens direct access to kube-apiserver
	if user.HasRole(roletype.RoleAdmin) && user.IsServiceAccount {
		// Extra fields are set up here as placeholders. It is just to demonstrate that
		// the authorization flow will have Username, Groups and additionally any other Extra fields as necessary
		extra := make(map[string]authnV1.ExtraValue)
		extra["token-name"] = []string{c.SignedInUser.Name}
		extra["org-role"] = []string{string(c.SignedInUser.OrgRole)}
		return sendV1Response(authnV1.UserInfo{
			// SignedInUser.Name could be anything, since it's just the token name
			// as entered by the user. We normalize it for subsequent use in the authorization flow.
			Username: GrafanaAdminK8sUser,
			Groups:   []string{"server-admins"},
			UID:      strconv.FormatInt(c.SignedInUser.UserID, 10),
			Extra:    extra,
		})
	}

	return sendDeniedV1Response("authorization token does not have sufficient privileges")
}

func (api *K8sAuthnzAPI) authorize(c *contextmodel.ReqContext) response.Response {
	inputSAR := authzV1.SubjectAccessReview{}
	if err := web.Bind(c.Req, &inputSAR); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	// TODO: expand this logic so it isn't just limited to letting Admin through
	if inputSAR.Spec.User == GrafanaAdminK8sUser {
		return response.JSON(http.StatusOK, authzV1.SubjectAccessReview{
			Status: authzV1.SubjectAccessReviewStatus{
				Allowed: true,
			},
		})

	}

	return response.JSON(http.StatusOK, authzV1.SubjectAccessReview{
		Status: authzV1.SubjectAccessReviewStatus{
			Allowed: false,
			Denied:  true,
			Reason:  "specified user doesn't have Admin role",
		},
	})
}
