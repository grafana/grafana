package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/services"
	"github.com/grafana/grafana/pkg/util"
)

type ProvisioningSrv struct {
	log      log.Logger
	policies *services.NotificationPolicyService
}

func (srv *ProvisioningSrv) RouteGetPolicyTree(c *models.ReqContext) response.Response {
	policies, err := srv.policies.GetPolicyTree(c.Req.Context(), c.OrgId)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, policies)
}

func (srv *ProvisioningSrv) RoutePostPolicyTree(c *models.ReqContext, tree apimodels.Route) response.Response {
	_, err := srv.policies.UpdatePolicyTree(c.Req.Context(), c.OrgId, tree)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusCreated, util.DynMap{"message": "policies updated"})
}
