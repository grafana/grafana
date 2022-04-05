package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	domain "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

type ProvisioningSrv struct {
	log                 log.Logger
	policies            NotificationPolicyService
	contactpointService ContactpointService
}

type ContactpointService interface {
	GetContactPoints(orgID int64) ([]domain.EmbeddedContactPoint, error)
	CreateContactPoint(orgID int64, contactPoint domain.EmbeddedContactPoint) (domain.EmbeddedContactPoint, error)
	UpdateContactPoint(orgID int64, contactPoint domain.EmbeddedContactPoint) error
	DeleteContactPoint(orgID int64, uid string) error
}

type NotificationPolicyService interface {
	GetPolicyTree(ctx context.Context, orgID int64) (provisioning.EmbeddedRoutingTree, error)
	UpdatePolicyTree(ctx context.Context, orgID int64, tree apimodels.Route, p domain.Provenance) error
}

func (srv *ProvisioningSrv) RouteGetPolicyTree(c *models.ReqContext) response.Response {
	policies, err := srv.policies.GetPolicyTree(c.Req.Context(), c.OrgId)
	if errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
		return ErrResp(http.StatusNotFound, err, "")
	}
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	return response.JSON(http.StatusOK, policies)
}

func (srv *ProvisioningSrv) RoutePostPolicyTree(c *models.ReqContext, tree apimodels.Route) response.Response {
	// TODO: lift validation out of definitions.Rotue.UnmarshalJSON and friends into a dedicated validator.
	err := srv.policies.UpdatePolicyTree(c.Req.Context(), c.OrgId, tree, domain.ProvenanceApi)
	if errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
		return ErrResp(http.StatusNotFound, err, "")
	}
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "policies updated"})
}

func (srv *ProvisioningSrv) RouteGetContactpoints(c *models.ReqContext) response.Response {
	cps, err := srv.contactpointService.GetContactPoints(c.OrgId)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, cps)
}

func (srv *ProvisioningSrv) RoutePostContactpoint(c *models.ReqContext, cp apimodels.Contactpoint) response.Response {
	contactPoint, err := srv.contactpointService.CreateContactPoint(c.OrgId, domain.EmbeddedContactPoint(cp))
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, contactPoint)
}

func (srv *ProvisioningSrv) RoutePutContactpoints(c *models.ReqContext, cp apimodels.Contactpoint) response.Response {
	err := srv.contactpointService.UpdateContactPoint(c.OrgId, domain.EmbeddedContactPoint(cp))
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, "")
}

func (srv *ProvisioningSrv) RouteDeleteContactpoint(c *models.ReqContext) response.Response {
	cpID := web.Params(c.Req)[":ID"]
	err := srv.contactpointService.DeleteContactPoint(c.OrgId, cpID)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, "")
}
