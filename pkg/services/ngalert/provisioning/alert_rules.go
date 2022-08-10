package provisioning

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/util"
)

type AlertRuleService struct {
	defaultIntervalSeconds int64
	baseIntervalSeconds    int64
	ruleStore              RuleStore
	provenanceStore        ProvisioningStore
	quotas                 QuotaChecker
	xact                   TransactionManager
	log                    log.Logger
}

func NewAlertRuleService(ruleStore RuleStore,
	provenanceStore ProvisioningStore,
	quotas QuotaChecker,
	xact TransactionManager,
	defaultIntervalSeconds int64,
	baseIntervalSeconds int64,
	log log.Logger) *AlertRuleService {
	return &AlertRuleService{
		defaultIntervalSeconds: defaultIntervalSeconds,
		baseIntervalSeconds:    baseIntervalSeconds,
		ruleStore:              ruleStore,
		provenanceStore:        provenanceStore,
		quotas:                 quotas,
		xact:                   xact,
		log:                    log,
	}
}

func (service *AlertRuleService) GetAlertRule(ctx context.Context, orgID int64, ruleUID string) (models.AlertRule, models.Provenance, error) {
	query := &models.GetAlertRuleByUIDQuery{
		OrgID: orgID,
		UID:   ruleUID,
	}
	err := service.ruleStore.GetAlertRuleByUID(ctx, query)
	if err != nil {
		return models.AlertRule{}, models.ProvenanceNone, err
	}
	provenance, err := service.provenanceStore.GetProvenance(ctx, query.Result, orgID)
	if err != nil {
		return models.AlertRule{}, models.ProvenanceNone, err
	}
	return *query.Result, provenance, nil
}

// CreateAlertRule creates a new alert rule. This function will ignore any
// interval that is set in the rule struct and use the already existing group
// interval or the default one.
func (service *AlertRuleService) CreateAlertRule(ctx context.Context, rule models.AlertRule, provenance models.Provenance, userID int64) (models.AlertRule, error) {
	if rule.UID == "" {
		rule.UID = util.GenerateShortUID()
	}
	interval, err := service.ruleStore.GetRuleGroupInterval(ctx, rule.OrgID, rule.NamespaceUID, rule.RuleGroup)
	// if the alert group does not exists we just use the default interval
	if err != nil && errors.Is(err, store.ErrAlertRuleGroupNotFound) {
		interval = service.defaultIntervalSeconds
	} else if err != nil {
		return models.AlertRule{}, err
	}
	rule.IntervalSeconds = interval
	err = rule.SetDashboardAndPanel()
	if err != nil {
		return models.AlertRule{}, err
	}
	rule.Updated = time.Now()
	err = service.xact.InTransaction(ctx, func(ctx context.Context) error {
		ids, err := service.ruleStore.InsertAlertRules(ctx, []models.AlertRule{
			rule,
		})
		if err != nil {
			return err
		}
		if id, ok := ids[rule.UID]; ok {
			rule.ID = id
		} else {
			return errors.New("couldn't find newly created id")
		}

		limitReached, err := service.quotas.CheckQuotaReached(ctx, "alert_rule", &quota.ScopeParameters{
			OrgID:  rule.OrgID,
			UserID: userID,
		})
		if err != nil {
			return fmt.Errorf("failed to check alert rule quota: %w", err)
		}
		if limitReached {
			return models.ErrQuotaReached
		}

		return service.provenanceStore.SetProvenance(ctx, &rule, rule.OrgID, provenance)
	})
	if err != nil {
		return models.AlertRule{}, err
	}
	return rule, nil
}

func (service *AlertRuleService) GetRuleGroup(ctx context.Context, orgID int64, folder, group string) (definitions.AlertRuleGroup, error) {
	q := models.ListAlertRulesQuery{
		OrgID:         orgID,
		NamespaceUIDs: []string{folder},
		RuleGroup:     group,
	}
	if err := service.ruleStore.ListAlertRules(ctx, &q); err != nil {
		return definitions.AlertRuleGroup{}, err
	}
	if len(q.Result) == 0 {
		return definitions.AlertRuleGroup{}, store.ErrAlertRuleGroupNotFound
	}
	res := definitions.AlertRuleGroup{
		Title:     q.Result[0].RuleGroup,
		FolderUID: q.Result[0].NamespaceUID,
		Interval:  q.Result[0].IntervalSeconds,
		Rules:     []models.AlertRule{},
	}
	for _, r := range q.Result {
		if r != nil {
			res.Rules = append(res.Rules, *r)
		}
	}
	return res, nil
}

// UpdateRuleGroup will update the interval for all rules in the group.
func (service *AlertRuleService) UpdateRuleGroup(ctx context.Context, orgID int64, namespaceUID string, ruleGroup string, intervalSeconds int64) error {
	if err := models.ValidateRuleGroupInterval(intervalSeconds, service.baseIntervalSeconds); err != nil {
		return err
	}
	return service.xact.InTransaction(ctx, func(ctx context.Context) error {
		query := &models.ListAlertRulesQuery{
			OrgID:         orgID,
			NamespaceUIDs: []string{namespaceUID},
			RuleGroup:     ruleGroup,
		}
		err := service.ruleStore.ListAlertRules(ctx, query)
		if err != nil {
			return fmt.Errorf("failed to list alert rules: %w", err)
		}
		updateRules := make([]store.UpdateRule, 0, len(query.Result))
		for _, rule := range query.Result {
			if rule.IntervalSeconds == intervalSeconds {
				continue
			}
			newRule := *rule
			newRule.IntervalSeconds = intervalSeconds
			updateRules = append(updateRules, store.UpdateRule{
				Existing: rule,
				New:      newRule,
			})
		}
		return service.ruleStore.UpdateAlertRules(ctx, updateRules)
	})
}

// CreateAlertRule creates a new alert rule. This function will ignore any
// interval that is set in the rule struct and fetch the current group interval
// from database.
func (service *AlertRuleService) UpdateAlertRule(ctx context.Context, rule models.AlertRule, provenance models.Provenance) (models.AlertRule, error) {
	storedRule, storedProvenance, err := service.GetAlertRule(ctx, rule.OrgID, rule.UID)
	if err != nil {
		return models.AlertRule{}, err
	}
	if storedProvenance != provenance && storedProvenance != models.ProvenanceNone {
		return models.AlertRule{}, fmt.Errorf("cannot changed provenance from '%s' to '%s'", storedProvenance, provenance)
	}
	rule.Updated = time.Now()
	rule.ID = storedRule.ID
	rule.IntervalSeconds, err = service.ruleStore.GetRuleGroupInterval(ctx, rule.OrgID, rule.NamespaceUID, rule.RuleGroup)
	if err != nil {
		return models.AlertRule{}, err
	}
	err = rule.SetDashboardAndPanel()
	if err != nil {
		return models.AlertRule{}, err
	}
	err = service.xact.InTransaction(ctx, func(ctx context.Context) error {
		err := service.ruleStore.UpdateAlertRules(ctx, []store.UpdateRule{
			{
				Existing: &storedRule,
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

func (service *AlertRuleService) DeleteAlertRule(ctx context.Context, orgID int64, ruleUID string, provenance models.Provenance) error {
	rule := &models.AlertRule{
		OrgID: orgID,
		UID:   ruleUID,
	}
	// check that provenance is not changed in a invalid way
	storedProvenance, err := service.provenanceStore.GetProvenance(ctx, rule, rule.OrgID)
	if err != nil {
		return err
	}
	if storedProvenance != provenance && storedProvenance != models.ProvenanceNone {
		return fmt.Errorf("cannot delete with provided provenance '%s', needs '%s'", provenance, storedProvenance)
	}
	return service.xact.InTransaction(ctx, func(ctx context.Context) error {
		err := service.ruleStore.DeleteAlertRulesByUID(ctx, orgID, ruleUID)
		if err != nil {
			return err
		}
		return service.provenanceStore.DeleteProvenance(ctx, rule, rule.OrgID)
	})
}
