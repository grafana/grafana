package adapter

import (
	"context"
	"errors"
	"reflect"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/registry"
)

var _ services.NamedService = &serviceAdapter{}

// serviceAdapter adapts a Grafana background service to dskit's NamedService interface.
// It wraps the background service with dskit's BasicService to provide the standard
// service state model: New → Starting → Running → Stopping → Terminated/Failed.
//
// The adapter uses dskit's BasicService with a custom RunningFn:
//   - Starting phase: No-op, transitions immediately to Running
//   - Running phase: Delegates to the wrapped service's Run method
//   - Stopping phase: Closes the stop channel to signal the service to stop
type serviceAdapter struct {
	services.NamedService
	stopCh  chan struct{}
	name    string
	service registry.BackgroundService
}

// asNamedService converts a Grafana background service into a dskit NamedService.
// The returned service starts in the New state and can be managed using dskit's
// standard service operations (StartAsync, AwaitRunning, StopAsync, AwaitTerminated).
//
// The service name is derived from the Go type name using reflection, ensuring
// each service type has a unique identifier within the dskit module system.
func asNamedService(service registry.BackgroundService) *serviceAdapter {
	name := reflect.TypeOf(service).String()
	a := &serviceAdapter{
		name:    name,
		service: service,
		stopCh:  make(chan struct{}),
	}
	a.NamedService = services.NewBasicService(nil, a.running, a.stopping).WithName(name)
	return a
}

// run implements the RunningFn for dskit's BasicService.
// This phase keeps the service in Running state by delegating to the wrapped
// background service's Run method. If the background service completes without
// error, the adapter waits for context cancellation (service stop) before
// transitioning to Stopping state, ensuring proper dskit service lifecycle.
func (a *serviceAdapter) running(ctx context.Context) error {
	serviceCtx, serviceCancel := context.WithCancel(ctx)
	go func() {
		<-a.stopCh
		serviceCancel()
	}()

	err := a.service.Run(serviceCtx)
	if err != nil && !errors.Is(err, context.Canceled) {
		return err
	}
	// wait for context cancellation to transition to Stopping state.
	// this prevents the service from causing it's dependents to stop prematurely.
	<-serviceCtx.Done()
	return nil
}

func (a *serviceAdapter) stopping(_ error) error {
	close(a.stopCh)
	return nil
}
