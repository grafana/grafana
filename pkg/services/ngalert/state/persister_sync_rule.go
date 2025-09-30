package state

import (
	"context"
	"time"

	"github.com/benbjohnson/clock"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type SyncRuleStatePersister struct {
	log              log.Logger
	store            InstanceStore
	fullSyncEnabled  bool
	fullSyncInterval time.Duration
	ticker           *clock.Ticker
}

func NewSyncRuleStatePersisiter(log log.Logger, ticker *clock.Ticker, cfg ManagerCfg) StatePersister {
	return &SyncRuleStatePersister{
		log:              log,
		store:            cfg.InstanceStore,
		fullSyncEnabled:  cfg.StateCompressedPeriodicSaveEnabled,
		fullSyncInterval: cfg.StateCompressedPeriodicSaveInterval,
		ticker:           ticker,
	}
}

func (a *SyncRuleStatePersister) Async(ctx context.Context, instancesProvider AlertInstancesProvider) {
	if a.ticker == nil {
		return
	}

	for {
		select {
		case <-a.ticker.C:
			if err := a.fullSync(ctx, instancesProvider); err != nil {
				a.log.Error("Failed to do a full compressed state sync to database", "err", err)
			}
		case <-ctx.Done():
			a.log.Info("Scheduler is shutting down, doing a final state sync.")
			if err := a.fullSync(context.Background(), instancesProvider); err != nil {
				a.log.Error("Failed to do a full compressed state sync to database", "err", err)
			}
			a.ticker.Stop()
			a.log.Info("Compressed state async worker is shut down.")
			return
		}
	}
}

func (a *SyncRuleStatePersister) fullSync(ctx context.Context, instancesProvider AlertInstancesProvider) error {
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

func (a *SyncRuleStatePersister) Sync(ctx context.Context, span trace.Span, ruleKey models.AlertRuleKeyWithGroup, states StateTransitions) {
	if a.ticker != nil {
		a.log.Debug("Skip immediate save, using periodic save instead")
		return
	}

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
			FiredAt:           s.FiredAt,
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
