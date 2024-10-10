package state

import (
	"context"
	"time"

	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

type SyncRuleStatePersister struct {
	log   log.Logger
	store InstanceStore
	// doNotSaveNormalState controls whether eval.Normal state is persisted to the database and returned by get methods.
	doNotSaveNormalState bool
}

func NewSyncRuleStatePersisiter(log log.Logger, cfg ManagerCfg) StatePersister {
	return &SyncRuleStatePersister{
		log:                  log,
		store:                cfg.InstanceStore,
		doNotSaveNormalState: cfg.DoNotSaveNormalState,
	}
}

func (a *SyncRuleStatePersister) Async(_ context.Context, _ *cache) {
	a.log.Debug("Async: No-Op")
}
func (a *SyncRuleStatePersister) Sync(ctx context.Context, span trace.Span, allStates StateTransitions) {
	a.log.Debug("Sync: No-Op")
}

// SyncRule persists the state transitions of the rule to the database
func (a *SyncRuleStatePersister) SyncRule(ctx context.Context, span trace.Span, ruleKey ngModels.AlertRuleKeyWithGroup, states StateTransitions) {
	if a.store == nil || len(states) == 0 {
		return
	}
	logger := a.log.FromContext(ctx)

	instancesToSave := make([]ngModels.AlertInstance, 0, len(states))

	for _, s := range states {
		if s.IsStale() {
			continue
		}

		if a.doNotSaveNormalState && IsNormalStateWithNoReason(s.State) && !s.Changed() {
			continue
		}

		key, err := s.GetAlertInstanceKey()
		if err != nil {
			logger.Error("Failed to create a key for alert state to save it to database. The state will be ignored ", "cacheID", s.CacheID, "error", err, "labels", s.Labels.String())
			continue
		}

		instance := ngModels.AlertInstance{
			AlertInstanceKey:  key,
			Labels:            ngModels.InstanceLabels(s.Labels),
			CurrentState:      ngModels.InstanceStateType(s.State.State.String()),
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
	span.AddEvent("updated database")
}
