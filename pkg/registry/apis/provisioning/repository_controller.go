package provisioning

import (
	"context"
	"fmt"
	"time"

	clientrest "k8s.io/client-go/rest"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
)

const defaultWebhookSecretRotationInterval = 30 * 24 * time.Hour

// RepositoryControllerServiceName is the background-service module name of
// [RepositoryControllerService].
const RepositoryControllerServiceName = "provisioning-repository-controller"

// RepositoryControllerService runs the repository controller in the Grafana
// process once the provisioning API is served.
type RepositoryControllerService struct {
	*loopbackService
}

// ProvideRepositoryControllerService is called by Wire. Depending on the
// builder orders it after [RegisterAPIService], which registers the
// provisioning API group with the API server.
func ProvideRepositoryControllerService(builder *APIBuilder) *RepositoryControllerService {
	s := &RepositoryControllerService{}
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
	webhookSecretRotationInterval := b.webhookSecretRotationInterval
	if webhookSecretRotationInterval <= 0 {
		webhookSecretRotationInterval = defaultWebhookSecretRotationInterval
	}

	relistProjectionMetrics, freshnessMetrics := b.informerMetrics()
	repoController, err := controller.ProvideRepositoryController(controller.RepositoryControllerDeps{
		ProvisioningClient:            client,
		NATSSubscriber:                b.natsSubscriber,
		KeysLister:                    keysapi.NewGRPCLister(b.unified, provisioningapis.RepositoryResourceInfo.GroupVersionResource()),
		RelistProjectionMetrics:       relistProjectionMetrics,
		FreshnessMetrics:              freshnessMetrics,
		HealthMetrics:                 controller.NewHealthMetricsRecorder(b.registry),
		RepoFactory:                   b.repoFactory,
		ConnectionFactory:             b.connectionFactory,
		ResourceLister:                b.resourceLister,
		Clients:                       b.clients,
		Validator:                     b.repoValidator,
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
	return repoController.Run(ctx, repoControllerWorkers, func() {}, func() {})
}
