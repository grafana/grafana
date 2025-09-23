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
//   - Stopping phase: No-op, transitions immediately to Terminated/Failed
type serviceAdapter struct {
	*services.BasicService
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
	}
	a.BasicService = services.NewBasicService(nil, a.run, nil).WithName(name)
	return a
}

// run implements the RunningFn for dskit's BasicService.
// This phase keeps the service in Running state by delegating to the wrapped
// background service's Run method. If the background service completes without
// error, the adapter waits for context cancellation (service stop) before
// transitioning to Stopping state, ensuring proper dskit service lifecycle.
func (a *serviceAdapter) run(ctx context.Context) error {
	err := a.service.Run(ctx)
	if err != nil && !errors.Is(err, context.Canceled) {
		return err
	}
	// wait for context cancellation to transition to Stopping state.
	// this prevents the service from causing it's dependents to stop prematurely.
	<-ctx.Done()
	return nil
}
