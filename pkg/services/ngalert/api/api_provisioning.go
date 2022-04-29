package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	alerting_models "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

type ProvisioningSrv struct {
	log                 log.Logger
	policies            NotificationPolicyService
	contactPointService ContactPointService
	templates           TemplateService
}

type ContactPointService interface {
	GetContactPoints(ctx context.Context, orgID int64) ([]apimodels.EmbeddedContactPoint, error)
	CreateContactPoint(ctx context.Context, orgID int64, contactPoint apimodels.EmbeddedContactPoint, p alerting_models.Provenance) (apimodels.EmbeddedContactPoint, error)
	UpdateContactPoint(ctx context.Context, orgID int64, contactPoint apimodels.EmbeddedContactPoint, p alerting_models.Provenance) error
	DeleteContactPoint(ctx context.Context, orgID int64, uid string) error
}

type TemplateService interface {
	GetTemplates(ctx context.Context, orgID int64) (map[string]string, error)
}

type NotificationPolicyService interface {
	GetPolicyTree(ctx context.Context, orgID int64) (apimodels.Route, error)
	UpdatePolicyTree(ctx context.Context, orgID int64, tree apimodels.Route, p alerting_models.Provenance) error
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
	err := srv.policies.UpdatePolicyTree(c.Req.Context(), c.OrgId, tree, alerting_models.ProvenanceAPI)
	if errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
		return ErrResp(http.StatusNotFound, err, "")
	}
	if errors.Is(err, provisioning.ErrValidation) {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "policies updated"})
}

func (srv *ProvisioningSrv) RouteGetContactPoints(c *models.ReqContext) response.Response {
	cps, err := srv.contactPointService.GetContactPoints(c.Req.Context(), c.OrgId)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, cps)
}

func (srv *ProvisioningSrv) RoutePostContactPoint(c *models.ReqContext, cp apimodels.EmbeddedContactPoint) response.Response {
	// TODO: provenance is hardcoded for now, change it later to make it more flexible
	contactPoint, err := srv.contactPointService.CreateContactPoint(c.Req.Context(), c.OrgId, cp, alerting_models.ProvenanceAPI)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusAccepted, contactPoint)
}

func (srv *ProvisioningSrv) RoutePutContactPoint(c *models.ReqContext, cp apimodels.EmbeddedContactPoint) response.Response {
	err := srv.contactPointService.UpdateContactPoint(c.Req.Context(), c.OrgId, cp, alerting_models.ProvenanceAPI)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusAccepted, util.DynMap{"message": "contactpoint updated"})
}

func (srv *ProvisioningSrv) RouteDeleteContactPoint(c *models.ReqContext) response.Response {
	cpID := web.Params(c.Req)[":ID"]
	err := srv.contactPointService.DeleteContactPoint(c.Req.Context(), c.OrgId, cpID)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusAccepted, util.DynMap{"message": "contactpoint deleted"})
}

func (srv *ProvisioningSrv) RouteGetTemplates(c *models.ReqContext) response.Response {
	templates, err := srv.templates.GetTemplates(c.Req.Context(), c.OrgId)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	result := make([]apimodels.MessageTemplate, 0, len(templates))
	for k, v := range templates {
		result = append(result, apimodels.MessageTemplate{Name: k, Template: v})
	}
	return response.JSON(http.StatusOK, result)
}

func (srv *ProvisioningSrv) RouteGetTemplate(c *models.ReqContext) response.Response {
	id := web.Params(c.Req)[":ID"]
	templates, err := srv.templates.GetTemplates(c.Req.Context(), c.OrgId)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	if tmpl, ok := templates[id]; ok {
		return response.JSON(http.StatusOK, apimodels.MessageTemplate{Name: id, Template: tmpl})
	}
	return response.Empty(http.StatusNotFound)
}
