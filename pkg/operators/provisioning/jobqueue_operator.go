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
	apisprovisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/operators/internal/supervision"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

// jobClaimExpiry is how long a job claim is considered valid before the cleanup
// controller treats it as abandoned. The lease renewal interval must stay well
// below this so a worker renews several times before its claim goes stale;
// otherwise a single delayed renewal can let a running job be reaped and
// re-run by another worker.
const jobClaimExpiry = 60 * time.Second

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
	jobStore, err := jobs.NewJobStore(provisioningClient.ProvisioningV0alpha1(), jobClaimExpiry, deps.Registerer)
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

	// Jobs informer feeding the driver's work queue with job keys. Under the NATS
	// watch the source is a NATS-backed informer; otherwise an apiserver-backed
	// one. Both satisfy DeltaSource, so the rest of the wiring is identical. The
	// informer's periodic resync/re-list is the driver's only recovery path for
	// unclaimed jobs (rolled-back claims, dropped keys, missed notifications), so
	// the handler must be registered before the informer runs: the NATS-backed
	// source has no cache to replay for late handlers.
	//
	// The jobs informer resyncs on job_interval (default 30s) rather than the
	// controllers' resync_interval, preserving the job pickup cadence (and config
	// key) of the polling design this replaced.
	app, err := newOperatorApp("provisioning-jobqueue", logger, watchedKind{
		info:    apisprovisioning.JobResourceInfo,
		source:  informer.NewJobDeltaSource(controllerCfg.natsSubscriber, provisioningClient, controllerCfg.jobInterval, deps.Registerer),
		handler: driver.EventHandler(),
	})
	if err != nil {
		return err
	}
	app.AddRunnable(runnableFunc(func(ctx context.Context) error {
		logger.Info("job queue controller started")
		if err := driver.Run(ctx); err != nil {
			logger.Error("job driver failed", "error", err)
		}
		logger.Info("job driver stopped")
		return nil
	}))
	app.AddSyncedRunnable(func(ctx context.Context) error {
		logger.Info("job queue operator is ready")
		deps.HealthNotifier.SetReady()
		context.AfterFunc(ctx, deps.HealthNotifier.SetNotReady)
		return nil
	})

	if err := app.Run(ctx, deps.Registerer, controllerCfg.maxJobTimeout+appShutdownGrace, logger); err != nil {
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
		leaseRenewalInterval: operatorSec.Key("lease_renewal_interval").MustDuration(jobClaimExpiry / 3),
	}, nil
}
