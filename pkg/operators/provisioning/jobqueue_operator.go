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
	"k8s.io/client-go/tools/cache"
)

// jobClaimExpiry is how long a job claim is considered valid before the cleanup
// controller treats it as abandoned. The lease renewal interval must stay well
// below this so a worker renews several times before its claim goes stale;
// otherwise a single delayed renewal can let a running job be reaped and
// re-run by another worker.
const jobClaimExpiry = 60 * time.Second

func RunJobQueueController(ctx context.Context, deps server.OperatorDependencies) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-jobqueue-controller")
	logger.Info("Starting provisioning job queue controller")

	controllerCfg, err := setupJobQueueControllerFromConfig(deps.Config, deps.Registerer)
	if err != nil {
		return fmt.Errorf("failed to setup operator: %w", err)
	}

	tracer, err := controllerCfg.Tracer()
	if err != nil {
		return fmt.Errorf("failed to provide tracing service: %w", err)
	}

	provisioningClient, err := controllerCfg.ProvisioningClient()
	if err != nil {
		return fmt.Errorf("failed to create provisioning client: %w", err)
	}

	// Jobs informer and controller for insert notifications. Under the NATS watch
	// the source is a NATS-backed informer; otherwise an apiserver-backed one. Both
	// satisfy DeltaSource, so the rest of the wiring is identical.
	jobController := controller.NewJobController()

	jobInformer := informer.NewJobDeltaSource(controllerCfg.natsSubscriber, provisioningClient, controllerCfg.ResyncInterval(), informer.RegisterMetrics(deps.Registerer))
	reg, err := jobInformer.AddEventHandler(jobController.EventHandler())
	if err != nil {
		return fmt.Errorf("failed to add job event handler: %w", err)
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
		jobController.InsertNotifications(),
	)
	if err != nil {
		return fmt.Errorf("build driver: %w", err)
	}

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		logger.Info("job queue controller started")
		if err := driver.Run(ctx); err != nil {
			logger.Error("job driver failed", "error", err)
		}
		logger.Info("job driver stopped")
	}()

	// Start the informer and wait for its cache to sync.
	go jobInformer.Run(ctx.Done())

	if !cache.WaitForCacheSync(ctx.Done(), reg.HasSynced) {
		return fmt.Errorf("failed to sync job informer cache")
	}

	logger.Info("job queue operator is ready")
	deps.HealthNotifier.SetReady()

	<-ctx.Done()
	deps.HealthNotifier.SetNotReady()
	logger.Info("shutdown signal received, waiting for goroutines to finish")

	shutdownTimeout := controllerCfg.maxJobTimeout + 30*time.Second
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		logger.Info("job queue operator shutdown complete")
	case <-time.After(shutdownTimeout):
		logger.Warn("shutdown timeout exceeded, forcing exit", "timeout", shutdownTimeout)
	}

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

	return &jobQueueControllerConfig{
		ControllerConfig:     *controllerCfg,
		concurrentDrivers:    operatorSec.Key("concurrent_drivers").MustInt(3),
		maxSyncWorkers:       operatorSec.Key("max_sync_workers").MustInt(10),
		maxJobTimeout:        operatorSec.Key("max_job_timeout").MustDuration(20 * time.Minute),
		jobInterval:          operatorSec.Key("job_interval").MustDuration(30 * time.Second),
		leaseRenewalInterval: operatorSec.Key("lease_renewal_interval").MustDuration(jobClaimExpiry / 3),
	}, nil
}
