package state

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// InstanceStore represents the ability to fetch and write alert instances.
type InstanceStore interface {
	FetchOrgIds(ctx context.Context) ([]int64, error)
	ListAlertInstances(ctx context.Context, cmd *models.ListAlertInstancesQuery) error
	SaveAlertInstance(ctx context.Context, cmd *models.SaveAlertInstanceCommand) error
	DeleteAlertInstance(ctx context.Context, orgID int64, ruleUID, labelsHash string) error
	DeleteAlertInstancesByRule(ctx context.Context, key models.AlertRuleKey) error
}

// RuleReader represents the ability to fetch alert rules.
type RuleReader interface {
	ListAlertRules(ctx context.Context, query *models.ListAlertRulesQuery) error
}
