package backgroundsvcs

import (
	"context"
	"errors"
	"fmt"
	"reflect"

	"golang.org/x/sync/errgroup"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/registry"
)

// BackgroundServiceRunner provides a runner for background services.
type BackgroundServiceRunner struct {
	*services.BasicService
	registry registry.BackgroundServiceRegistry
	log      log.Logger
}

func ProvideBackgroundServiceRunner(registry registry.BackgroundServiceRegistry) *BackgroundServiceRunner {
	r := &BackgroundServiceRunner{registry: registry, log: log.New("background-services-runner")}
	r.BasicService = services.NewBasicService(nil, r.run, nil).WithName(modules.BackgroundServices)
	return r
}

func (r *BackgroundServiceRunner) run(ctx context.Context) error {
	childRoutines, childCtx := errgroup.WithContext(ctx)

	// Start background services.
	for _, svc := range r.registry.GetServices() {
		if registry.IsDisabled(svc) {
			continue
		}

		service := svc
		serviceName := reflect.TypeOf(service).String()
		childRoutines.Go(func() error {
			select {
			case <-childCtx.Done():
				return childCtx.Err()
			default:
			}
			r.log.Debug("Starting background service", "service", serviceName)
			err := service.Run(childCtx)
			// Do not return context.Canceled error since errgroup.Group only
			// returns the first error to the caller - thus we can miss a more
			// interesting error.
			if err != nil && !errors.Is(err, context.Canceled) {
				r.log.Error("Stopped background service", "service", serviceName, "reason", err)
				return fmt.Errorf("%s run error: %w", serviceName, err)
			}
			r.log.Debug("Stopped background service", "service", serviceName, "reason", err)
			return nil
		})
	}

	r.log.Debug("Waiting on services...")
	return childRoutines.Wait()
}
