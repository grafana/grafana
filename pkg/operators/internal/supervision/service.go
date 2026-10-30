package supervision

import (
	"context"
	"fmt"

	"github.com/grafana/dskit/services"
)

// Watch registers before startup so even immediate service failures cancel the operator.
// The caller must defer stop and include its error in the operator's return value.
func Watch(ctx context.Context, svc services.Service) (context.Context, func() error) {
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
