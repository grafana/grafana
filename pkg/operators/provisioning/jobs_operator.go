package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	folderv1beta1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/apps/provisioning/pkg/controller"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	provisioninginformers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/tools/cache"
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

	tracer, err := controllerCfg.Tracer()
	if err != nil {
		return fmt.Errorf("failed to provide tracing service: %w", err)
	}

	provisioningClient, err := controllerCfg.ProvisioningClient()
	if err != nil {
		return fmt.Errorf("failed to create provisioning client: %w", err)
	}

	// Jobs informer and controller (resync ~60s like in register.go)
	natsWatch := controllerCfg.natsWatch()

	var startHistoryInformers func()
	if controllerCfg.historyExpiration > 0 {
		historyJobController := controller.NewHistoryJobController(
			provisioningClient.ProvisioningV0alpha1(),
			controllerCfg.historyExpiration,
		)
		if natsWatch {
			// Historic-job cleanup is resync-driven: the informer's periodic
			// re-list delivers each job as an update so the handler can act on its
			// age. There is no apiserver informer to start.
			historyNatsInformer := informer.NewHistoricJobInformer(controllerCfg.natsSubscriber, provisioningClient, "", controllerCfg.historyExpiration)
			if _, err := historyNatsInformer.AddEventHandler(historyJobController.EventHandler()); err != nil {
				return fmt.Errorf("failed to add history job event handler: %w", err)
			}
			startHistoryInformers = func() { historyNatsInformer.Start(ctx.Done()) }
		} else {
			// History jobs informer and controller (separate factory with resync == expiration)
			historyInformerFactory := informers.NewSharedInformerFactory(provisioningClient, controllerCfg.historyExpiration)
			historyJobInformer := historyInformerFactory.Provisioning().V0alpha1().HistoricJobs()
			if _, err := historyJobInformer.Informer().AddEventHandler(historyJobController.EventHandler()); err != nil {
				return fmt.Errorf("failed to add history job event handler: %w", err)
			}
			startHistoryInformers = func() { historyInformerFactory.Start(ctx.Done()) }
		}
		logger.Info("history cleanup enabled", "expiration", controllerCfg.historyExpiration.String())
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

	// Under the NATS watch a NATS-backed informer drives the job handler from
	// direct API reads (wired below when job processing is enabled); otherwise the
	// apiserver-backed informer does, and is the only case that creates one. When
	// job processing is disabled under NATS there is no job handler, so nothing to
	// start or sync.
	jobHasSynced := func() bool { return true }
	startJobInformers := func() {}
	var jobInformer provisioninginformers.JobInformer
	if !natsWatch {
		jobInformerFactory := informers.NewSharedInformerFactory(provisioningClient, controllerCfg.ResyncInterval())
		jobInformer = jobInformerFactory.Provisioning().V0alpha1().Jobs()
		jobHasSynced = jobInformer.Informer().HasSynced
		startJobInformers = func() { go jobInformerFactory.Start(ctx.Done()) }
	}

	if controllerCfg.jobProcessingEnabled {
		jobController := controller.NewJobController()
		if natsWatch {
			jobNatsInformer := informer.NewJobInformer(controllerCfg.natsSubscriber, provisioningClient, "", controllerCfg.ResyncInterval())
			reg, err := jobNatsInformer.AddEventHandler(jobController.EventHandler())
			if err != nil {
				return fmt.Errorf("failed to add job event handler: %w", err)
			}
			jobHasSynced = reg.HasSynced
			startJobInformers = func() { jobNatsInformer.Start(ctx.Done()) }
		} else {
			if _, err := jobInformer.Informer().AddEventHandler(jobController.EventHandler()); err != nil {
				return fmt.Errorf("failed to add job event handler: %w", err)
			}
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

	// Start the delta sources (informers or NATS-backed informers)
	startJobInformers()
	startHistoryInformers()

	// Optionally wait for job sync; history cleanup can rely on resync events
	if !cache.WaitForCacheSync(ctx.Done(), jobHasSynced) {
		return fmt.Errorf("failed to sync job event source")
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
