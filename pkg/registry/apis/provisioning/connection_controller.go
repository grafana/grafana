package provisioning

import (
	"context"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	clientrest "k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// ConnectionControllerServiceName is the background-service module name of
// [ConnectionControllerService].
const ConnectionControllerServiceName = "provisioning-connection-controller"

// ConnectionControllerService runs the connection controller in the Grafana
// process once the provisioning API is served.
type ConnectionControllerService struct {
	*loopbackService

	subscriber      nats.Subscriber
	registry        prometheus.Registerer
	tracer          tracing.Tracer
	unified         resource.ResourceClient
	informerMetrics *InformerMetrics
	resyncInterval  time.Duration
}

// ProvideConnectionControllerService is called by Wire. Depending on the
// builder orders it after [RegisterAPIService], which registers the
// provisioning API group with the API server.
func ProvideConnectionControllerService(
	cfg *setting.Cfg,
	builder *APIBuilder,
	subscriber nats.Subscriber,
	registry prometheus.Registerer,
	tracer tracing.Tracer,
	unified resource.ResourceClient,
	informerMetrics *InformerMetrics,
) *ConnectionControllerService {
	s := &ConnectionControllerService{
		subscriber:      subscriber,
		registry:        registry,
		tracer:          tracer,
		unified:         unified,
		informerMetrics: informerMetrics,
		resyncInterval:  controllerResyncInterval(cfg),
	}
	s.loopbackService = newLoopbackService(ConnectionControllerServiceName, builder, cfg.DisableControllers, s.runController)
	return s
}

func (s *ConnectionControllerService) runController(ctx context.Context, restConfig *clientrest.Config) error {
	client, err := clientset.NewForConfig(restConfig)
	if err != nil {
		return fmt.Errorf("create provisioning clientset: %w", err)
	}

	b := s.builder
	relistMetrics, freshnessMetrics := s.informerMetrics.get()

	connController, err := controller.ProvideConnectionController(controller.ConnectionControllerDeps{
		Subscriber:        s.subscriber,
		Client:            client,
		Keys:              keysapi.NewGRPCLister(s.unified, provisioning.ConnectionResourceInfo.GroupVersionResource()),
		ConnectionFactory: b.connectionFactory,
		HealthMetrics:     controller.NewHealthMetricsRecorder(s.registry),
		RelistMetrics:     relistMetrics,
		FreshnessMetrics:  freshnessMetrics,
		Registry:          s.registry,
		Tracer:            s.tracer,
		ResyncInterval:    s.resyncInterval,
		DrainTimeout:      30 * time.Second,
	})
	if err != nil {
		return err
	}

	return connController.Run(ctx, repoControllerWorkers, func() {})
}
