package provisioning

import (
	"context"
	"errors"

	"github.com/grafana/dskit/services"
	clientrest "k8s.io/client-go/rest"
)

// loopbackService is the background-service lifecycle shared by the
// provisioning controllers that run in the Grafana process: it waits until the
// provisioning API is served and then runs the controller on the post-start
// hook's loopback config until shutdown.
//
// Controllers run on the loopback config rather than a routed one because
// their writes carry the provisioning requester, and the router strips the
// loopback credentials before a remote backend.
type loopbackService struct {
	services.NamedService

	builder *APIBuilder
	run     func(ctx context.Context, restConfig *clientrest.Config) error
	// awaitBootstrap also delays run until the bootstrap repository is
	// reconciled.
	awaitBootstrap bool
}

func newLoopbackService(name string, builder *APIBuilder, run func(ctx context.Context, restConfig *clientrest.Config) error) *loopbackService {
	s := &loopbackService{builder: builder, run: run}
	s.NamedService = services.NewBasicService(nil, s.running, nil).WithName(name)
	return s
}

// IsDisabled implements registry.CanBeDisabled.
func (s *loopbackService) IsDisabled() bool {
	return s.builder == nil || s.builder.onlyApiServer
}

// Run implements registry.BackgroundService.
func (s *loopbackService) Run(ctx context.Context) error {
	if err := s.StartAsync(ctx); err != nil {
		return err
	}
	return s.AwaitTerminated(context.Background())
}

func (s *loopbackService) running(ctx context.Context) error {
	restConfig, err := s.builder.awaitLoopbackConfig(ctx)
	if err == nil && s.awaitBootstrap {
		err = s.builder.awaitBootstrapReconciled(ctx)
	}
	if err == nil {
		err = s.run(ctx, restConfig)
	}
	if errors.Is(err, context.Canceled) && ctx.Err() != nil {
		return nil
	}
	return err
}
