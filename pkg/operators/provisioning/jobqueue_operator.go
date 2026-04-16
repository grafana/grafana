package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	folderv1beta1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/apps/provisioning/pkg/controller"
	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/tools/cache"
)

func RunJobQueueController(deps server.OperatorDependencies) error {
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

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		logger.Info("Received shutdown signal, stopping controllers")
		cancel()
	}()

	if !controllerCfg.enabled {
		logger.Info("job queue controller is disabled via operator config (jobqueue_enabled=false), idling")
		deps.HealthNotifier.SetReady()
		<-ctx.Done()
		deps.HealthNotifier.SetNotReady()
		return nil
	}

	provisioningClient, err := controllerCfg.ProvisioningClient()
	if err != nil {
		return fmt.Errorf("failed to create provisioning client: %w", err)
	}

	// Jobs informer and controller for insert notifications
	jobInformerFactory := informer.NewSharedInformerFactoryWithOptions(
		provisioningClient,
		controllerCfg.ResyncInterval(),
	)
	jobInformer := jobInformerFactory.Provisioning().V0alpha1().Jobs()
	jobController, err := controller.NewJobController(jobInformer)
	if err != nil {
		return fmt.Errorf("failed to create job controller: %w", err)
	}

	jobHistoryWriter := jobs.NewAPIClientHistoryWriter(provisioningClient.ProvisioningV0alpha1())
	jobStore, err := jobs.NewJobStore(provisioningClient.ProvisioningV0alpha1(), 30*time.Second, deps.Registerer)
	if err != nil {
		return fmt.Errorf("create API client job store: %w", err)
	}

	workers, metrics, err := buildWorkers(deps.Config, &controllerCfg.ControllerConfig, deps.Registerer, tracer, controllerCfg.maxSyncWorkers, controllerCfg.folderAPIVersion)
	if err != nil {
		return fmt.Errorf("build workers: %w", err)
	}

	repoFactory, err := controllerCfg.RepositoryFactory()
	if err != nil {
		return fmt.Errorf("failed to get repository factory: %w", err)
	}

	repoGetter := resources.NewRepositoryGetter(
		repoFactory,
		provisioningClient.ProvisioningV0alpha1(),
	)

	driver, err := jobs.NewConcurrentJobDriver(
		controllerCfg.concurrentDrivers,
		controllerCfg.maxJobTimeout,
		controllerCfg.jobInterval,
		controllerCfg.leaseRenewalInterval,
		jobStore,
		repoGetter,
		jobHistoryWriter,
		jobController.InsertNotifications(),
		deps.Registerer,
		metrics,
		workers...,
	)
	if err != nil {
		return fmt.Errorf("create concurrent job driver: %w", err)
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

	// Start informers
	go jobInformerFactory.Start(ctx.Done())

	if !cache.WaitForCacheSync(ctx.Done(), jobInformer.Informer().HasSynced) {
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
	enabled              bool
	maxJobTimeout        time.Duration
	jobInterval          time.Duration
	leaseRenewalInterval time.Duration
	concurrentDrivers    int
	maxSyncWorkers       int
	folderAPIVersion     string
}

func setupJobQueueControllerFromConfig(cfg *setting.Cfg, registry prometheus.Registerer) (*jobQueueControllerConfig, error) {
	controllerCfg, err := setupFromConfig(cfg, registry)
	if err != nil {
		return nil, err
	}

	operatorSec := cfg.SectionWithEnvOverrides("operator")
	folderAPIVersion := operatorSec.Key("folders_api_version").MustString(folderv1beta1.APIVersion)

	return &jobQueueControllerConfig{
		ControllerConfig:     *controllerCfg,
		enabled:              operatorSec.Key("jobqueue_enabled").MustBool(true),
		concurrentDrivers:    operatorSec.Key("concurrent_drivers").MustInt(3),
		maxSyncWorkers:       operatorSec.Key("max_sync_workers").MustInt(10),
		maxJobTimeout:        operatorSec.Key("max_job_timeout").MustDuration(20 * time.Minute),
		jobInterval:          operatorSec.Key("job_interval").MustDuration(30 * time.Second),
		leaseRenewalInterval: operatorSec.Key("lease_renewal_interval").MustDuration(30 * time.Second),
		folderAPIVersion:     folderAPIVersion,
	}, nil
}
