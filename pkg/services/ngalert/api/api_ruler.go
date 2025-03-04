package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	authz "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type ConditionValidator interface {
	// Validate validates that the condition is correct. Returns nil if the condition is correct. Otherwise, error that describes the failure
	Validate(ctx eval.EvaluationContext, condition ngmodels.Condition) error
}

type AMConfigStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, orgID int64) (*ngmodels.AlertConfiguration, error)
}

type AMRefresher interface {
	ApplyConfig(ctx context.Context, orgId int64, dbConfig *ngmodels.AlertConfiguration) error
}

type RulerSrv struct {
	xactManager        provisioning.TransactionManager
	provenanceStore    provisioning.ProvisioningStore
	store              RuleStore
	QuotaService       quota.Service
	log                log.Logger
	cfg                *setting.UnifiedAlertingSettings
	conditionValidator ConditionValidator
	authz              RuleAccessControlService
	userService        user.Service

	amConfigStore  AMConfigStore
	amRefresher    AMRefresher
	featureManager featuremgmt.FeatureToggles
}

var (
	errProvisionedResource = errors.New("request affects resources created via provisioning API")
)

// ignore fields that are not part of the rule definition
var ignoreFieldsForValidate = [...]string{"RuleGroupIndex"}

// RouteDeleteAlertRules deletes all alert rules the user is authorized to access in the given namespace
// or, if non-empty, a specific group of rules in the namespace.
// Returns http.StatusForbidden if user does not have access to any of the rules that match the filter.
// Returns http.StatusBadRequest if all rules that match the filter and the user is authorized to delete are provisioned.
func (srv RulerSrv) RouteDeleteAlertRules(c *contextmodel.ReqContext, namespaceUID string, group string) response.Response {
	namespace, err := srv.store.GetNamespaceByUID(c.Req.Context(), namespaceUID, c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}

	id, _ := c.SignedInUser.GetInternalID()
	userNamespace := c.SignedInUser.GetIdentityType()
	var loggerCtx = []any{
		"identity",
		id,
		"userNamespace",
		userNamespace,
		"namespaceUid",
		namespace.UID,
	}

	finalGroup, err := getRulesGroupParam(c, group)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	if finalGroup != "" {
		loggerCtx = append(loggerCtx, "group", finalGroup)
	}
	logger := srv.log.New(loggerCtx...)

	provenances, err := srv.provenanceStore.GetProvenances(c.Req.Context(), c.SignedInUser.GetOrgID(), (&ngmodels.AlertRule{}).ResourceType())
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to fetch provenances of alert rules")
	}

	err = srv.xactManager.InTransaction(c.Req.Context(), func(ctx context.Context) error {
		deletionCandidates := map[ngmodels.AlertRuleGroupKey]ngmodels.RulesGroup{}
		if finalGroup != "" {
			key := ngmodels.AlertRuleGroupKey{
				OrgID:        c.SignedInUser.GetOrgID(),
				NamespaceUID: namespace.UID,
				RuleGroup:    finalGroup,
			}
			rules, err := srv.getAuthorizedRuleGroup(ctx, c, key)
			if err != nil {
				return err
			}
			deletionCandidates[key] = rules
		} else {
			var totalGroups int
			deletionCandidates, totalGroups, err = srv.searchAuthorizedAlertRules(ctx, authorizedRuleGroupQuery{
				User:          c.SignedInUser,
				NamespaceUIDs: []string{namespace.UID},
			})
			if err != nil {
				return err
			}
			if totalGroups > 0 && len(deletionCandidates) == 0 {
				return authz.NewAuthorizationErrorGeneric("delete any existing rules in the namespace due to missing data source query permissions")
			}
		}
		rulesToDelete := make([]string, 0)
		provisioned := false
		auth := true
		for groupKey, rules := range deletionCandidates {
			if containsProvisionedAlerts(provenances, rules) {
				logger.Debug("Alert group cannot be deleted because it is provisioned", "group", groupKey.RuleGroup)
				provisioned = true
				continue
			}
			// XXX: Currently delete requires data source query access to all rules in the group.
			if err := srv.authz.AuthorizeDatasourceAccessForRuleGroup(ctx, c.SignedInUser, rules); err != nil {
				if errors.Is(err, authz.ErrAuthorizationBase) {
					logger.Debug("User is not authorized to delete rules in the group", "group", groupKey.RuleGroup)
					auth = false
					continue
				} else {
					return err
				}
			}
			uid := make([]string, 0, len(rules))
			for _, rule := range rules {
				uid = append(uid, rule.UID)
			}
			rulesToDelete = append(rulesToDelete, uid...)
		}
		if len(rulesToDelete) > 0 {
			err := srv.store.DeleteAlertRulesByUID(ctx, c.SignedInUser.GetOrgID(), rulesToDelete...)
			if err != nil {
				return err
			}
			logger.Info("Alert rules were deleted", "ruleUid", strings.Join(rulesToDelete, ","))
			return nil
		}
		// if none rules were deleted return an error.

		// Check whether provisioned check failed first because if it is true, then all rules that the user can access (actually read via GET API) are provisioned.
		if provisioned {
			return errProvisionedResource
		}

		// If auth is false, then the user is not authorized to delete any of the rules.
		if !auth {
			return authz.NewAuthorizationErrorGeneric("delete any existing rules in the namespace")
		}

		logger.Info("No alert rules were deleted")
		return nil
	})

	if err != nil {
		if errors.As(err, &errutil.Error{}) {
			return response.Err(err)
		}
		if errors.Is(err, errProvisionedResource) {
			return ErrResp(http.StatusBadRequest, err, "failed to delete rule group")
		}
		return ErrResp(http.StatusInternalServerError, err, "failed to delete rule group")
	}
	return response.JSON(http.StatusAccepted, util.DynMap{"message": "rules deleted"})
}

// RouteGetNamespaceRulesConfig returns all rules in a specific folder that user has access to
func (srv RulerSrv) RouteGetNamespaceRulesConfig(c *contextmodel.ReqContext, namespaceUID string) response.Response {
	namespace, err := srv.store.GetNamespaceByUID(c.Req.Context(), namespaceUID, c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}

	ruleGroups, _, err := srv.searchAuthorizedAlertRules(c.Req.Context(), authorizedRuleGroupQuery{
		User:          c.SignedInUser,
		NamespaceUIDs: []string{namespace.UID},
	})
	if err != nil {
		return errorToResponse(err)
	}
	provenanceRecords, err := srv.provenanceStore.GetProvenances(c.Req.Context(), c.SignedInUser.GetOrgID(), (&ngmodels.AlertRule{}).ResourceType())
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get provenance for rule group")
	}

	result := apimodels.NamespaceConfigResponse{}

	for groupKey, rules := range ruleGroups {
		result[namespace.Fullpath] = append(result[namespace.Fullpath], toGettableRuleGroupConfig(groupKey.RuleGroup, rules, provenanceRecords, srv.resolveUserIdToNameFn(c.Req.Context())))
	}

	return response.JSON(http.StatusAccepted, result)
}

// RouteGetRulesGroupConfig returns rules that belong to a specific group in a specific namespace (folder).
// If user does not have access to at least one of the rule in the group, returns status 403 Forbidden
func (srv RulerSrv) RouteGetRulesGroupConfig(c *contextmodel.ReqContext, namespaceUID string, ruleGroup string) response.Response {
	namespace, err := srv.store.GetNamespaceByUID(c.Req.Context(), namespaceUID, c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}

	finalRuleGroup, err := getRulesGroupParam(c, ruleGroup)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	rules, err := srv.getAuthorizedRuleGroup(c.Req.Context(), c, ngmodels.AlertRuleGroupKey{
		OrgID:        c.SignedInUser.GetOrgID(),
		RuleGroup:    finalRuleGroup,
		NamespaceUID: namespace.UID,
	})
	if err != nil {
		return errorToResponse(err)
	}

	if len(rules) == 0 {
		return ErrResp(http.StatusNotFound, errors.New("rule group does not exist"), "")
	}

	provenanceRecords, err := srv.provenanceStore.GetProvenances(c.Req.Context(), c.SignedInUser.GetOrgID(), (&ngmodels.AlertRule{}).ResourceType())
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get group alert rules")
	}

	result := apimodels.RuleGroupConfigResponse{
		// nolint:staticcheck
		GettableRuleGroupConfig: toGettableRuleGroupConfig(finalRuleGroup, rules, provenanceRecords, srv.resolveUserIdToNameFn(c.Req.Context())),
	}

	return response.JSON(http.StatusAccepted, result)
}

// RouteGetRulesConfig returns all alert rules that are available to the current user
func (srv RulerSrv) RouteGetRulesConfig(c *contextmodel.ReqContext) response.Response {
	namespaceMap, err := srv.store.GetUserVisibleNamespaces(c.Req.Context(), c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get namespaces visible to the user")
	}
	result := apimodels.NamespaceConfigResponse{}

	if len(namespaceMap) == 0 {
		srv.log.Debug("User has no access to any namespaces")
		return response.JSON(http.StatusOK, result)
	}

	namespaceUIDs := make([]string, len(namespaceMap))
	for k := range namespaceMap {
		namespaceUIDs = append(namespaceUIDs, k)
	}

	dashboardUID := c.Query("dashboard_uid")
	panelID, err := getPanelIDFromQuery(c.Req.URL.Query())
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "invalid panel_id")
	}
	if dashboardUID == "" && panelID != 0 {
		return ErrResp(http.StatusBadRequest, errors.New("panel_id must be set with dashboard_uid"), "")
	}

	configs, _, err := srv.searchAuthorizedAlertRules(c.Req.Context(), authorizedRuleGroupQuery{
		User:          c.SignedInUser,
		NamespaceUIDs: namespaceUIDs,
		DashboardUID:  dashboardUID,
		PanelID:       panelID,
	})
	if err != nil {
		return errorToResponse(err)
	}
	provenanceRecords, err := srv.provenanceStore.GetProvenances(c.Req.Context(), c.SignedInUser.GetOrgID(), (&ngmodels.AlertRule{}).ResourceType())
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get alert rules")
	}

	for groupKey, rules := range configs {
		folder, ok := namespaceMap[groupKey.NamespaceUID]
		if !ok {
			id, _ := c.SignedInUser.GetInternalID()
			userNamespace := c.SignedInUser.GetIdentityType()
			srv.log.Error("Namespace not visible to the user", "user", id, "userNamespace", userNamespace, "namespace", groupKey.NamespaceUID)
			continue
		}
		result[folder.Fullpath] = append(result[folder.Fullpath], toGettableRuleGroupConfig(groupKey.RuleGroup, rules, provenanceRecords, srv.resolveUserIdToNameFn(c.Req.Context())))
	}
	return response.JSON(http.StatusOK, result)
}

// RouteGetRuleByUID returns the alert rule with the given UID
func (srv RulerSrv) RouteGetRuleByUID(c *contextmodel.ReqContext, ruleUID string) response.Response {
	ctx := c.Req.Context()
	orgID := c.SignedInUser.GetOrgID()

	rule, err := srv.getAuthorizedRuleByUid(ctx, c, ruleUID)
	if err != nil {
		if errors.Is(err, ngmodels.ErrAlertRuleNotFound) {
			return response.Empty(http.StatusNotFound)
		}
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to get rule by UID", err)
	}

	provenance, err := srv.provenanceStore.GetProvenance(ctx, &rule, orgID)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to get rule provenance", err)
	}

	result := toGettableExtendedRuleNode(rule, map[string]ngmodels.Provenance{rule.ResourceID(): provenance}, srv.resolveUserIdToNameFn(ctx))

	return response.JSON(http.StatusOK, result)
}

func (srv RulerSrv) RouteGetRuleVersionsByUID(c *contextmodel.ReqContext, ruleUID string) response.Response {
	ctx := c.Req.Context()
	// make sure the user has access to the current version of the rule. Also, check if it exists
	rule, err := srv.getAuthorizedRuleByUid(ctx, c, ruleUID)
	if err != nil {
		if errors.Is(err, ngmodels.ErrAlertRuleNotFound) {
			return response.Empty(http.StatusNotFound)
		}
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to get rule by UID", err)
	}

	rules, err := srv.store.GetAlertRuleVersions(ctx, rule.OrgID, rule.GUID)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to get rule history", err)
	}
	sort.Slice(rules, func(i, j int) bool { return rules[i].ID > rules[j].ID })
	result := make(apimodels.GettableRuleVersions, 0, len(rules))
	for _, rule := range rules {
		// do not provide provenance status because we do not have historical changes for it
		result = append(result, toGettableExtendedRuleNode(*rule, map[string]ngmodels.Provenance{}, srv.resolveUserIdToNameFn(ctx)))
	}
	return response.JSON(http.StatusOK, result)
}

func (srv RulerSrv) RoutePostNameRulesConfig(c *contextmodel.ReqContext, ruleGroupConfig apimodels.PostableRuleGroupConfig, namespaceUID string) response.Response {
	namespace, err := srv.store.GetNamespaceByUID(c.Req.Context(), namespaceUID, c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		return toNamespaceErrorResponse(err)
	}

	if err := srv.checkGroupLimits(ruleGroupConfig); err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	rules, err := ValidateRuleGroup(&ruleGroupConfig, c.SignedInUser.GetOrgID(), namespace.UID, RuleLimitsFromConfig(srv.cfg, srv.featureManager))
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	groupKey := ngmodels.AlertRuleGroupKey{
		OrgID:        c.SignedInUser.GetOrgID(),
		NamespaceUID: namespace.UID,
		RuleGroup:    ruleGroupConfig.Name,
	}

	return srv.updateAlertRulesInGroup(c, groupKey, rules)
}

func (srv RulerSrv) checkGroupLimits(group apimodels.PostableRuleGroupConfig) error {
	if srv.cfg.RulesPerRuleGroupLimit > 0 && int64(len(group.Rules)) > srv.cfg.RulesPerRuleGroupLimit {
		srv.log.Warn("Large rule group was edited. Large groups are discouraged and may be rejected in the future.",
			"limit", srv.cfg.RulesPerRuleGroupLimit,
			"actual", len(group.Rules),
			"group", group.Name,
		)
	}

	return nil
}

// updateAlertRulesInGroup calculates changes (rules to add,update,delete), verifies that the user is authorized to do the calculated changes and updates database.
// All operations are performed in a single transaction
//
//nolint:gocyclo
func (srv RulerSrv) updateAlertRulesInGroup(c *contextmodel.ReqContext, groupKey ngmodels.AlertRuleGroupKey, rules []*ngmodels.AlertRuleWithOptionals) response.Response {
	var finalChanges *store.GroupDelta
	var dbConfig *ngmodels.AlertConfiguration
	err := srv.xactManager.InTransaction(c.Req.Context(), func(tranCtx context.Context) error {
		id, _ := c.SignedInUser.GetInternalID()
		userNamespace := c.SignedInUser.GetIdentityType()

		logger := srv.log.New("namespace_uid", groupKey.NamespaceUID, "group",
			groupKey.RuleGroup, "org_id", groupKey.OrgID, "user_id", id, "userNamespace", userNamespace)
		groupChanges, err := store.CalculateChanges(tranCtx, srv.store, groupKey, rules)
		if err != nil {
			return err
		}

		if groupChanges.IsEmpty() {
			finalChanges = groupChanges
			logger.Info("No changes detected in the request. Do nothing")
			return nil
		}

		err = srv.authz.AuthorizeRuleChanges(c.Req.Context(), c.SignedInUser, groupChanges)
		if err != nil {
			return err
		}

		if err := validateQueries(c.Req.Context(), groupChanges, srv.conditionValidator, c.SignedInUser); err != nil {
			return err
		}

		newOrUpdatedNotificationSettings := groupChanges.NewOrUpdatedNotificationSettings()
		if len(newOrUpdatedNotificationSettings) > 0 {
			dbConfig, err = srv.amConfigStore.GetLatestAlertmanagerConfiguration(c.Req.Context(), groupChanges.GroupKey.OrgID)
			if err != nil {
				return fmt.Errorf("failed to get latest configuration: %w", err)
			}
			cfg, err := notifier.Load([]byte(dbConfig.AlertmanagerConfiguration))
			if err != nil {
				return fmt.Errorf("failed to parse configuration: %w", err)
			}
			validator := notifier.NewNotificationSettingsValidator(&cfg.AlertmanagerConfig)
			for _, s := range newOrUpdatedNotificationSettings {
				if err := validator.Validate(s); err != nil {
					return errors.Join(ngmodels.ErrAlertRuleFailedValidation, err)
				}
			}
		}

		if err := verifyProvisionedRulesNotAffected(c.Req.Context(), srv.provenanceStore, c.SignedInUser.GetOrgID(), groupChanges); err != nil {
			return err
		}

		finalChanges = store.UpdateCalculatedRuleFields(groupChanges)
		logger.Debug("Updating database with the authorized changes", "add", len(finalChanges.New), "update", len(finalChanges.New), "delete", len(finalChanges.Delete))

		// Delete first as this could prevent future unique constraint violations.
		if len(finalChanges.Delete) > 0 {
			UIDs := make([]string, 0, len(finalChanges.Delete))
			for _, rule := range finalChanges.Delete {
				UIDs = append(UIDs, rule.UID)
			}

			if err = srv.store.DeleteAlertRulesByUID(tranCtx, c.SignedInUser.GetOrgID(), UIDs...); err != nil {
				return fmt.Errorf("failed to delete rules: %w", err)
			}
		}

		if len(finalChanges.Update) > 0 {
			updates := make([]ngmodels.UpdateRule, 0, len(finalChanges.Update))
			for _, update := range finalChanges.Update {
				logger.Debug("Updating rule", "rule_uid", update.New.UID, "diff", update.Diff.String())
				updates = append(updates, ngmodels.UpdateRule{
					Existing: update.Existing,
					New:      *update.New,
				})
			}
			err = srv.store.UpdateAlertRules(tranCtx, ngmodels.NewUserUID(c.SignedInUser), updates)
			if err != nil {
				return fmt.Errorf("failed to update rules: %w", err)
			}
		}

		if len(finalChanges.New) > 0 {
			inserts := make([]ngmodels.AlertRule, 0, len(finalChanges.New))
			for _, rule := range finalChanges.New {
				inserts = append(inserts, *rule)
			}
			added, err := srv.store.InsertAlertRules(tranCtx, ngmodels.NewUserUID(c.SignedInUser), inserts)
			if err != nil {
				return fmt.Errorf("failed to add rules: %w", err)
			}
			if len(added) != len(finalChanges.New) {
				logger.Error("Cannot match inserted rules with final changes", "insertedCount", len(added), "changes", len(finalChanges.New))
			} else {
				for i, newRule := range finalChanges.New {
					newRule.ID = added[i].ID
					newRule.UID = added[i].UID
				}
			}
		}

		if len(finalChanges.New) > 0 {
			userID, _ := identity.UserIdentifier(c.SignedInUser.GetID())
			limitReached, err := srv.QuotaService.CheckQuotaReached(tranCtx, ngmodels.QuotaTargetSrv, &quota.ScopeParameters{
				OrgID:  c.SignedInUser.GetOrgID(),
				UserID: userID,
			}) // alert rule is table name
			if err != nil {
				return fmt.Errorf("failed to get alert rules quota: %w", err)
			}
			if limitReached {
				return ngmodels.ErrQuotaReached
			}
		}
		return nil
	})

	if err != nil {
		if errors.As(err, &errutil.Error{}) {
			return response.Err(err)
		} else if errors.Is(err, ngmodels.ErrAlertRuleNotFound) {
			return ErrResp(http.StatusNotFound, err, "failed to update rule group")
		} else if errors.Is(err, ngmodels.ErrAlertRuleFailedValidation) || errors.Is(err, errProvisionedResource) {
			return ErrResp(http.StatusBadRequest, err, "failed to update rule group")
		} else if errors.Is(err, ngmodels.ErrQuotaReached) {
			return ErrResp(http.StatusForbidden, err, "")
		} else if errors.Is(err, store.ErrOptimisticLock) {
			return ErrResp(http.StatusConflict, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "failed to update rule group")
	}

	if srv.featureManager.IsEnabled(c.Req.Context(), featuremgmt.FlagAlertingSimplifiedRouting) && dbConfig != nil {
		// This isn't strictly necessary since the alertmanager config is periodically synced.
		err := srv.amRefresher.ApplyConfig(c.Req.Context(), groupKey.OrgID, dbConfig)
		if err != nil {
			srv.log.Warn("Failed to refresh Alertmanager config for org after change in notification settings", "org", c.SignedInUser.GetOrgID(), "error", err)
		}
	}

	return changesToResponse(finalChanges)
}

func changesToResponse(finalChanges *store.GroupDelta) response.Response {
	body := apimodels.UpdateRuleGroupResponse{
		Message: "rule group updated successfully",
		Created: make([]string, 0, len(finalChanges.New)),
		Updated: make([]string, 0, len(finalChanges.Update)),
		Deleted: make([]string, 0, len(finalChanges.Delete)),
	}
	if finalChanges.IsEmpty() {
		body.Message = "no changes detected in the rule group"
	} else {
		for _, r := range finalChanges.New {
			body.Created = append(body.Created, r.UID)
		}
		for _, r := range finalChanges.Update {
			body.Updated = append(body.Updated, r.Existing.UID)
		}
		for _, r := range finalChanges.Delete {
			body.Deleted = append(body.Deleted, r.UID)
		}
	}
	return response.JSON(http.StatusAccepted, body)
}

func toGettableRuleGroupConfig(groupName string, rules ngmodels.RulesGroup, provenanceRecords map[string]ngmodels.Provenance, userIdToName userIDToUserInfoFn) apimodels.GettableRuleGroupConfig {
	rules.SortByGroupIndex()
	ruleNodes := make([]apimodels.GettableExtendedRuleNode, 0, len(rules))
	var interval time.Duration
	if len(rules) > 0 {
		interval = time.Duration(rules[0].IntervalSeconds) * time.Second
	}
	for _, r := range rules {
		ruleNodes = append(ruleNodes, toGettableExtendedRuleNode(*r, provenanceRecords, userIdToName))
	}
	return apimodels.GettableRuleGroupConfig{
		Name:     groupName,
		Interval: model.Duration(interval),
		Rules:    ruleNodes,
	}
}

func toGettableExtendedRuleNode(r ngmodels.AlertRule, provenanceRecords map[string]ngmodels.Provenance, userIdToName userIDToUserInfoFn) apimodels.GettableExtendedRuleNode {
	provenance := ngmodels.ProvenanceNone
	if prov, exists := provenanceRecords[r.ResourceID()]; exists {
		provenance = prov
	}

	gettableExtendedRuleNode := apimodels.GettableExtendedRuleNode{
		GrafanaManagedAlert: &apimodels.GettableGrafanaRule{
			Title:                r.Title,
			Condition:            r.Condition,
			Data:                 ApiAlertQueriesFromAlertQueries(r.Data),
			Updated:              r.Updated,
			UpdatedBy:            userIdToName(r.UpdatedBy),
			IntervalSeconds:      r.IntervalSeconds,
			Version:              r.Version,
			UID:                  r.UID,
			NamespaceUID:         r.NamespaceUID,
			RuleGroup:            r.RuleGroup,
			NoDataState:          apimodels.NoDataState(r.NoDataState),
			ExecErrState:         apimodels.ExecutionErrorState(r.ExecErrState),
			Provenance:           apimodels.Provenance(provenance),
			IsPaused:             r.IsPaused,
			NotificationSettings: AlertRuleNotificationSettingsFromNotificationSettings(r.NotificationSettings),
			Record:               ApiRecordFromModelRecord(r.Record),
			Metadata:             AlertRuleMetadataFromModelMetadata(r.Metadata),
		},
	}
	forDuration := model.Duration(r.For)
	gettableExtendedRuleNode.ApiRuleNode = &apimodels.ApiRuleNode{
		For:         &forDuration,
		Annotations: r.Annotations,
		Labels:      r.Labels,
	}
	return gettableExtendedRuleNode
}

func toNamespaceErrorResponse(err error) response.Response {
	if errors.Is(err, ngmodels.ErrCannotEditNamespace) {
		return ErrResp(http.StatusForbidden, err, err.Error())
	}
	if errors.Is(err, dashboards.ErrDashboardIdentifierNotSet) {
		return ErrResp(http.StatusBadRequest, err, err.Error())
	}
	return apierrors.ToFolderErrorResponse(err)
}

// verifyProvisionedRulesNotAffected check that neither of provisioned alerts are affected by changes.
// Returns errProvisionedResource if there is at least one rule in groups affected by changes that was provisioned.
func verifyProvisionedRulesNotAffected(ctx context.Context, provenanceStore provisioning.ProvisioningStore, orgID int64, ch *store.GroupDelta) error {
	provenances, err := provenanceStore.GetProvenances(ctx, orgID, (&ngmodels.AlertRule{}).ResourceType())
	if err != nil {
		return err
	}
	errorMsg := strings.Builder{}
	for group, alertRules := range ch.AffectedGroups {
		if !containsProvisionedAlerts(provenances, alertRules) {
			continue
		}
		if errorMsg.Len() > 0 {
			errorMsg.WriteRune(',')
		}
		errorMsg.WriteString(group.String())
	}
	if errorMsg.Len() == 0 {
		return nil
	}
	return fmt.Errorf("%w: alert rule group [%s]", errProvisionedResource, errorMsg.String())
}

func validateQueries(ctx context.Context, groupChanges *store.GroupDelta, validator ConditionValidator, user identity.Requester) error {
	if len(groupChanges.New) > 0 {
		for _, rule := range groupChanges.New {
			err := validator.Validate(eval.NewContext(ctx, user), rule.GetEvalCondition())
			if err != nil {
				return fmt.Errorf("%w '%s': %s", ngmodels.ErrAlertRuleFailedValidation, rule.Title, err.Error())
			}
		}
	}
	if len(groupChanges.Update) > 0 {
		for _, upd := range groupChanges.Update {
			if !shouldValidate(upd) {
				continue
			}
			err := validator.Validate(eval.NewContext(ctx, user), upd.New.GetEvalCondition())
			if err != nil {
				return fmt.Errorf("%w '%s' (UID: %s): %s", ngmodels.ErrAlertRuleFailedValidation, upd.New.Title, upd.New.UID, err.Error())
			}
		}
	}
	return nil
}

// shouldValidate returns true if the rule is not paused and there are changes in the rule that are not ignored
func shouldValidate(delta store.RuleDelta) bool {
	for _, diff := range delta.Diff {
		if !slices.Contains(ignoreFieldsForValidate[:], diff.Path) {
			return true
		}
	}

	// TODO: consider also checking if rule will be paused after the update
	return false
}

// getAuthorizedRuleByUid fetches the rule by uid and checks whether the user is authorized to read it.
// Returns rule identified by provided UID or ErrAuthorization if user is not authorized to access the rule.
func (srv RulerSrv) getAuthorizedRuleByUid(ctx context.Context, c *contextmodel.ReqContext, ruleUID string) (ngmodels.AlertRule, error) {
	q := ngmodels.GetAlertRuleByUIDQuery{
		UID:   ruleUID,
		OrgID: c.SignedInUser.GetOrgID(),
	}
	var err error
	rule, err := srv.store.GetAlertRuleByUID(ctx, &q)
	if err != nil {
		return ngmodels.AlertRule{}, err
	}
	if err := srv.authz.AuthorizeAccessInFolder(ctx, c.SignedInUser, rule); err != nil {
		return ngmodels.AlertRule{}, err
	}
	return *rule, nil
}

// getAuthorizedRuleGroup fetches rules that belong to the specified models.AlertRuleGroupKey and validate user's authorization.
// Returns models.RuleGroup if authorization passed or ErrAuthorization if user is not authorized to access the rule.
func (srv RulerSrv) getAuthorizedRuleGroup(ctx context.Context, c *contextmodel.ReqContext, ruleGroupKey ngmodels.AlertRuleGroupKey) (ngmodels.RulesGroup, error) {
	q := ngmodels.ListAlertRulesQuery{
		OrgID:         ruleGroupKey.OrgID,
		NamespaceUIDs: []string{ruleGroupKey.NamespaceUID},
		RuleGroups:    []string{ruleGroupKey.RuleGroup},
	}
	rules, err := srv.store.ListAlertRules(ctx, &q)
	if err != nil {
		return nil, err
	}
	if err := srv.authz.AuthorizeAccessToRuleGroup(ctx, c.SignedInUser, rules); err != nil {
		return nil, err
	}
	return rules, nil
}

type authorizedRuleGroupQuery struct {
	User          identity.Requester
	NamespaceUIDs []string
	DashboardUID  string
	PanelID       int64
}

// searchAuthorizedAlertRules fetches rules according to the filters, groups them by models.AlertRuleGroupKey and filters out groups that the current user is not authorized to access.
// Returns groups that user is authorized to access, and total count of groups returned by query
func (srv RulerSrv) searchAuthorizedAlertRules(ctx context.Context, q authorizedRuleGroupQuery) (map[ngmodels.AlertRuleGroupKey]ngmodels.RulesGroup, int, error) {
	query := ngmodels.ListAlertRulesQuery{
		OrgID:         q.User.GetOrgID(),
		NamespaceUIDs: q.NamespaceUIDs,
		DashboardUID:  q.DashboardUID,
		PanelID:       q.PanelID,
	}
	rules, err := srv.store.ListAlertRules(ctx, &query)
	if err != nil {
		return nil, 0, err
	}

	byGroupKey := ngmodels.GroupByAlertRuleGroupKey(rules)
	totalGroups := len(byGroupKey)
	for groupKey, rulesGroup := range byGroupKey {
		if ok, err := srv.authz.HasAccessToRuleGroup(ctx, q.User, rulesGroup); !ok || err != nil {
			if err != nil {
				return nil, 0, err
			}
			delete(byGroupKey, groupKey)
		}
	}
	return byGroupKey, totalGroups, nil
}

type userIDToUserInfoFn func(id *ngmodels.UserUID) *apimodels.UserInfo

// getIdentityName returns name of either user or service account
func (srv RulerSrv) resolveUserIdToNameFn(ctx context.Context) userIDToUserInfoFn {
	cache := map[ngmodels.UserUID]*apimodels.UserInfo{
		ngmodels.AlertingUserUID: {
			UID: string(ngmodels.AlertingUserUID),
		},
		ngmodels.FileProvisioningUserUID: {
			UID: string(ngmodels.FileProvisioningUserUID),
		},
	}
	return func(id *ngmodels.UserUID) *apimodels.UserInfo {
		if id == nil {
			return nil
		}
		if val, ok := cache[*id]; ok {
			return val
		}
		u, err := srv.userService.GetByUID(ctx, &user.GetUserByUIDQuery{
			UID: string(*id),
		})
		var name string
		if err != nil {
			srv.log.FromContext(ctx).Warn("Failed to get user by uid. Defaulting to an empty name", "uid", id, "error", err)
		}
		if u != nil {
			name = u.NameOrFallback()
		}
		result := &apimodels.UserInfo{
			UID:  string(*id),
			Name: name,
		}
		cache[*id] = result
		return result
	}
}
