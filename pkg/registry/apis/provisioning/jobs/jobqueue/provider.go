package jobqueue

import (
	"context"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
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
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
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
	// AllowImageRendering embeds dashboard screenshots in pull request comments.
	AllowImageRendering bool
}

// Dependencies are the services the job queue is built from. They differ
// between the in-process API server and the standalone operator, which is why
// callers resolve them and ProvideJobQueue only wires them together.
type Dependencies struct {
	// Client and Subscriber feed the jobs informer: a NATS-backed one when
	// nats.Enabled(Subscriber), else an apiserver-backed one.
	Client              versioned.Interface
	Subscriber          nats.Subscriber
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
	// ScreenshotRenderer and PullRequestURLs back the pull request worker's
	// comments. Use pullrequest.NewNoOpRenderer where nothing can render dashboards.
	ScreenshotRenderer pullrequest.ScreenshotRenderer
	PullRequestURLs    pullrequest.URLProvider
	// ExtraWorkers are appended to the built-in workers.
	ExtraWorkers []jobs.Worker
}

// Queue is a ConcurrentJobDriver fed by the jobs informer.
type Queue struct {
	driver       *jobs.ConcurrentJobDriver
	source       informer.DeltaSource
	registration cache.ResourceEventHandlerRegistration
}

// ProvideJobQueue builds the job queue shared by the provisioning API server and
// the standalone job queue operator: a ConcurrentJobDriver with every built-in
// worker, registered on the jobs informer. The informer's periodic resync is the
// driver's only recovery path for unclaimed jobs, and the NATS-backed source has
// no cache to replay for late handlers, so the handler is registered here before
// anything runs.
//
// The queue is not started; the caller owns its lifecycle and must call Run.
func ProvideJobQueue(cfg Config, deps Dependencies) (*Queue, error) {
	metrics := jobs.RegisterJobMetrics(deps.Registry)
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
		nats.Enabled(deps.Subscriber),
		newWorkers(cfg, deps, metrics)...,
	)
	if err != nil {
		return nil, fmt.Errorf("create concurrent job driver: %w", err)
	}
	driver.SetTracer(deps.Tracer)

	source := informer.NewJobDeltaSource(deps.Subscriber, deps.Client, cfg.JobInterval, deps.Registry)
	registration, err := source.AddEventHandler(driver.EventHandler())
	if err != nil {
		return nil, fmt.Errorf("add job event handler: %w", err)
	}

	return &Queue{driver: driver, source: source, registration: registration}, nil
}

// HasSynced reports whether the jobs informer has delivered its initial list to the driver.
func (q *Queue) HasSynced() bool {
	return q.registration.HasSynced()
}

// Run starts the jobs informer and processes jobs until ctx is done.
func (q *Queue) Run(ctx context.Context) error {
	go q.source.Run(ctx.Done())
	return q.driver.Run(ctx)
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
	pullRequestWorker := pullrequest.NewPullRequestWorker(
		pullrequest.NewEvaluator(deps.ScreenshotRenderer, resources.NewParserFactory(deps.Clients), deps.PullRequestURLs, deps.Registry),
		pullrequest.NewCommenter(cfg.AllowImageRendering, deps.PullRequestURLs),
		deps.Registry,
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
		pullRequestWorker,
	}, deps.ExtraWorkers...)
}
