package provisioning

import (
	"context"
	"fmt"
	"time"

	clientrest "k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
)

// ConnectionControllerServiceName is the background-service module name of
// [ConnectionControllerService].
const ConnectionControllerServiceName = "provisioning-connection-controller"

// ConnectionControllerService runs the connection controller in the Grafana
// process once the provisioning API is served.
type ConnectionControllerService struct {
	*loopbackService
}

// ProvideConnectionControllerService is called by Wire. Depending on the
// builder orders it after [RegisterAPIService], which registers the
// provisioning API group with the API server.
func ProvideConnectionControllerService(builder *APIBuilder) *ConnectionControllerService {
	s := &ConnectionControllerService{}
	s.loopbackService = newLoopbackService(ConnectionControllerServiceName, builder, s.runController)
	return s
}

func (s *ConnectionControllerService) runController(ctx context.Context, restConfig *clientrest.Config) error {
	client, err := clientset.NewForConfig(restConfig)
	if err != nil {
		return fmt.Errorf("create provisioning client for connection controller: %w", err)
	}

	b := s.builder
	relistMetrics, freshnessMetrics := b.informerMetrics()

	connController, err := controller.ProvideConnectionController(controller.ConnectionControllerDeps{
		Subscriber:        b.natsSubscriber,
		Client:            client,
		Keys:              keysapi.NewGRPCLister(b.unified, provisioning.ConnectionResourceInfo.GroupVersionResource()),
		ConnectionFactory: b.connectionFactory,
		HealthMetrics:     controller.NewHealthMetricsRecorder(b.registry),
		RelistMetrics:     relistMetrics,
		FreshnessMetrics:  freshnessMetrics,
		Registry:          b.registry,
		Tracer:            b.tracer,
		ResyncInterval:    b.resyncInterval(),
		DrainTimeout:      30 * time.Second,
	})
	if err != nil {
		return err
	}

	return connController.Run(ctx, repoControllerWorkers, func() {})
}
