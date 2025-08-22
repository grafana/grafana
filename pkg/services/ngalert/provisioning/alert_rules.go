package provisioning

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/util"
)

type ruleAccessControlService interface {
	AuthorizeRuleGroupRead(ctx context.Context, user identity.Requester, rules models.RulesGroup) error
	AuthorizeRuleGroupWrite(ctx context.Context, user identity.Requester, change *store.GroupDelta) error
	AuthorizeRuleRead(ctx context.Context, user identity.Requester, rule *models.AlertRule) error
	// CanReadAllRules returns true if the user has full access to read rules via provisioning API and bypass regular checks
	CanReadAllRules(ctx context.Context, user identity.Requester) (bool, error)
	// CanWriteAllRules returns true if the user has full access to write rules via provisioning API and bypass regular checks
	CanWriteAllRules(ctx context.Context, user identity.Requester) (bool, error)
}

var errProvenanceMismatch = errutil.NewBase(errutil.StatusConflict, "alerting.provenanceMismatch").MustTemplate(
	"cannot {{ .Public.Operation }} with provided provenance '{{ .Public.ProvidedProvenance }}', needs '{{ .Public.StoredProvenance }}'",
	errutil.WithPublic("cannot {{ .Public.Operation }} with provided provenance '{{ .Public.ProvidedProvenance }}', needs '{{ .Public.StoredProvenance }}'"),
)

type NotificationSettingsValidatorProvider interface {
	Validator(ctx context.Context, orgID int64) (notifier.NotificationSettingsValidator, error)
}

type AlertRuleService struct {
	defaultIntervalSeconds int64
	baseIntervalSeconds    int64
	rulesPerRuleGroupLimit int64
	ruleStore              RuleStore
	provenanceStore        ProvisioningStore
	folderService          folder.Service
	quotas                 QuotaChecker
	xact                   TransactionManager
	log                    log.Logger
	nsValidatorProvider    NotificationSettingsValidatorProvider
	authz                  ruleAccessControlService
}

func NewAlertRuleService(ruleStore RuleStore,
	provenanceStore ProvisioningStore,
	folderService folder.Service,
	quotas QuotaChecker,
	xact TransactionManager,
	defaultIntervalSeconds int64,
	baseIntervalSeconds int64,
	rulesPerRuleGroupLimit int64,
	log log.Logger,
	ns NotificationSettingsValidatorProvider,
	authz RuleAccessControlService,
) *AlertRuleService {
	return &AlertRuleService{
		defaultIntervalSeconds: defaultIntervalSeconds,
		baseIntervalSeconds:    baseIntervalSeconds,
		rulesPerRuleGroupLimit: rulesPerRuleGroupLimit,
		ruleStore:              ruleStore,
		provenanceStore:        provenanceStore,
		folderService:          folderService,
		quotas:                 quotas,
		xact:                   xact,
		log:                    log,
		nsValidatorProvider:    ns,
		authz:                  newRuleAccessControlService(authz),
	}
}

func (service *AlertRuleService) GetAlertRules(ctx context.Context, user identity.Requester) ([]*models.AlertRule, map[string]models.Provenance, error) {
	q := models.ListAlertRulesQuery{
		OrgID: user.GetOrgID(),
	}
	rules, err := service.ruleStore.ListAlertRules(ctx, &q)
	if err != nil {
		return nil, nil, err
	}
	provenances := make(map[string]models.Provenance)
	if len(rules) > 0 {
		resourceType := rules[0].ResourceType()
		provenances, err = service.provenanceStore.GetProvenances(ctx, user.GetOrgID(), resourceType)
		if err != nil {
			return nil, nil, err
		}
	}

	can, err := service.authz.CanReadAllRules(ctx, user)
	if err != nil {
		return nil, nil, err
	}
	if can {
		return rules, provenances, nil
	}
	// If user does not have blanket privilege to read rules, remove all rules that are not allowed to the user.
	groups := models.GroupByAlertRuleGroupKey(rules)
	result := make([]*models.AlertRule, 0, len(rules))
	for _, group := range groups {
		if err := service.authz.AuthorizeRuleGroupRead(ctx, user, group); err != nil {
			if errors.Is(err, accesscontrol.ErrAuthorizationBase) {
				// remove provenances for rules that will not be added to the output
				for _, rule := range group {
					delete(provenances, rule.ResourceID())
				}
				continue
			}
			return nil, nil, err
		}
		result = append(result, group...)
	}
	return result, provenances, nil
}

func (service *AlertRuleService) getAlertRuleAuthorized(ctx context.Context, user identity.Requester, ruleUID string) (models.AlertRule, error) {
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

func (service *AlertRuleService) GetAlertRule(ctx context.Context, user identity.Requester, ruleUID string) (models.AlertRule, models.Provenance, error) {
	rule, err := service.getAlertRuleAuthorized(ctx, user, ruleUID)
	if err != nil {
		return models.AlertRule{}, models.ProvenanceNone, err
	}
	provenance, err := service.provenanceStore.GetProvenance(ctx, &rule, user.GetOrgID())
	if err != nil {
		return models.AlertRule{}, models.ProvenanceNone, err
	}
	return rule, provenance, nil
}

type AlertRuleWithFolderFullpath struct {
	AlertRule      models.AlertRule
	FolderFullpath string
}

// GetAlertRuleWithFolderFullpath returns a single alert rule with its folder title.
func (service *AlertRuleService) GetAlertRuleWithFolderFullpath(ctx context.Context, user identity.Requester, ruleUID string) (AlertRuleWithFolderFullpath, error) {
	rule, err := service.getAlertRuleAuthorized(ctx, user, ruleUID)
	if err != nil {
		return AlertRuleWithFolderFullpath{}, err
	}

	fq := folder.GetFolderQuery{
		OrgID:        user.GetOrgID(),
		UID:          &rule.NamespaceUID,
		WithFullpath: true,
		SignedInUser: user,
	}

	f, err := service.folderService.Get(ctx, &fq)
	if err != nil {
		return AlertRuleWithFolderFullpath{}, err
	}

	return AlertRuleWithFolderFullpath{
		AlertRule:      rule,
		FolderFullpath: f.Fullpath,
	}, nil
}

// CreateAlertRule creates a new alert rule. This function will ignore any
// interval that is set in the rule struct and use the already existing group
// interval or the default one.
func (service *AlertRuleService) CreateAlertRule(ctx context.Context, user identity.Requester, rule models.AlertRule, provenance models.Provenance) (models.AlertRule, error) {
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
		delta, err := store.CalculateRuleCreate(ctx, service.ruleStore, &rule)
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
	rule.IntervalSeconds = interval
	err = rule.SetDashboardAndPanelFromAnnotations()
	if err != nil {
		return models.AlertRule{}, err
	}
	rule.Updated = time.Now()
	if len(rule.NotificationSettings) > 0 {
		validator, err := service.nsValidatorProvider.Validator(ctx, rule.OrgID)
		if err != nil {
			return models.AlertRule{}, err
		}
		for _, setting := range rule.NotificationSettings {
			if err := validator.Validate(setting); err != nil {
				return models.AlertRule{}, errors.Join(models.ErrAlertRuleFailedValidation, err)
			}
		}
	}
	err = service.xact.InTransaction(ctx, func(ctx context.Context) error {
		ids, err := service.ruleStore.InsertAlertRules(ctx, userUidOrFallback(user), []models.AlertRule{
			rule,
		})
		if err != nil {
			return err
		}
		var fixed bool
		for _, key := range ids {
			if key.UID == rule.UID {
				rule.ID = key.ID
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

		return service.provenanceStore.SetProvenance(ctx, &rule, rule.OrgID, provenance)
	})
	if err != nil {
		return models.AlertRule{}, err
	}
	return rule, nil
}

// FilterOptions provides filtering for alert rule queries.
// All fields are optional and will be applied as filters if provided.
type FilterOptions struct {
	HasPrometheusRuleDefinition *bool
	RuleGroups                  []string
	NamespaceUIDs               []string
}

func (opts *FilterOptions) apply(q models.ListAlertRulesQuery) models.ListAlertRulesQuery {
	if opts == nil {
		return q
	}

	if opts.HasPrometheusRuleDefinition != nil {
		q.HasPrometheusRuleDefinition = opts.HasPrometheusRuleDefinition
	}

	if len(opts.NamespaceUIDs) > 0 {
		q.NamespaceUIDs = opts.NamespaceUIDs
	}

	if len(opts.RuleGroups) > 0 {
		q.RuleGroups = opts.RuleGroups
	}

	return q
}

func (service *AlertRuleService) GetRuleGroup(ctx context.Context, user identity.Requester, namespaceUID, group string) (models.AlertRuleGroup, error) {
	q := models.ListAlertRulesQuery{
		OrgID:         user.GetOrgID(),
		NamespaceUIDs: []string{namespaceUID},
		RuleGroups:    []string{group},
	}

	ruleList, err := service.ruleStore.ListAlertRules(ctx, &q)
	if err != nil {
		return models.AlertRuleGroup{}, err
	}
	if len(ruleList) == 0 {
		return models.AlertRuleGroup{}, models.ErrAlertRuleGroupNotFound.Errorf("")
	}

	can, err := service.authz.CanReadAllRules(ctx, user)
	if err != nil {
		return models.AlertRuleGroup{}, err
	}
	if !can {
		if err := service.authz.AuthorizeRuleGroupRead(ctx, user, ruleList); err != nil {
			return models.AlertRuleGroup{}, err
		}
	}
	res := models.AlertRuleGroup{
		Title:     ruleList[0].RuleGroup,
		FolderUID: ruleList[0].NamespaceUID,
		Interval:  ruleList[0].IntervalSeconds,
		Rules:     make([]models.AlertRule, 0, len(ruleList)),
	}
	for _, r := range ruleList {
		if r != nil {
			res.Rules = append(res.Rules, *r)
		}
	}
	return res, nil
}

// UpdateRuleGroup will update the interval for all rules in the group.
func (service *AlertRuleService) UpdateRuleGroup(ctx context.Context, user identity.Requester, namespaceUID string, ruleGroup string, intervalSeconds int64) error {
	if err := models.ValidateRuleGroupInterval(intervalSeconds, service.baseIntervalSeconds); err != nil {
		return err
	}
	return service.xact.InTransaction(ctx, func(ctx context.Context) error {
		query := &models.ListAlertRulesQuery{
			OrgID:         user.GetOrgID(),
			NamespaceUIDs: []string{namespaceUID},
			RuleGroups:    []string{ruleGroup},
		}
		ruleList, err := service.ruleStore.ListAlertRules(ctx, query)
		if err != nil {
			return fmt.Errorf("failed to list alert rules: %w", err)
		}
		updateRules := make([]models.UpdateRule, 0, len(ruleList))
		for _, rule := range ruleList {
			if rule.IntervalSeconds == intervalSeconds {
				continue
			}
			newRule := *rule
			newRule.IntervalSeconds = intervalSeconds
			updateRules = append(updateRules, models.UpdateRule{
				Existing: rule,
				New:      newRule,
			})
		}

		// check if user has write access to all rules and can bypass the regular checks.
		can, err := service.authz.CanWriteAllRules(ctx, user)
		if err != nil {
			return err
		}
		// If it cannot, check that the user is authorized to perform all the changes caused by this request
		if !can {
			groupKey := models.AlertRuleGroupKey{
				OrgID:        user.GetOrgID(),
				NamespaceUID: namespaceUID,
				RuleGroup:    ruleGroup,
			}
			ruleDeltas := make([]store.RuleDelta, 0, len(ruleList))
			for _, upd := range updateRules {
				updNew := upd.New
				ruleDeltas = append(ruleDeltas, store.RuleDelta{
					Existing: upd.Existing,
					New:      &updNew,
				})
			}
			delta := &store.GroupDelta{
				GroupKey: groupKey,
				AffectedGroups: map[models.AlertRuleGroupKey]models.RulesGroup{
					groupKey: ruleList,
				},
				Update: ruleDeltas,
			}
			if err := service.authz.AuthorizeRuleGroupWrite(ctx, user, delta); err != nil {
				return err
			}
		}

		return service.ruleStore.UpdateAlertRules(ctx, userUidOrFallback(user), updateRules)
	})
}

func (service *AlertRuleService) ReplaceRuleGroup(ctx context.Context, user identity.Requester, group models.AlertRuleGroup, provenance models.Provenance) error {
	if err := models.ValidateRuleGroupInterval(group.Interval, service.baseIntervalSeconds); err != nil {
		return err
	}

	for _, rule := range group.Rules {
		if rule.UID == "" {
			// if empty the UID will be generated before save
			continue
		}
		if err := util.ValidateUID(rule.UID); err != nil {
			return fmt.Errorf("%w: cannot create rule with UID %q: %w", models.ErrAlertRuleFailedValidation, rule.UID, err)
		}
	}

	delta, err := service.calcDelta(ctx, user, group)
	if err != nil {
		return err
	}

	if delta.IsEmpty() {
		return nil
	}

	// check if the current user has permissions to all rules and can bypass the regular authorization validation.
	can, err := service.authz.CanWriteAllRules(ctx, user)
	if err != nil {
		return err
	}

	if !can {
		if err := service.authz.AuthorizeRuleGroupWrite(ctx, user, delta); err != nil {
			return err
		}
	}

	newOrUpdatedNotificationSettings := delta.NewOrUpdatedNotificationSettings()
	if len(newOrUpdatedNotificationSettings) > 0 {
		validator, err := service.nsValidatorProvider.Validator(ctx, delta.GroupKey.OrgID)
		if err != nil {
			return err
		}
		for _, s := range newOrUpdatedNotificationSettings {
			if err := validator.Validate(s); err != nil {
				return errors.Join(models.ErrAlertRuleFailedValidation, err)
			}
		}
	}

	return service.persistDelta(ctx, user, delta, provenance)
}

func (service *AlertRuleService) ReplaceRuleGroups(ctx context.Context, user identity.Requester, groups []*models.AlertRuleGroup, provenance models.Provenance) error {
	err := service.xact.InTransaction(ctx, func(ctx context.Context) error {
		for _, group := range groups {
			err := service.ReplaceRuleGroup(ctx, user, *group, provenance)
			if err != nil {
				return err
			}
		}
		return nil
	})

	return err
}

func (service *AlertRuleService) DeleteRuleGroup(ctx context.Context, user identity.Requester, namespaceUID, group string, provenance models.Provenance) error {
	return service.DeleteRuleGroups(ctx, user, provenance, &FilterOptions{
		NamespaceUIDs: []string{namespaceUID},
		RuleGroups:    []string{group},
	})
}

// DeleteRuleGroups deletes alert rule groups by the specified filter options.
func (service *AlertRuleService) DeleteRuleGroups(ctx context.Context, user identity.Requester, provenance models.Provenance, filterOpts *FilterOptions) error {
	q := models.ListAlertRulesQuery{}
	q = filterOpts.apply(q)
	q.OrgID = user.GetOrgID()

	deltas, err := store.CalculateRuleGroupsDelete(ctx, service.ruleStore, user.GetOrgID(), &q)
	if err != nil {
		return err
	}

	// Perform all deletions in a transaction
	return service.xact.InTransaction(ctx, func(ctx context.Context) error {
		for _, delta := range deltas {
			can, err := service.authz.CanWriteAllRules(ctx, user)
			if err != nil {
				return err
			}
			if !can {
				if err := service.authz.AuthorizeRuleGroupWrite(ctx, user, delta); err != nil {
					return err
				}
			}
			err = service.persistDelta(ctx, user, delta, provenance)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (service *AlertRuleService) calcDelta(ctx context.Context, user identity.Requester, group models.AlertRuleGroup) (*store.GroupDelta, error) {
	// If the provided request did not provide the rules list at all, treat it as though it does not wish to change rules.
	// This is done for backwards compatibility. Requests which specify only the interval must update only the interval.
	if group.Rules == nil {
		listRulesQuery := models.ListAlertRulesQuery{
			OrgID:         user.GetOrgID(),
			NamespaceUIDs: []string{group.FolderUID},
			RuleGroups:    []string{group.Title},
		}
		ruleList, err := service.ruleStore.ListAlertRules(ctx, &listRulesQuery)
		if err != nil {
			return nil, fmt.Errorf("failed to list alert rules: %w", err)
		}
		group.Rules = make([]models.AlertRule, 0, len(ruleList))
		for _, r := range ruleList {
			if r != nil {
				group.Rules = append(group.Rules, *r)
			}
		}
	}

	if err := service.checkGroupLimits(group); err != nil {
		return nil, fmt.Errorf("write rejected due to exceeded limits: %w", err)
	}

	key := models.AlertRuleGroupKey{
		OrgID:        user.GetOrgID(),
		NamespaceUID: group.FolderUID,
		RuleGroup:    group.Title,
	}
	rules := make([]*models.AlertRuleWithOptionals, 0, len(group.Rules))
	group = *syncGroupRuleFields(&group, user.GetOrgID())
	for i := range group.Rules {
		if err := group.Rules[i].SetDashboardAndPanelFromAnnotations(); err != nil {
			return nil, err
		}
		rules = append(rules, &models.AlertRuleWithOptionals{AlertRule: group.Rules[i], HasPause: true})
	}
	delta, err := store.CalculateChanges(ctx, service.ruleStore, key, rules)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate diff for alert rules: %w", err)
	}

	// Refresh all calculated fields across all rules.
	return store.UpdateCalculatedRuleFields(delta), nil
}

func (service *AlertRuleService) persistDelta(ctx context.Context, user identity.Requester, delta *store.GroupDelta, provenance models.Provenance) error {
	return service.xact.InTransaction(ctx, func(ctx context.Context) error {
		// Delete first as this could prevent future unique constraint violations.
		if len(delta.Delete) > 0 {
			for _, del := range delta.Delete {
				// check that provenance is not changed in an invalid way
				storedProvenance, err := service.provenanceStore.GetProvenance(ctx, del, user.GetOrgID())
				if err != nil {
					return err
				}
				if canUpdate := validation.CanUpdateProvenanceInRuleGroup(storedProvenance, provenance); !canUpdate {
					return errProvenanceMismatch.Build(errutil.TemplateData{
						Public: map[string]interface{}{
							"ProvidedProvenance": provenance,
							"StoredProvenance":   storedProvenance,
							"Operation":          "delete",
						},
					})
				}
			}
			if err := service.deleteRules(ctx, user, delta.Delete...); err != nil {
				return err
			}
		}

		if len(delta.Update) > 0 {
			updates := make([]models.UpdateRule, 0, len(delta.Update))
			for _, update := range delta.Update {
				// check that provenance is not changed in an invalid way
				storedProvenance, err := service.provenanceStore.GetProvenance(ctx, update.New, user.GetOrgID())
				if err != nil {
					return err
				}
				if canUpdate := validation.CanUpdateProvenanceInRuleGroup(storedProvenance, provenance); !canUpdate {
					return errProvenanceMismatch.Build(errutil.TemplateData{
						Public: map[string]interface{}{
							"ProvidedProvenance": provenance,
							"StoredProvenance":   storedProvenance,
							"Operation":          "update",
						},
					})
				}
				updates = append(updates, models.UpdateRule{
					Existing: update.Existing,
					New:      *update.New,
				})
			}
			if err := service.ruleStore.UpdateAlertRules(ctx, userUidOrFallback(user), updates); err != nil {
				return fmt.Errorf("failed to update alert rules: %w", err)
			}
			for _, update := range delta.Update {
				if err := service.provenanceStore.SetProvenance(ctx, update.New, user.GetOrgID(), provenance); err != nil {
					return err
				}
			}
		}

		if len(delta.New) > 0 {
			uids, err := service.ruleStore.InsertAlertRules(ctx, userUidOrFallback(user), withoutNilAlertRules(delta.New))
			if err != nil {
				return fmt.Errorf("failed to insert alert rules: %w", err)
			}
			for _, key := range uids {
				if err := service.provenanceStore.SetProvenance(ctx, &models.AlertRule{UID: key.UID}, user.GetOrgID(), provenance); err != nil {
					return err
				}
			}
		}

		if err := service.checkLimitsTransactionCtx(ctx, user); err != nil {
			return err
		}

		return nil
	})
}

// UpdateAlertRule updates an alert rule.
func (service *AlertRuleService) UpdateAlertRule(ctx context.Context, user identity.Requester, rule models.AlertRule, provenance models.Provenance) (models.AlertRule, error) {
	var storedRule *models.AlertRule
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
		delta, err := store.CalculateRuleUpdate(ctx, service.ruleStore, &models.AlertRuleWithOptionals{AlertRule: rule})
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
	storedProvenance, err := service.provenanceStore.GetProvenance(ctx, storedRule, storedRule.OrgID)
	if err != nil {
		return models.AlertRule{}, err
	}
	if storedProvenance != provenance && storedProvenance != models.ProvenanceNone {
		return models.AlertRule{}, fmt.Errorf("cannot change provenance from '%s' to '%s'", storedProvenance, provenance)
	}
	if len(rule.NotificationSettings) > 0 {
		validator, err := service.nsValidatorProvider.Validator(ctx, rule.OrgID)
		if err != nil {
			return models.AlertRule{}, err
		}
		for _, setting := range rule.NotificationSettings {
			if err := validator.Validate(setting); err != nil {
				return models.AlertRule{}, errors.Join(models.ErrAlertRuleFailedValidation, err)
			}
		}
	}
	rule.Updated = time.Now()
	rule.ID = storedRule.ID
	rule.IntervalSeconds = storedRule.IntervalSeconds

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
		return service.provenanceStore.SetProvenance(ctx, &rule, rule.OrgID, provenance)
	})
	if err != nil {
		return models.AlertRule{}, err
	}
	return rule, err
}

func (service *AlertRuleService) DeleteAlertRule(ctx context.Context, user identity.Requester, ruleUID string, provenance models.Provenance) error {
	rule := &models.AlertRule{
		OrgID: user.GetOrgID(),
		UID:   ruleUID,
	}
	// check that provenance is not changed in an invalid way
	storedProvenance, err := service.provenanceStore.GetProvenance(ctx, rule, rule.OrgID)
	if err != nil {
		return err
	}
	if storedProvenance != provenance && storedProvenance != models.ProvenanceNone {
		return errProvenanceMismatch.Build(errutil.TemplateData{
			Public: map[string]interface{}{
				"ProvidedProvenance": provenance,
				"StoredProvenance":   storedProvenance,
				"Operation":          "delete",
			},
		})
	}

	can, err := service.authz.CanWriteAllRules(ctx, user)
	if err != nil {
		return err
	}
	if !can {
		delta, err := store.CalculateRuleDelete(ctx, service.ruleStore, rule.GetKey())
		if err != nil {
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
func (service *AlertRuleService) checkLimitsTransactionCtx(ctx context.Context, user identity.Requester) error {
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
func (service *AlertRuleService) deleteRules(ctx context.Context, user identity.Requester, targets ...*models.AlertRule) error {
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

// GetAlertRuleGroupWithFolderFullpath returns the alert rule group with folder title.
func (service *AlertRuleService) GetAlertRuleGroupWithFolderFullpath(ctx context.Context, user identity.Requester, namespaceUID, group string) (models.AlertRuleGroupWithFolderFullpath, error) {
	ruleList, err := service.GetRuleGroup(ctx, user, namespaceUID, group)
	if err != nil {
		return models.AlertRuleGroupWithFolderFullpath{}, err
	}

	fq := folder.GetFolderQuery{
		OrgID:        user.GetOrgID(),
		UID:          &namespaceUID,
		WithFullpath: true,
		SignedInUser: user,
	}
	f, err := service.folderService.Get(ctx, &fq)
	if err != nil {
		return models.AlertRuleGroupWithFolderFullpath{}, err
	}

	res := models.NewAlertRuleGroupWithFolderFullpath(ruleList.Rules[0].GetGroupKey(), ruleList.Rules, f.Fullpath)
	return res, nil
}

// GetAlertGroupsWithFolderFullpath returns all groups that have at least one alert with the full folder path for each group.

// It queries all alert rules for the user's organization, applies optional filtering specified in filterOpts,
// and groups the rules by groups. The function then fetches folder details (including the full path)
// for each namespace (folder UID) associated with the rule groups. If the user lacks blanket read permissions,
// only the groups that the user is authorized to view are returned.
func (service *AlertRuleService) GetAlertGroupsWithFolderFullpath(ctx context.Context, user identity.Requester, filterOpts *FilterOptions) ([]models.AlertRuleGroupWithFolderFullpath, error) {
	q := models.ListAlertRulesQuery{
		OrgID: user.GetOrgID(),
	}
	q = filterOpts.apply(q)

	ruleList, err := service.ruleStore.ListAlertRules(ctx, &q)
	if err != nil {
		return nil, err
	}
	groups := models.GroupByAlertRuleGroupKey(ruleList)

	can, err := service.authz.CanReadAllRules(ctx, user)
	if err != nil {
		return nil, err
	}
	if !can {
		// if user cannot read all rules, check read access to each group and remove groups that the user does not have access to
		for key, group := range groups {
			if err := service.authz.AuthorizeRuleGroupRead(ctx, user, group); err != nil {
				if errors.Is(err, accesscontrol.ErrAuthorizationBase) {
					delete(groups, key)
					continue
				}
				return nil, err
			}
		}
	}

	namespaces := make(map[string][]*models.AlertRuleGroupKey)
	for groupKey := range groups {
		namespaces[groupKey.NamespaceUID] = append(namespaces[groupKey.NamespaceUID], util.Pointer(groupKey))
	}

	if len(namespaces) == 0 {
		return []models.AlertRuleGroupWithFolderFullpath{}, nil
	}

	fq := folder.GetFoldersQuery{
		OrgID:        user.GetOrgID(),
		UIDs:         nil,
		WithFullpath: true,
		SignedInUser: user,
	}
	for uid := range namespaces {
		fq.UIDs = append(fq.UIDs, uid)
	}

	// We need folder titles for the provisioning file format. We do it this way instead of using GetUserVisibleNamespaces to avoid folder:read permissions that should not apply to those with alert.provisioning:read.
	folders, err := service.folderService.GetFolders(ctx, fq)
	if err != nil {
		return nil, err
	}
	folderUidToFullpath := make(map[string]string)
	for _, folder := range folders {
		folderUidToFullpath[folder.UID] = folder.Fullpath
	}

	result := make([]models.AlertRuleGroupWithFolderFullpath, 0)
	for groupKey, rules := range groups {
		fullpath, ok := folderUidToFullpath[groupKey.NamespaceUID]
		if !ok {
			return nil, fmt.Errorf("cannot find full path for folder with uid '%s'", groupKey.NamespaceUID)
		}
		result = append(result, models.NewAlertRuleGroupWithFolderFullpathFromRulesGroup(groupKey, rules, fullpath))
	}

	// Return results in a stable manner.
	models.SortAlertRuleGroupWithFolderTitle(result)
	return result, nil
}

// syncRuleGroupFields synchronizes calculated fields across multiple rules in a group.
func syncGroupRuleFields(group *models.AlertRuleGroup, orgID int64) *models.AlertRuleGroup {
	for i := range group.Rules {
		group.Rules[i].IntervalSeconds = group.Interval
		group.Rules[i].RuleGroup = group.Title
		group.Rules[i].NamespaceUID = group.FolderUID
		group.Rules[i].OrgID = orgID
		group.Rules[i].RuleGroupIndex = i
	}
	return group
}

func withoutNilAlertRules(ptrs []*models.AlertRule) []models.AlertRule {
	result := make([]models.AlertRule, 0, len(ptrs))
	for _, ptr := range ptrs {
		if ptr != nil {
			result = append(result, *ptr)
		}
	}
	return result
}

func (service *AlertRuleService) checkGroupLimits(group models.AlertRuleGroup) error {
	if service.rulesPerRuleGroupLimit > 0 && int64(len(group.Rules)) > service.rulesPerRuleGroupLimit {
		service.log.Warn("Large rule group was edited. Large groups are discouraged and may be rejected in the future.",
			"limit", service.rulesPerRuleGroupLimit,
			"actual", len(group.Rules),
			"group", group.Title,
		)
	}

	return nil
}

// ensureNamespace ensures that the rule has a valid namespace UID.
// If the rule does not have a namespace UID or the namespace (folder) does not exist it will return an error.
func (service *AlertRuleService) ensureNamespace(ctx context.Context, user identity.Requester, orgID int64, namespaceUID string) error {
	if namespaceUID == "" {
		return fmt.Errorf("%w: folderUID must be set", models.ErrAlertRuleFailedValidation)
	}

	if service.folderService == nil {
		// folder service is nil when this is called during file provisioning,
		// which already creates the folder if it does not exist
		return nil
	}

	// ensure the namespace exists
	_, err := service.folderService.Get(ctx, &folder.GetFolderQuery{
		OrgID:        orgID,
		UID:          &namespaceUID,
		SignedInUser: user,
	})
	if err != nil {
		if errors.Is(err, dashboards.ErrFolderNotFound) {
			return fmt.Errorf("%w: folder does not exist", models.ErrAlertRuleFailedValidation)
		}
		return err
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
