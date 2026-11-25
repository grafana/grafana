package supervision

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/dskit/services"
)

// watch registers before startup so even immediate service failures cancel the operator.
// The caller must defer stop and include its error in the operator's return value.
func watch(ctx context.Context, svc services.Service) (context.Context, func() error) {
	ctx, cancel := context.WithCancelCause(ctx)
	remove := svc.AddListener(services.NewListener(nil, nil, nil, nil, func(_ services.State, err error) {
		cancel(err)
	}))
	return ctx, func() error {
		defer remove()
		defer cancel(nil)
		if err := services.StopAndAwaitTerminated(context.Background(), svc); err != nil {
			return fmt.Errorf("operator service %s failed: %w", services.DescribeService(svc), err)
		}
		return nil
	}
}

// Start watches svcs and starts them in order; the returned context is
// cancelled when any of them fails. The caller must defer stop even when Start
// returns an error, and include its error in the operator's return value. stop
// stops the services in reverse order. A start interrupted by a service
// failing reports that failure, not the cancellation it caused.
func Start(ctx context.Context, svcs ...services.Service) (_ context.Context, stop func() error, _ error) {
	stops := make([]func() error, 0, len(svcs))
	for _, svc := range svcs {
		var stopSvc func() error
		ctx, stopSvc = watch(ctx, svc)
		stops = append(stops, stopSvc)
	}
	stop = func() error {
		var errs []error
		for i := len(stops) - 1; i >= 0; i-- {
			errs = append(errs, stops[i]())
		}
		return errors.Join(errs...)
	}

	for _, svc := range svcs {
		if err := services.StartAndAwaitRunning(ctx, svc); err != nil {
			if errors.Is(err, context.Canceled) && ctx.Err() != nil {
				err = context.Cause(ctx)
			}
			return ctx, stop, fmt.Errorf("start %s: %w", services.DescribeService(svc), err)
		}
	}
	return ctx, stop, nil
}
