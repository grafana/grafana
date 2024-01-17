package state

import (
	"context"
	"time"

	"github.com/benbjohnson/clock"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
)

type AsyncStatePersister struct {
	log log.Logger
	// doNotSaveNormalState controls whether eval.Normal state is persisted to the database and returned by get methods.
	doNotSaveNormalState bool
	store                InstanceStore
}

func NewAsyncStatePersisiter(log log.Logger, cfg ManagerCfg) StatePersister {
	return &AsyncStatePersister{
		log:                  log,
		store:                cfg.InstanceStore,
		doNotSaveNormalState: cfg.DoNotSaveNormalState,
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
