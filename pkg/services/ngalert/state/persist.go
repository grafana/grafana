package state

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
)

// InstanceDataStore is an interface for storing the instance data for alert rules.
// The store does assume the format of the data, other than it is a blob less
// than 16MB.
type InstanceDataStore interface {
	// ListAlertInstanceData returns the instance data for all alert rules.
	// It does not return expired instance data, as this should be deleted using
	// DeleteExpiredAlertInstanceData.
	ListAlertInstanceData(ctx context.Context, cmd *models.ListAlertInstancesQuery) ([]*models.AlertInstanceData, error)

	// SaveAlertInstanceData saves instance data for the alert rule. The data
	// should have an ExpiresAt time some time in the future, as expired
	// instance data is not returned from the store. In most cases, a multiple
	// of the evaluation interval is recommended.
	SaveAlertInstanceData(ctx context.Context, data models.AlertInstanceData) error

	// DeleteAlertInstanceData deletes the alert instance data. It returns
	// true if the instance data was deleted, and false if it does not exist.
	DeleteAlertInstanceData(ctx context.Context, key models.AlertRuleKey) (bool, error)

	// DeleteExpiredAlertInstanceData deletes all expired instance data.
	DeleteExpiredAlertInstanceData(ctx context.Context) (int64, error)
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
