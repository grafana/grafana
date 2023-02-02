package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	alerting_models "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/provisioning/alerting/file"
	"github.com/grafana/grafana/pkg/util"
)

const disableProvenanceHeaderName = "X-Disable-Provenance"

type ProvisioningSrv struct {
	log                 log.Logger
	policies            NotificationPolicyService
	contactPointService ContactPointService
	templates           TemplateService
	muteTimings         MuteTimingService
	alertRules          AlertRuleService
}

type ContactPointService interface {
	GetContactPoints(ctx context.Context, q provisioning.ContactPointQuery) ([]definitions.EmbeddedContactPoint, error)
	CreateContactPoint(ctx context.Context, orgID int64, contactPoint definitions.EmbeddedContactPoint, p alerting_models.Provenance) (definitions.EmbeddedContactPoint, error)
	UpdateContactPoint(ctx context.Context, orgID int64, contactPoint definitions.EmbeddedContactPoint, p alerting_models.Provenance) error
	DeleteContactPoint(ctx context.Context, orgID int64, uid string) error
}

type TemplateService interface {
	GetTemplates(ctx context.Context, orgID int64) (map[string]string, error)
	SetTemplate(ctx context.Context, orgID int64, tmpl definitions.NotificationTemplate) (definitions.NotificationTemplate, error)
	DeleteTemplate(ctx context.Context, orgID int64, name string) error
}

type NotificationPolicyService interface {
	GetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, error)
	UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route, p alerting_models.Provenance) error
	ResetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, error)
}

type MuteTimingService interface {
	GetMuteTimings(ctx context.Context, orgID int64) ([]definitions.MuteTimeInterval, error)
	CreateMuteTiming(ctx context.Context, mt definitions.MuteTimeInterval, orgID int64) (*definitions.MuteTimeInterval, error)
	UpdateMuteTiming(ctx context.Context, mt definitions.MuteTimeInterval, orgID int64) (*definitions.MuteTimeInterval, error)
	DeleteMuteTiming(ctx context.Context, name string, orgID int64) error
}

type AlertRuleService interface {
	GetAlertRules(ctx context.Context, orgID int64) ([]*alerting_models.AlertRule, error)
	GetAlertRule(ctx context.Context, orgID int64, ruleUID string) (alerting_models.AlertRule, alerting_models.Provenance, error)
	CreateAlertRule(ctx context.Context, rule alerting_models.AlertRule, provenance alerting_models.Provenance, userID int64) (alerting_models.AlertRule, error)
	UpdateAlertRule(ctx context.Context, rule alerting_models.AlertRule, provenance alerting_models.Provenance) (alerting_models.AlertRule, error)
	DeleteAlertRule(ctx context.Context, orgID int64, ruleUID string, provenance alerting_models.Provenance) error
	GetRuleGroup(ctx context.Context, orgID int64, folder, group string) (alerting_models.AlertRuleGroup, error)
	ReplaceRuleGroup(ctx context.Context, orgID int64, group alerting_models.AlertRuleGroup, userID int64, provenance alerting_models.Provenance) error
	GetAlertRuleWithFolderTitle(ctx context.Context, orgID int64, ruleUID string) (provisioning.AlertRuleWithFolderTitle, error)
	GetAlertRuleGroupWithFolderTitle(ctx context.Context, orgID int64, folder, group string) (file.AlertRuleGroupWithFolderTitle, error)
	GetAlertGroupsWithFolderTitle(ctx context.Context, orgID int64) ([]file.AlertRuleGroupWithFolderTitle, error)
}

func (srv *ProvisioningSrv) RouteGetPolicyTree(c *contextmodel.ReqContext) response.Response {
	policies, err := srv.policies.GetPolicyTree(c.Req.Context(), c.OrgID)
	if errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
		return ErrResp(http.StatusNotFound, err, "")
	}
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	return response.JSON(http.StatusOK, policies)
}

func (srv *ProvisioningSrv) RoutePutPolicyTree(c *contextmodel.ReqContext, tree definitions.Route) response.Response {
	err := srv.policies.UpdatePolicyTree(c.Req.Context(), c.OrgID, tree, alerting_models.ProvenanceAPI)
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

func (srv *ProvisioningSrv) RouteResetPolicyTree(c *contextmodel.ReqContext) response.Response {
	tree, err := srv.policies.ResetPolicyTree(c.Req.Context(), c.OrgID)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusAccepted, tree)
}

func (srv *ProvisioningSrv) RouteGetContactPoints(c *contextmodel.ReqContext) response.Response {
	q := provisioning.ContactPointQuery{
		Name:  c.Query("name"),
		OrgID: c.OrgID,
	}
	cps, err := srv.contactPointService.GetContactPoints(c.Req.Context(), q)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, cps)
}

func (srv *ProvisioningSrv) RoutePostContactPoint(c *contextmodel.ReqContext, cp definitions.EmbeddedContactPoint) response.Response {
	// TODO: provenance is hardcoded for now, change it later to make it more flexible
	contactPoint, err := srv.contactPointService.CreateContactPoint(c.Req.Context(), c.OrgID, cp, alerting_models.ProvenanceAPI)
	if errors.Is(err, provisioning.ErrValidation) {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusAccepted, contactPoint)
}

func (srv *ProvisioningSrv) RoutePutContactPoint(c *contextmodel.ReqContext, cp definitions.EmbeddedContactPoint, UID string) response.Response {
	cp.UID = UID
	err := srv.contactPointService.UpdateContactPoint(c.Req.Context(), c.OrgID, cp, alerting_models.ProvenanceAPI)
	if errors.Is(err, provisioning.ErrValidation) {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	if errors.Is(err, provisioning.ErrNotFound) {
		return ErrResp(http.StatusNotFound, err, "")
	}
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusAccepted, util.DynMap{"message": "contactpoint updated"})
}

func (srv *ProvisioningSrv) RouteDeleteContactPoint(c *contextmodel.ReqContext, UID string) response.Response {
	err := srv.contactPointService.DeleteContactPoint(c.Req.Context(), c.OrgID, UID)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusAccepted, util.DynMap{"message": "contactpoint deleted"})
}

func (srv *ProvisioningSrv) RouteGetTemplates(c *contextmodel.ReqContext) response.Response {
	templates, err := srv.templates.GetTemplates(c.Req.Context(), c.OrgID)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	result := make([]definitions.NotificationTemplate, 0, len(templates))
	for k, v := range templates {
		result = append(result, definitions.NotificationTemplate{Name: k, Template: v})
	}
	return response.JSON(http.StatusOK, result)
}

func (srv *ProvisioningSrv) RouteGetTemplate(c *contextmodel.ReqContext, name string) response.Response {
	templates, err := srv.templates.GetTemplates(c.Req.Context(), c.OrgID)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	if tmpl, ok := templates[name]; ok {
		return response.JSON(http.StatusOK, definitions.NotificationTemplate{Name: name, Template: tmpl})
	}
	return response.Empty(http.StatusNotFound)
}

func (srv *ProvisioningSrv) RoutePutTemplate(c *contextmodel.ReqContext, body definitions.NotificationTemplateContent, name string) response.Response {
	tmpl := definitions.NotificationTemplate{
		Name:       name,
		Template:   body.Template,
		Provenance: alerting_models.ProvenanceAPI,
	}
	modified, err := srv.templates.SetTemplate(c.Req.Context(), c.OrgID, tmpl)
	if err != nil {
		if errors.Is(err, provisioning.ErrValidation) {
			return ErrResp(http.StatusBadRequest, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusAccepted, modified)
}

func (srv *ProvisioningSrv) RouteDeleteTemplate(c *contextmodel.ReqContext, name string) response.Response {
	err := srv.templates.DeleteTemplate(c.Req.Context(), c.OrgID, name)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusNoContent, nil)
}

func (srv *ProvisioningSrv) RouteGetMuteTiming(c *contextmodel.ReqContext, name string) response.Response {
	timings, err := srv.muteTimings.GetMuteTimings(c.Req.Context(), c.OrgID)
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

func (srv *ProvisioningSrv) RouteGetMuteTimings(c *contextmodel.ReqContext) response.Response {
	timings, err := srv.muteTimings.GetMuteTimings(c.Req.Context(), c.OrgID)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, timings)
}

func (srv *ProvisioningSrv) RoutePostMuteTiming(c *contextmodel.ReqContext, mt definitions.MuteTimeInterval) response.Response {
	mt.Provenance = alerting_models.ProvenanceAPI
	created, err := srv.muteTimings.CreateMuteTiming(c.Req.Context(), mt, c.OrgID)
	if err != nil {
		if errors.Is(err, provisioning.ErrValidation) {
			return ErrResp(http.StatusBadRequest, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusCreated, created)
}

func (srv *ProvisioningSrv) RoutePutMuteTiming(c *contextmodel.ReqContext, mt definitions.MuteTimeInterval, name string) response.Response {
	mt.Name = name
	mt.Provenance = alerting_models.ProvenanceAPI
	updated, err := srv.muteTimings.UpdateMuteTiming(c.Req.Context(), mt, c.OrgID)
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

func (srv *ProvisioningSrv) RouteDeleteMuteTiming(c *contextmodel.ReqContext, name string) response.Response {
	err := srv.muteTimings.DeleteMuteTiming(c.Req.Context(), name, c.OrgID)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusNoContent, nil)
}

func (srv *ProvisioningSrv) RouteGetAlertRules(c *contextmodel.ReqContext) response.Response {
	rules, err := srv.alertRules.GetAlertRules(c.Req.Context(), c.OrgID)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, definitions.NewAlertRules(rules))
}

func (srv *ProvisioningSrv) RouteRouteGetAlertRule(c *contextmodel.ReqContext, UID string) response.Response {
	rule, provenace, err := srv.alertRules.GetAlertRule(c.Req.Context(), c.OrgID, UID)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, definitions.NewAlertRule(rule, provenace))
}

func (srv *ProvisioningSrv) RoutePostAlertRule(c *contextmodel.ReqContext, ar definitions.ProvisionedAlertRule) response.Response {
	upstreamModel, err := ar.UpstreamModel()
	upstreamModel.OrgID = c.OrgID
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	provenance := determineProvenance(c)
	createdAlertRule, err := srv.alertRules.CreateAlertRule(c.Req.Context(), upstreamModel, provenance, c.UserID)
	if errors.Is(err, alerting_models.ErrAlertRuleFailedValidation) {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	if err != nil {
		if errors.Is(err, store.ErrOptimisticLock) {
			return ErrResp(http.StatusConflict, err, "")
		}
		if errors.Is(err, alerting_models.ErrQuotaReached) {
			return ErrResp(http.StatusForbidden, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	resp := definitions.NewAlertRule(createdAlertRule, provenance)
	return response.JSON(http.StatusCreated, resp)
}

func (srv *ProvisioningSrv) RoutePutAlertRule(c *contextmodel.ReqContext, ar definitions.ProvisionedAlertRule, UID string) response.Response {
	updated, err := ar.UpstreamModel()
	if err != nil {
		ErrResp(http.StatusBadRequest, err, "")
	}
	updated.OrgID = c.OrgID
	updated.UID = UID
	provenance := determineProvenance(c)
	updatedAlertRule, err := srv.alertRules.UpdateAlertRule(c.Req.Context(), updated, provenance)
	if errors.Is(err, alerting_models.ErrAlertRuleNotFound) {
		return response.Empty(http.StatusNotFound)
	}
	if errors.Is(err, alerting_models.ErrAlertRuleFailedValidation) {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	if err != nil {
		if errors.Is(err, store.ErrOptimisticLock) {
			return ErrResp(http.StatusConflict, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	resp := definitions.NewAlertRule(updatedAlertRule, provenance)
	return response.JSON(http.StatusOK, resp)
}

func (srv *ProvisioningSrv) RouteDeleteAlertRule(c *contextmodel.ReqContext, UID string) response.Response {
	err := srv.alertRules.DeleteAlertRule(c.Req.Context(), c.OrgID, UID, alerting_models.ProvenanceAPI)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusNoContent, "")
}

func (srv *ProvisioningSrv) RouteGetAlertRuleGroup(c *contextmodel.ReqContext, folder string, group string) response.Response {
	g, err := srv.alertRules.GetRuleGroup(c.Req.Context(), c.OrgID, folder, group)
	if err != nil {
		if errors.Is(err, store.ErrAlertRuleGroupNotFound) {
			return ErrResp(http.StatusNotFound, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, definitions.NewAlertRuleGroupFromModel(g))
}

// RouteGetAlertRulesExport retrieves all alert rules in a format compatible with file provisioning.
func (srv *ProvisioningSrv) RouteGetAlertRulesExport(c *contextmodel.ReqContext) response.Response {
	groupsWithTitle, err := srv.alertRules.GetAlertGroupsWithFolderTitle(c.Req.Context(), c.OrgID)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get alert rules")
	}

	e, err := file.NewAlertingFileExport(groupsWithTitle)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to create alerting file export")
	}

	return exportResponse(c, e)
}

// RouteGetAlertRuleGroupExport retrieves the given alert rule group in a format compatible with file provisioning.
func (srv *ProvisioningSrv) RouteGetAlertRuleGroupExport(c *contextmodel.ReqContext, folder string, group string) response.Response {
	g, err := srv.alertRules.GetAlertRuleGroupWithFolderTitle(c.Req.Context(), c.OrgID, folder, group)
	if err != nil {
		if errors.Is(err, store.ErrAlertRuleGroupNotFound) {
			return ErrResp(http.StatusNotFound, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "failed to get alert rule group")
	}

	e, err := file.NewAlertingFileExport([]file.AlertRuleGroupWithFolderTitle{g})
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to create alerting file export")
	}

	return exportResponse(c, e)
}

// RouteGetAlertRuleExport retrieves the given alert rule in a format compatible with file provisioning.
func (srv *ProvisioningSrv) RouteGetAlertRuleExport(c *contextmodel.ReqContext, UID string) response.Response {
	rule, err := srv.alertRules.GetAlertRuleWithFolderTitle(c.Req.Context(), c.OrgID, UID)
	if err != nil {
		if errors.Is(err, alerting_models.ErrAlertRuleNotFound) {
			return ErrResp(http.StatusNotFound, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	e, err := file.NewAlertingFileExport([]file.AlertRuleGroupWithFolderTitle{{
		AlertRuleGroup: &alerting_models.AlertRuleGroup{
			Title:     rule.AlertRule.RuleGroup,
			FolderUID: rule.AlertRule.NamespaceUID,
			Interval:  rule.AlertRule.IntervalSeconds,
			Rules:     []alerting_models.AlertRule{rule.AlertRule},
		},
		OrgID:       c.OrgID,
		FolderTitle: rule.FolderTitle,
	}})
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to create alerting file export")
	}

	return exportResponse(c, e)
}

func (srv *ProvisioningSrv) RoutePutAlertRuleGroup(c *contextmodel.ReqContext, ag definitions.AlertRuleGroup, folderUID string, group string) response.Response {
	ag.FolderUID = folderUID
	ag.Title = group
	groupModel, err := ag.ToModel()
	if err != nil {
		ErrResp(http.StatusBadRequest, err, "")
	}
	err = srv.alertRules.ReplaceRuleGroup(c.Req.Context(), c.OrgID, groupModel, c.UserID, alerting_models.ProvenanceAPI)
	if errors.Is(err, alerting_models.ErrAlertRuleFailedValidation) {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	if err != nil {
		if errors.Is(err, store.ErrOptimisticLock) {
			return ErrResp(http.StatusConflict, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, ag)
}

func determineProvenance(ctx *contextmodel.ReqContext) alerting_models.Provenance {
	if _, disabled := ctx.Req.Header[disableProvenanceHeaderName]; disabled {
		return alerting_models.ProvenanceNone
	}
	return alerting_models.ProvenanceAPI
}

func exportResponse(c *contextmodel.ReqContext, body any) response.Response {
	var format = "yaml"

	acceptHeader := c.Req.Header.Get("Accept")
	if strings.Contains(acceptHeader, "yaml") {
		format = "yaml"
	}

	if strings.Contains(acceptHeader, "json") {
		format = "json"
	}

	queryFormat := c.Query("format")
	if queryFormat == "yaml" || queryFormat == "json" {
		format = queryFormat
	}

	download := c.QueryBoolWithDefault("download", false)
	if download {
		r := response.JSONDownload
		if format == "yaml" {
			r = response.YAMLDownload
		}
		return r(http.StatusOK, body, fmt.Sprintf("export.%s", format))
	}

	r := response.JSON
	if format == "yaml" {
		r = response.YAML
	}
	return r(http.StatusOK, body)
}
