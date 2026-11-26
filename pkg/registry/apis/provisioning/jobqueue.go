package provisioning

import (
	"context"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/jobqueue"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// JobQueueServiceName is the background-service module name of [JobQueueService].
const JobQueueServiceName = "provisioning-job-queue"

var _ registry.CanBeDisabled = (*JobQueueService)(nil)

// JobQueueService runs the provisioning job driver in the Grafana process once
// the provisioning API is served, and processes jobs until shutdown.
type JobQueueService struct {
	*loopbackService

	screenshotRenderer pullrequest.ScreenshotRenderer
	pullRequestURLs    pullrequest.URLProvider
	cfg                jobqueue.Config
}

// ProvideJobQueueService is called by Wire. Depending on the builder orders it
// after [RegisterAPIService], which registers the provisioning API group with
// the API server.
func ProvideJobQueueService(
	cfg *setting.Cfg,
	builder *APIBuilder,
	subscriber nats.Subscriber,
	registry prometheus.Registerer,
	tracer tracing.Tracer,
	renderer rendering.Service,
	blobstore resource.ResourceClient,
) *JobQueueService {
	// The jobs informer resyncs on job_poll_interval rather than the controllers'
	// resync_interval, preserving the job pickup cadence (and config key) of the
	// polling design this replaced. The driver gets the same value so its
	// post-claim cooldown tracks the configured recovery cadence.
	jobPollInterval := cfg.ProvisioningJobPollInterval
	if jobPollInterval <= 0 {
		jobPollInterval = setting.ProvisioningJobPollIntervalDefault
	}

	s := &JobQueueService{
		screenshotRenderer: pullrequest.NewScreenshotRenderer(renderer, blobstore),
		pullRequestURLs:    pullrequest.URLsFromConfig(cfg),
		cfg: jobqueue.Config{
			ConcurrentDrivers: 3,
			MaxJobTimeout:     20 * time.Minute,
			JobInterval:       jobPollInterval,
			// Renew the lease well before it expires. Using jobs.ClaimExpiry as
			// the renewal interval would schedule the single renewal at the
			// exact moment the claim goes stale, so any delay (GC pause,
			// apiserver blip) lets the cleanup controller reap a job that is
			// still running and risks duplicate execution. A third of the
			// expiry gives three renewal attempts before the claim is
			// considered abandoned.
			LeaseRenewalInterval: jobs.ClaimExpiry / 3,
			MaxSyncWorkers:       10,
			MaxFileSize:          cfg.ProvisioningMaxFileSize,
			SyncResourceTimeout:  cfg.ProvisioningSyncResourceTimeout,
			AllowImageRendering:  cfg.ProvisioningAllowImageRendering,
		},
	}
	common := controller.Common{Subscriber: subscriber, Registry: registry, Tracer: tracer}
	s.loopbackService = newControllerService(JobQueueServiceName, builder, common, s.runController)
	return s
}

func (s *JobQueueService) runController(ctx context.Context, common controller.Common) error {
	b := s.builder
	queue, err := jobqueue.ProvideJobQueue(s.cfg, jobqueue.Dependencies{
		Common:              common,
		Clients:             b.clients,
		RepositoryResources: b.repositoryResources,
		ResourceLister:      b.resourceLister,
		RepoFactory:         b.repoFactory,
		HistoryWriter:       b.historyWriter(),
		PerformanceEnabled:  performanceEnabled,
		ScreenshotRenderer:  s.screenshotRenderer,
		PullRequestURLs:     s.pullRequestURLs,
	})
	if err != nil {
		return err
	}
	return queue.Run(ctx)
}
