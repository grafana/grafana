package provisioning

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

type AlertRuleService struct {
	ruleStore       store.RuleStore
	provenanceStore ProvisioningStore
	xact            TransactionManager
	log             log.Logger
}

func NewAlertRuleService(ruleStore store.RuleStore,
	provenanceStore ProvisioningStore,
	xact TransactionManager,
	log log.Logger) AlertRuleService {
	return AlertRuleService{
		ruleStore:       ruleStore,
		provenanceStore: provenanceStore,
		xact:            xact,
		log:             log,
	}
}

func (service *AlertRuleService) GetAlertRule(ctx context.Context, uid string) (models.AlertRule, error) {
	return models.AlertRule{}, nil
}

func (service *AlertRuleService) CreateAlertRule(ctx context.Context, provenance models.Provenance) error {
	return service.xact.InTransaction(ctx, func(ctx context.Context) error {
		err := service.ruleStore.UpsertAlertRules(ctx, []store.UpsertRule{
			{
				New: models.AlertRule{
					OrgID: 1,
				},
			},
		})
		if err != nil {
			return err
		}
		return service.provenanceStore.SetProvenance(ctx, provenanceOrgAdapter{}, provenance)
	})
}

func (service *AlertRuleService) UpdateAlertRule(ctx context.Context, provenance models.Provenance) error {
	storedRule, err := service.GetAlertRule(ctx, "someuid")
	if err != nil {
		return err
	}
	return service.xact.InTransaction(ctx, func(ctx context.Context) error {
		err := service.ruleStore.UpsertAlertRules(ctx, []store.UpsertRule{
			{
				Existing: &storedRule,
				New: models.AlertRule{
					OrgID: 1,
				},
			},
		})
		if err != nil {
			return err
		}
		return service.provenanceStore.SetProvenance(ctx, provenanceOrgAdapter{}, provenance)
	})
}

func (service *AlertRuleService) DeleteALertRule() error {
	return nil
}
