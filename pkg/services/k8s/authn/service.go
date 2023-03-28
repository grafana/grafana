package authn

import (
	"context"
	"errors"
	"fmt"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"io"
	"net/http"

	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"

	v1 "k8s.io/api/authentication/v1"
)

const GrafanaAdminK8sUser = "gl-admin"

type K8sAuthnAPI interface {
	Validate(c *contextmodel.ReqContext) response.Response
}

type K8sAuthnAPIImpl struct {
	RouteRegister routing.RouteRegister
	Features      *featuremgmt.FeatureManager
	ApiKey        *clients.APIKey
	Log           log.Logger
}

func ProvideService(
	rr routing.RouteRegister,
	apikeyService apikey.Service,
	userService user.Service,
	ac accesscontrol.AccessControl,
	features *featuremgmt.FeatureManager,
) *K8sAuthnAPIImpl {
	k8sAuthnAPI := &K8sAuthnAPIImpl{
		RouteRegister: rr,
		ApiKey:        clients.ProvideAPIKey(apikeyService, userService),
		Log:           log.New("k8s.webhooks.authn"),
	}

	k8sAuthnAPI.RegisterAPIEndpoints()

	return k8sAuthnAPI
}

func (api *K8sAuthnAPIImpl) RegisterAPIEndpoints() {
	api.RouteRegister.Post("/k8s/authn", api.Validate)
}

func (api *K8sAuthnAPIImpl) parseToken(c *contextmodel.ReqContext) (*authn.Identity, error) {
	req, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return nil, errors.New("could not parse the request body")
	}

	reqJSON, err := simplejson.NewJson(req)
	if err != nil {
		return nil, errors.New("could not read the request body as JSON")
	}

	token := reqJSON.Get("spec").Get("token").MustString()

	// K8s authn operates with a TokenReview construct. We use a slight hack below to set the Authorization header
	// to be able to use existing authn authentication methods
	c.Req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	return api.ApiKey.Authenticate(context.Background(), &authn.Request{
		HTTPRequest: c.Req,
	})
}

func (api *K8sAuthnAPIImpl) Validate(c *contextmodel.ReqContext) response.Response {
	identity, err := api.parseToken(c)

	if err != nil {
		api.Log.Error("K8s authn webhook failed to authenticate a request", "error", err)

		return api.sendDeniedV1Response("authorization token is invalid")
	} else {
		user := identity.SignedInUser()
		// We currently only allow glsa-prefixed serviceaccount tokens direct access to kube-apiserver
		if user.HasRole(roletype.RoleAdmin) && user.IsServiceAccount {
			// Extra fields are set up here as placeholders. It is just to demonstrate that
			// the authorization flow will have Username, Groups and additionally any other Extra fields as necessary
			extra := make(map[string]v1.ExtraValue)
			extra["token-name"] = []string{c.SignedInUser.Name}
			extra["org-role"] = []string{string(c.SignedInUser.OrgRole)}
			return api.sendV1Response(v1.UserInfo{
				// SignedInUser.Name could be anything, since it's just the token name
				// as entered by the user. We normalize it for subsequent use in the authorization flow.
				Username: GrafanaAdminK8sUser,
				Groups:   []string{"server-admins"},
				UID:      strconv.FormatInt(c.SignedInUser.UserID, 10),
				Extra:    extra,
			})
		}
	}

	return api.sendDeniedV1Response("authorization token does not have sufficient privileges")
}

func wrapStatusInTokenReview(status v1.TokenReviewStatus) v1.TokenReview {
	return v1.TokenReview{
		Status: status,
	}
}

func (api *K8sAuthnAPIImpl) sendDeniedV1Response(errorMsg string) response.Response {
	return response.JSON(http.StatusOK, wrapStatusInTokenReview(v1.TokenReviewStatus{
		Authenticated: false,
		Error:         errorMsg,
	}))
}

func (api *K8sAuthnAPIImpl) sendV1Response(userInfo v1.UserInfo) response.Response {
	return response.JSON(http.StatusOK, wrapStatusInTokenReview(v1.TokenReviewStatus{
		Authenticated: true,
		User:          userInfo,
	}))
}
