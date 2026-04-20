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
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/tools/cache"
)

func RunJobController(deps server.OperatorDependencies) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-job-controller")
	logger.Info("Starting provisioning job controller")

	controllerCfg, err := setupJobsControllerFromConfig(deps.Config, deps.Registerer)
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

	provisioningClient, err := controllerCfg.ProvisioningClient()
	if err != nil {
		return fmt.Errorf("failed to create provisioning client: %w", err)
	}

	// Jobs informer and controller (resync ~60s like in register.go)
	jobInformerFactory := informer.NewSharedInformerFactoryWithOptions(
		provisioningClient,
		controllerCfg.ResyncInterval(),
	)
	jobInformer := jobInformerFactory.Provisioning().V0alpha1().Jobs()

	var startHistoryInformers func()
	if controllerCfg.historyExpiration > 0 {
		// History jobs informer and controller (separate factory with resync == expiration)
		historyInformerFactory := informer.NewSharedInformerFactoryWithOptions(
			provisioningClient,
			controllerCfg.historyExpiration,
		)
		historyJobInformer := historyInformerFactory.Provisioning().V0alpha1().HistoricJobs()
		_, err = controller.NewHistoryJobController(
			provisioningClient.ProvisioningV0alpha1(),
			historyJobInformer,
			controllerCfg.historyExpiration,
		)
		if err != nil {
			return fmt.Errorf("failed to create history job controller: %w", err)
		}
		logger.Info("history cleanup enabled", "expiration", controllerCfg.historyExpiration.String())
		startHistoryInformers = func() { historyInformerFactory.Start(ctx.Done()) }
	} else {
		startHistoryInformers = func() {}
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

	if controllerCfg.jobProcessingEnabled {
		jobController, err := controller.NewJobController(jobInformer)
		if err != nil {
			return fmt.Errorf("failed to create job controller: %w", err)
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
				folderAPIVersion:     controllerCfg.folderAPIVersion,
			},
			jobStore,
			jobHistoryWriter,
			jobController.InsertNotifications(),
		)
		if err != nil {
			return fmt.Errorf("build driver: %w", err)
		}

		wg.Add(1)
		go func() {
			defer wg.Done()
			logger.Info("jobs controller started")
			if err := driver.Run(ctx); err != nil {
				logger.Error("job driver failed", "error", err)
			}
			logger.Info("job driver stopped")
		}()
	} else {
		logger.Info("job driver disabled via operator config (jobs_processing_enabled=false)")
	}

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

	// Start informers
	go jobInformerFactory.Start(ctx.Done())
	go startHistoryInformers()

	// Optionally wait for job cache sync; history cleanup can rely on resync events
	if !cache.WaitForCacheSync(ctx.Done(), jobInformer.Informer().HasSynced) {
		return fmt.Errorf("failed to sync job informer cache")
	}

	logger.Info("jobs operator is ready")
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
		logger.Info("jobs operator shutdown complete")
	case <-time.After(shutdownTimeout):
		logger.Warn("shutdown timeout exceeded, forcing exit", "timeout", shutdownTimeout)
	}

	return nil
}

type jobsControllerConfig struct {
	ControllerConfig
	jobProcessingEnabled bool
	historyExpiration    time.Duration
	cleanupInterval      time.Duration
	maxJobTimeout        time.Duration
	jobInterval          time.Duration
	leaseRenewalInterval time.Duration
	concurrentDrivers    int
	maxSyncWorkers       int
	folderAPIVersion     string
}

func setupJobsControllerFromConfig(cfg *setting.Cfg, registry prometheus.Registerer) (*jobsControllerConfig, error) {
	controllerCfg, err := setupFromConfig(cfg, registry)
	if err != nil {
		return nil, err
	}

	operatorSec := cfg.SectionWithEnvOverrides("operator")
	folderAPIVersion := operatorSec.Key("folders_api_version").MustString(folderv1beta1.APIVersion)

	return &jobsControllerConfig{
		ControllerConfig:     *controllerCfg,
		jobProcessingEnabled: operatorSec.Key("jobs_processing_enabled").MustBool(true),
		historyExpiration:    operatorSec.Key("history_expiration").MustDuration(0),
		concurrentDrivers:    operatorSec.Key("concurrent_drivers").MustInt(3),
		maxSyncWorkers:       operatorSec.Key("max_sync_workers").MustInt(10),
		maxJobTimeout:        operatorSec.Key("max_job_timeout").MustDuration(20 * time.Minute),
		cleanupInterval:      operatorSec.Key("cleanup_interval").MustDuration(time.Minute),
		jobInterval:          operatorSec.Key("job_interval").MustDuration(30 * time.Second),
		leaseRenewalInterval: operatorSec.Key("lease_renewal_interval").MustDuration(30 * time.Second),
		folderAPIVersion:     folderAPIVersion,
	}, nil
}
