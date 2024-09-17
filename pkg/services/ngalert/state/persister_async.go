package state

import (
	"context"
	"time"

	"github.com/benbjohnson/clock"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
)

type AsyncStatePersister struct {
	log log.Logger
	// doNotSaveNormalState controls whether eval.Normal state is persisted to the database and returned by get methods.
	doNotSaveNormalState bool
	store                InstanceStore
	ticker               *clock.Ticker
	metrics              *metrics.State
}

func NewAsyncStatePersister(log log.Logger, ticker *clock.Ticker, cfg ManagerCfg) StatePersister {
	return &AsyncStatePersister{
		log:                  log,
		store:                cfg.InstanceStore,
		ticker:               ticker,
		doNotSaveNormalState: cfg.DoNotSaveNormalState,
		metrics:              cfg.Metrics,
	}
}

func (a *AsyncStatePersister) Async(ctx context.Context, cache *cache) {
	for {
		select {
		case <-a.ticker.C:
			if err := a.fullSync(ctx, cache); err != nil {
				a.log.Error("Failed to do a full state sync to database", "err", err)
			}
		case <-ctx.Done():
			a.log.Info("Scheduler is shutting down, doing a final state sync.")
			if err := a.fullSync(context.Background(), cache); err != nil {
				a.log.Error("Failed to do a full state sync to database", "err", err)
			}
			a.ticker.Stop()
			a.log.Info("State async worker is shut down.")
			return
		}
	}
}

func (a *AsyncStatePersister) fullSync(ctx context.Context, cache *cache) error {
	startTime := time.Now()
	a.log.Debug("Full state sync start")
	instances := cache.asInstances(a.doNotSaveNormalState)
	if err := a.store.FullSync(ctx, instances); err != nil {
		a.log.Error("Full state sync failed", "duration", time.Since(startTime), "instances", len(instances))
		return err
	}
	a.log.Debug("Full state sync done", "duration", time.Since(startTime), "instances", len(instances))
	if a.metrics != nil {
		a.metrics.StateFullSyncDuration.Observe(time.Since(startTime).Seconds())
	}
	return nil
}

func (a *AsyncStatePersister) Sync(_ context.Context, _ trace.Span, _ StateTransitions) {
	a.log.Debug("Sync: No-Op")
}
