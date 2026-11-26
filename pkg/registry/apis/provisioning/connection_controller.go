package provisioning

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
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

	informer controllerInformer
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
		informer: newControllerInformer(cfg, unified, informerMetrics),
	}
	common := controller.Common{Subscriber: subscriber, Registry: registry, Tracer: tracer}
	s.loopbackService = newControllerService(ConnectionControllerServiceName, builder, common, s.runController)
	return s
}

func (s *ConnectionControllerService) runController(ctx context.Context, common controller.Common) error {
	connController, err := controller.ProvideConnectionController(controller.ConnectionControllerDeps{
		Common:            common,
		Informer:          s.informer.forResource(provisioning.ConnectionResourceInfo.GroupVersionResource()),
		ConnectionFactory: s.builder.connectionFactory,
		HealthMetrics:     controller.NewHealthMetricsRecorder(common.Registry),
	})
	if err != nil {
		return err
	}

	return connController.Run(ctx, repoControllerWorkers, func() {})
}
