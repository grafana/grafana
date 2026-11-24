package provisioning

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/jobqueue"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var _ registry.CanBeDisabled = (*JobQueueService)(nil)

// JobQueueService runs the provisioning job driver. Run blocks until the Grafana
// API server is running, then processes jobs until shutdown.
type JobQueueService struct {
	builder            *APIBuilder
	configProvider     apiserver.RestConfigProvider
	screenshotRenderer pullrequest.ScreenshotRenderer
	pullRequestURLs    pullrequest.URLProvider
	disableControllers bool
	cfg                jobqueue.Config
}

func ProvideJobQueueService(
	cfg *setting.Cfg,
	builder *APIBuilder,
	configProvider apiserver.RestConfigProvider,
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

	return &JobQueueService{
		builder:            builder,
		configProvider:     configProvider,
		screenshotRenderer: pullrequest.NewScreenshotRenderer(renderer, blobstore),
		pullRequestURLs:    pullrequest.URLsFromConfig(cfg),
		disableControllers: cfg.DisableControllers,
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
			AllowImageRendering:  cfg.ProvisioningAllowImageRendering,
		},
	}
}

// IsDisabled reports whether this instance processes no jobs: the builder is nil
// when provisioning is disabled, and controllers can be turned off by configuration.
func (s *JobQueueService) IsDisabled() bool {
	return s.builder == nil || s.disableControllers
}

func (s *JobQueueService) Run(ctx context.Context) error {
	restConfig, err := s.configProvider.GetRestConfig(ctx)
	if ctx.Err() != nil {
		// Shut down before the API server became ready.
		return nil
	}
	if err != nil {
		return fmt.Errorf("get rest config: %w", err)
	}
	client, err := clientset.NewForConfig(restConfig)
	if err != nil {
		return fmt.Errorf("create provisioning clientset: %w", err)
	}

	b := s.builder
	store, err := jobs.NewJobStore(client.ProvisioningV0alpha1(), jobClaimExpiry, b.registry)
	if err != nil {
		return fmt.Errorf("create API client job store: %w", err)
	}
	historyWriter := jobs.NewAPIClientHistoryWriter(client.ProvisioningV0alpha1())
	if b.jobHistoryLoki != nil {
		historyWriter = b.jobHistoryLoki
	}

	queue, err := jobqueue.ProvideJobQueue(s.cfg, jobqueue.Dependencies{
		Client:              client,
		Subscriber:          b.natsSubscriber,
		Clients:             b.clients,
		RepositoryResources: b.repositoryResources,
		ResourceLister:      b.resourceLister,
		PatchStatus:         appcontroller.NewRepositoryStatusPatcher(client.ProvisioningV0alpha1()).Patch,
		Store:               store,
		RepoGetter:          resources.NewRepositoryGetter(b.repoFactory, client.ProvisioningV0alpha1()),
		HistoryWriter:       historyWriter,
		Tracer:              b.tracer,
		Registry:            b.registry,
		PerformanceEnabled:  performanceEnabled,
		ScreenshotRenderer:  s.screenshotRenderer,
		PullRequestURLs:     s.pullRequestURLs,
		ExtraWorkers:        b.extraWorkers,
	})
	if err != nil {
		return err
	}
	logging.DefaultLogger.Info("starting provisioning job queue", "drivers", s.cfg.ConcurrentDrivers)
	return queue.Run(ctx)
}
