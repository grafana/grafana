package provisioning

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/jobqueue"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/setting"
)

// JobQueue runs the provisioning job driver inside the Grafana process.
type JobQueue struct {
	cfg jobqueue.Config
}

// RegisterJobQueue attaches the in-process job queue to the provisioning API builder. It is called by Wire.
// Depending on the builder orders it after the provisioning API server registration, and the queue is only
// started from that server's post-start hook, once the API client, job store and status patcher it needs exist.
// It returns nil when provisioning is disabled.
func RegisterJobQueue(cfg *setting.Cfg, builder *APIBuilder) *JobQueue {
	if builder == nil {
		return nil
	}

	// The jobs informer resyncs on job_poll_interval rather than the controllers'
	// resync_interval, preserving the job pickup cadence (and config key) of the
	// polling design this replaced. The driver gets the same value so its
	// post-claim cooldown tracks the configured recovery cadence.
	jobPollInterval := cfg.ProvisioningJobPollInterval
	if jobPollInterval <= 0 {
		jobPollInterval = setting.ProvisioningJobPollIntervalDefault
	}

	q := &JobQueue{
		cfg: jobqueue.Config{
			ConcurrentDrivers: 3,
			MaxJobTimeout:     20 * time.Minute,
			JobInterval:       jobPollInterval,
			// Renew the lease well before it expires. Using jobClaimExpiry as
			// the renewal interval would schedule the single renewal at the
			// exact moment the claim goes stale, so any delay (GC pause,
			// apiserver blip) lets the cleanup controller reap a job that is
			// still running and risks duplicate execution. A third of the
			// expiry gives three renewal attempts before the claim is
			// considered abandoned.
			LeaseRenewalInterval: jobClaimExpiry / 3,
			MaxSyncWorkers:       10,
			MaxFileSize:          cfg.ProvisioningMaxFileSize,
			SyncResourceTimeout:  cfg.ProvisioningSyncResourceTimeout,
		},
	}
	builder.jobQueue = q

	return q
}

// start builds the job driver from the builder's post-start state and runs it
// until ctx is done.
func (q *JobQueue) start(ctx context.Context, b *APIBuilder, clientset versioned.Interface, historyWriter jobs.HistoryWriter) error {
	driver, err := jobqueue.ProvideDriver(q.cfg, jobqueue.Dependencies{
		Clients:             b.clients,
		RepositoryResources: b.repositoryResources,
		ResourceLister:      b.resourceLister,
		PatchStatus:         b.statusPatcher.Patch,
		Store:               b.jobs,
		RepoGetter:          resources.NewRepositoryGetter(b.repoFactory, b.client),
		HistoryWriter:       historyWriter,
		Tracer:              b.tracer,
		Registry:            b.registry,
		PerformanceEnabled:  performanceEnabled,
		NATSBacked:          nats.Enabled(b.natsSubscriber),
		ExtraWorkers:        b.extraWorkers,
	})
	if err != nil {
		return err
	}

	// Feed the driver's work queue from the jobs informer: live create
	// events plus the periodic resync/re-list, which re-delivers unclaimed
	// jobs and is the driver's only recovery path. The handler must be
	// registered before the informer runs: the NATS-backed source has no
	// cache to replay for late handlers.
	jobSource := informer.NewJobDeltaSource(b.natsSubscriber, clientset, q.cfg.JobInterval, b.registry)
	if _, err := jobSource.AddEventHandler(driver.EventHandler()); err != nil {
		return fmt.Errorf("add job event handler: %w", err)
	}
	go jobSource.Run(ctx.Done())

	go func() {
		if err := driver.Run(ctx); err != nil {
			logging.FromContext(ctx).Error("job driver failed", "error", err)
		}
	}()

	return nil
}
