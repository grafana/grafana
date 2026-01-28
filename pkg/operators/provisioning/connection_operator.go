package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/grafana/grafana-app-sdk/logging"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/server"
)

// RunConnectionController starts the connection controller operator.
func RunConnectionController(deps server.OperatorDependencies) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-connection-controller")
	logger.Info("Starting provisioning connection controller")

	controllerCfg, err := setupFromConfig(deps.Config, deps.Registerer)
	if err != nil {
		return fmt.Errorf("failed to setup config: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		fmt.Println("Received shutdown signal, stopping controllers")
		cancel()
	}()

	provisioningClient, err := controllerCfg.ProvisioningClient()
	if err != nil {
		return fmt.Errorf("failed to create provisioning client: %w", err)
	}

	informerFactory := informer.NewSharedInformerFactoryWithOptions(
		provisioningClient,
		controllerCfg.ResyncInterval(),
	)

	statusPatcher := appcontroller.NewConnectionStatusPatcher(provisioningClient.ProvisioningV0alpha1())
	connInformer := informerFactory.Provisioning().V0alpha1().Connections()

	// Setup connection factory and tester
	connectionFactory, err := controllerCfg.ConnectionFactory()
	if err != nil {
		return fmt.Errorf("failed to setup connection factory: %w", err)
	}

	healthMetricsRecorder, err := controllerCfg.HealthMetricsRecorder()
	if err != nil {
		return fmt.Errorf("failed to get health metrics recorder: %w", err)
	}

	connController, err := controller.NewConnectionController(
		provisioningClient.ProvisioningV0alpha1(),
		connInformer,
		statusPatcher,
		controller.NewConnectionHealthChecker(
			connection.NewSimpleConnectionTester(connectionFactory),
			healthMetricsRecorder,
		),
		connectionFactory,
		controllerCfg.ResyncInterval(),
	)

	if err != nil {
		return fmt.Errorf("failed to create connection controller: %w", err)
	}

	informerFactory.Start(ctx.Done())
	if !cache.WaitForCacheSync(ctx.Done(), connInformer.Informer().HasSynced) {
		return fmt.Errorf("failed to sync informer cache")
	}

	connController.Run(ctx, controllerCfg.NumberOfWorkers())
	return nil
}
