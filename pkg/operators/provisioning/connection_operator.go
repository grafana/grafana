package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/grafana/grafana-app-sdk/logging"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
	"github.com/grafana/grafana/pkg/server"
)

// RunConnectionController starts the connection controller operator.
func RunConnectionController(ctx context.Context, deps server.OperatorDependencies) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-connection-controller")
	logger.Info("Starting provisioning connection controller")

	controllerCfg, err := setupFromConfig(deps.Config, deps.Registerer)
	if err != nil {
		return fmt.Errorf("failed to setup config: %w", err)
	}

	provisioningClient, err := controllerCfg.ProvisioningClient()
	if err != nil {
		return fmt.Errorf("failed to create provisioning client: %w", err)
	}

	statusPatcher := appcontroller.NewConnectionStatusPatcher(provisioningClient.ProvisioningV0alpha1())

	// Setup connection factory and tester
	connectionFactory, err := controllerCfg.ConnectionFactory()
	if err != nil {
		return fmt.Errorf("failed to setup connection factory: %w", err)
	}

	healthMetricsRecorder, err := controllerCfg.HealthMetricsRecorder()
	if err != nil {
		return fmt.Errorf("failed to get health metrics recorder: %w", err)
	}

	// Expose the controller's named workqueue metrics (depth, adds, retries,
	// queue/work duration). Must be set before the controller builds its queue.
	registerWorkqueueMetrics(deps.Registerer)

	// The connection delta source and the getter it backs.
	connSource, connGetter := informer.NewConnectionDeltaSource(controllerCfg.natsSubscriber, provisioningClient, controllerCfg.ResyncInterval(), informer.RegisterMetrics(deps.Registerer))
	connController := controller.NewConnectionController(
		connGetter,
		statusPatcher,
		controller.NewConnectionHealthChecker(
			connection.NewSimpleConnectionTester(connectionFactory),
			healthMetricsRecorder,
		),
		connectionFactory,
		controllerCfg.ResyncInterval(),
		controllerCfg.DrainTimeout(),
		controllerCfg.Registry(),
	)

	reg, err := connSource.AddEventHandler(connController.EventHandler())
	if err != nil {
		return fmt.Errorf("failed to add connection event handler: %w", err)
	}
	go connSource.Run(ctx.Done())

	if !cache.WaitForCacheSync(ctx.Done(), reg.HasSynced) {
		return fmt.Errorf("connection controller informer cache sync failed")
	}

	connController.Run(ctx, controllerCfg.NumberOfWorkers(), func() {
		logger.Info("connection operator is ready")
		deps.HealthNotifier.SetReady()
	}, func() {})
	return nil
}
