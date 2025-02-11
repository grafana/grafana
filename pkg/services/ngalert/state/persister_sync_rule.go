package state

import (
	"context"
	"time"

	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type SyncRuleStatePersister struct {
	log   log.Logger
	store InstanceStore
}

func NewSyncRuleStatePersisiter(log log.Logger, cfg ManagerCfg) StatePersister {
	return &SyncRuleStatePersister{
		log:   log,
		store: cfg.InstanceStore,
	}
}

func (a *SyncRuleStatePersister) Async(_ context.Context, _ AlertInstancesProvider) {
	a.log.Debug("Async: No-Op")
}

func (a *SyncRuleStatePersister) Sync(ctx context.Context, span trace.Span, ruleKey models.AlertRuleKeyWithGroup, states StateTransitions) {
	if a.store == nil || len(states) == 0 {
		return
	}
	logger := a.log.FromContext(ctx)

	instancesToSave := make([]models.AlertInstance, 0, len(states))

	for _, s := range states {
		if s.IsStale() {
			continue
		}

		key, err := s.GetAlertInstanceKey()
		if err != nil {
			logger.Error("Failed to create a key for alert state to save it. The state will be ignored ", "cacheID", s.CacheID, "error", err, "labels", s.Labels.String(), "rule_uid", ruleKey.UID, "rule_group", ruleKey.RuleGroup)
			continue
		}

		instance := models.AlertInstance{
			AlertInstanceKey:  key,
			Labels:            models.InstanceLabels(s.Labels),
			CurrentState:      models.InstanceStateType(s.State.State.String()),
			CurrentReason:     s.StateReason,
			LastEvalTime:      s.LastEvaluationTime,
			CurrentStateSince: s.StartsAt,
			CurrentStateEnd:   s.EndsAt,
			ResolvedAt:        s.ResolvedAt,
			LastSentAt:        s.LastSentAt,
			ResultFingerprint: s.ResultFingerprint.String(),
		}

		instancesToSave = append(instancesToSave, instance)
	}

	start := time.Now()
	logger.Debug("Saving alert states", "count", len(instancesToSave))
	err := a.store.SaveAlertInstancesForRule(ctx, ruleKey, instancesToSave)
	if err != nil {
		logger.Error("Failed to save alert rule state", "error", err, "duration", time.Since(start))
		return
	}

	logger.Debug("Saving alert states done", "count", len(instancesToSave), "duration", time.Since(start))
	span.AddEvent("saved alert rule state")
}
