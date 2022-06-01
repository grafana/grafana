package provisioning

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"
)

type AlertRuleService struct {
	defaultInterval int64
	ruleStore       store.RuleStore
	provenanceStore ProvisioningStore
	xact            TransactionManager
	log             log.Logger
}

func NewAlertRuleService(ruleStore store.RuleStore,
	provenanceStore ProvisioningStore,
	xact TransactionManager,
	defaultInterval int64,
	log log.Logger) *AlertRuleService {
	return &AlertRuleService{
		defaultInterval: defaultInterval,
		ruleStore:       ruleStore,
		provenanceStore: provenanceStore,
		xact:            xact,
		log:             log,
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

func (service *AlertRuleService) CreateAlertRule(ctx context.Context, rule models.AlertRule, provenance models.Provenance) (models.AlertRule, error) {
	if rule.UID == "" {
		rule.UID = util.GenerateShortUID()
	}
	interval, err := service.ruleStore.GetRuleGroupInterval(ctx, rule.OrgID, rule.NamespaceUID, rule.RuleGroup)
	// if the alert group does not exists we just use the default interval
	if err != nil && errors.Is(err, store.ErrAlertRuleGroupNotFound) {
		interval = service.defaultInterval
	} else if err != nil {
		return models.AlertRule{}, err
	}
	rule.IntervalSeconds = interval
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
		err = service.ruleStore.UpdateRuleGroup(ctx, rule.OrgID, rule.NamespaceUID, rule.RuleGroup, rule.IntervalSeconds)
		if err != nil {
			return err
		}
		return service.provenanceStore.SetProvenance(ctx, &rule, rule.OrgID, provenance)
	})
	if err != nil {
		return models.AlertRule{}, err
	}
	return rule, nil
}

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
	service.log.Info("update rule", "ID", storedRule.ID, "labels", fmt.Sprintf("%+v", rule.Labels))
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
		err = service.ruleStore.UpdateRuleGroup(ctx, rule.OrgID, rule.NamespaceUID, rule.RuleGroup, rule.IntervalSeconds)
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

func (service *AlertRuleService) UpdateAlertGroup(ctx context.Context, orgID int64, folderUID, roulegroup string, interval int64) error {
	return service.ruleStore.UpdateRuleGroup(ctx, orgID, folderUID, roulegroup, interval)
}
