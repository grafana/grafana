package jobqueue

import (
	"context"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	deletepkg "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/delete"
	deleteresourcespkg "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/deleteresources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/export"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/fixfoldermetadata"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/migrate"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/move"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/perftest"
	releaseresourcespkg "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/releaseresources"
	jobsync "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// orphanCleanupConcurrency bounds the parallel resource operations of the
// release-resources and delete-resources workers.
const orphanCleanupConcurrency = 10

// Config holds the tunables of the job queue.
type Config struct {
	ConcurrentDrivers int
	MaxJobTimeout     time.Duration
	// JobInterval is the jobs informer's resync cadence; the driver uses it as
	// the post-claim cooldown so failed-run recovery tracks the configured
	// pickup interval.
	JobInterval          time.Duration
	LeaseRenewalInterval time.Duration
	MaxSyncWorkers       int
	// MaxFileSize caps the size in bytes of files read during sync. <=0 disables the check.
	MaxFileSize         int64
	SyncResourceTimeout time.Duration
}

// Dependencies are the services the job queue is built from. They differ
// between the in-process API server and the standalone operator, which is why
// callers resolve them and ProvideDriver only wires them together.
type Dependencies struct {
	Clients             resources.ClientFactory
	RepositoryResources resources.RepositoryResourcesFactory
	ResourceLister      resources.ResourceLister
	PatchStatus         jobsync.RepositoryPatchFn
	Store               jobs.Store
	RepoGetter          jobs.RepoGetter
	HistoryWriter       jobs.HistoryWriter
	Tracer              tracing.Tracer
	Registry            prometheus.Registerer
	// PerformanceEnabled is evaluated per job to gate the synthetic load-testing worker.
	PerformanceEnabled func(ctx context.Context) bool
	NATSBacked         bool
	// ExtraWorkers are appended to the built-in workers, e.g. the pull request worker.
	ExtraWorkers []jobs.Worker
}

// ProvideDriver builds the ConcurrentJobDriver with every built-in job worker.
func ProvideDriver(cfg Config, deps Dependencies) (*jobs.ConcurrentJobDriver, error) {
	metrics := jobs.RegisterJobMetrics(deps.Registry)
	workers := newWorkers(cfg, deps, metrics)

	driver, err := jobs.NewConcurrentJobDriver(
		cfg.ConcurrentDrivers,
		cfg.MaxJobTimeout,
		cfg.JobInterval,
		cfg.LeaseRenewalInterval,
		deps.Store,
		deps.RepoGetter,
		deps.HistoryWriter,
		deps.Registry,
		&metrics,
		deps.NATSBacked,
		workers...,
	)
	if err != nil {
		return nil, fmt.Errorf("create concurrent job driver: %w", err)
	}
	driver.SetTracer(deps.Tracer)

	return driver, nil
}

func newWorkers(cfg Config, deps Dependencies, metrics jobs.JobMetrics) []jobs.Worker {
	stageIfPossible := repository.WrapWithStageAndPushIfPossible

	syncer := jobsync.NewSyncer(jobsync.Compare, jobsync.FullSync, jobsync.IncrementalSync, deps.Tracer, cfg.MaxSyncWorkers, metrics, cfg.SyncResourceTimeout)
	syncWorker := jobsync.NewSyncWorker(
		deps.Clients,
		deps.RepositoryResources,
		deps.PatchStatus,
		syncer,
		metrics,
		deps.Tracer,
		cfg.MaxSyncWorkers,
		cfg.MaxFileSize,
	)

	// Standalone export generates new UIDs so exported files don't
	// reference existing resource identifiers.
	exportWorker := export.NewExportWorker(
		deps.Clients,
		deps.RepositoryResources,
		export.ExportAllWithNewUIDs,
		stageIfPossible,
		metrics,
	)

	// Migration export preserves original names so the takeover
	// allowlist can correlate resources during the sync phase.
	migrateExportWorker := export.NewExportWorker(
		deps.Clients,
		deps.RepositoryResources,
		export.ExportAll,
		stageIfPossible,
		metrics,
	)
	unifiedStorageMigrator := migrate.NewUnifiedStorageMigrator(
		migrate.NewNamespaceCleaner(deps.Clients),
		migrateExportWorker,
		syncWorker,
	)

	return append([]jobs.Worker{
		syncWorker,
		exportWorker,
		migrate.NewMigrationWorker(unifiedStorageMigrator),
		deletepkg.NewWorker(syncWorker, stageIfPossible, deps.RepositoryResources, metrics),
		move.NewWorker(syncWorker, stageIfPossible, deps.RepositoryResources, metrics),
		fixfoldermetadata.NewWorker(deps.Clients),
		releaseresourcespkg.NewWorker(deps.ResourceLister, deps.Clients, orphanCleanupConcurrency),
		deleteresourcespkg.NewWorker(deps.ResourceLister, deps.Clients, orphanCleanupConcurrency),
		// A no-op unless provisioning.performance is enabled.
		perftest.NewWorker(deps.PerformanceEnabled),
	}, deps.ExtraWorkers...)
}
