package state

import (
	"context"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/dskit/concurrency"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

type StatePersister interface {
	Async(ctx context.Context, ticker *clock.Ticker, cache *cache)
	Sync(ctx context.Context, span trace.Span, states, staleStates []StateTransition)
}

type NoopPersister struct{}

func (n *NoopPersister) Async(_ context.Context, _ *clock.Ticker, _ *cache) {
	return
}
func (n *NoopPersister) Sync(_ context.Context, _ trace.Span, _, _ []StateTransition) {
	return
}

func NewNoopPersister() StatePersister {
	return &NoopPersister{}
}

type AsyncStatePersister struct {
	log log.Logger
	// doNotSaveNormalState controls whether eval.Normal state is persisted to the database and returned by get methods.
	doNotSaveNormalState bool
	store                InstanceStore
}

func NewAsyncStatePerisiter(log log.Logger, store InstanceStore, doNotSaveNormalState bool) StatePersister {
	return &AsyncStatePersister{
		log:                  log,
		store:                store,
		doNotSaveNormalState: doNotSaveNormalState,
	}
}

func (a *AsyncStatePersister) Async(ctx context.Context, ticker *clock.Ticker, cache *cache) {

infLoop:
	for {
		select {
		case <-ticker.C:
			if err := a.fullSync(ctx, cache); err != nil {
				a.log.Error("Failed to do a full state sync to database", "err", err)
			}
		case <-ctx.Done():
			a.log.Info("Stopping state sync...")
			if err := a.fullSync(context.Background(), cache); err != nil {
				a.log.Error("Failed to do a full state sync to database", "err", err)
			}
			ticker.Stop()
			break infLoop
		}
	}
	a.log.Info("State sync shut down")
	return
}

func (a *AsyncStatePersister) fullSync(ctx context.Context, cache *cache) error {
	startTime := time.Now()
	a.log.Info("Full state sync start")
	instances := cache.asInstances(a.doNotSaveNormalState)
	if err := a.store.FullSync(ctx, instances); err != nil {
		a.log.Error("Full state sync failed", "duration", time.Since(startTime), "instances", len(instances))
		return err
	}
	a.log.Info("Full state sync done", "duration", time.Since(startTime), "instances", len(instances))
	return nil
}

func (a *AsyncStatePersister) Sync(_ context.Context, _ trace.Span, _, _ []StateTransition) {
	a.log.Debug("Sync: No-Op")
}

type SyncStatePersister struct {
	log   log.Logger
	store InstanceStore
	// doNotSaveNormalState controls whether eval.Normal state is persisted to the database and returned by get methods.
	doNotSaveNormalState bool
	// maxStateSaveConcurrency controls the number of goroutines (per rule) that can save alert state in parallel.
	maxStateSaveConcurrency int
}

func NewSyncStatePerisiter(log log.Logger, store InstanceStore, doNotSaveNormalState bool, maxStateSaveConcurrency int) StatePersister {
	return &SyncStatePersister{
		log:                     log,
		store:                   store,
		doNotSaveNormalState:    doNotSaveNormalState,
		maxStateSaveConcurrency: maxStateSaveConcurrency,
	}
}

func (a *SyncStatePersister) Async(_ context.Context, _ *clock.Ticker, _ *cache) {
	a.log.Debug("Async: No-Op")
	return
}
func (a *SyncStatePersister) Sync(ctx context.Context, span trace.Span, states, staleStates []StateTransition) {
	a.deleteAlertStates(ctx, staleStates)
	if len(staleStates) > 0 {
		span.AddEvent("deleted stale states", trace.WithAttributes(
			attribute.Int64("state_transitions", int64(len(staleStates))),
		))
	}

	a.saveAlertStates(ctx, states...)
	span.AddEvent("updated database")
}

func (a *SyncStatePersister) deleteAlertStates(ctx context.Context, states []StateTransition) {
	if a.store == nil || len(states) == 0 {
		return
	}

	a.log.Debug("Deleting alert states", "count", len(states))
	toDelete := make([]ngModels.AlertInstanceKey, 0, len(states))

	for _, s := range states {
		key, err := s.GetAlertInstanceKey()
		if err != nil {
			a.log.Error("Failed to delete alert instance with invalid labels", "cacheID", s.CacheID, "error", err)
			continue
		}
		toDelete = append(toDelete, key)
	}

	err := a.store.DeleteAlertInstances(ctx, toDelete...)
	if err != nil {
		a.log.Error("Failed to delete stale states", "error", err)
	}
}

func (a *SyncStatePersister) saveAlertStates(ctx context.Context, states ...StateTransition) {
	if a.store == nil || len(states) == 0 {
		return
	}

	saveState := func(ctx context.Context, idx int) error {
		s := states[idx]
		// Do not save normal state to database and remove transition to Normal state but keep mapped states
		if a.doNotSaveNormalState && IsNormalStateWithNoReason(s.State) && !s.Changed() {
			return nil
		}

		key, err := s.GetAlertInstanceKey()
		if err != nil {
			a.log.Error("Failed to create a key for alert state to save it to database. The state will be ignored ", "cacheID", s.CacheID, "error", err, "labels", s.Labels.String())
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
		}

		err = a.store.SaveAlertInstance(ctx, instance)
		if err != nil {
			a.log.Error("Failed to save alert state", "labels", s.Labels.String(), "state", s.State, "error", err)
			return nil
		}
		return nil
	}

	start := time.Now()
	a.log.Debug("Saving alert states", "count", len(states), "max_state_save_concurrency", a.maxStateSaveConcurrency)
	_ = concurrency.ForEachJob(ctx, len(states), a.maxStateSaveConcurrency, saveState)
	a.log.Debug("Saving alert states done", "count", len(states), "max_state_save_concurrency", a.maxStateSaveConcurrency, "duration", time.Since(start))
}
