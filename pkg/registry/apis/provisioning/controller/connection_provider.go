package controller

import (
	"context"
	"fmt"

	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
)

// ConnectionControllerDeps are the dependencies of a connection controller,
// shared by the in-process apiserver and the standalone connection operator.
type ConnectionControllerDeps struct {
	Common
	Informer
	ConnectionFactory connection.Factory
	HealthMetrics     HealthMetricsRecorder
}

// ConnectionControllerRunner is a connection controller wired to its delta source.
type ConnectionControllerRunner struct {
	source       informer.DeltaSource
	registration cache.ResourceEventHandlerRegistration
	controller   *ConnectionController
}

// ProvideConnectionController builds the connection controller and its delta
// source, and registers the controller's event handler with the source.
func ProvideConnectionController(deps ConnectionControllerDeps) (*ConnectionControllerRunner, error) {
	source, getter := informer.NewConnectionDeltaSource(deps.Subscriber, deps.Client, deps.Keys, deps.ResyncInterval, deps.RelistMetrics, deps.FreshnessMetrics)
	return newConnectionControllerRunner(source, getter, deps)
}

func newConnectionControllerRunner(source informer.DeltaSource, getter informer.ConnectionGetter, deps ConnectionControllerDeps) (*ConnectionControllerRunner, error) {
	controller := NewConnectionController(
		getter,
		appcontroller.NewConnectionStatusPatcher(deps.Client.ProvisioningV0alpha1()),
		NewConnectionHealthChecker(connection.NewSimpleConnectionTester(deps.ConnectionFactory), deps.HealthMetrics),
		deps.ConnectionFactory,
		deps.ResyncInterval,
		deps.DrainTimeout,
		deps.Registry,
		deps.Tracer,
		nats.Enabled(deps.Subscriber),
	)

	// The handler must be registered before the source runs: the NATS-backed
	// source has no cache to replay for late handlers.
	registration, err := source.AddEventHandler(controller.EventHandler())
	if err != nil {
		return nil, fmt.Errorf("add connection controller event handler: %w", err)
	}

	return &ConnectionControllerRunner{
		source:       source,
		registration: registration,
		controller:   controller,
	}, nil
}

// Run starts the delta source, waits until the controller has handled the
// initial list, and then runs the controller workers until ctx is done.
// onStarted is called once the workers are running.
func (r *ConnectionControllerRunner) Run(ctx context.Context, workers int, onStarted func()) error {
	go r.source.Run(ctx.Done())

	if !cache.WaitForCacheSync(ctx.Done(), r.registration.HasSynced) {
		r.controller.queue.ShutDown()
		// The cause tells a dependency failure, such as the NATS subscriber
		// stopping, apart from a shutdown: callers treat context.Canceled as
		// a clean stop.
		return fmt.Errorf("connection controller informer cache sync failed: %w", context.Cause(ctx))
	}

	r.controller.Run(ctx, workers, onStarted, func() {})
	return nil
}
