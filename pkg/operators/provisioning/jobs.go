package provisioning

import (
	"fmt"

	"github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	deletepkg "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/delete"
	deleteresourcespkg "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/deleteresources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/export"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/fixfoldermetadata"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/migrate"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/move"
	releaseresourcespkg "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/releaseresources"
	jobsync "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

// buildWorkers resolves all dependencies and constructs the job workers.
// This is the single source of truth for worker construction used by both operators.
func buildWorkers(cfg *setting.Cfg, controllerCfg *ControllerConfig, registry prometheus.Registerer, tracer tracing.Tracer, maxSyncWorkers int, folderAPIVersion string) ([]jobs.Worker, *jobs.JobMetrics, error) {
	featureManager, err := featuremgmt.ProvideManagerService(cfg)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to provide feature manager: %w", err)
	}
	features := featuremgmt.ProvideToggles(featureManager)
	exportEnabled := features.IsEnabledGlobally(featuremgmt.FlagProvisioningExport)                 //nolint:staticcheck
	folderMetadataEnabled := features.IsEnabledGlobally(featuremgmt.FlagProvisioningFolderMetadata) //nolint:staticcheck

	clients, err := controllerCfg.Clients()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get clients: %w", err)
	}
	parsers := resources.NewParserFactory(clients, folderMetadataEnabled)

	unified, err := controllerCfg.UnifiedStorageClient()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get unified storage client: %w", err)
	}
	resourceLister := resources.NewResourceLister(unified)

	provisioningClient, err := controllerCfg.ProvisioningClient()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create provisioning client: %w", err)
	}

	repositoryResources := resources.NewRepositoryResourcesFactory(parsers, clients, resourceLister, folderMetadataEnabled, folderAPIVersion)
	statusPatcher := controller.NewRepositoryStatusPatcher(provisioningClient.ProvisioningV0alpha1())

	urlProvider, err := controllerCfg.URLProvider()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get URL provider: %w", err)
	}

	metrics := jobs.RegisterJobMetrics(registry)

	syncer := jobsync.NewSyncer(jobsync.Compare, jobsync.FullSync, jobsync.IncrementalSync, tracer, maxSyncWorkers, metrics, folderMetadataEnabled)
	syncWorker := jobsync.NewSyncWorker(
		clients,
		repositoryResources,
		statusPatcher.Patch,
		syncer,
		metrics,
		tracer,
		maxSyncWorkers,
	)

	stageIfPossible := repository.WrapWithStageAndPushIfPossible

	// Standalone export generates new UIDs so exported files
	// don't reference existing resource identifiers.
	exportWorker := export.NewExportWorker(
		clients,
		repositoryResources,
		resourceLister,
		export.ExportAllWithNewUIDs,
		stageIfPossible,
		metrics,
		exportEnabled,
		folderAPIVersion,
	)

	// Migration export preserves original names so the takeover
	// allowlist can correlate resources during the sync phase.
	migrateExportWorker := export.NewExportWorker(
		clients,
		repositoryResources,
		resourceLister,
		export.ExportAll,
		stageIfPossible,
		metrics,
		exportEnabled,
		folderAPIVersion,
	)
	cleaner := migrate.NewNamespaceCleaner(clients)
	unifiedStorageMigrator := migrate.NewUnifiedStorageMigrator(
		cleaner,
		migrateExportWorker,
		syncWorker,
	)
	migrationWorker := migrate.NewMigrationWorkerFromUnified(unifiedStorageMigrator, exportEnabled)

	// Delete
	deleteWorker := deletepkg.NewWorker(syncWorker, stageIfPossible, repositoryResources, metrics)

	// Move
	moveWorker := move.NewWorker(syncWorker, stageIfPossible, repositoryResources, metrics)

	// Fix Metadata
	fixMetadataWorker := fixfoldermetadata.NewWorker(resources.FolderGVKForVersion(folderAPIVersion))

	// Release Resources (orphan cleanup — removes ownership annotations)
	releaseResourcesWorker := releaseresourcespkg.NewWorker(resourceLister, clients, 10)

	// Delete Resources (orphan cleanup — deletes managed resources)
	deleteResourcesWorker := deleteresourcespkg.NewWorker(resourceLister, clients, 10)

	// PullRequest
	renderer := pullrequest.NewNoOpRenderer()
	evaluator := pullrequest.NewEvaluator(renderer, parsers, urlProvider, registry)
	commenter := pullrequest.NewCommenter(false)
	prWorker := pullrequest.NewPullRequestWorker(evaluator, commenter, registry)

	workers := []jobs.Worker{
		syncWorker,
		exportWorker,
		migrationWorker,
		deleteWorker,
		moveWorker,
		fixMetadataWorker,
		releaseResourcesWorker,
		deleteResourcesWorker,
		prWorker,
	}

	return workers, &metrics, nil
}
