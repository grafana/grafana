package legacy

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
	provenancestore "github.com/grafana/grafana/pkg/services/ngalert/store/provenance"
	rulestore "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/util"
)

type ruleAccessControlService interface {
	AuthorizeRuleGroupWrite(ctx context.Context, user identity.Requester, change *rulestore.GroupDelta) error
	AuthorizeNotificationSettings(ctx context.Context, user identity.Requester, receivers []accesscontrol.ReceiverRef) error
	AuthorizeRuleRead(ctx context.Context, user identity.Requester, rule *models.AlertRule) error
	// CanReadAllRules returns true if the user has full access to read rules via provisioning API and bypass regular checks
	CanReadAllRules(ctx context.Context, user identity.Requester) (bool, error)
	// CanWriteAllRules returns true if the user has full access to write rules via provisioning API and bypass regular checks
	CanWriteAllRules(ctx context.Context, user identity.Requester) (bool, error)
	HasAccessInFolder(ctx context.Context, user identity.Requester, folder models.Namespaced) (bool, error)
}

var errProvenanceMismatch = errutil.NewBase(errutil.StatusConflict, "alerting.provenanceMismatch").MustTemplate(
	"cannot {{ .Public.Operation }} with provided provenance '{{ .Public.ProvidedProvenance }}', needs '{{ .Public.StoredProvenance }}'",
	errutil.WithPublic("cannot {{ .Public.Operation }} with provided provenance '{{ .Public.ProvidedProvenance }}', needs '{{ .Public.StoredProvenance }}'"),
)

// TransactionManager represents the ability to issue and close transactions through contexts.
type TransactionManager interface {
	InTransaction(ctx context.Context, work func(ctx context.Context) error) error
}

// QuotaChecker represents the ability to evaluate whether quotas are met.
//
//go:generate mockery --name QuotaChecker --structname MockQuotaChecker --inpackage --filename quota_checker_mock.go --with-expecter
type QuotaChecker interface {
	CheckQuotaReached(ctx context.Context, target quota.TargetSrv, scopeParams *quota.ScopeParameters) (bool, error)
}

type NotificationSettingsValidatorProvider interface {
	Validator(ctx context.Context, orgID int64) (notifier.NotificationSettingsValidator, error)
}

// RuleStore represents the ability to persist and query alert rules.
type RuleStore interface {
	rulestore.RuleReader
	rulestore.RulePageReader
	rulestore.RuleWriter
	rulestore.RuleVersionReader
}

type ProvenanceStore interface {
	provenancestore.ProvenanceReader
	provenancestore.ProvenanceWriter
	provenancestore.ManagerPropertiesStore
}

type LegacyRuleService struct {
	defaultIntervalSeconds int64
	ruleStore              RuleStore
	provenanceStore        ProvenanceStore
	folderService          folder.Service
	quotas                 QuotaChecker
	xact                   TransactionManager
	log                    log.Logger
	nsValidatorProvider    NotificationSettingsValidatorProvider
	authz                  ruleAccessControlService
	ruleValidator          RuleMutationValidator
}

func NewLegacyRuleService(ruleStore RuleStore,
	provenanceStore ProvenanceStore,
	folderService folder.Service,
	quotas QuotaChecker,
	xact TransactionManager,
	defaultIntervalSeconds int64,
	log log.Logger,
	ns NotificationSettingsValidatorProvider,
	authz RuleAccessControlService,
	ruleValidator RuleMutationValidator,
) *LegacyRuleService {
	return &LegacyRuleService{
		defaultIntervalSeconds: defaultIntervalSeconds,
		ruleStore:              ruleStore,
		provenanceStore:        provenanceStore,
		folderService:          folderService,
		quotas:                 quotas,
		xact:                   xact,
		log:                    log,
		nsValidatorProvider:    ns,
		authz:                  newRuleAccessControlService(authz),
		ruleValidator:          ruleValidator,
	}
}

// ListRuleStringFilter provides filtering options for string fields in rules such as group and namespace (folder) uid
type ListRuleStringFilter struct {
	Exists  *bool
	Include []string
	Exclude []string
}

type ListRuleBoolFilter struct {
	Value *bool
}

type ListAlertRulesOptions struct {
	RuleType      models.RuleTypeFilter
	Limit         int64
	ContinueToken string
	// RuleUIDs restricts the results to rules with these UIDs (metadata.name).
	RuleUIDs                  []string
	GroupFilter               ListRuleStringFilter
	FolderFilter              ListRuleStringFilter
	TitleFilter               ListRuleStringFilter
	PausedFilter              ListRuleBoolFilter
	DashboardFilter           ListRuleStringFilter
	PanelIDFilter             ListRuleStringFilter
	NotificationTypeFilter    ListRuleStringFilter
	ReceiverFilter            ListRuleStringFilter
	RoutingTreeFilter         ListRuleStringFilter
	MetricFilter              ListRuleStringFilter
	TargetDatasourceUIDFilter ListRuleStringFilter
	DatasourceUIDs            []string
	SearchTitle               string
	StateFilter               ListRuleStringFilter
	HealthFilter              ListRuleStringFilter
}

// extractSingleValue returns the single value from a ListRuleStringFilter's Include or Exclude slice,
// returning an error when the slice has more than one entry. Field selectors only support
// equality and inequality, so multiple `=` or multiple `!=` requirements for the same field are
// not meaningful for field-selector-derived filters. Empty slice returns an empty string.
func extractSingleValue(values []string, field, side string) (string, error) {
	switch len(values) {
	case 0:
		return "", nil
	case 1:
		return values[0], nil
	default:
		return "", fmt.Errorf("%s only accepts a single %s value, got %d", field, side, len(values))
	}
}

// unwrapSingleStringFilter resolves a ListRuleStringFilter to scalar (include, exclude) string values,
// returning an error when either side has more than one entry.
func unwrapSingleStringFilter(filter ListRuleStringFilter, field string) (include, exclude string, err error) {
	include, err = extractSingleValue(filter.Include, field, "include")
	if err != nil {
		return "", "", err
	}
	exclude, err = extractSingleValue(filter.Exclude, field, "exclude")
	if err != nil {
		return "", "", err
	}
	return include, exclude, nil
}

// unwrapSingleInt64Filter resolves a ListRuleStringFilter to scalar (include, exclude) int64 values,
// returning an error when either side has more than one entry or fails to parse as int64.
func unwrapSingleInt64Filter(filter ListRuleStringFilter, field string) (include, exclude int64, err error) {
	includeStr, excludeStr, err := unwrapSingleStringFilter(filter, field)
	if err != nil {
		return 0, 0, err
	}
	if includeStr != "" {
		include, err = strconv.ParseInt(includeStr, 10, 64)
		if err != nil {
			return 0, 0, fmt.Errorf("invalid include value for %s: %w", field, err)
		}
	}
	if excludeStr != "" {
		exclude, err = strconv.ParseInt(excludeStr, 10, 64)
		if err != nil {
			return 0, 0, fmt.Errorf("invalid exclude value for %s: %w", field, err)
		}
	}
	return include, exclude, nil
}

// scalarFieldSelectorFilters collapses every field-selector-backed filter on opts into the
// scalar query fields the rule store accepts. It enforces the single-value rule for each
// (filter, side) pair.
type scalarFieldSelectorFilters struct {
	titleInclude, titleExclude         string
	dashboardInclude, dashboardExclude string
	panelIDInclude, panelIDExclude     int64
	notifTypeInclude, notifTypeExclude string
	receiverInclude, receiverExclude   string
	routingInclude, routingExclude     string
	metricInclude, metricExclude       string
	targetDSInclude, targetDSExclude   string
}

func resolveFieldSelectorFilters(opts ListAlertRulesOptions) (scalarFieldSelectorFilters, error) {
	var f scalarFieldSelectorFilters
	var err error
	if f.titleInclude, f.titleExclude, err = unwrapSingleStringFilter(opts.TitleFilter, "spec.title"); err != nil {
		return f, err
	}
	if f.dashboardInclude, f.dashboardExclude, err = unwrapSingleStringFilter(opts.DashboardFilter, "spec.panelRef.dashboardUID"); err != nil {
		return f, err
	}
	if f.panelIDInclude, f.panelIDExclude, err = unwrapSingleInt64Filter(opts.PanelIDFilter, "spec.panelRef.panelID"); err != nil {
		return f, err
	}
	if f.notifTypeInclude, f.notifTypeExclude, err = unwrapSingleStringFilter(opts.NotificationTypeFilter, "spec.notificationSettings.type"); err != nil {
		return f, err
	}
	if f.receiverInclude, f.receiverExclude, err = unwrapSingleStringFilter(opts.ReceiverFilter, "spec.notificationSettings.receiver"); err != nil {
		return f, err
	}
	if f.routingInclude, f.routingExclude, err = unwrapSingleStringFilter(opts.RoutingTreeFilter, "spec.notificationSettings.routingTree"); err != nil {
		return f, err
	}
	if f.metricInclude, f.metricExclude, err = unwrapSingleStringFilter(opts.MetricFilter, "spec.metric"); err != nil {
		return f, err
	}
	if f.targetDSInclude, f.targetDSExclude, err = unwrapSingleStringFilter(opts.TargetDatasourceUIDFilter, "spec.targetDatasourceUID"); err != nil {
		return f, err
	}
	return f, nil
}

func (service *LegacyRuleService) ListAlertRules(ctx context.Context, user identity.Requester, opts ListAlertRulesOptions) (rules []*models.AlertRule, managerPropsMap map[string]utils.ManagerProperties, nextToken string, err error) {
	f, err := resolveFieldSelectorFilters(opts)
	if err != nil {
		return nil, nil, "", err
	}
	q := models.ListAlertRulesExtendedQuery{
		ListAlertRulesQuery: models.ListAlertRulesQuery{
			OrgID:                            user.GetOrgID(),
			RuleUIDs:                         opts.RuleUIDs,
			RuleGroups:                       opts.GroupFilter.Include,
			ExcludeRuleGroups:                opts.GroupFilter.Exclude,
			RuleGroupExists:                  opts.GroupFilter.Exists,
			ExcludeNamespaceUIDs:             opts.FolderFilter.Exclude,
			TitleExact:                       f.titleInclude,
			ExcludeTitle:                     f.titleExclude,
			IsPaused:                         opts.PausedFilter.Value,
			DashboardUID:                     f.dashboardInclude,
			ExcludeDashboardUID:              f.dashboardExclude,
			PanelID:                          f.panelIDInclude,
			ExcludePanelID:                   f.panelIDExclude,
			NotificationSettingsType:         models.NotificationSettingsType(f.notifTypeInclude),
			ExcludeNotificationSettingsType:  models.NotificationSettingsType(f.notifTypeExclude),
			ReceiverName:                     f.receiverInclude,
			ExcludeReceiverName:              f.receiverExclude,
			RoutingPolicyExact:               f.routingInclude,
			ExcludeRoutingPolicy:             f.routingExclude,
			RecordMetricExact:                f.metricInclude,
			ExcludeRecordMetric:              f.metricExclude,
			RecordTargetDatasourceUIDExact:   f.targetDSInclude,
			ExcludeRecordTargetDatasourceUID: f.targetDSExclude,
			DataSourceUIDs:                   opts.DatasourceUIDs,
			SearchTitle:                      opts.SearchTitle,
		},
		RuleType:       opts.RuleType,
		Limit:          opts.Limit,
		ContinueToken:  opts.ContinueToken,
		States:         opts.StateFilter.Include,
		ExcludeStates:  opts.StateFilter.Exclude,
		Healths:        opts.HealthFilter.Include,
		ExcludeHealths: opts.HealthFilter.Exclude,
	}

	can, err := service.authz.CanReadAllRules(ctx, user)
	if err != nil {
		return nil, nil, "", err
	}
	// If user does not have blanket privilege to read rules, filter to only folders they have rule access to
	if !can {
		fq := folder.GetFoldersQuery{
			OrgID:        user.GetOrgID(),
			SignedInUser: user,
			// Only folder UID and per-folder access are used below; serve
			// from the search index rather than a full-object folder list.
			MetadataOnly: true,
		}
		folders, err := service.folderService.GetFolders(ctx, fq)
		if err != nil {
			return nil, nil, "", err
		}
		folderUIDs := make([]string, 0, len(folders))
		for _, f := range folders {
			access, err := service.authz.HasAccessInFolder(ctx, user, models.NewNamespace(f))
			if err != nil {
				return nil, nil, "", err
			}
			if access {
				folderUIDs = append(folderUIDs, f.UID)
			}
		}
		// Intersect accessible folders with any requested folder filter
		if len(opts.FolderFilter.Include) > 0 {
			requestedSet := make(map[string]struct{}, len(opts.FolderFilter.Include))
			for _, uid := range opts.FolderFilter.Include {
				requestedSet[uid] = struct{}{}
			}
			filtered := folderUIDs[:0]
			for _, uid := range folderUIDs {
				if _, ok := requestedSet[uid]; ok {
					filtered = append(filtered, uid)
				}
			}
			q.NamespaceUIDs = filtered
		} else {
			q.NamespaceUIDs = folderUIDs
		}
		if len(q.NamespaceUIDs) == 0 {
			return nil, map[string]utils.ManagerProperties{}, "", nil
		}
	} else if len(opts.FolderFilter.Include) > 0 {
		q.NamespaceUIDs = opts.FolderFilter.Include
	}

	rules, nextToken, err = service.ruleStore.ListAlertRulesPaginated(ctx, &q)
	if err != nil {
		return nil, nil, "", err
	}
	managerPropsMap = make(map[string]utils.ManagerProperties)
	if len(rules) > 0 {
		resourceType := rules[0].ResourceType()
		managerPropsMap, err = service.provenanceStore.GetAllManagerProperties(ctx, user.GetOrgID(), resourceType)
		if err != nil {
			return nil, nil, "", err
		}
	}

	return rules, managerPropsMap, nextToken, nil
}

func (service *LegacyRuleService) getAlertRuleAuthorized(ctx context.Context, user identity.Requester, ruleUID string) (models.AlertRule, error) {
	q := models.GetAlertRuleByUIDQuery{
		UID:   ruleUID,
		OrgID: user.GetOrgID(),
	}
	var err error
	rule, err := service.ruleStore.GetAlertRuleByUID(ctx, &q)
	if err != nil {
		return models.AlertRule{}, err
	}
	if err := service.authz.AuthorizeRuleRead(ctx, user, rule); err != nil {
		return models.AlertRule{}, err
	}
	return *rule, nil
}

func (service *LegacyRuleService) GetAlertRule(ctx context.Context, user identity.Requester, ruleUID string) (models.AlertRule, utils.ManagerProperties, error) {
	rule, err := service.getAlertRuleAuthorized(ctx, user, ruleUID)
	if err != nil {
		return models.AlertRule{}, utils.ManagerProperties{}, err
	}
	managerProps, err := service.provenanceStore.GetManagerProperties(ctx, &rule, user.GetOrgID())
	if err != nil {
		return models.AlertRule{}, utils.ManagerProperties{}, err
	}
	return rule, managerProps, nil
}

// GetAlertRuleVersions returns the version history of a single alert rule identified by UID.
// The caller must already have read access to the rule; this is verified via getAlertRuleAuthorized.
// Versions are returned in the order provided by the underlying store (newest first).
func (service *LegacyRuleService) GetAlertRuleVersions(ctx context.Context, user identity.Requester, ruleUID string) ([]*models.AlertRuleVersion, error) {
	rule, err := service.getAlertRuleAuthorized(ctx, user, ruleUID)
	if err != nil {
		return nil, err
	}
	return service.ruleStore.GetAlertRuleVersions(ctx, user.GetOrgID(), rule.GUID)
}

// GetDeletedAlertRules returns rules that have been soft-deleted in the user's organization.
// The result is filtered to namespaces the user can access when they don't have blanket read access.
func (service *LegacyRuleService) GetDeletedAlertRules(ctx context.Context, user identity.Requester) ([]*models.AlertRule, error) {
	rules, err := service.ruleStore.ListDeletedRules(ctx, user.GetOrgID())
	if err != nil {
		return nil, err
	}

	canReadAll, err := service.authz.CanReadAllRules(ctx, user)
	if err != nil {
		return nil, err
	}
	if canReadAll {
		return rules, nil
	}

	// Filter to namespaces the user can read rules in. Deleted rules retain their last known
	// namespace UID, so we use the same folder-access check used by ListAlertRules.
	allowed := make(map[string]bool)
	filtered := rules[:0]
	for _, r := range rules {
		ns := r.NamespaceUID
		access, ok := allowed[ns]
		if !ok {
			access, err = service.authz.HasAccessInFolder(ctx, user, models.NewNamespaceUID(ns))
			if err != nil {
				return nil, err
			}
			allowed[ns] = access
		}
		if access {
			filtered = append(filtered, r)
		}
	}
	return filtered, nil
}

// CreateAlertRule creates a new alert rule. For normal rule groups, this function will ignore any
// interval that is set in the rule struct and use the already existing group interval or the default one.
func (service *LegacyRuleService) CreateAlertRule(ctx context.Context, user identity.Requester, rule models.AlertRule, manager utils.ManagerProperties) (models.AlertRule, error) {
	if models.IsNoGroupRuleGroup(rule.RuleGroup) {
		return models.AlertRule{}, fmt.Errorf("%w: rules must have a valid group", models.ErrAlertRuleFailedValidation)
	}

	if rule.UID == "" {
		rule.UID = util.GenerateShortUID()
	} else if err := util.ValidateUID(rule.UID); err != nil {
		return models.AlertRule{}, errors.Join(models.ErrAlertRuleFailedValidation, fmt.Errorf("cannot create rule with UID '%s': %w", rule.UID, err))
	}
	var interval = service.defaultIntervalSeconds
	if err := service.ensureNamespace(ctx, user, rule.OrgID, rule.NamespaceUID); err != nil {
		return models.AlertRule{}, err
	}
	// check if user can bypass fine-grained rule authorization checks. If it cannot, verfiy that the user can add rules to the group
	canWriteAllRules, err := service.authz.CanWriteAllRules(ctx, user)
	if err != nil {
		return models.AlertRule{}, err
	}
	if canWriteAllRules {
		groupInterval, err := service.ruleStore.GetRuleGroupInterval(ctx, rule.OrgID, rule.NamespaceUID, rule.RuleGroup)
		// if the alert group does not exist we just use the default interval
		if err == nil {
			interval = groupInterval
		} else if !errors.Is(err, models.ErrAlertRuleGroupNotFound) {
			return models.AlertRule{}, err
		}
	} else {
		delta, err := rulestore.CalculateRuleCreate(ctx, service.ruleStore, &rule)
		if err != nil {
			return models.AlertRule{}, fmt.Errorf("failed to calculate delta: %w", err)
		}
		if err := service.authz.AuthorizeRuleGroupWrite(ctx, user, delta); err != nil {
			return models.AlertRule{}, err
		}
		existingGroup := delta.AffectedGroups[rule.GetGroupKey()]
		if len(existingGroup) > 0 {
			interval = existingGroup[0].IntervalSeconds
		}
	}
	if rule.RuleGroup != "" {
		rule.IntervalSeconds = interval
	}
	err = rule.SetDashboardAndPanelFromAnnotations()
	if err != nil {
		return models.AlertRule{}, err
	}
	if err := service.validateRuleMutations(ctx, []*models.AlertRule{&rule}, manager); err != nil {
		return models.AlertRule{}, err
	}
	rule.Updated = time.Now()
	if rule.NotificationSettings != nil {
		// The receivers are authorized, and then validated, against the same configuration. In that order so that who
		// cannot use a receiver is not told whether it exists.
		validator, err := service.nsValidatorProvider.Validator(ctx, rule.OrgID)
		if err != nil {
			return models.AlertRule{}, err
		}
		if !canWriteAllRules {
			if err := service.authz.AuthorizeNotificationSettings(ctx, user, accesscontrol.ReceiverRefs(validator.Config(), *rule.NotificationSettings)); err != nil {
				return models.AlertRule{}, err
			}
		}
		if err := validator.Validate(*rule.NotificationSettings); err != nil {
			return models.AlertRule{}, errors.Join(models.ErrAlertRuleFailedValidation, err)
		}
	}
	err = service.xact.InTransaction(ctx, func(ctx context.Context) error {
		ids, err := service.ruleStore.InsertAlertRules(ctx, userUidOrFallback(user), []models.InsertRule{
			{
				AlertRule: rule,
			},
		})
		if err != nil {
			return err
		}
		var fixed bool
		for _, key := range ids {
			if key.UID == rule.UID {
				rule.ID = key.ID
				rule.GUID = key.GUID
				fixed = true
				break
			}
		}
		if !fixed {
			return errors.New("couldn't find newly created id")
		}

		if err = service.checkLimitsTransactionCtx(ctx, user); err != nil {
			return err
		}

		return service.provenanceStore.SetManagerProperties(ctx, &rule, rule.OrgID, manager)
	})
	if err != nil {
		return models.AlertRule{}, err
	}
	return rule, nil
}

// UpdateAlertRule updates an alert rule.
func (service *LegacyRuleService) UpdateAlertRule(ctx context.Context, user identity.Requester, rule models.AlertRule, manager utils.ManagerProperties) (models.AlertRule, error) {
	var storedRule *models.AlertRule
	var changedNotificationSettings []models.NotificationSettings // Needs authorizing unless the user can write all rules.
	if err := service.ensureNamespace(ctx, user, rule.OrgID, rule.NamespaceUID); err != nil {
		return models.AlertRule{}, err
	}
	// check if the user has full access to all rules and can bypass the regular authorization validations.
	// If it cannot, calculate the changes to the group caused by this update and authorize them.
	canWriteAllRules, err := service.authz.CanWriteAllRules(ctx, user)
	if err != nil {
		return models.AlertRule{}, err
	}
	if canWriteAllRules {
		query := &models.GetAlertRuleByUIDQuery{
			OrgID: rule.OrgID,
			UID:   rule.UID,
		}
		existing, err := service.ruleStore.GetAlertRuleByUID(ctx, query)
		if err != nil {
			return models.AlertRule{}, err
		}
		storedRule = existing
	} else {
		delta, err := rulestore.CalculateRuleUpdate(ctx, service.ruleStore, &models.AlertRuleWithOptionals{AlertRule: rule})
		if err != nil {
			return models.AlertRule{}, err
		}
		if err = service.authz.AuthorizeRuleGroupWrite(ctx, user, delta); err != nil {
			return models.AlertRule{}, err
		}
		if delta.IsEmpty() {
			// No changes to the rule.
			return rule, nil
		}
		changedNotificationSettings = delta.NewOrUpdatedNotificationSettings()
		// new rules not allowed in update for a single rule
		if len(delta.New) > 0 {
			return models.AlertRule{}, fmt.Errorf("failed to update rule with UID %s because %w", rule.UID, models.ErrAlertRuleNotFound)
		}
		for _, d := range delta.Update {
			if d.Existing.GetKey() == rule.GetKey() {
				storedRule = d.Existing
			}
		}
		if storedRule == nil { // this should not happen but we better catch it to avoid panic
			return models.AlertRule{}, fmt.Errorf("cannot find rule in the delta")
		}
	}
	storedManager, err := service.provenanceStore.GetManagerProperties(ctx, storedRule, storedRule.OrgID)
	if err != nil {
		return models.AlertRule{}, err
	}
	if storedManager.Kind != manager.Kind && storedManager.Kind != utils.ManagerKindUnknown {
		return models.AlertRule{}, errProvenanceMismatch.Build(errutil.TemplateData{
			Public: map[string]any{
				"ProvidedProvenance": models.ManagerPropertiesToProvenance(manager),
				"StoredProvenance":   models.ManagerPropertiesToProvenance(storedManager),
				"Operation":          "update",
			},
		})
	}
	if rule.NotificationSettings != nil {
		// The receivers are authorized, and then validated, against the same configuration. In that order so that who
		// cannot use a receiver is not told whether it exists.
		validator, err := service.nsValidatorProvider.Validator(ctx, rule.OrgID)
		if err != nil {
			return models.AlertRule{}, err
		}
		if len(changedNotificationSettings) > 0 {
			if err := service.authz.AuthorizeNotificationSettings(ctx, user, accesscontrol.ReceiverRefs(validator.Config(), changedNotificationSettings...)); err != nil {
				return models.AlertRule{}, err
			}
		}
		if err := validator.Validate(*rule.NotificationSettings); err != nil {
			return models.AlertRule{}, errors.Join(models.ErrAlertRuleFailedValidation, err)
		}
	}
	rule.Updated = time.Now()
	rule.ID = storedRule.ID
	// Normal rule groups share an interval, so single-rule updates can't change it.
	// NoGroup rules each live in their own sentinel group, so per-rule interval changes are allowed.
	if !models.IsNoGroupRuleGroup(storedRule.RuleGroup) {
		rule.IntervalSeconds = storedRule.IntervalSeconds
	}

	// Currently metadata contains only editor settings, so we can just copy it.
	// If we add more fields to metadata, we might need to handle them separately,
	// and/or merge or update their values.
	if rule.Metadata == (models.AlertRuleMetadata{}) {
		rule.Metadata = storedRule.Metadata
	}

	err = rule.SetDashboardAndPanelFromAnnotations()
	if err != nil {
		return models.AlertRule{}, err
	}
	if err := service.validateRuleMutations(ctx, []*models.AlertRule{&rule}, manager); err != nil {
		return models.AlertRule{}, err
	}
	err = service.xact.InTransaction(ctx, func(ctx context.Context) error {
		err := service.ruleStore.UpdateAlertRules(ctx, userUidOrFallback(user), []models.UpdateRule{
			{
				Existing: storedRule,
				New:      rule,
			},
		})
		if err != nil {
			return err
		}
		return service.provenanceStore.SetManagerProperties(ctx, &rule, rule.OrgID, manager)
	})
	if err != nil {
		return models.AlertRule{}, err
	}
	return rule, err
}

func (service *LegacyRuleService) DeleteAlertRule(ctx context.Context, user identity.Requester, ruleUID string, manager utils.ManagerProperties) error {
	rule := &models.AlertRule{
		OrgID: user.GetOrgID(),
		UID:   ruleUID,
	}
	storedManager, err := service.provenanceStore.GetManagerProperties(ctx, rule, rule.OrgID)
	if err != nil {
		return err
	}
	if !validation.CanUpdateManagerInRuleGroup(storedManager, manager) {
		return errProvenanceMismatch.Build(errutil.TemplateData{
			Public: map[string]any{
				"ProvidedProvenance": manager.Kind,
				"StoredProvenance":   storedManager.Kind,
				"Operation":          "delete",
			},
		})
	}

	can, err := service.authz.CanWriteAllRules(ctx, user)
	if err != nil {
		return err
	}
	if !can {
		delta, err := rulestore.CalculateRuleDelete(ctx, service.ruleStore, rule.GetKey())
		if err != nil {
			if errors.Is(err, models.ErrAlertRuleNotFound) {
				// Rule already gone; return early so non-admin users
				// get the same idempotent behaviour as admins.
				return nil
			}
			return err
		}
		if err = service.authz.AuthorizeRuleGroupWrite(ctx, user, delta); err != nil {
			return err
		}
	}

	// The single delete is idempotent, and doesn't error when deleting a group that already doesn't exist.
	// This is different from deleting groups. We delete the rules directly rather than persisting a delta here to keep the semantics the same.
	// TODO: Either persist a delta here as a breaking change, or deprecate this endpoint in favor of the group endpoint.
	return service.xact.InTransaction(ctx, func(ctx context.Context) error {
		return service.deleteRules(ctx, user, rule)
	})
}

// checkLimitsTransactionCtx checks whether the current transaction (as identified by the ctx) breaches configured alert rule limits.
func (service *LegacyRuleService) checkLimitsTransactionCtx(ctx context.Context, user identity.Requester) error {
	// default to 0 if there is no user
	var userID int64
	if id, err := identity.UserIdentifier(user.GetID()); err == nil {
		userID = id
	}

	limitReached, err := service.quotas.CheckQuotaReached(ctx, models.QuotaTargetSrv, &quota.ScopeParameters{
		OrgID:  user.GetOrgID(),
		UserID: userID,
	})
	if err != nil {
		return fmt.Errorf("failed to check alert rule quota: %w", err)
	}
	if limitReached {
		return models.ErrQuotaReached
	}
	return nil
}

// deleteRules deletes a set of target rules and associated data, while checking for database consistency.
func (service *LegacyRuleService) deleteRules(ctx context.Context, user identity.Requester, targets ...*models.AlertRule) error {
	uids := make([]string, 0, len(targets))
	for _, tgt := range targets {
		if tgt != nil {
			uids = append(uids, tgt.UID)
		}
	}
	if err := service.ruleStore.DeleteAlertRulesByUID(ctx, user.GetOrgID(), models.NewUserUID(user), false, uids...); err != nil {
		return err
	}
	for _, uid := range uids {
		if err := service.provenanceStore.DeleteProvenance(ctx, &models.AlertRule{UID: uid}, user.GetOrgID()); err != nil {
			// We failed to clean up the record, but this doesn't break things. Log it and move on.
			service.log.Warn("Failed to delete provenance record for rule: %w", err)
		}
	}
	return nil
}

// ensureNamespace ensures that the rule has a valid namespace UID.
// If the rule does not have a namespace UID or the namespace (folder) does not exist it will return an error.
// If the folder is managed by a manager, it will also return an error.
func (service *LegacyRuleService) ensureNamespace(ctx context.Context, user identity.Requester, orgID int64, namespaceUID string) error {
	if namespaceUID == "" {
		return fmt.Errorf("%w: folderUID must be set", models.ErrAlertRuleFailedValidation)
	}
	if folder.IsRootFolderUID(namespaceUID) {
		return fmt.Errorf("%w: folderUID cannot be the root folder", models.ErrAlertRuleFailedValidation)
	}

	if service.folderService == nil {
		// folder service is nil when this is called during file provisioning,
		// which already creates the folder if it does not exist
		return nil
	}

	// ensure the namespace exists
	f, err := service.folderService.Get(ctx, &folder.GetFolderQuery{
		OrgID:        orgID,
		UID:          &namespaceUID,
		SignedInUser: user,
	})
	if err != nil || f == nil {
		if errors.Is(err, dashboards.ErrFolderNotFound) {
			return fmt.Errorf("%w: folder does not exist", models.ErrAlertRuleFailedValidation)
		}
		return err
	}

	// check if the folder is managed by a manager
	if err := models.NewNamespace(f).ValidateForRuleStorage(); err != nil {
		return fmt.Errorf("%w: %s", models.ErrAlertRuleFailedValidation, err)
	}

	return nil
}

func userUidOrFallback(user identity.Requester) *models.UserUID {
	userUID := models.NewUserUID(user)
	if user == nil {
		return &models.FileProvisioningUserUID
	}
	return userUID
}
