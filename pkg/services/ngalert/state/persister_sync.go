package state

import (
	"context"
	"time"

	"github.com/grafana/dskit/concurrency"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

type SyncStatePersister struct {
	log   log.Logger
	store InstanceStore
	// maxStateSaveConcurrency controls the number of goroutines (per rule) that can save alert state in parallel.
	maxStateSaveConcurrency int
}

func NewSyncStatePersisiter(log log.Logger, cfg ManagerCfg) StatePersister {
	return &SyncStatePersister{
		log:                     log,
		store:                   cfg.InstanceStore,
		maxStateSaveConcurrency: cfg.MaxStateSaveConcurrency,
	}
}

func (a *SyncStatePersister) Async(_ context.Context, _ AlertInstancesProvider) {
	a.log.Debug("Async: No-Op")
}

// Sync persists the state transitions to the database. It deletes stale states and saves the current states.
func (a *SyncStatePersister) Sync(ctx context.Context, span trace.Span, _ ngModels.AlertRuleKeyWithGroup, allStates StateTransitions) {
	staleStates := allStates.StaleStates()
	if len(staleStates) > 0 {
		a.deleteAlertStates(ctx, staleStates)
		span.AddEvent("deleted stale states", trace.WithAttributes(
			attribute.Int64("state_transitions", int64(len(staleStates))),
		))
	}

	a.saveAlertStates(ctx, allStates...)
	span.AddEvent("updated database")
}

func (a *SyncStatePersister) deleteAlertStates(ctx context.Context, states []StateTransition) {
	if a.store == nil || len(states) == 0 {
		return
	}
	logger := a.log.FromContext(ctx)
	logger.Debug("Deleting alert states", "count", len(states))
	toDelete := make([]ngModels.AlertInstanceKey, 0, len(states))

	for _, s := range states {
		key, err := s.GetAlertInstanceKey()
		if err != nil {
			a.log.Error("Failed to delete alert instance with invalid labels", "cacheID", s.CacheID, "labels", s.Labels.String(), "error", err)
			continue
		}
		toDelete = append(toDelete, key)
	}

	err := a.store.DeleteAlertInstances(ctx, toDelete...)
	if err != nil {
		logger.Error("Failed to delete stale states", "error", err)
	}
}

func (a *SyncStatePersister) saveAlertStates(ctx context.Context, states ...StateTransition) {
	if a.store == nil || len(states) == 0 {
		return
	}
	logger := a.log.FromContext(ctx)
	saveState := func(ctx context.Context, idx int) error {
		s := states[idx]

		// Do not save stale state to database.
		if s.IsStale() {
			return nil
		}

		key, err := s.GetAlertInstanceKey()
		if err != nil {
			logger.Error("Failed to create a key for alert state to save it to database. The state will be ignored ", "cacheID", s.CacheID, "error", err, "labels", s.Labels.String())
			return nil
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

		err = a.store.SaveAlertInstance(ctx, instance)
		if err != nil {
			logger.Error("Failed to save alert state", "labels", s.Labels.String(), "state", s.State, "error", err)
			return nil
		}
		return nil
	}

	start := time.Now()
	logger.Debug("Saving alert states", "count", len(states), "max_state_save_concurrency", a.maxStateSaveConcurrency)
	_ = concurrency.ForEachJob(ctx, len(states), a.maxStateSaveConcurrency, saveState)
	logger.Debug("Saving alert states done", "count", len(states), "max_state_save_concurrency", a.maxStateSaveConcurrency, "duration", time.Since(start))
}
