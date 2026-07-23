package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

func RunJobController(ctx context.Context, deps server.OperatorDependencies) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-job-controller")
	logger.Info("Starting provisioning job controller")

	controllerCfg, err := setupJobsControllerFromConfig(deps.Config, deps.Registerer)
	if err != nil {
		return fmt.Errorf("failed to setup operator: %w", err)
	}

	provisioningClient, err := controllerCfg.ProvisioningClient()
	if err != nil {
		return fmt.Errorf("failed to create provisioning client: %w", err)
	}

	// Historic-job cleanup is age-based and needs no live events: when NATS is off
	// the source is an apiserver informer (watch-fed cache replayed on resync),
	// when NATS is on it is a cron-style periodic re-list. Either way each pass
	// delivers every job to the handler, which deletes the expired ones. It only
	// runs when a history expiration is configured; the expired-job reaper below
	// runs regardless. The source choice reads the NATS config flag directly, not a
	// subscriber: this operator has no NATS consumer role and holds no subscriber.
	var historySource informer.DeltaSource
	if controllerCfg.historyExpiration > 0 {
		historyJobController := controller.NewHistoryJobController(
			provisioningClient.ProvisioningV0alpha1(),
			controllerCfg.historyExpiration,
		)
		historySource = informer.NewHistoricJobDeltaSource(controllerCfg.Settings.NATS.Enabled, provisioningClient, controllerCfg.historyExpiration)
		if _, err := historySource.AddEventHandler(historyJobController.EventHandler()); err != nil {
			return fmt.Errorf("add history job event handler: %w", err)
		}
		logger.Info("history cleanup enabled", "expiration", controllerCfg.historyExpiration.String())
	} else {
		logger.Info("history cleanup disabled", "history_expiration", controllerCfg.historyExpiration.String())
	}
	// HistoryWriter can be either Loki or the API server
	// TODO: Loki configuration and setup in the same way we do for the API server
	// https://github.com/grafana/git-ui-sync-project/issues/508
	// var jobHistoryWriter jobs.HistoryWriter
	// if b.jobHistoryLoki != nil {
	// 	jobHistoryWriter = b.jobHistoryLoki
	// } else {
	// 	jobHistoryWriter = jobs.NewAPIClientHistoryWriter(provisioningClient.ProvisioningV0alpha1())
	// }

	jobHistoryWriter := jobs.NewAPIClientHistoryWriter(provisioningClient.ProvisioningV0alpha1())
	jobStore, err := jobs.NewJobStore(provisioningClient.ProvisioningV0alpha1(), jobClaimExpiry, deps.Registerer, deps.Config.ProvisioningMaxQueuedJobsPerRepository, deps.Config.ProvisioningMaxQueuedJobsPerNamespace)
	if err != nil {
		return fmt.Errorf("create API client job store: %w", err)
	}

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		jobCleanupController := jobs.NewJobCleanupController(
			jobStore,
			jobHistoryWriter,
			controllerCfg.cleanupInterval,
		)
		if err := jobCleanupController.Run(ctx); err != nil {
			logger.Error("job cleanup controller failed", "error", err)
		}
		logger.Info("job cleanup controller stopped")
	}()

	// Start the historic-job source when history cleanup is enabled; cleanup runs
	// off its re-lists.
	if historySource != nil {
		go historySource.Run(ctx.Done())
	}

	logger.Info("jobs operator is ready")
	deps.HealthNotifier.SetReady()

	<-ctx.Done()
	deps.HealthNotifier.SetNotReady()
	logger.Info("shutdown signal received, waiting for goroutines to finish")

	shutdownTimeout := 30 * time.Second
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		logger.Info("jobs operator shutdown complete")
	case <-time.After(shutdownTimeout):
		logger.Warn("shutdown timeout exceeded, forcing exit", "timeout", shutdownTimeout)
	}

	return nil
}

type jobsControllerConfig struct {
	ControllerConfig
	historyExpiration time.Duration
	cleanupInterval   time.Duration
}

func setupJobsControllerFromConfig(cfg *setting.Cfg, registry prometheus.Registerer) (*jobsControllerConfig, error) {
	controllerCfg, err := setupFromConfig(cfg, registry)
	if err != nil {
		return nil, err
	}

	operatorSec := cfg.SectionWithEnvOverrides("operator")

	return &jobsControllerConfig{
		ControllerConfig:  *controllerCfg,
		historyExpiration: operatorSec.Key("history_expiration").MustDuration(0),
		cleanupInterval:   operatorSec.Key("cleanup_interval").MustDuration(time.Minute),
	}, nil
}
