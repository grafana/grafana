package provisioning

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-app-sdk/logging"

	apisprovisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/operators/internal/supervision"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/server"
)

// RunConnectionController starts the connection controller operator.
func RunConnectionController(ctx context.Context, deps server.OperatorDependencies) (runErr error) {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-connection-controller")
	logger.Info("Starting provisioning connection controller")

	controllerCfg, err := setupFromConfig(deps.Config, deps.Registerer)
	if err != nil {
		return fmt.Errorf("failed to setup config: %w", err)
	}

	ctx, stopSubscriber := supervision.Watch(ctx, controllerCfg.natsSubscriber)
	defer func() {
		deps.HealthNotifier.SetNotReady()
		runErr = errors.Join(runErr, stopSubscriber())
	}()
	if err := services.StartAndAwaitRunning(ctx, controllerCfg.natsSubscriber); err != nil {
		if errors.Is(err, context.Canceled) && ctx.Err() != nil {
			err = context.Cause(ctx)
		}
		return fmt.Errorf("failed to start NATS subscriber: %w", err)
	}

	provisioningClient, err := controllerCfg.ProvisioningClient()
	if err != nil {
		return fmt.Errorf("failed to create provisioning client: %w", err)
	}

	connectionFactory, err := controllerCfg.ConnectionFactory()
	if err != nil {
		return fmt.Errorf("failed to setup connection factory: %w", err)
	}

	healthMetricsRecorder, err := controllerCfg.HealthMetricsRecorder()
	if err != nil {
		return fmt.Errorf("failed to get health metrics recorder: %w", err)
	}

	tracer, err := controllerCfg.Tracer()
	if err != nil {
		return fmt.Errorf("failed to get tracer: %w", err)
	}

	// nil unless keys_only_relist is on, which keeps the full-object re-list.
	connKeys, err := controllerCfg.ProvisioningKeysLister(logger, apisprovisioning.ConnectionResourceInfo.GroupVersionResource())
	if err != nil {
		return err
	}

	connController, err := controller.ProvideConnectionController(controller.ConnectionControllerDeps{
		Subscriber:        controllerCfg.natsSubscriber,
		Client:            provisioningClient,
		Keys:              connKeys,
		ConnectionFactory: connectionFactory,
		HealthMetrics:     healthMetricsRecorder,
		RelistMetrics:     controllerCfg.RelistProjectionMetrics(),
		FreshnessMetrics:  controllerCfg.FreshnessMetrics(),
		Registry:          controllerCfg.Registry(),
		Tracer:            tracer,
		ResyncInterval:    controllerCfg.ResyncInterval(),
		DrainTimeout:      controllerCfg.DrainTimeout(),
	})
	if err != nil {
		return err
	}

	return connController.Run(ctx, controllerCfg.NumberOfWorkers(), func() {
		logger.Info("connection operator is ready")
		deps.HealthNotifier.SetReady()
	})
}
