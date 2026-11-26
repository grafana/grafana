package provisioning

import (
	"context"
	"fmt"

	apisprovisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/operators/runner"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
)

var ConnectionOperator = runner.Operator{
	Name:        "provisioning-connection",
	Description: "Watch provisioning connections",
	Logger:      "provisioning-connection-controller",
	Defaults:    operatorDefaults,
	Build: func(rt *runner.Runtime) (*runner.Parts, error) {
		controllerCfg, err := setupFromConfig(rt)
		if err != nil {
			return nil, err
		}
		return &runner.Parts{Run: func(ctx context.Context, ready func()) error {
			return runConnectionController(ctx, controllerCfg, ready)
		}}, nil
	},
}

func runConnectionController(ctx context.Context, controllerCfg *ProvisioningRunner, ready func()) error {
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

	tracer := controllerCfg.Tracer

	connKeys, err := controllerCfg.ProvisioningKeysLister(apisprovisioning.ConnectionResourceInfo.GroupVersionResource())
	if err != nil {
		return err
	}

	connController, err := controller.ProvideConnectionController(controller.ConnectionControllerDeps{
		Subscriber:        controllerCfg.Subscriber,
		Client:            provisioningClient,
		Keys:              connKeys,
		ConnectionFactory: connectionFactory,
		HealthMetrics:     healthMetricsRecorder,
		RelistMetrics:     controllerCfg.RelistProjectionMetrics(),
		FreshnessMetrics:  controllerCfg.FreshnessMetrics(),
		Registry:          controllerCfg.Registerer,
		Tracer:            tracer,
		ResyncInterval:    controllerCfg.Options.Resync,
		DrainTimeout:      controllerCfg.Options.DrainTimeout,
	})
	if err != nil {
		return err
	}

	return connController.Run(ctx, controllerCfg.Options.Workers, ready)
}
