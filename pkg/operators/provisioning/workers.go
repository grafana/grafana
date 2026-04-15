package provisioning

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	deletepkg "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/delete"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/export"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/fixfoldermetadata"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/migrate"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/move"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

// WorkerSetupConfig holds the resolved dependencies needed to construct job workers.
// Both the jobqueue and jobs operators populate this from their respective configs.
type WorkerSetupConfig struct {
	Clients               resources.ClientFactory
	RepositoryResources   resources.RepositoryResourcesFactory
	ResourceLister        resources.ResourceLister
	Parsers               resources.ParserFactory
	StatusPatcher         *controller.RepositoryStatusPatcher
	Tracer                tracing.Tracer
	Registry              prometheus.Registerer
	MaxSyncWorkers        int
	ExportEnabled         bool
	FolderMetadataEnabled bool
	URLProvider           func(ctx context.Context, namespace string) string
}

// SetupWorkers constructs all job workers from resolved dependencies.
// This is the single source of truth for worker construction used by both operators.
func SetupWorkers(cfg WorkerSetupConfig) ([]jobs.Worker, error) {
	metrics := jobs.RegisterJobMetrics(cfg.Registry)

	syncer := sync.NewSyncer(sync.Compare, sync.FullSync, sync.IncrementalSync, cfg.Tracer, cfg.MaxSyncWorkers, metrics, cfg.FolderMetadataEnabled)
	syncWorker := sync.NewSyncWorker(
		cfg.Clients,
		cfg.RepositoryResources,
		cfg.StatusPatcher.Patch,
		syncer,
		metrics,
		cfg.Tracer,
		cfg.MaxSyncWorkers,
	)

	stageIfPossible := repository.WrapWithStageAndPushIfPossible

	// Standalone export generates new UIDs so exported files
	// don't reference existing resource identifiers.
	exportWorker := export.NewExportWorker(
		cfg.Clients,
		cfg.RepositoryResources,
		cfg.ResourceLister,
		export.ExportAllWithNewUIDs,
		stageIfPossible,
		metrics,
		cfg.ExportEnabled,
	)

	// Migration export preserves original names so the takeover
	// allowlist can correlate resources during the sync phase.
	migrateExportWorker := export.NewExportWorker(
		cfg.Clients,
		cfg.RepositoryResources,
		cfg.ResourceLister,
		export.ExportAll,
		stageIfPossible,
		metrics,
		cfg.ExportEnabled,
	)
	cleaner := migrate.NewNamespaceCleaner(cfg.Clients)
	unifiedStorageMigrator := migrate.NewUnifiedStorageMigrator(
		cleaner,
		migrateExportWorker,
		syncWorker,
	)
	migrationWorker := migrate.NewMigrationWorkerFromUnified(unifiedStorageMigrator, cfg.ExportEnabled)

	deleteWorker := deletepkg.NewWorker(syncWorker, stageIfPossible, cfg.RepositoryResources, metrics)
	moveWorker := move.NewWorker(syncWorker, stageIfPossible, cfg.RepositoryResources, metrics)
	fixMetadataWorker := fixfoldermetadata.NewWorker()

	renderer := pullrequest.NewNoOpRenderer()
	evaluator := pullrequest.NewEvaluator(renderer, cfg.Parsers, cfg.URLProvider, cfg.Registry)
	commenter := pullrequest.NewCommenter(false)
	prWorker := pullrequest.NewPullRequestWorker(evaluator, commenter, cfg.Registry)

	workers := []jobs.Worker{
		syncWorker,
		exportWorker,
		migrationWorker,
		deleteWorker,
		moveWorker,
		fixMetadataWorker,
		prWorker,
	}

	return workers, nil
}

// resolveWorkerDeps builds a WorkerSetupConfig from an operator's ControllerConfig.
// Both operators use this to bridge their config into the shared SetupWorkers function.
func resolveWorkerDeps(cfg *setting.Cfg, controllerCfg *ControllerConfig, registry prometheus.Registerer, tracer tracing.Tracer, maxSyncWorkers int) (*WorkerSetupConfig, error) {
	featureManager, err := featuremgmt.ProvideManagerService(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to provide feature manager: %w", err)
	}
	features := featuremgmt.ProvideToggles(featureManager)
	exportEnabled := features.IsEnabledGlobally(featuremgmt.FlagProvisioningExport)                 //nolint:staticcheck
	folderMetadataEnabled := features.IsEnabledGlobally(featuremgmt.FlagProvisioningFolderMetadata) //nolint:staticcheck

	clients, err := controllerCfg.Clients()
	if err != nil {
		return nil, fmt.Errorf("failed to get clients: %w", err)
	}
	parsers := resources.NewParserFactory(clients, folderMetadataEnabled)

	unified, err := controllerCfg.UnifiedStorageClient()
	if err != nil {
		return nil, fmt.Errorf("failed to get unified storage client: %w", err)
	}
	resourceLister := resources.NewResourceLister(unified)

	provisioningClient, err := controllerCfg.ProvisioningClient()
	if err != nil {
		return nil, fmt.Errorf("failed to create provisioning client: %w", err)
	}

	repositoryResources := resources.NewRepositoryResourcesFactory(parsers, clients, resourceLister, folderMetadataEnabled)
	statusPatcher := controller.NewRepositoryStatusPatcher(provisioningClient.ProvisioningV0alpha1())

	urlProvider, err := controllerCfg.URLProvider()
	if err != nil {
		return nil, fmt.Errorf("failed to get URL provider: %w", err)
	}

	return &WorkerSetupConfig{
		Clients:               clients,
		RepositoryResources:   repositoryResources,
		ResourceLister:        resourceLister,
		Parsers:               parsers,
		StatusPatcher:         statusPatcher,
		Tracer:                tracer,
		Registry:              registry,
		MaxSyncWorkers:        maxSyncWorkers,
		ExportEnabled:         exportEnabled,
		FolderMetadataEnabled: folderMetadataEnabled,
		URLProvider:           urlProvider,
	}, nil
}
