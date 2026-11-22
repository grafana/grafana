package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/provisioning/pkg/controllerapp"
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

	// Historic-job cleanup only runs when a history expiration is configured; the
	// expired-job reaper below runs regardless. The source choice reads the NATS
	// config flag directly, not a subscriber: this operator has no NATS consumer
	// role and holds no subscriber.
	var kinds []controllerapp.WatchedKind
	if controllerCfg.historyExpiration > 0 {
		kinds = append(kinds, informer.HistoricJobsKind(provisioningClient, controllerCfg.Settings.NATS.Enabled, controllerCfg.historyExpiration))
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
	jobStore, err := jobs.NewJobStore(provisioningClient.ProvisioningV0alpha1(), jobs.ClaimExpiry, deps.Registerer)
	if err != nil {
		return fmt.Errorf("create API client job store: %w", err)
	}

	// Historic-job cleanup runs off the source's re-lists, so readiness does not
	// wait for its first pass.
	app, err := controllerapp.New("provisioning-jobs", logger, deps.Registerer, kinds...)
	if err != nil {
		return err
	}
	jobCleanupController := jobs.NewJobCleanupController(
		jobStore,
		jobHistoryWriter,
		controllerCfg.cleanupInterval,
	)
	app.AddRunnable(controllerapp.LogErrors(logger, "job cleanup controller", jobCleanupController.Run))

	logger.Info("jobs operator is ready")
	deps.HealthNotifier.SetReady()
	context.AfterFunc(ctx, deps.HealthNotifier.SetNotReady)
	defer deps.HealthNotifier.SetNotReady()

	if err := app.Run(ctx, shutdownGrace, logger); err != nil {
		return err
	}
	logger.Info("jobs operator shutdown complete")
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
