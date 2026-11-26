package provisioning

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-app-sdk/logging"
	clientrest "k8s.io/client-go/rest"

	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/jobqueue"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
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
	services.NamedService

	builder            *APIBuilder
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
		builder:            builder,
		screenshotRenderer: pullrequest.NewScreenshotRenderer(renderer, blobstore),
		pullRequestURLs:    pullrequest.URLsFromConfig(cfg),
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
	s.NamedService = services.NewBasicService(nil, s.running, nil).WithName(JobQueueServiceName)
	return s
}

// IsDisabled implements registry.CanBeDisabled.
func (s *JobQueueService) IsDisabled() bool {
	return s.builder == nil || s.builder.onlyApiServer
}

// Run implements registry.BackgroundService.
func (s *JobQueueService) Run(ctx context.Context) error {
	if err := s.StartAsync(ctx); err != nil {
		return err
	}
	return s.AwaitTerminated(context.Background())
}

func (s *JobQueueService) running(ctx context.Context) error {
	// Job claims, status patches and repository status patches carry the
	// provisioning requester. A routed config would send them through the
	// router, which strips the loopback credentials before a remote backend.
	restConfig, err := s.builder.awaitLoopbackConfig(ctx)
	if err == nil {
		err = s.runQueue(ctx, restConfig)
	}
	if errors.Is(err, context.Canceled) && ctx.Err() != nil {
		return nil
	}
	return err
}

func (s *JobQueueService) runQueue(ctx context.Context, restConfig *clientrest.Config) error {
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
