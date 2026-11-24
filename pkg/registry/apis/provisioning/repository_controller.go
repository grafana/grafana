package provisioning

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"k8s.io/client-go/tools/cache"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/services/apiserver"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	"github.com/grafana/grafana/pkg/setting"
)

const defaultWebhookSecretRotationInterval = 30 * 24 * time.Hour

var _ registry.CanBeDisabled = (*RepositoryControllerService)(nil)

// RepositoryControllerService reconciles provisioning repositories. Run blocks
// until the Grafana API server is running, then runs the repository controller
// until shutdown.
type RepositoryControllerService struct {
	builder            *APIBuilder
	configProvider     apiserver.RestConfigProvider
	disableControllers bool
}

func ProvideRepositoryControllerService(cfg *setting.Cfg, builder *APIBuilder, configProvider apiserver.RestConfigProvider) *RepositoryControllerService {
	return &RepositoryControllerService{
		builder:            builder,
		configProvider:     configProvider,
		disableControllers: cfg.DisableControllers,
	}
}

// IsDisabled reports whether this instance runs no repository controller: the
// builder is nil when provisioning is disabled, and controllers can be turned
// off by configuration.
func (s *RepositoryControllerService) IsDisabled() bool {
	return s.builder == nil || s.disableControllers
}

func (s *RepositoryControllerService) Run(ctx context.Context) error {
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
		// Shut down before the initial list was processed.
		return nil
	}
	logging.DefaultLogger.Info("starting repository controller")
	repoController.Run(ctx, repoControllerWorkers, func() {}, func() {})
	return nil
}
