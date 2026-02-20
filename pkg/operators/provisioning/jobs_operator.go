package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/provisioning/pkg/controller"
	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	deletepkg "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/delete"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/export"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/migrate"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/move"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
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

	tracingConfig, err := tracing.ProvideTracingConfig(deps.Config)
	if err != nil {
		return fmt.Errorf("failed to provide tracing config: %w", err)
	}

	tracer, err := tracing.ProvideService(tracingConfig)
	if err != nil {
		return fmt.Errorf("failed to provide tracing service: %w", err)
	}

	controllerCfg, err := setupJobsControllerFromConfig(deps.Config, deps.Registerer)
	if err != nil {
		return fmt.Errorf("failed to setup operator: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		fmt.Println("Received shutdown signal, stopping controllers")
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
	jobController, err := controller.NewJobController(jobInformer)
	if err != nil {
		return fmt.Errorf("failed to create job controller: %w", err)
	}

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

	workers, err := setupWorkers(deps.Config, controllerCfg, deps.Registerer, tracer)
	if err != nil {
		return fmt.Errorf("setup workers: %w", err)
	}

	repoFactory, err := controllerCfg.RepositoryFactory()
	if err != nil {
		return fmt.Errorf("failed to get repository factory: %w", err)
	}

	repoGetter := resources.NewRepositoryGetter(
		repoFactory,
		provisioningClient.ProvisioningV0alpha1(),
	)
	// This is basically our own JobQueue system
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
		workers...,
	)
	if err != nil {
		return fmt.Errorf("create concurrent job driver: %w", err)
	}

	go func() {
		logger.Info("jobs controller started")
		if err := driver.Run(ctx); err != nil {
			logger.Error("job driver failed", "error", err)
		}
	}()

	go func() {
		jobCleanupController := jobs.NewJobCleanupController(
			jobStore,
			jobHistoryWriter,
			controllerCfg.cleanupInterval,
		)
		if err := jobCleanupController.Run(ctx); err != nil {
			logger.Error("job cleanup controller failed", "error", err)
		}
	}()

	// Start informers
	go jobInformerFactory.Start(ctx.Done())
	go startHistoryInformers()

	// Optionally wait for job cache sync; history cleanup can rely on resync events
	if !cache.WaitForCacheSync(ctx.Done(), jobInformer.Informer().HasSynced) {
		return fmt.Errorf("failed to sync job informer cache")
	}

	<-ctx.Done()
	return nil
}

type jobsControllerConfig struct {
	ControllerConfig
	historyExpiration    time.Duration
	maxJobTimeout        time.Duration
	cleanupInterval      time.Duration
	jobInterval          time.Duration
	leaseRenewalInterval time.Duration
	concurrentDrivers    int
	maxSyncWorkers       int
}

func setupJobsControllerFromConfig(cfg *setting.Cfg, registry prometheus.Registerer) (*jobsControllerConfig, error) {
	controllerCfg, err := setupFromConfig(cfg, registry)
	if err != nil {
		return nil, err
	}

	return &jobsControllerConfig{
		ControllerConfig:     *controllerCfg,
		historyExpiration:    cfg.SectionWithEnvOverrides("operator").Key("history_expiration").MustDuration(0),
		concurrentDrivers:    cfg.SectionWithEnvOverrides("operator").Key("concurrent_drivers").MustInt(3),
		maxSyncWorkers:       cfg.SectionWithEnvOverrides("operator").Key("max_sync_workers").MustInt(10),
		maxJobTimeout:        cfg.SectionWithEnvOverrides("operator").Key("max_job_timeout").MustDuration(20 * time.Minute),
		cleanupInterval:      cfg.SectionWithEnvOverrides("operator").Key("cleanup_interval").MustDuration(time.Minute),
		jobInterval:          cfg.SectionWithEnvOverrides("operator").Key("job_interval").MustDuration(30 * time.Second),
		leaseRenewalInterval: cfg.SectionWithEnvOverrides("operator").Key("lease_renewal_interval").MustDuration(30 * time.Second),
	}, nil
}

func setupWorkers(
	cfg *setting.Cfg, controllerCfg *jobsControllerConfig, registry prometheus.Registerer, tracer tracing.Tracer,
) ([]jobs.Worker, error) {
	clients, err := controllerCfg.Clients()
	if err != nil {
		return nil, fmt.Errorf("failed to get clients: %w", err)
	}
	parsers := resources.NewParserFactory(clients)

	unified, err := controllerCfg.UnifiedStorageClient()
	if err != nil {
		return nil, fmt.Errorf("failed to get unified storage client: %w", err)
	}
	resourceLister := resources.NewResourceLister(unified)

	provisioningClient, err := controllerCfg.ProvisioningClient()
	if err != nil {
		return nil, fmt.Errorf("failed to create provisioning client: %w", err)
	}

	repositoryResources := resources.NewRepositoryResourcesFactory(parsers, clients, resourceLister)
	statusPatcher := controller.NewRepositoryStatusPatcher(provisioningClient.ProvisioningV0alpha1())

	workers := make([]jobs.Worker, 0)

	metrics := jobs.RegisterJobMetrics(registry)

	// Sync
	syncer := sync.NewSyncer(sync.Compare, sync.FullSync, sync.IncrementalSync, tracer, controllerCfg.maxSyncWorkers, metrics)
	syncWorker := sync.NewSyncWorker(
		clients,
		repositoryResources,
		statusPatcher.Patch,
		syncer,
		metrics,
		tracer,
		controllerCfg.maxSyncWorkers,
	)
	workers = append(workers, syncWorker)

	// Export
	stageIfPossible := repository.WrapWithStageAndPushIfPossible
	exportWorker := export.NewExportWorker(
		clients,
		repositoryResources,
		resourceLister,
		export.ExportAll,
		stageIfPossible,
		metrics,
	)
	workers = append(workers, exportWorker)

	// Migrate
	cleaner := migrate.NewNamespaceCleaner(clients)
	unifiedStorageMigrator := migrate.NewUnifiedStorageMigrator(
		cleaner,
		exportWorker,
		syncWorker,
	)
	migrationWorker := migrate.NewMigrationWorkerFromUnified(unifiedStorageMigrator)
	workers = append(workers, migrationWorker)

	// Delete
	deleteWorker := deletepkg.NewWorker(syncWorker, stageIfPossible, repositoryResources, metrics)
	workers = append(workers, deleteWorker)

	// Move
	moveWorker := move.NewWorker(syncWorker, stageIfPossible, repositoryResources, metrics)
	workers = append(workers, moveWorker)

	// PullRequest
	urlProvider, err := controllerCfg.URLProvider()
	if err != nil {
		return nil, fmt.Errorf("failed to get URL provider: %w", err)
	}
	renderer := pullrequest.NewNoOpRenderer()
	evaluator := pullrequest.NewEvaluator(renderer, parsers, urlProvider, registry)
	commenter := pullrequest.NewCommenter(false)
	prWorker := pullrequest.NewPullRequestWorker(evaluator, commenter, registry)
	workers = append(workers, prWorker)

	return workers, nil
}
