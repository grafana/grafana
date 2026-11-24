package provisioning

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/dskit/services"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
)

const defaultWebhookSecretRotationInterval = 30 * 24 * time.Hour

// RepositoryControllerServiceName is the background-service module name of
// [RepositoryControllerService].
const RepositoryControllerServiceName = "provisioning-repository-controller"

// RepositoryControllerService runs the repository controller in the Grafana
// process once the provisioning API is served.
type RepositoryControllerService struct {
	services.NamedService

	builder *APIBuilder
	run     func(ctx context.Context, restConfig *clientrest.Config) error
}

// ProvideRepositoryControllerService is called by Wire. Depending on the
// builder orders it after [RegisterAPIService], which registers the
// provisioning API group with the API server.
func ProvideRepositoryControllerService(builder *APIBuilder) *RepositoryControllerService {
	s := &RepositoryControllerService{builder: builder}
	s.run = s.runController
	s.NamedService = services.NewBasicService(nil, s.running, nil).WithName(RepositoryControllerServiceName)
	return s
}

// IsDisabled implements registry.CanBeDisabled.
func (s *RepositoryControllerService) IsDisabled() bool {
	return s.builder == nil || s.builder.onlyApiServer
}

// Run implements registry.BackgroundService.
func (s *RepositoryControllerService) Run(ctx context.Context) error {
	if err := s.StartAsync(ctx); err != nil {
		return err
	}
	return s.AwaitTerminated(context.Background())
}

func (s *RepositoryControllerService) running(ctx context.Context) error {
	// Status patches and job writes carry the provisioning requester, so a
	// routed config would send them through the router, which strips the
	// loopback credentials before a remote backend.
	restConfig, err := s.builder.awaitLoopbackConfig(ctx)
	if err == nil {
		err = s.run(ctx, restConfig)
	}
	if errors.Is(err, context.Canceled) && ctx.Err() != nil {
		return nil
	}
	return err
}

func (s *RepositoryControllerService) runController(ctx context.Context, restConfig *clientrest.Config) error {
	client, err := clientset.NewForConfig(restConfig)
	if err != nil {
		return fmt.Errorf("create provisioning clientset: %w", err)
	}

	b := s.builder
	jobStore, err := jobs.NewJobStore(client.ProvisioningV0alpha1(), jobClaimExpiry, b.registry)
	if err != nil {
		return fmt.Errorf("create API client job store: %w", err)
	}
	statusPatcher := appcontroller.NewRepositoryStatusPatcher(client.ProvisioningV0alpha1())
	healthChecker := controller.NewRepositoryHealthChecker(statusPatcher, repository.NewTester(b.repoValidator), controller.NewHealthMetricsRecorder(b.registry))

	webhookSecretRotationInterval := b.webhookSecretRotationInterval
	if webhookSecretRotationInterval <= 0 {
		webhookSecretRotationInterval = defaultWebhookSecretRotationInterval
	}

	repoKeys := keysapi.NewGRPCLister(b.unified, provisioningapis.RepositoryResourceInfo.GroupVersionResource())
	relistProjectionMetrics, freshnessMetrics := b.informerMetrics()
	repoController, source, hasSynced, err := controller.ProvideRepositoryController(controller.RepositoryControllerDeps{
		ProvisioningClient:            client,
		NATSSubscriber:                b.natsSubscriber,
		KeysLister:                    repoKeys,
		RelistProjectionMetrics:       relistProjectionMetrics,
		FreshnessMetrics:              freshnessMetrics,
		RepoFactory:                   b.repoFactory,
		ConnectionFactory:             b.connectionFactory,
		ResourceLister:                b.resourceLister,
		Clients:                       b.clients,
		Jobs:                          jobStore,
		HealthChecker:                 healthChecker,
		StatusPatcher:                 statusPatcher,
		QuotaGetter:                   b.quotaGetter,
		IncrementalPolicy:             b.incrementalPolicy,
		Registry:                      b.registry,
		Tracer:                        b.tracer,
		ParallelOperations:            10,
		ResyncInterval:                b.resyncInterval(),
		MinSyncInterval:               b.minSyncInterval,
		DrainTimeout:                  30 * time.Second,
		WebhookSecretRotationInterval: webhookSecretRotationInterval,
	})
	if err != nil {
		return err
	}
	go source.Run(ctx.Done())

	if !cache.WaitForCacheSync(ctx.Done(), hasSynced) {
		repoController.ShutDownQueue()
		return fmt.Errorf("repository controller informer cache sync failed: %w", context.Cause(ctx))
	}
	repoController.Run(ctx, repoControllerWorkers, func() {}, func() {})
	return nil
}
