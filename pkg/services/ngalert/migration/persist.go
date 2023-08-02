package migration

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// RuleStore represents the ability to persist and query alert rules.
type RuleStore interface {
	InsertAlertRules(ctx context.Context, rule []models.AlertRule) (map[string]int64, error)
}

// AlertingStore is the database interface used by the Alertmanager service.
type AlertingStore interface {
	SaveAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error
}
