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
		r, err := newProvisioningRunner(rt)
		if err != nil {
			return nil, err
		}
		return &runner.Parts{Run: func(ctx context.Context, ready func()) error {
			return runConnectionController(ctx, r, ready)
		}}, nil
	},
}

func runConnectionController(ctx context.Context, r *ProvisioningRunner, ready func()) error {
	provisioningClient, err := r.ProvisioningClient()
	if err != nil {
		return fmt.Errorf("failed to create provisioning client: %w", err)
	}

	connectionFactory, err := r.ConnectionFactory()
	if err != nil {
		return fmt.Errorf("failed to setup connection factory: %w", err)
	}

	healthMetricsRecorder, err := r.HealthMetricsRecorder()
	if err != nil {
		return fmt.Errorf("failed to get health metrics recorder: %w", err)
	}

	tracer := r.Tracer

	connKeys, err := r.ProvisioningKeysLister(apisprovisioning.ConnectionResourceInfo.GroupVersionResource())
	if err != nil {
		return err
	}

	connController, err := controller.ProvideConnectionController(controller.ConnectionControllerDeps{
		Subscriber:        r.Subscriber,
		Client:            provisioningClient,
		Keys:              connKeys,
		ConnectionFactory: connectionFactory,
		HealthMetrics:     healthMetricsRecorder,
		RelistMetrics:     r.RelistProjectionMetrics(),
		FreshnessMetrics:  r.FreshnessMetrics(),
		Registry:          r.Registerer,
		Tracer:            tracer,
		ResyncInterval:    r.Options.Resync,
		DrainTimeout:      r.Options.DrainTimeout,
	})
	if err != nil {
		return err
	}

	return connController.Run(ctx, r.Options.Workers, ready)
}
