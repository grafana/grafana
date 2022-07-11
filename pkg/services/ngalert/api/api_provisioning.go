package api

import (
	"context"
	"errors"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	alerting_models "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

type ProvisioningSrv struct {
	log                 log.Logger
	policies            NotificationPolicyService
	contactPointService ContactPointService
	alertRules          AlertRuleService
	folderService       dashboards.FolderService
}

type ContactPointService interface {
	GetContactPoints(ctx context.Context, orgID int64) ([]definitions.EmbeddedContactPoint, error)
	CreateContactPoint(ctx context.Context, orgID int64, contactPoint definitions.EmbeddedContactPoint, p alerting_models.Provenance) (definitions.EmbeddedContactPoint, error)
	UpdateContactPoint(ctx context.Context, orgID int64, contactPoint definitions.EmbeddedContactPoint, p alerting_models.Provenance) error
	DeleteContactPoint(ctx context.Context, orgID int64, uid string) error
}

type NotificationPolicyService interface {
	GetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, error)
	UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route, p alerting_models.Provenance) error
}

type AlertRuleService interface {
	GetAlertRule(ctx context.Context, orgID int64, ruleUID string) (alerting_models.AlertRule, alerting_models.Provenance, error)
	CreateAlertRule(ctx context.Context, rule alerting_models.AlertRule, provenance alerting_models.Provenance) (alerting_models.AlertRule, error)
	UpdateAlertRule(ctx context.Context, rule alerting_models.AlertRule, provenance alerting_models.Provenance) (alerting_models.AlertRule, error)
	DeleteAlertRule(ctx context.Context, orgID int64, ruleUID string, provenance alerting_models.Provenance) error
	UpdateRuleGroup(ctx context.Context, orgID int64, folderUID, rulegroup string, interval int64) error
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

func (srv *ProvisioningSrv) RoutePostPolicyTree(c *models.ReqContext, tree definitions.Route) response.Response {
	// TODO: lift validation out of definitions.Rotue.UnmarshalJSON and friends into a dedicated validator.
	err := srv.policies.UpdatePolicyTree(c.Req.Context(), c.OrgId, tree, alerting_models.ProvenanceAPI)
	if errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
		return ErrResp(http.StatusNotFound, err, "")
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

func (srv *ProvisioningSrv) RoutePostContactPoint(c *models.ReqContext, cp definitions.EmbeddedContactPoint) response.Response {
	// TODO: provenance is hardcoded for now, change it later to make it more flexible
	contactPoint, err := srv.contactPointService.CreateContactPoint(c.Req.Context(), c.OrgId, cp, alerting_models.ProvenanceAPI)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusAccepted, contactPoint)
}

func (srv *ProvisioningSrv) RoutePutContactPoint(c *models.ReqContext, cp definitions.EmbeddedContactPoint) response.Response {
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

func (srv *ProvisioningSrv) RouteRouteGetAlertRule(c *models.ReqContext, UID string) response.Response {
	rule, provenace, err := srv.alertRules.GetAlertRule(c.Req.Context(), c.OrgId, UID)
	if errors.Is(err, alerting_models.ErrAlertRuleNotFound) {
		return ErrResp(http.StatusNotFound, err, "")
	}
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, definitions.NewAlertRule(rule, provenace))
}

func (srv *ProvisioningSrv) RoutePostAlertRule(c *models.ReqContext, ar definitions.AlertRule) response.Response {
	//LOGZ.IO GRAFANA CHANGE :: DEV-32720 - Take alert rule organization from auth context and not from req body
	ar.OrgID = c.OrgId
	createdAlertRule, err := srv.alertRules.CreateAlertRule(c.Req.Context(), ar.UpstreamModel(), alerting_models.ProvenanceAPI)
	//LOGZ.IO GRAFANA CHANGE :: END
	if errors.Is(err, alerting_models.ErrAlertRuleFailedValidation) {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	ar.ID = createdAlertRule.ID
	ar.UID = createdAlertRule.UID
	ar.Updated = createdAlertRule.Updated
	return response.JSON(http.StatusCreated, ar)
}

func (srv *ProvisioningSrv) RoutePutAlertRule(c *models.ReqContext, ar definitions.AlertRule, UID string) response.Response {
	//LOGZ.IO GRAFANA CHANGE :: DEV-32720 - Take alert rule organization from auth context and not from req body
	ar.UID = UID
	ar.OrgID = c.OrgId
	updatedAlertRule, err := srv.alertRules.UpdateAlertRule(c.Req.Context(), ar.UpstreamModel(), alerting_models.ProvenanceAPI)
	//LOGZ.IO GRAFANA CHANGE :: END
	if errors.Is(err, alerting_models.ErrAlertRuleNotFound) {
		return ErrResp(http.StatusNotFound, err, "")
	}
	if errors.Is(err, alerting_models.ErrAlertRuleFailedValidation) {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	ar.Updated = updatedAlertRule.Updated
	ar.ID = updatedAlertRule.ID
	return response.JSON(http.StatusOK, ar)
}

func (srv *ProvisioningSrv) RouteDeleteAlertRule(c *models.ReqContext, UID string) response.Response {
	err := srv.alertRules.DeleteAlertRule(c.Req.Context(), c.OrgId, UID, alerting_models.ProvenanceAPI)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusNoContent, "")
}

func (srv *ProvisioningSrv) RoutePutAlertRuleGroup(c *models.ReqContext, ag definitions.AlertRuleGroup, folderUID string, group string) response.Response {
	err := srv.alertRules.UpdateRuleGroup(c.Req.Context(), c.OrgId, folderUID, group, ag.Interval)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, ag)
}
