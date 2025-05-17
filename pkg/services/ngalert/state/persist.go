package state

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
	state_metric_model "github.com/grafana/grafana/pkg/services/ngalert/state/metricwriter/model"
)

// InstanceStore represents the ability to fetch and write alert instances.
type InstanceStore interface {
	InstanceReader
	InstanceWriter
}

// InstanceReader provides methods to fetch alert instances.
type InstanceReader interface {
	ListAlertInstances(ctx context.Context, cmd *models.ListAlertInstancesQuery) ([]*models.AlertInstance, error)
}

// InstanceWriter provides methods to write alert instances.
type InstanceWriter interface {
	SaveAlertInstance(ctx context.Context, instance models.AlertInstance) error
	DeleteAlertInstances(ctx context.Context, keys ...models.AlertInstanceKey) error
	// SaveAlertInstancesForRule overwrites the state for the given rule.
	SaveAlertInstancesForRule(ctx context.Context, key models.AlertRuleKeyWithGroup, instances []models.AlertInstance) error
	DeleteAlertInstancesByRule(ctx context.Context, key models.AlertRuleKeyWithGroup) error
	FullSync(ctx context.Context, instances []models.AlertInstance, batchSize int) error
}

type OrgReader interface {
	FetchOrgIds(ctx context.Context) ([]int64, error)
}

// RuleReader represents the ability to fetch alert rules.
type RuleReader interface {
	ListAlertRules(ctx context.Context, query *models.ListAlertRulesQuery) (models.RulesGroup, error)
}

// Historian maintains an audit log of alert state history.
type Historian interface {
	// RecordStates writes a number of state transitions for a given rule to state history. It returns a channel that
	// is closed when writing the state transitions has completed. If an error has occurred, the channel will contain a
	// non-nil error.
	Record(ctx context.Context, rule history_model.RuleMeta, states []StateTransition) <-chan error
}

// ImageCapturer captures images.
//
//go:generate mockgen -destination=image_mock.go -package=state github.com/grafana/grafana/pkg/services/ngalert/state ImageCapturer
type ImageCapturer interface {
	NewImage(ctx context.Context, r *models.AlertRule) (*models.Image, error)
}

type AlertStateMetricsWriter interface {
	Write(ctx context.Context, ruleMeta state_metric_model.RuleMeta, states StateTransitions) <-chan error
}
