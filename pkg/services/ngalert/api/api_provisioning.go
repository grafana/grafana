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

const namePathParam = ":name"
const idPathParam = ":ID"

type ProvisioningSrv struct {
	log                 log.Logger
	policies            NotificationPolicyService
	contactPointService ContactPointService
	templates           TemplateService
	muteTimings         MuteTimingService
}

type ContactPointService interface {
	GetContactPoints(ctx context.Context, orgID int64) ([]apimodels.EmbeddedContactPoint, error)
	CreateContactPoint(ctx context.Context, orgID int64, contactPoint apimodels.EmbeddedContactPoint, p alerting_models.Provenance) (apimodels.EmbeddedContactPoint, error)
	UpdateContactPoint(ctx context.Context, orgID int64, contactPoint apimodels.EmbeddedContactPoint, p alerting_models.Provenance) error
	DeleteContactPoint(ctx context.Context, orgID int64, uid string) error
}

type TemplateService interface {
	GetTemplates(ctx context.Context, orgID int64) (map[string]string, error)
	SetTemplate(ctx context.Context, orgID int64, tmpl apimodels.MessageTemplate) (apimodels.MessageTemplate, error)
	DeleteTemplate(ctx context.Context, orgID int64, name string) error
}

type NotificationPolicyService interface {
	GetPolicyTree(ctx context.Context, orgID int64) (apimodels.Route, error)
	UpdatePolicyTree(ctx context.Context, orgID int64, tree apimodels.Route, p alerting_models.Provenance) error
}

type MuteTimingService interface {
	GetMuteTimings(ctx context.Context, orgID int64) ([]apimodels.MuteTimeInterval, error)
	CreateMuteTiming(ctx context.Context, mt apimodels.MuteTimeInterval, orgID int64) (*apimodels.MuteTimeInterval, error)
	UpdateMuteTiming(ctx context.Context, mt apimodels.MuteTimeInterval, orgID int64) (*apimodels.MuteTimeInterval, error)
	DeleteMuteTiming(ctx context.Context, name string, orgID int64) error
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

func (srv *ProvisioningSrv) RoutePutPolicyTree(c *models.ReqContext, tree apimodels.Route) response.Response {
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
	id := pathParam(c, idPathParam)
	cp.UID = id
	err := srv.contactPointService.UpdateContactPoint(c.Req.Context(), c.OrgId, cp, alerting_models.ProvenanceAPI)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusAccepted, util.DynMap{"message": "contactpoint updated"})
}

func (srv *ProvisioningSrv) RouteDeleteContactPoint(c *models.ReqContext) response.Response {
	cpID := pathParam(c, idPathParam)
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
	name := pathParam(c, namePathParam)
	templates, err := srv.templates.GetTemplates(c.Req.Context(), c.OrgId)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	if tmpl, ok := templates[name]; ok {
		return response.JSON(http.StatusOK, apimodels.MessageTemplate{Name: name, Template: tmpl})
	}
	return response.Empty(http.StatusNotFound)
}

func (srv *ProvisioningSrv) RoutePutTemplate(c *models.ReqContext, body apimodels.MessageTemplateContent) response.Response {
	name := pathParam(c, namePathParam)
	tmpl := apimodels.MessageTemplate{
		Name:       name,
		Template:   body.Template,
		Provenance: alerting_models.ProvenanceAPI,
	}
	modified, err := srv.templates.SetTemplate(c.Req.Context(), c.OrgId, tmpl)
	if err != nil {
		if errors.Is(err, provisioning.ErrValidation) {
			return ErrResp(http.StatusBadRequest, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusAccepted, modified)
}

func (srv *ProvisioningSrv) RouteDeleteTemplate(c *models.ReqContext) response.Response {
	name := pathParam(c, namePathParam)
	err := srv.templates.DeleteTemplate(c.Req.Context(), c.OrgId, name)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusNoContent, nil)
}

func (srv *ProvisioningSrv) RouteGetMuteTiming(c *models.ReqContext) response.Response {
	name := pathParam(c, namePathParam)
	timings, err := srv.muteTimings.GetMuteTimings(c.Req.Context(), c.OrgId)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	for _, timing := range timings {
		if name == timing.Name {
			return response.JSON(http.StatusOK, timing)
		}
	}
	return response.Empty(http.StatusNotFound)
}

func (srv *ProvisioningSrv) RouteGetMuteTimings(c *models.ReqContext) response.Response {
	timings, err := srv.muteTimings.GetMuteTimings(c.Req.Context(), c.OrgId)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, timings)
}

func (srv *ProvisioningSrv) RoutePostMuteTiming(c *models.ReqContext, mt apimodels.MuteTimeInterval) response.Response {
	created, err := srv.muteTimings.CreateMuteTiming(c.Req.Context(), mt, c.OrgId)
	if err != nil {
		if errors.Is(err, provisioning.ErrValidation) {
			return ErrResp(http.StatusBadRequest, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusCreated, created)
}

func (srv *ProvisioningSrv) RoutePutMuteTiming(c *models.ReqContext, mt apimodels.MuteTimeInterval) response.Response {
	name := pathParam(c, namePathParam)
	mt.Name = name
	updated, err := srv.muteTimings.UpdateMuteTiming(c.Req.Context(), mt, c.OrgId)
	if err != nil {
		if errors.Is(err, provisioning.ErrValidation) {
			return ErrResp(http.StatusBadRequest, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	if updated == nil {
		return response.Empty(http.StatusNotFound)
	}
	return response.JSON(http.StatusAccepted, updated)
}

func (srv *ProvisioningSrv) RouteDeleteMuteTiming(c *models.ReqContext) response.Response {
	name := pathParam(c, namePathParam)
	err := srv.muteTimings.DeleteMuteTiming(c.Req.Context(), name, c.OrgId)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusNoContent, nil)
}

func pathParam(c *models.ReqContext, param string) string {
	return web.Params(c.Req)[param]
}
