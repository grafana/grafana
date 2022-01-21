package services

import (
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

type RuleService interface {
	GetRule(orgID int64, uid string) (models.AlertRule, error)
	CreateRule(models.AlertRule) error
	UpdateRule(models.AlertRule) error
	DeleteRule(orgID int64, uid string) error
}

type GrafanaRuleService struct {
	store store.RuleStore
}

func NewGrafanaRuleService(store store.RuleStore) RuleService {
	return &GrafanaRuleService{
		store: store,
	}
}

func (service *GrafanaRuleService) GetRule(orgID int64, uid string) (models.AlertRule, error) {
	query := &models.GetAlertRuleByUIDQuery{
		UID:   uid,
		OrgID: orgID,
	}
	err := service.store.GetAlertRuleByUID(query)
	if err != nil {
		return models.AlertRule{}, err
	}

	return *query.Result, nil
}

func (service *GrafanaRuleService) CreateRule(rule models.AlertRule) error {
	return service.store.UpsertAlertRules([]store.UpsertRule{
		{
			New: rule,
		},
	})
}

func (service *GrafanaRuleService) UpdateRule(rule models.AlertRule) error {
	existingRule, err := service.GetRule(rule.OrgID, rule.UID)
	if err != nil {
		return err
	}
	return service.store.UpsertAlertRules([]store.UpsertRule{
		{
			New:      rule,
			Existing: &existingRule,
		},
	})
}

func (service *GrafanaRuleService) DeleteRule(orgID int64, uid string) error {
	return service.store.DeleteAlertRuleByUID(orgID, uid)
}
