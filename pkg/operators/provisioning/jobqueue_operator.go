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
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/tools/cache"
)

func RunJobQueueController(deps server.OperatorDependencies) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-jobqueue-controller")
	logger.Info("Starting provisioning job queue controller")

	tracingConfig, err := tracing.ProvideTracingConfig(deps.Config)
	if err != nil {
		return fmt.Errorf("failed to provide tracing config: %w", err)
	}

	tracer, err := tracing.ProvideService(tracingConfig)
	if err != nil {
		return fmt.Errorf("failed to provide tracing service: %w", err)
	}

	controllerCfg, err := setupJobQueueControllerFromConfig(deps.Config, deps.Registerer)
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

	workers, err := setupJobWorkers(deps.Config, controllerCfg, deps.Registerer, tracer)
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
		logger.Info("job queue controller started")
		if err := driver.Run(ctx); err != nil {
			logger.Error("job driver failed", "error", err)
		}
	}()

	// Start informers
	go jobInformerFactory.Start(ctx.Done())

	if !cache.WaitForCacheSync(ctx.Done(), jobInformer.Informer().HasSynced) {
		return fmt.Errorf("failed to sync job informer cache")
	}

	<-ctx.Done()
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
		leaseRenewalInterval: operatorSec.Key("lease_renewal_interval").MustDuration(30 * time.Second),
	}, nil
}

func setupJobWorkers(
	cfg *setting.Cfg, controllerCfg *jobQueueControllerConfig, registry prometheus.Registerer, tracer tracing.Tracer,
) ([]jobs.Worker, error) {
	// Initialize feature toggles from config
	featureManager, err := featuremgmt.ProvideManagerService(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to provide feature manager: %w", err)
	}
	features := featuremgmt.ProvideToggles(featureManager)
	exportEnabled := features.IsEnabledGlobally(featuremgmt.FlagProvisioningExport) //nolint:staticcheck

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
		exportEnabled,
	)
	workers = append(workers, exportWorker)

	// Migrate
	cleaner := migrate.NewNamespaceCleaner(clients)
	unifiedStorageMigrator := migrate.NewUnifiedStorageMigrator(
		cleaner,
		exportWorker,
		syncWorker,
	)
	migrationWorker := migrate.NewMigrationWorkerFromUnified(unifiedStorageMigrator, exportEnabled)
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
