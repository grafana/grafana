package provisioning

import (
	"context"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	clientrest "k8s.io/client-go/rest"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	"github.com/grafana/grafana/pkg/setting"
)

const defaultWebhookSecretRotationInterval = 30 * 24 * time.Hour

// controllerResyncInterval is the informer re-list interval of the repository
// and connection controllers, from [provisioning] resync_interval.
func controllerResyncInterval(cfg *setting.Cfg) time.Duration {
	if cfg.ProvisioningControllerResyncInterval <= 0 {
		return setting.ProvisioningControllerResyncIntervalDefault
	}
	return cfg.ProvisioningControllerResyncInterval
}

// RepositoryControllerServiceName is the background-service module name of
// [RepositoryControllerService].
const RepositoryControllerServiceName = "provisioning-repository-controller"

// RepositoryControllerService runs the repository controller in the Grafana
// process once the provisioning API is served.
type RepositoryControllerService struct {
	*loopbackService

	subscriber                    nats.Subscriber
	registry                      prometheus.Registerer
	informerMetrics               *InformerMetrics
	resyncInterval                time.Duration
	webhookSecretRotationInterval time.Duration
}

// ProvideRepositoryControllerService is called by Wire. Depending on the
// builder orders it after [RegisterAPIService], which registers the
// provisioning API group with the API server.
func ProvideRepositoryControllerService(
	cfg *setting.Cfg,
	builder *APIBuilder,
	subscriber nats.Subscriber,
	registry prometheus.Registerer,
	informerMetrics *InformerMetrics,
) *RepositoryControllerService {
	webhookSecretRotationInterval := cfg.ProvisioningWebhookSecretRotationInterval
	if webhookSecretRotationInterval <= 0 {
		webhookSecretRotationInterval = defaultWebhookSecretRotationInterval
	}
	s := &RepositoryControllerService{
		subscriber:                    subscriber,
		registry:                      registry,
		informerMetrics:               informerMetrics,
		resyncInterval:                controllerResyncInterval(cfg),
		webhookSecretRotationInterval: webhookSecretRotationInterval,
	}
	s.loopbackService = newLoopbackService(RepositoryControllerServiceName, builder, s.runController)
	// A changed or cleared bootstrap_path must be applied before the
	// controller syncs the repository it replaces.
	s.awaitBootstrap = true
	return s
}

func (s *RepositoryControllerService) runController(ctx context.Context, restConfig *clientrest.Config) error {
	client, err := clientset.NewForConfig(restConfig)
	if err != nil {
		return fmt.Errorf("create provisioning clientset: %w", err)
	}

	b := s.builder
	relistProjectionMetrics, freshnessMetrics := s.informerMetrics.get()
	repoController, err := controller.ProvideRepositoryController(controller.RepositoryControllerDeps{
		ProvisioningClient:            client,
		NATSSubscriber:                s.subscriber,
		KeysLister:                    keysapi.NewGRPCLister(b.unified, provisioningapis.RepositoryResourceInfo.GroupVersionResource()),
		RelistProjectionMetrics:       relistProjectionMetrics,
		FreshnessMetrics:              freshnessMetrics,
		HealthMetrics:                 controller.NewHealthMetricsRecorder(s.registry),
		RepoFactory:                   b.repoFactory,
		ConnectionFactory:             b.connectionFactory,
		ResourceLister:                b.resourceLister,
		Clients:                       b.clients,
		Validator:                     b.repoValidator,
		QuotaGetter:                   b.quotaGetter,
		IncrementalPolicy:             b.incrementalPolicy,
		Registry:                      s.registry,
		Tracer:                        b.tracer,
		ParallelOperations:            10,
		ResyncInterval:                s.resyncInterval,
		MinSyncInterval:               b.minSyncInterval,
		DrainTimeout:                  30 * time.Second,
		WebhookSecretRotationInterval: s.webhookSecretRotationInterval,
	})
	if err != nil {
		return err
	}
	return repoController.Run(ctx, repoControllerWorkers, func() {}, func() {})
}
