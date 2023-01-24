package state

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// InstanceStore represents the ability to fetch and write alert instances.
type InstanceStore interface {
	FetchOrgIds(ctx context.Context) ([]int64, error)
	ListAlertInstances(ctx context.Context, cmd *models.ListAlertInstancesQuery) error
	SaveAlertInstances(ctx context.Context, cmd ...models.AlertInstance) error
	DeleteAlertInstances(ctx context.Context, keys ...models.AlertInstanceKey) error
	DeleteAlertInstancesByRule(ctx context.Context, key models.AlertRuleKey) error
}

// RuleReader represents the ability to fetch alert rules.
type RuleReader interface {
	ListAlertRules(ctx context.Context, query *models.ListAlertRulesQuery) error
}

// RuleMeta is the metadata about a rule that is needed by state history.
type RuleMeta struct {
	ID           int64
	OrgID        int64
	UID          string
	Title        string
	Group        string
	NamespaceUID string
	DashboardUID string
	PanelID      int64
}

func NewRuleMeta(r *models.AlertRule, log log.Logger) RuleMeta {
	dashUID, ok := r.Annotations[models.DashboardUIDAnnotation]
	var panelID int64
	if ok {
		panelAnno := r.Annotations[models.PanelIDAnnotation]
		pid, err := strconv.ParseInt(panelAnno, 10, 64)
		if err != nil {
			logger.Error("Error parsing panelUID for alert annotation", "ruleID", r.ID, "dash", dashUID, "actual", panelAnno, "error", err)
			pid = 0
		}
		panelID = pid
	}
	return RuleMeta{
		ID:           r.ID,
		OrgID:        r.OrgID,
		UID:          r.UID,
		Title:        r.Title,
		Group:        r.RuleGroup,
		NamespaceUID: r.NamespaceUID,
		DashboardUID: dashUID,
		PanelID:      panelID,
	}
}

// Historian maintains an audit log of alert state history.
type Historian interface {
	// RecordStates writes a number of state transitions for a given rule to state history. It returns a channel that
	// is closed when writing the state transitions has completed. If an error has occurred, the channel will contain a
	// non-nil error.
	RecordStatesAsync(ctx context.Context, rule RuleMeta, states []StateTransition) <-chan error
}

// ImageCapturer captures images.
//
//go:generate mockgen -destination=image_mock.go -package=state github.com/grafana/grafana/pkg/services/ngalert/state ImageCapturer
type ImageCapturer interface {
	NewImage(ctx context.Context, r *models.AlertRule) (*models.Image, error)
}
