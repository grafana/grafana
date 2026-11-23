// Package workers builds the job workers every provisioning job driver runs,
// whether the API server's in-process driver or the job queue operator's.
package workers

import (
	"time"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	deletepkg "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/delete"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/deleteresources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/export"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/fixfoldermetadata"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/migrate"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/move"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/perftest"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/releaseresources"
	jobsync "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// orphanCleanupWorkers bounds the concurrent resource writes of the release
// and delete orphaned-resources jobs.
const orphanCleanupWorkers = 10

type Config struct {
	Clients             resources.ClientFactory
	RepositoryResources resources.RepositoryResourcesFactory
	ResourceLister      resources.ResourceLister
	PatchStatus         jobsync.RepositoryPatchFn
	Tracer              tracing.Tracer
	Metrics             jobs.JobMetrics
	// MaxSyncWorkers bounds the concurrent resource writes of a single sync.
	MaxSyncWorkers      int
	SyncResourceTimeout time.Duration
	MaxFileSize         int64
}

// New returns one worker for each built-in job action. Each worker supports a
// single action, so their order does not matter. Callers append the workers
// that differ between deployments, such as the pull request worker.
func New(cfg Config) []jobs.Worker {
	stageIfPossible := repository.WrapWithStageAndPushIfPossible

	syncer := jobsync.NewSyncer(jobsync.Compare, jobsync.FullSync, jobsync.IncrementalSync, cfg.Tracer, cfg.MaxSyncWorkers, cfg.Metrics, cfg.SyncResourceTimeout)
	syncWorker := jobsync.NewSyncWorker(cfg.Clients, cfg.RepositoryResources, cfg.PatchStatus, syncer, cfg.Metrics, cfg.Tracer, cfg.MaxSyncWorkers, cfg.MaxFileSize)

	// Migration export preserves original names so the takeover allowlist can
	// correlate resources during the sync phase.
	migrateExportWorker := export.NewExportWorker(cfg.Clients, cfg.RepositoryResources, export.ExportAll, stageIfPossible, cfg.Metrics)
	migrator := migrate.NewUnifiedStorageMigrator(migrate.NewNamespaceCleaner(cfg.Clients), migrateExportWorker, syncWorker)

	return []jobs.Worker{
		syncWorker,
		// Standalone export generates new UIDs so exported files don't
		// reference existing resource identifiers.
		export.NewExportWorker(cfg.Clients, cfg.RepositoryResources, export.ExportAllWithNewUIDs, stageIfPossible, cfg.Metrics),
		migrate.NewMigrationWorker(migrator),
		deletepkg.NewWorker(syncWorker, stageIfPossible, cfg.RepositoryResources, cfg.Metrics),
		move.NewWorker(syncWorker, stageIfPossible, cfg.RepositoryResources, cfg.Metrics),
		fixfoldermetadata.NewWorker(cfg.Clients),
		releaseresources.NewWorker(cfg.ResourceLister, cfg.Clients, orphanCleanupWorkers),
		deleteresources.NewWorker(cfg.ResourceLister, cfg.Clients, orphanCleanupWorkers),
		// A no-op unless provisioning.performance is enabled.
		perftest.NewWorker(perftest.Enabled),
	}
}
