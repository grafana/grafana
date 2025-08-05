package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/api/hcl"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	alerting_models "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
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
	folderSvc           folder.Service

	// XXX: Used to flag recording rules, remove when FT is removed
	featureManager featuremgmt.FeatureToggles
}

type ContactPointService interface {
	GetContactPoints(ctx context.Context, q provisioning.ContactPointQuery, user identity.Requester) ([]definitions.EmbeddedContactPoint, error)
	CreateContactPoint(ctx context.Context, orgID int64, user identity.Requester, contactPoint definitions.EmbeddedContactPoint, p alerting_models.Provenance) (definitions.EmbeddedContactPoint, error)
	UpdateContactPoint(ctx context.Context, orgID int64, contactPoint definitions.EmbeddedContactPoint, p alerting_models.Provenance) error
	DeleteContactPoint(ctx context.Context, orgID int64, uid string) error
}

type TemplateService interface {
	GetTemplates(ctx context.Context, orgID int64) ([]definitions.NotificationTemplate, error)
	GetTemplate(ctx context.Context, orgID int64, nameOrUid string) (definitions.NotificationTemplate, error)
	UpsertTemplate(ctx context.Context, orgID int64, tmpl definitions.NotificationTemplate) (definitions.NotificationTemplate, error)
	DeleteTemplate(ctx context.Context, orgID int64, nameOrUid string, provenance definitions.Provenance, version string) error
}

type NotificationPolicyService interface {
	GetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, string, error)
	UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route, p alerting_models.Provenance, version string) error
	ResetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, error)
}

type MuteTimingService interface {
	GetMuteTimings(ctx context.Context, orgID int64) ([]definitions.MuteTimeInterval, error)
	GetMuteTiming(ctx context.Context, name string, orgID int64) (definitions.MuteTimeInterval, error)
	CreateMuteTiming(ctx context.Context, mt definitions.MuteTimeInterval, orgID int64) (definitions.MuteTimeInterval, error)
	UpdateMuteTiming(ctx context.Context, mt definitions.MuteTimeInterval, orgID int64) (definitions.MuteTimeInterval, error)
	DeleteMuteTiming(ctx context.Context, name string, orgID int64, provenance definitions.Provenance, version string) error
}

type AlertRuleService interface {
	GetAlertRules(ctx context.Context, user identity.Requester) ([]*alerting_models.AlertRule, map[string]alerting_models.Provenance, error)
	GetAlertRule(ctx context.Context, user identity.Requester, ruleUID string) (alerting_models.AlertRule, alerting_models.Provenance, error)
	CreateAlertRule(ctx context.Context, user identity.Requester, rule alerting_models.AlertRule, provenance alerting_models.Provenance) (alerting_models.AlertRule, error)
	UpdateAlertRule(ctx context.Context, user identity.Requester, rule alerting_models.AlertRule, provenance alerting_models.Provenance) (alerting_models.AlertRule, error)
	DeleteAlertRule(ctx context.Context, user identity.Requester, ruleUID string, provenance alerting_models.Provenance) error
	GetRuleGroup(ctx context.Context, user identity.Requester, folder, group string) (alerting_models.AlertRuleGroup, error)
	ReplaceRuleGroup(ctx context.Context, user identity.Requester, group alerting_models.AlertRuleGroup, provenance alerting_models.Provenance) error
	DeleteRuleGroup(ctx context.Context, user identity.Requester, folder, group string, provenance alerting_models.Provenance) error
	GetAlertRuleWithFolderFullpath(ctx context.Context, u identity.Requester, ruleUID string) (provisioning.AlertRuleWithFolderFullpath, error)
	GetAlertRuleGroupWithFolderFullpath(ctx context.Context, u identity.Requester, folder, group string) (alerting_models.AlertRuleGroupWithFolderFullpath, error)
	GetAlertGroupsWithFolderFullpath(ctx context.Context, u identity.Requester, folderUIDs []string) ([]alerting_models.AlertRuleGroupWithFolderFullpath, error)
}

func (srv *ProvisioningSrv) RouteGetPolicyTree(c *contextmodel.ReqContext) response.Response {
	policies, _, err := srv.policies.GetPolicyTree(c.Req.Context(), c.SignedInUser.GetOrgID())
	if errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
		return ErrResp(http.StatusNotFound, err, "")
	}
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	return response.JSON(http.StatusOK, policies)
}

func (srv *ProvisioningSrv) RouteGetPolicyTreeExport(c *contextmodel.ReqContext) response.Response {
	policies, _, err := srv.policies.GetPolicyTree(c.Req.Context(), c.SignedInUser.GetOrgID())
	if err != nil {
		if errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
			return ErrResp(http.StatusNotFound, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	e, err := AlertingFileExportFromRoute(c.SignedInUser.GetOrgID(), policies)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to create alerting file export")
	}

	return exportResponse(c, e)
}

func (srv *ProvisioningSrv) RoutePutPolicyTree(c *contextmodel.ReqContext, tree definitions.Route) response.Response {
	provenance := determineProvenance(c)
	err := srv.policies.UpdatePolicyTree(c.Req.Context(), c.SignedInUser.GetOrgID(), tree, alerting_models.Provenance(provenance), "")
	if errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
		return ErrResp(http.StatusNotFound, err, "")
	}
	if errors.Is(err, provisioning.ErrValidation) {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "", err)
	}

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "policies updated"})
}

func (srv *ProvisioningSrv) RouteResetPolicyTree(c *contextmodel.ReqContext) response.Response {
	tree, err := srv.policies.ResetPolicyTree(c.Req.Context(), c.SignedInUser.GetOrgID())
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusAccepted, tree)
}

func (srv *ProvisioningSrv) RouteGetContactPoints(c *contextmodel.ReqContext) response.Response {
	q := provisioning.ContactPointQuery{
		Name:  c.Query("name"),
		OrgID: c.SignedInUser.GetOrgID(),
	}
	cps, err := srv.contactPointService.GetContactPoints(c.Req.Context(), q, c.SignedInUser)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "", err)
	}

	return response.JSON(http.StatusOK, cps)
}

func (srv *ProvisioningSrv) RouteGetContactPointsExport(c *contextmodel.ReqContext) response.Response {
	q := provisioning.ContactPointQuery{
		Name:    c.Query("name"),
		OrgID:   c.SignedInUser.GetOrgID(),
		Decrypt: c.QueryBoolWithDefault("decrypt", false),
	}
	cps, err := srv.contactPointService.GetContactPoints(c.Req.Context(), q, c.SignedInUser)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "", err)
	}

	e, err := AlertingFileExportFromEmbeddedContactPoints(c.SignedInUser.GetOrgID(), cps)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to create alerting file export")
	}

	return exportResponse(c, e)
}

func (srv *ProvisioningSrv) RoutePostContactPoint(c *contextmodel.ReqContext, cp definitions.EmbeddedContactPoint) response.Response {
	provenance := determineProvenance(c)
	contactPoint, err := srv.contactPointService.CreateContactPoint(c.Req.Context(), c.SignedInUser.GetOrgID(), c.SignedInUser, cp, alerting_models.Provenance(provenance))
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
	provenance := determineProvenance(c)
	err := srv.contactPointService.UpdateContactPoint(c.Req.Context(), c.SignedInUser.GetOrgID(), cp, alerting_models.Provenance(provenance))
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
	err := srv.contactPointService.DeleteContactPoint(c.Req.Context(), c.SignedInUser.GetOrgID(), UID)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to delete contact point", err)
	}
	return response.JSON(http.StatusAccepted, util.DynMap{"message": "contactpoint deleted"})
}

func (srv *ProvisioningSrv) RouteGetTemplates(c *contextmodel.ReqContext) response.Response {
	templates, err := srv.templates.GetTemplates(c.Req.Context(), c.SignedInUser.GetOrgID())
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "", err)
	}
	return response.JSON(http.StatusOK, templates)
}

func (srv *ProvisioningSrv) RouteGetTemplate(c *contextmodel.ReqContext, nameOrUid string) response.Response {
	template, err := srv.templates.GetTemplate(c.Req.Context(), c.SignedInUser.GetOrgID(), nameOrUid)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "", err)
	}
	return response.JSON(http.StatusOK, template)
}

func (srv *ProvisioningSrv) RoutePutTemplate(c *contextmodel.ReqContext, body definitions.NotificationTemplateContent, name string) response.Response {
	tmpl := definitions.NotificationTemplate{
		Name:            name,
		Template:        body.Template,
		Provenance:      determineProvenance(c),
		ResourceVersion: body.ResourceVersion,
	}
	modified, err := srv.templates.UpsertTemplate(c.Req.Context(), c.SignedInUser.GetOrgID(), tmpl)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "", err)
	}
	return response.JSON(http.StatusAccepted, modified)
}

func (srv *ProvisioningSrv) RouteDeleteTemplate(c *contextmodel.ReqContext, nameOrUid string) response.Response {
	version := c.Query("version")
	err := srv.templates.DeleteTemplate(c.Req.Context(), c.SignedInUser.GetOrgID(), nameOrUid, determineProvenance(c), version)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "", err)
	}
	return response.JSON(http.StatusNoContent, nil)
}

func (srv *ProvisioningSrv) RouteGetMuteTiming(c *contextmodel.ReqContext, name string) response.Response {
	timing, err := srv.muteTimings.GetMuteTiming(c.Req.Context(), name, c.SignedInUser.GetOrgID())
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to get mute timing by name", err)
	}
	return response.JSON(http.StatusOK, timing)
}

func (srv *ProvisioningSrv) RouteGetMuteTimingExport(c *contextmodel.ReqContext, name string) response.Response {
	timings, err := srv.muteTimings.GetMuteTimings(c.Req.Context(), c.SignedInUser.GetOrgID())
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to get mute timings", err)
	}
	for _, timing := range timings {
		if name == timing.Name {
			e := AlertingFileExportFromMuteTimings(c.SignedInUser.GetOrgID(), []definitions.MuteTimeInterval{timing})
			return exportResponse(c, e)
		}
	}
	return response.Empty(http.StatusNotFound)
}

func (srv *ProvisioningSrv) RouteGetMuteTimings(c *contextmodel.ReqContext) response.Response {
	timings, err := srv.muteTimings.GetMuteTimings(c.Req.Context(), c.SignedInUser.GetOrgID())
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to get mute timings", err)
	}
	return response.JSON(http.StatusOK, timings)
}

func (srv *ProvisioningSrv) RouteGetMuteTimingsExport(c *contextmodel.ReqContext) response.Response {
	timings, err := srv.muteTimings.GetMuteTimings(c.Req.Context(), c.SignedInUser.GetOrgID())
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to get mute timings", err)
	}
	e := AlertingFileExportFromMuteTimings(c.SignedInUser.GetOrgID(), timings)
	return exportResponse(c, e)
}

func (srv *ProvisioningSrv) RoutePostMuteTiming(c *contextmodel.ReqContext, mt definitions.MuteTimeInterval) response.Response {
	mt.Provenance = determineProvenance(c)
	created, err := srv.muteTimings.CreateMuteTiming(c.Req.Context(), mt, c.SignedInUser.GetOrgID())
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to create mute timing", err)
	}
	return response.JSON(http.StatusCreated, created)
}

func (srv *ProvisioningSrv) RoutePutMuteTiming(c *contextmodel.ReqContext, mt definitions.MuteTimeInterval, name string) response.Response {
	// if body does not specify name, assume that the path contains the name
	if mt.Name == "" {
		mt.Name = name
	}
	// if body contains a name, and it's different from the one in the path, assume the latter to be UID
	if mt.Name != name {
		mt.UID = name
	}
	mt.Provenance = determineProvenance(c)
	updated, err := srv.muteTimings.UpdateMuteTiming(c.Req.Context(), mt, c.SignedInUser.GetOrgID())
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to update mute timing", err)
	}
	return response.JSON(http.StatusAccepted, updated)
}

func (srv *ProvisioningSrv) RouteDeleteMuteTiming(c *contextmodel.ReqContext, name string) response.Response {
	version := c.Query("version")
	err := srv.muteTimings.DeleteMuteTiming(c.Req.Context(), name, c.SignedInUser.GetOrgID(), determineProvenance(c), version)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to delete mute timing", err)
	}
	return response.JSON(http.StatusNoContent, nil)
}

func (srv *ProvisioningSrv) RouteGetAlertRules(c *contextmodel.ReqContext) response.Response {
	rules, provenances, err := srv.alertRules.GetAlertRules(c.Req.Context(), c.SignedInUser)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "", err)
	}
	return response.JSON(http.StatusOK, ProvisionedAlertRuleFromAlertRules(rules, provenances))
}

func (srv *ProvisioningSrv) RouteRouteGetAlertRule(c *contextmodel.ReqContext, UID string) response.Response {
	rule, provenace, err := srv.alertRules.GetAlertRule(c.Req.Context(), c.SignedInUser, UID)
	if err != nil {
		if errors.Is(err, alerting_models.ErrAlertRuleNotFound) {
			return response.Empty(http.StatusNotFound)
		}
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to get rule by UID", err)
	}
	return response.JSON(http.StatusOK, ProvisionedAlertRuleFromAlertRule(rule, provenace))
}

func (srv *ProvisioningSrv) RoutePostAlertRule(c *contextmodel.ReqContext, ar definitions.ProvisionedAlertRule) response.Response {
	upstreamModel, err := AlertRuleFromProvisionedAlertRule(ar)
	upstreamModel.OrgID = c.SignedInUser.GetOrgID()
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	if upstreamModel.Type() == alerting_models.RuleTypeRecording && !srv.featureManager.IsEnabledGlobally(featuremgmt.FlagGrafanaManagedRecordingRules) {
		return ErrResp(
			http.StatusBadRequest,
			fmt.Errorf("%w: recording rules cannot be created on this instance", alerting_models.ErrAlertRuleFailedValidation),
			"",
		)
	}

	provenance := determineProvenance(c)
	createdAlertRule, err := srv.alertRules.CreateAlertRule(c.Req.Context(), c.SignedInUser, upstreamModel, alerting_models.Provenance(provenance))
	if errors.Is(err, alerting_models.ErrAlertRuleFailedValidation) {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	if err != nil {
		if errors.Is(err, alerting_models.ErrAlertRuleUniqueConstraintViolation) {
			return ErrResp(http.StatusBadRequest, err, "")
		}
		if errors.Is(err, store.ErrOptimisticLock) {
			return ErrResp(http.StatusConflict, err, "")
		}
		if errors.Is(err, alerting_models.ErrQuotaReached) {
			return ErrResp(http.StatusForbidden, err, "")
		}
		return response.ErrOrFallback(http.StatusInternalServerError, "", err)
	}

	resp := ProvisionedAlertRuleFromAlertRule(createdAlertRule, alerting_models.Provenance(provenance))
	return response.JSON(http.StatusCreated, resp)
}

func (srv *ProvisioningSrv) RoutePutAlertRule(c *contextmodel.ReqContext, ar definitions.ProvisionedAlertRule, UID string) response.Response {
	updated, err := AlertRuleFromProvisionedAlertRule(ar)
	if err != nil {
		ErrResp(http.StatusBadRequest, err, "")
	}

	if updated.Type() == alerting_models.RuleTypeRecording && !srv.featureManager.IsEnabledGlobally(featuremgmt.FlagGrafanaManagedRecordingRules) {
		return ErrResp(
			http.StatusBadRequest,
			fmt.Errorf("%w: recording rules cannot be created on this instance", alerting_models.ErrAlertRuleFailedValidation),
			"",
		)
	}

	updated.OrgID = c.SignedInUser.GetOrgID()
	updated.UID = UID
	provenance := determineProvenance(c)
	updatedAlertRule, err := srv.alertRules.UpdateAlertRule(c.Req.Context(), c.SignedInUser, updated, alerting_models.Provenance(provenance))
	if errors.Is(err, alerting_models.ErrAlertRuleUniqueConstraintViolation) {
		return ErrResp(http.StatusBadRequest, err, "")
	}
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
		return response.ErrOrFallback(http.StatusInternalServerError, "", err)
	}

	resp := ProvisionedAlertRuleFromAlertRule(updatedAlertRule, alerting_models.Provenance(provenance))
	return response.JSON(http.StatusOK, resp)
}

func (srv *ProvisioningSrv) RouteDeleteAlertRule(c *contextmodel.ReqContext, UID string) response.Response {
	provenance := determineProvenance(c)
	err := srv.alertRules.DeleteAlertRule(c.Req.Context(), c.SignedInUser, UID, alerting_models.Provenance(provenance))
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "", err)
	}
	return response.JSON(http.StatusNoContent, "")
}

func (srv *ProvisioningSrv) RouteGetAlertRuleGroup(c *contextmodel.ReqContext, folder string, group string) response.Response {
	g, err := srv.alertRules.GetRuleGroup(c.Req.Context(), c.SignedInUser, folder, group)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "", err)
	}
	return response.JSON(http.StatusOK, ApiAlertRuleGroupFromAlertRuleGroup(g))
}

// RouteGetAlertRulesExport retrieves all alert rules in a format compatible with file provisioning.
func (srv *ProvisioningSrv) RouteGetAlertRulesExport(c *contextmodel.ReqContext) response.Response {
	folderUIDs := c.QueryStrings("folderUid")
	group := c.Query("group")
	uid := c.Query("ruleUid")
	if uid != "" {
		if group != "" || len(folderUIDs) > 0 {
			return ErrResp(http.StatusBadRequest, errors.New("group and folder should not be specified when a single rule is requested"), "")
		}
		return srv.RouteGetAlertRuleExport(c, uid)
	}
	if group != "" {
		if len(folderUIDs) != 1 || folderUIDs[0] == "" {
			return ErrResp(http.StatusBadRequest,
				fmt.Errorf("group name must be specified together with a single folder_uid parameter. Got %d", len(folderUIDs)),
				"",
			)
		}
		return srv.RouteGetAlertRuleGroupExport(c, folderUIDs[0], group)
	}

	groupsWithFullpath, err := srv.alertRules.GetAlertGroupsWithFolderFullpath(c.Req.Context(), c.SignedInUser, folderUIDs)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to get alert rules", err)
	}
	if len(groupsWithFullpath) == 0 {
		return response.Empty(http.StatusNotFound)
	}

	e, err := AlertingFileExportFromAlertRuleGroupWithFolderFullpath(groupsWithFullpath)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to create alerting file export", err)
	}

	return exportResponse(c, e)
}

// RouteGetAlertRuleGroupExport retrieves the given alert rule group in a format compatible with file provisioning.
func (srv *ProvisioningSrv) RouteGetAlertRuleGroupExport(c *contextmodel.ReqContext, folder string, group string) response.Response {
	g, err := srv.alertRules.GetAlertRuleGroupWithFolderFullpath(c.Req.Context(), c.SignedInUser, folder, group)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to get alert rule group", err)
	}

	e, err := AlertingFileExportFromAlertRuleGroupWithFolderFullpath([]alerting_models.AlertRuleGroupWithFolderFullpath{g})
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to create alerting file export", err)
	}

	return exportResponse(c, e)
}

// RouteGetAlertRuleExport retrieves the given alert rule in a format compatible with file provisioning.
func (srv *ProvisioningSrv) RouteGetAlertRuleExport(c *contextmodel.ReqContext, UID string) response.Response {
	rule, err := srv.alertRules.GetAlertRuleWithFolderFullpath(c.Req.Context(), c.SignedInUser, UID)
	if err != nil {
		if errors.Is(err, alerting_models.ErrAlertRuleNotFound) {
			return ErrResp(http.StatusNotFound, err, "")
		}
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to get alert rules", err)
	}

	e, err := AlertingFileExportFromAlertRuleGroupWithFolderFullpath([]alerting_models.AlertRuleGroupWithFolderFullpath{
		alerting_models.NewAlertRuleGroupWithFolderFullpathFromRulesGroup(rule.AlertRule.GetGroupKey(), alerting_models.RulesGroup{&rule.AlertRule}, rule.FolderFullpath),
	})
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to create alerting file export")
	}

	return exportResponse(c, e)
}

func (srv *ProvisioningSrv) RoutePutAlertRuleGroup(c *contextmodel.ReqContext, ag definitions.AlertRuleGroup, folderUID string, group string) response.Response {
	ag.FolderUID = folderUID
	ag.Title = group
	groupModel, err := AlertRuleGroupFromApiAlertRuleGroup(ag)
	if err != nil {
		ErrResp(http.StatusBadRequest, err, "")
	}
	provenance := determineProvenance(c)
	err = srv.alertRules.ReplaceRuleGroup(c.Req.Context(), c.SignedInUser, groupModel, alerting_models.Provenance(provenance))
	if errors.Is(err, alerting_models.ErrAlertRuleUniqueConstraintViolation) {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	if errors.Is(err, alerting_models.ErrAlertRuleFailedValidation) {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	if errors.Is(err, store.ErrOptimisticLock) {
		return ErrResp(http.StatusConflict, err, "")
	}
	if errors.Is(err, alerting_models.ErrQuotaReached) {
		return ErrResp(http.StatusForbidden, err, "")
	}
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "", err)
	}
	return response.JSON(http.StatusOK, ag)
}

func (srv *ProvisioningSrv) RouteDeleteAlertRuleGroup(c *contextmodel.ReqContext, folderUID string, group string) response.Response {
	provenance := determineProvenance(c)
	err := srv.alertRules.DeleteRuleGroup(c.Req.Context(), c.SignedInUser, folderUID, group, alerting_models.Provenance(provenance))
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "", err)
	}
	return response.JSON(http.StatusNoContent, "")
}

func determineProvenance(ctx *contextmodel.ReqContext) definitions.Provenance {
	if _, disabled := ctx.Req.Header[disableProvenanceHeaderName]; disabled {
		return definitions.Provenance(alerting_models.ProvenanceNone)
	}
	return definitions.Provenance(alerting_models.ProvenanceAPI)
}

func extractExportRequest(c *contextmodel.ReqContext) definitions.ExportQueryParams {
	var format = "yaml"

	acceptHeader := c.Req.Header.Get("Accept")
	if strings.Contains(acceptHeader, "yaml") {
		format = "yaml"
	}

	if strings.Contains(acceptHeader, "json") {
		format = "json"
	}

	queryFormat := c.Query("format")
	if queryFormat == "yaml" || queryFormat == "json" || queryFormat == "hcl" {
		format = queryFormat
	}

	params := definitions.ExportQueryParams{
		Format:   format,
		Download: c.QueryBoolWithDefault("download", false),
	}

	return params
}

func exportResponse(c *contextmodel.ReqContext, body definitions.AlertingFileExport) response.Response {
	params := extractExportRequest(c)
	if params.Format == "hcl" {
		return exportHcl(params.Download, body)
	}

	body = escapeAlertingFileExport(body)
	if params.Download {
		r := response.JSONDownload
		if params.Format == "yaml" {
			r = response.YAMLDownload
		}
		return r(http.StatusOK, body, fmt.Sprintf("export.%s", params.Format))
	}

	r := response.JSON
	if params.Format == "yaml" {
		r = response.YAML
	}
	return r(http.StatusOK, body)
}

// escape all strings except:
// Alert rule annotations: groups[].rules[].annotations
// Alert rule time range: groups[].rules[].relativeTimeRange
// Alert rule query model: groups[].rules[].data.model
// Mute timings name: muteTimes[].name
// Mute timings time intervals: muteTimes[].time_intervals[]
// Notification template name: templates[].name
// Notification template content: templates[].template
func escapeAlertingFileExport(body definitions.AlertingFileExport) definitions.AlertingFileExport {
	for i, group := range body.Groups {
		body.Groups[i] = escapeRuleGroup(group)
	}
	// TODO: implement escaping for the other export fields
	return body
}

// escape all strings except:
// Alert rule annotations: groups[].rules[].annotations
// Alert rule time range: groups[].rules[].relativeTimeRange
// Alert rule query model: groups[].rules[].data.model
func escapeRuleGroup(group definitions.AlertRuleGroupExport) definitions.AlertRuleGroupExport {
	group.Name = addEscapeCharactersToString(group.Name)
	group.Folder = addEscapeCharactersToString(group.Folder)
	for i, rule := range group.Rules {
		group.Rules[i].Title = addEscapeCharactersToString(rule.Title)
		if rule.Labels != nil {
			group.Rules[i].Labels = escapeMapValues(*rule.Labels)
		}
		if rule.NotificationSettings != nil {
			notificationSettings := escapeRuleNotificationSettings(*rule.NotificationSettings)
			group.Rules[i].NotificationSettings = &notificationSettings
		}
	}
	return group
}

func escapeRuleNotificationSettings(ns definitions.AlertRuleNotificationSettingsExport) definitions.AlertRuleNotificationSettingsExport {
	ns.Receiver = addEscapeCharactersToString(ns.Receiver)
	for j := range ns.GroupBy {
		ns.GroupBy[j] = addEscapeCharactersToString(ns.GroupBy[j])
	}
	for k := range ns.MuteTimeIntervals {
		ns.MuteTimeIntervals[k] = addEscapeCharactersToString(ns.MuteTimeIntervals[k])
	}
	return ns
}

func escapeMapValues(m map[string]string) *map[string]string {
	escapedMap := make(map[string]string, len(m))
	for k, v := range m {
		escapedMap[k] = addEscapeCharactersToString(v)
	}
	return &escapedMap
}

func addEscapeCharactersToString(s string) string {
	return strings.ReplaceAll(s, "$", "$$")
}

func exportHcl(download bool, body definitions.AlertingFileExport) response.Response {
	resources := make([]hcl.Resource, 0, len(body.Groups)+len(body.ContactPoints)+len(body.Policies)+len(body.MuteTimings))
	convertToResources := func() error {
		for _, group := range body.Groups {
			gr := group
			hash := getHash([]string{gr.Name, gr.FolderUID})
			resources = append(resources, hcl.Resource{
				Type: "grafana_rule_group",
				Name: fmt.Sprintf("rule_group_%016x", hash),
				Body: &gr,
			})
		}
		for _, cp := range body.ContactPoints {
			upd, err := ContactPointFromContactPointExport(cp)
			if err != nil {
				return fmt.Errorf("failed to convert contact points to HCL:%w", err)
			}
			hash := getHash([]string{upd.Name})
			resources = append(resources, hcl.Resource{
				Type: "grafana_contact_point",
				Name: fmt.Sprintf("contact_point_%016x", hash),
				Body: &upd,
			})
		}

		for idx, cp := range body.Policies {
			policy := cp.RouteExport
			resources = append(resources, hcl.Resource{
				Type: "grafana_notification_policy",
				Name: fmt.Sprintf("notification_policy_%d", idx+1),
				Body: policy,
			})
		}

		for _, mt := range body.MuteTimings {
			mthcl, err := MuteTimingIntervalToMuteTimeIntervalHclExport(mt)
			if err != nil {
				return fmt.Errorf("failed to convert mute timing [%s] to HCL:%w", mt.Name, err)
			}
			hash := getHash([]string{mthcl.Name})
			resources = append(resources, hcl.Resource{
				Type: "grafana_mute_timing",
				Name: fmt.Sprintf("mute_timing_%016x", hash),
				Body: mthcl,
			})
		}
		return nil
	}
	if err := convertToResources(); err != nil {
		return response.Error(http.StatusInternalServerError, "failed to convert to HCL resources", err)
	}
	hclBody, err := hcl.Encode(resources...)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "body hcl encode", err)
	}
	resp := response.Respond(http.StatusOK, hclBody)
	if download {
		return resp.
			SetHeader("Content-Type", "application/terraform+hcl").
			SetHeader("Content-Disposition", `attachment;filename=export.tf`)
	}
	return resp.SetHeader("Content-Type", "text/hcl")
}
