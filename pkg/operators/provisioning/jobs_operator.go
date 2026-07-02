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

	// Historic-job cleanup is resync-driven: each re-list delivers every job as an
	// update so the handler can act on its age (resync == expiration). The source
	// stays nil when cleanup is disabled.
	var historyInformer informer.DeltaSource
	if controllerCfg.historyExpiration > 0 {
		historyJobController := controller.NewHistoryJobController(
			provisioningClient.ProvisioningV0alpha1(),
			controllerCfg.historyExpiration,
		)
		historyInformer = informer.NewHistoricJobDeltaSource(controllerCfg.natsSubscriber, provisioningClient, controllerCfg.historyExpiration)
		if _, err := historyInformer.AddEventHandler(historyJobController.EventHandler()); err != nil {
			return fmt.Errorf("failed to add history job event handler: %w", err)
		}
		logger.Info("history cleanup enabled", "expiration", controllerCfg.historyExpiration.String())
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
	jobStore, err := jobs.NewJobStore(provisioningClient.ProvisioningV0alpha1(), 30*time.Second, deps.Registerer)
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

	// Start the history informer; cleanup relies on its resync events.
	if historyInformer != nil {
		go historyInformer.Run(ctx.Done())
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
