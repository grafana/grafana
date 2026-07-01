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
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	provisioninginformers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions/provisioning/v0alpha1"
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

	// Under the NATS watch reconcile reads the connection fresh from the API and
	// the apiserver-backed informer is not created at all; otherwise the informer's
	// cache-backed getter is authoritative.
	var connGetter controller.ConnectionGetter
	var connInformer provisioninginformers.ConnectionInformer
	var informerFactory informers.SharedInformerFactory
	if controllerCfg.natsWatch() {
		connGetter = controller.NewClientConnectionGetter(provisioningClient.ProvisioningV0alpha1())
	} else {
		informerFactory = informers.NewSharedInformerFactory(provisioningClient, controllerCfg.ResyncInterval())
		connInformer = informerFactory.Provisioning().V0alpha1().Connections()
		connGetter = controller.NewCachedConnectionGetter(connInformer.Lister())
	}
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

	var hasSynced cache.InformerSynced
	if controllerCfg.natsWatch() {
		natsInformer := informer.NewConnectionInformer(controllerCfg.natsSubscriber, provisioningClient, "", controllerCfg.ResyncInterval())
		reg, err := natsInformer.AddEventHandler(connController.EventHandler())
		if err != nil {
			return fmt.Errorf("failed to add connection event handler: %w", err)
		}
		natsInformer.Start(ctx.Done())
		hasSynced = reg.HasSynced
	} else {
		reg, err := connInformer.Informer().AddEventHandler(connController.EventHandler())
		if err != nil {
			return fmt.Errorf("failed to add connection event handler: %w", err)
		}
		informerFactory.Start(ctx.Done())
		hasSynced = reg.HasSynced
	}

	if !cache.WaitForCacheSync(ctx.Done(), hasSynced) {
		return fmt.Errorf("connection controller event source sync failed")
	}

	connController.Run(ctx, controllerCfg.NumberOfWorkers(), func() {
		logger.Info("connection operator is ready")
		deps.HealthNotifier.SetReady()
	}, func() {})
	return nil
}
