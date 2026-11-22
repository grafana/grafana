package provisioning

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/provisioning/pkg/controllerapp"
	"github.com/grafana/grafana/apps/provisioning/pkg/jobs"
	"github.com/grafana/grafana/pkg/operators/internal/supervision"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

// shutdownGrace is how long past its own drain an operator waits for its
// controllers to stop before exiting anyway.
const shutdownGrace = 30 * time.Second

func RunJobQueueController(ctx context.Context, deps server.OperatorDependencies) (runErr error) {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-jobqueue-controller")
	logger.Info("Starting provisioning job queue controller")

	controllerCfg, err := setupJobQueueControllerFromConfig(deps.Config, deps.Registerer)
	if err != nil {
		return fmt.Errorf("failed to setup operator: %w", err)
	}

	ctx, stopSubscriber := supervision.Watch(ctx, controllerCfg.natsSubscriber)
	defer func() {
		deps.HealthNotifier.SetNotReady()
		runErr = errors.Join(runErr, stopSubscriber())
	}()
	if err := services.StartAndAwaitRunning(ctx, controllerCfg.natsSubscriber); err != nil {
		if errors.Is(err, context.Canceled) && ctx.Err() != nil {
			err = context.Cause(ctx)
		}
		return fmt.Errorf("failed to start NATS subscriber: %w", err)
	}

	tracer, err := controllerCfg.Tracer()
	if err != nil {
		return fmt.Errorf("failed to provide tracing service: %w", err)
	}

	provisioningClient, err := controllerCfg.ProvisioningClient()
	if err != nil {
		return fmt.Errorf("failed to create provisioning client: %w", err)
	}

	jobHistoryWriter := jobs.NewAPIClientHistoryWriter(provisioningClient.ProvisioningV0alpha1())
	jobStore, err := jobs.NewJobStore(provisioningClient.ProvisioningV0alpha1(), jobs.ClaimExpiry, deps.Registerer)
	if err != nil {
		return fmt.Errorf("create API client job store: %w", err)
	}

	driver, err := buildDriver(
		deps.Config,
		&controllerCfg.ControllerConfig,
		deps.Registerer,
		tracer,
		driverConfig{
			concurrentDrivers:    controllerCfg.concurrentDrivers,
			maxJobTimeout:        controllerCfg.maxJobTimeout,
			jobInterval:          controllerCfg.jobInterval,
			leaseRenewalInterval: controllerCfg.leaseRenewalInterval,
			maxSyncWorkers:       controllerCfg.maxSyncWorkers,
		},
		jobStore,
		jobHistoryWriter,
	)
	if err != nil {
		return fmt.Errorf("build driver: %w", err)
	}
	if err := services.StartAndAwaitRunning(ctx, controllerCfg.manifestWatcher); err != nil {
		return fmt.Errorf("failed to start manifest watcher: %w", err)
	}

	// The jobs informer resyncs on job_interval (default 30s) rather than the
	// controllers' resync_interval, preserving the job pickup cadence (and config
	// key) of the polling design this replaced.
	jobKind := informer.JobQueueKind(controllerCfg.natsSubscriber, provisioningClient, controllerCfg.jobInterval, deps.Registerer, driver)
	jobKind.OnSynced = func(ctx context.Context) error {
		logger.Info("job queue operator is ready")
		deps.HealthNotifier.SetReady()
		context.AfterFunc(ctx, deps.HealthNotifier.SetNotReady)
		return nil
	}
	app, err := controllerapp.New("provisioning-jobqueue", logger, deps.Registerer, jobKind)
	if err != nil {
		return err
	}
	app.AddRunnable(controllerapp.LogErrors(logger, "job driver", driver.Run))

	logger.Info("job queue controller started")
	if err := app.Run(ctx, controllerCfg.maxJobTimeout+shutdownGrace, logger); err != nil {
		return err
	}
	logger.Info("job queue operator shutdown complete")
	return nil
}

type jobQueueControllerConfig struct {
	ControllerConfig
	maxJobTimeout        time.Duration
	jobInterval          time.Duration
	leaseRenewalInterval time.Duration
	concurrentDrivers    int
	maxSyncWorkers       int
}

func setupJobQueueControllerFromConfig(cfg *setting.Cfg, registry prometheus.Registerer) (*jobQueueControllerConfig, error) {
	controllerCfg, err := setupFromConfig(cfg, registry)
	if err != nil {
		return nil, err
	}

	operatorSec := cfg.SectionWithEnvOverrides("operator")

	// The jobs informer resyncs on jobInterval and that resync is the driver's
	// only recovery path for unclaimed jobs. A non-positive value would disable
	// the apiserver informer's resync entirely (and fall back to an unrelated
	// default under NATS), so clamp it to the default instead.
	jobInterval := operatorSec.Key("job_interval").MustDuration(30 * time.Second)
	if jobInterval <= 0 {
		jobInterval = 30 * time.Second
	}

	return &jobQueueControllerConfig{
		ControllerConfig:     *controllerCfg,
		concurrentDrivers:    operatorSec.Key("concurrent_drivers").MustInt(3),
		maxSyncWorkers:       operatorSec.Key("max_sync_workers").MustInt(10),
		maxJobTimeout:        operatorSec.Key("max_job_timeout").MustDuration(20 * time.Minute),
		jobInterval:          jobInterval,
		leaseRenewalInterval: operatorSec.Key("lease_renewal_interval").MustDuration(jobs.DefaultLeaseRenewalInterval),
	}, nil
}
