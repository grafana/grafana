package authnz

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
	v1 "k8s.io/api/authorization/v1"
)

type K8sAuthzAPI interface {
	Authorize(c *contextmodel.ReqContext) response.Response
}

type K8sAuthzAPIImpl struct {
	// *services.BasicService
	RouteRegister routing.RouteRegister
	AccessControl accesscontrol.AccessControl
	Log           log.Logger
}

func ProvideAuthz(
	rr routing.RouteRegister,
	ac accesscontrol.AccessControl,
) *K8sAuthzAPIImpl {
	k8sAuthzAPI := &K8sAuthzAPIImpl{
		RouteRegister: rr,
		AccessControl: ac,
		Log:           log.New("k8s.webhooks.authn"),
	}

	k8sAuthzAPI.RegisterAPIEndpoints()

	return k8sAuthzAPI
}

func (api *K8sAuthzAPIImpl) RegisterAPIEndpoints() {
	api.RouteRegister.Post("/k8s/authz", api.Authorize)
}

func (api *K8sAuthzAPIImpl) Authorize(c *contextmodel.ReqContext) response.Response {
	inputSAR := v1.SubjectAccessReview{}
	web.Bind(c.Req, &inputSAR)

	// TODO: expand this logic so it isn't just limited to letting Admin through
	if inputSAR.Spec.User == GrafanaAdminK8sUser {
		return response.JSON(http.StatusOK, v1.SubjectAccessReview{
			Status: v1.SubjectAccessReviewStatus{
				Allowed: true,
			},
		})

	}

	return response.JSON(http.StatusOK, v1.SubjectAccessReview{
		Status: v1.SubjectAccessReviewStatus{
			Allowed: false,
			Denied:  true,
			Reason:  "specified user doesn't have Admin role",
		},
	})
}
