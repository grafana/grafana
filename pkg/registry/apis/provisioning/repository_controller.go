package provisioning

import (
	"context"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// repoControllerWorkers is the worker count of the repository and connection controllers.
const repoControllerWorkers = 1

const defaultWebhookSecretRotationInterval = 30 * 24 * time.Hour

// RepositoryControllerServiceName is the background-service module name of
// [RepositoryControllerService].
const RepositoryControllerServiceName = "provisioning-repository-controller"

// RepositoryControllerService runs the repository controller in the Grafana
// process once the provisioning API is served.
type RepositoryControllerService struct {
	*loopbackService

	informer                      controllerInformer
	webhookSecretRotationInterval time.Duration
}

// ProvideRepositoryControllerService is called by Wire. Depending on the
// builder orders it after [RegisterAPIService], which registers the
// provisioning API group with the API server.
func ProvideRepositoryControllerService(
	cfg *setting.Cfg,
	builder *APIBuilder,
	bootstrap *BootstrapService,
	subscriber nats.Subscriber,
	registry prometheus.Registerer,
	tracer tracing.Tracer,
	unified resource.ResourceClient,
	informerMetrics *InformerMetrics,
) *RepositoryControllerService {
	webhookSecretRotationInterval := cfg.ProvisioningWebhookSecretRotationInterval
	if webhookSecretRotationInterval <= 0 {
		webhookSecretRotationInterval = defaultWebhookSecretRotationInterval
	}
	s := &RepositoryControllerService{
		informer:                      newControllerInformer(cfg, unified, informerMetrics),
		webhookSecretRotationInterval: webhookSecretRotationInterval,
	}
	common := controller.Common{Subscriber: subscriber, Registry: registry, Tracer: tracer}
	s.loopbackService = newControllerService(RepositoryControllerServiceName, builder, common, s.runController)
	// A changed or cleared bootstrap_path must be applied before the
	// controller syncs the repository it replaces.
	s.waitFor = bootstrap.Done()
	return s
}

func (s *RepositoryControllerService) runController(ctx context.Context, common controller.Common) error {
	b := s.builder
	repoController, err := controller.ProvideRepositoryController(controller.RepositoryControllerDeps{
		Common:                        common,
		Informer:                      s.informer.forResource(provisioningapis.RepositoryResourceInfo.GroupVersionResource()),
		HealthMetrics:                 controller.NewHealthMetricsRecorder(common.Registry),
		RepoFactory:                   b.repoFactory,
		ConnectionFactory:             b.connectionFactory,
		ResourceLister:                b.resourceLister,
		Clients:                       b.clients,
		Validator:                     b.repoValidator,
		QuotaGetter:                   b.quotaGetter,
		IncrementalPolicy:             b.incrementalPolicy,
		ParallelOperations:            10,
		MinSyncInterval:               b.minSyncInterval,
		WebhookSecretRotationInterval: s.webhookSecretRotationInterval,
	})
	if err != nil {
		return err
	}
	return repoController.Run(ctx, repoControllerWorkers, func() {}, func() {})
}
