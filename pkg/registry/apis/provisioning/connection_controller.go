package provisioning

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-app-sdk/logging"
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
	services.NamedService

	builder *APIBuilder
	run     func(ctx context.Context, restConfig *clientrest.Config) error
}

// ProvideConnectionControllerService is called by Wire. Depending on the
// builder orders it after [RegisterAPIService], which registers the
// provisioning API group with the API server.
func ProvideConnectionControllerService(builder *APIBuilder) *ConnectionControllerService {
	s := &ConnectionControllerService{builder: builder}
	s.run = s.runController
	s.NamedService = services.NewBasicService(nil, s.running, nil).WithName(ConnectionControllerServiceName)
	return s
}

// IsDisabled implements registry.CanBeDisabled.
func (s *ConnectionControllerService) IsDisabled() bool {
	return s.builder == nil || s.builder.onlyApiServer
}

// Run implements registry.BackgroundService.
func (s *ConnectionControllerService) Run(ctx context.Context) error {
	if err := s.StartAsync(ctx); err != nil {
		return err
	}
	return s.AwaitTerminated(context.Background())
}

func (s *ConnectionControllerService) running(ctx context.Context) error {
	// The controller reads connections and patches their status through one
	// client on the hook's loopback config. A routed config would send the
	// patches, which carry the provisioning requester, through the router,
	// which strips the loopback credentials before a remote backend.
	restConfig, err := s.builder.awaitLoopbackConfig(ctx)
	if err == nil {
		err = s.run(ctx, restConfig)
	}
	if errors.Is(err, context.Canceled) && ctx.Err() != nil {
		return nil
	}
	return err
}

func (s *ConnectionControllerService) runController(ctx context.Context, restConfig *clientrest.Config) error {
	client, err := clientset.NewForConfig(restConfig)
	if err != nil {
		return fmt.Errorf("create provisioning client for connection controller: %w", err)
	}

	b := s.builder
	// nil keeps the full-object re-list; see NewConnectionDeltaSource.
	var keys keysapi.Lister
	if b.keysOnlyReList {
		gvr := provisioning.ConnectionResourceInfo.GroupVersionResource()
		keys = keysapi.NewGRPCLister(b.unified, gvr)
		logging.FromContext(ctx).Info("provisioning re-list will ask for keys only", "transport", "storage", "resource", gvr.Resource)
	}
	relistMetrics, freshnessMetrics := b.informerMetrics()

	connController, err := controller.ProvideConnectionController(controller.ConnectionControllerDeps{
		Subscriber:        b.natsSubscriber,
		Client:            client,
		Keys:              keys,
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
