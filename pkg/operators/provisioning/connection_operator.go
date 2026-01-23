package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/setting"
)

// RunConnectionController starts the connection controller operator.
func RunConnectionController(deps server.OperatorDependencies) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-connection-controller")
	logger.Info("Starting provisioning connection controller")

	controllerCfg, err := getConnectionControllerConfig(deps.Config, deps.Registerer)
	if err != nil {
		return fmt.Errorf("failed to setup operator: %w", err)
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

	informerFactory := informer.NewSharedInformerFactoryWithOptions(
		controllerCfg.provisioningClient,
		controllerCfg.resyncInterval,
	)

	statusPatcher := appcontroller.NewConnectionStatusPatcher(controllerCfg.provisioningClient.ProvisioningV0alpha1())
	connInformer := informerFactory.Provisioning().V0alpha1().Connections()

	decryptSvc, err := setupDecryptService(deps.Config, tracing.NewNoopTracerService(), controllerCfg.tokenExchangeClient)
	if err != nil {
		return fmt.Errorf("failed to setup decryptService: %w", err)
	}
	connectionDecrypter := connection.ProvideDecrypter(decryptSvc)

	// Setup connection factory and tester
	connectionFactory, err := setupConnectionFactory(deps.Config, connectionDecrypter)
	if err != nil {
		return fmt.Errorf("failed to setup connection factory: %w", err)
	}
	tester := connection.NewSimpleConnectionTester(connectionFactory)
	healthMetrics := controller.NewHealthMetricsRecorder(deps.Registerer)
	healthChecker := controller.NewConnectionHealthChecker(&tester, healthMetrics)

	connController, err := controller.NewConnectionController(
		controllerCfg.provisioningClient.ProvisioningV0alpha1(),
		connInformer,
		statusPatcher,
		healthChecker,
		connectionFactory,
	)
	if err != nil {
		return fmt.Errorf("failed to create connection controller: %w", err)
	}

	informerFactory.Start(ctx.Done())
	if !cache.WaitForCacheSync(ctx.Done(), connInformer.Informer().HasSynced) {
		return fmt.Errorf("failed to sync informer cache")
	}

	connController.Run(ctx, controllerCfg.workerCount)
	return nil
}

type connectionControllerConfig struct {
	provisioningControllerConfig
	workerCount int
}

func getConnectionControllerConfig(cfg *setting.Cfg, registry prometheus.Registerer) (*connectionControllerConfig, error) {
	controllerCfg, err := setupFromConfig(cfg, registry)
	if err != nil {
		return nil, err
	}

	return &connectionControllerConfig{
		provisioningControllerConfig: *controllerCfg,
		workerCount:                  cfg.SectionWithEnvOverrides("operator").Key("worker_count").MustInt(1),
	}, nil
}
