package state

import (
	"context"
	"time"

	"github.com/benbjohnson/clock"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// AsyncRuleStatePersister persists alert state periodically using compressed rule-based storage.
// It performs full syncs on a ticker interval and on shutdown.
// Sync operations are no-ops since persistence happens asynchronously.
type AsyncRuleStatePersister struct {
	log      log.Logger
	store    InstanceStore
	clock    clock.Clock
	interval time.Duration
}

func NewAsyncRuleStatePersister(log log.Logger, clk clock.Clock, interval time.Duration, cfg ManagerCfg) StatePersister {
	return &AsyncRuleStatePersister{
		log:      log,
		store:    cfg.InstanceStore,
		clock:    clk,
		interval: interval,
	}
}

func (a *AsyncRuleStatePersister) Async(ctx context.Context, instancesProvider AlertInstancesProvider) {
	ticker := a.clock.Ticker(a.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := a.fullSync(ctx, instancesProvider); err != nil {
				a.log.Error("Failed to do a full compressed state sync to database", "err", err)
			}
		case <-ctx.Done():
			a.log.Info("Scheduler is shutting down, doing a final state sync.")
			if err := a.fullSync(context.Background(), instancesProvider); err != nil {
				a.log.Error("Failed to do a full compressed state sync to database", "err", err)
			}
			a.log.Info("Compressed state async worker is shut down.")
			return
		}
	}
}

func (a *AsyncRuleStatePersister) fullSync(ctx context.Context, instancesProvider AlertInstancesProvider) error {
	startTime := time.Now()
	a.log.Debug("Full compressed state sync start")
	instances := instancesProvider.GetAlertInstances()

	// batchSize is set to 0 because compressed storage groups instances by ruleUID, not by batch size
	err := a.store.FullSync(ctx, instances, 0, nil)
	if err != nil {
		a.log.Error("Full compressed state sync failed", "duration", time.Since(startTime), "instances", len(instances))
		return err
	}
	a.log.Debug("Full compressed state sync done", "duration", time.Since(startTime), "instances", len(instances))
	return nil
}

func (a *AsyncRuleStatePersister) Sync(_ context.Context, _ trace.Span, _ models.AlertRuleKeyWithGroup, _ StateTransitions) {
	a.log.Debug("Sync: No-Op, using periodic save instead")
}
