package state

import (
	"context"
	"time"

	"github.com/benbjohnson/clock"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type AlertInstancesProvider interface {
	GetAlertInstances() []models.AlertInstance
}

type AsyncStatePersister struct {
	log           log.Logger
	batchSize     int
	store         InstanceStore
	ticker        *clock.Ticker
	metrics       *metrics.State
	jitterEnabled bool
	interval      time.Duration
}

func NewAsyncStatePersister(log log.Logger, ticker *clock.Ticker, cfg ManagerCfg) StatePersister {
	return &AsyncStatePersister{
		log:           log,
		store:         cfg.InstanceStore,
		ticker:        ticker,
		batchSize:     cfg.StatePeriodicSaveBatchSize,
		metrics:       cfg.Metrics,
		jitterEnabled: cfg.StatePeriodicSaveJitterEnabled,
		interval:      cfg.StatePeriodicSaveInterval,
	}
}

func (a *AsyncStatePersister) Async(ctx context.Context, instancesProvider AlertInstancesProvider) {
	for {
		select {
		case <-a.ticker.C:
			if err := a.fullSync(ctx, instancesProvider); err != nil {
				a.log.Error("Failed to do a full state sync to database", "err", err)
			}
		case <-ctx.Done():
			a.log.Info("Scheduler is shutting down, doing a final state sync.")
			if err := a.fullSync(context.Background(), instancesProvider); err != nil {
				a.log.Error("Failed to do a full state sync to database", "err", err)
			}
			a.ticker.Stop()
			a.log.Info("State async worker is shut down.")
			return
		}
	}
}

func (a *AsyncStatePersister) fullSync(ctx context.Context, instancesProvider AlertInstancesProvider) error {
	startTime := time.Now()
	a.log.Debug("Full state sync start")
	instances := instancesProvider.GetAlertInstances()

	var err error
	if a.jitterEnabled {
		err = a.fullSyncWithJitter(ctx, instances)
	} else {
		err = a.store.FullSync(ctx, instances, a.batchSize)
	}

	if err != nil {
		a.log.Error("Full state sync failed", "duration", time.Since(startTime), "instances", len(instances))
		return err
	}
	a.log.Debug("Full state sync done", "duration", time.Since(startTime), "instances", len(instances), "batchSize", a.batchSize)
	if a.metrics != nil {
		a.metrics.StateFullSyncDuration.Observe(time.Since(startTime).Seconds())
	}
	return nil
}

func (a *AsyncStatePersister) calculateBatchJitterDelay(batchIndex, totalBatches int, window time.Duration) time.Duration {
	if totalBatches <= 1 {
		return 0
	}

	// Distribute batches evenly across the window
	ratio := float64(batchIndex) / float64(totalBatches-1)
	delay := time.Duration(float64(window) * ratio)

	return delay
}

func (a *AsyncStatePersister) fullSyncWithJitter(ctx context.Context, instances []models.AlertInstance) error {
	safetyRatio := 0.85
	availableWindow := time.Duration(float64(a.interval) * safetyRatio)

	totalBatches := (len(instances) + a.batchSize - 1) / a.batchSize

	jitterFunc := func(batchIndex int) time.Duration {
		return a.calculateBatchJitterDelay(batchIndex, totalBatches, availableWindow)
	}

	err := a.store.FullSyncWithJitter(ctx, instances, jitterFunc, a.batchSize)
	if err != nil {
		a.log.Error("Full state sync with jitter failed", "err", err)
		return err
	}

	a.log.Debug("Full state sync with jitter completed", "instances", len(instances), "batches", totalBatches, "window", availableWindow)
	return nil
}

func (a *AsyncStatePersister) Sync(_ context.Context, _ trace.Span, _ models.AlertRuleKeyWithGroup, _ StateTransitions) {
	a.log.Debug("Sync: No-Op")
}
