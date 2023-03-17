package authentication

import (
	"context"
	"errors"
	"fmt"

	// "github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"net/http"
)

type User struct {
	Username string   `json:"username,omitempty"`
	UID      string   `json:"uid,omitempty"`
	Groups   []string `json:"groups,omitempty"`
}

// Status indicates if user is authenticated or not
type Status struct {
	Authenticated bool  `json:"authenticated"`
	User          *User `json:"user,omitempty"`
}

type UserInfo struct {
	APIVersion string  `json:"apiVersion,omitempty"`
	Kind       string  `json:"kind,omitempty"`
	Status     *Status `json:"status,omitempty"`
}

// var _ Service = (*K8sAuthnAPIImpl)(nil)

/* type Service interface {
	services.Service
} */

type K8sAuthnAPI interface {
	validate(c *contextmodel.ReqContext) response.Response
}

type K8sAuthnAPIImpl struct {
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
) *K8sAuthnAPIImpl {
	k8sAuthnAPI := &K8sAuthnAPIImpl{
		RouteRegister: rr,
		AccessControl: ac,
		Log:           log.New("k8s.webhooks.authn"),
	}

	fmt.Println("Potato")
	k8sAuthnAPI.RegisterAPIEndpoints()

	return k8sAuthnAPI
}

func (api *K8sAuthnAPIImpl) RegisterAPIEndpoints() {
	api.RouteRegister.Post("/k8s/authn", api.validate)
}

func (api *K8sAuthnAPIImpl) validate(c *contextmodel.ReqContext) response.Response {
	// Get userInfo from validate service account token
	if c.SignedInUser.IsServiceAccount && c.SignedInUser.HasRole(roletype.RoleAdmin) {
		return api.sendV1BetaResponse(context.Background(), nil, &UserInfo{
			APIVersion: "authentication.k8s.io/v1beta1",
			Kind:       "TokenReview",
			Status: &Status{
				Authenticated: true,
				User: &User{
					Username: "admin",
					Groups:   []string{"server-admins"},
					UID:      "some-uid",
				},
			},
		})
	} else {
		var errRet error
		if c.LookupTokenErr != nil {
			errRet = c.LookupTokenErr
		} else {
			errRet = errors.New("Supplied token didn't have sufficient privileges to access the k8s apiserver")
		}
		return api.sendV1BetaResponse(context.Background(), errRet, &UserInfo{
			APIVersion: "authentication.k8s.io/v1beta1",
			Kind:       "TokenReview",
			Status: &Status{
				Authenticated: false,
			},
		})
	}
}

func (api *K8sAuthnAPIImpl) sendV1BetaResponse(context context.Context, err error, userInfo *UserInfo) response.Response {
	if err != nil {
		api.Log.Error(err.Error(), context)
		return response.JSON(http.StatusOK, userInfo)
	} else {
		return response.JSON(http.StatusOK, userInfo)
	}

}
