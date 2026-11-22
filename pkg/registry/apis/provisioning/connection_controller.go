package provisioning

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/services/apiserver"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
)

// ConnectionControllerService runs the connection controller in the Grafana
// process once the API server, and with it the provisioning API, is running.
type ConnectionControllerService struct {
	builder        *APIBuilder
	configProvider apiserver.RestConfigProvider
}

// ProvideConnectionControllerService is called by Wire. Depending on the
// builder orders it after [RegisterAPIService], which registers the
// provisioning API group with the API server.
func ProvideConnectionControllerService(builder *APIBuilder, configProvider apiserver.RestConfigProvider) *ConnectionControllerService {
	return &ConnectionControllerService{
		builder:        builder,
		configProvider: configProvider,
	}
}

// IsDisabled implements registry.CanBeDisabled.
func (s *ConnectionControllerService) IsDisabled() bool {
	return s.builder == nil || s.builder.onlyApiServer
}

// Run implements registry.BackgroundService.
func (s *ConnectionControllerService) Run(ctx context.Context) error {
	// Blocks until the API server is running.
	restConfig, err := s.configProvider.GetRestConfig(ctx)
	if err != nil {
		return fmt.Errorf("get rest config for connection controller: %w", err)
	}
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
