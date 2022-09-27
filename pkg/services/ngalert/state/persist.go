package state

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type InstanceStore interface {
	FetchOrgIds(ctx context.Context) ([]int64, error)
	ListAlertInstances(ctx context.Context, cmd *models.ListAlertInstancesQuery) error
	SaveAlertInstance(ctx context.Context, cmd *models.SaveAlertInstanceCommand) error
	DeleteAlertInstance(ctx context.Context, orgID int64, ruleUID, labelsHash string) error
	DeleteAlertInstancesByRule(ctx context.Context, key models.AlertRuleKey) error
}
