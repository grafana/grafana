package provisioning

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-app-sdk/logging"
	clientrest "k8s.io/client-go/rest"

	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
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
	// disabled is set from disable_controllers.
	disabled bool
	run      func(ctx context.Context, restConfig *clientrest.Config) error
	// waitFor, when set, also delays run until it is closed.
	waitFor <-chan struct{}
	// onStop, when set, is called once the service stops, however it stopped.
	onStop func()
}

func newLoopbackService(name string, builder *APIBuilder, disabled bool, run func(ctx context.Context, restConfig *clientrest.Config) error) *loopbackService {
	s := &loopbackService{builder: builder, disabled: disabled, run: run}
	s.NamedService = services.NewBasicService(nil, s.running, s.stopping).WithName(name)
	return s
}

// newControllerService is a loopbackService for a provisioning controller: it
// runs with common completed by a client for the provisioning API.
func newControllerService(name string, builder *APIBuilder, disabled bool, common controller.Common, run func(ctx context.Context, common controller.Common) error) *loopbackService {
	return newLoopbackService(name, builder, disabled, func(ctx context.Context, restConfig *clientrest.Config) error {
		client, err := clientset.NewForConfig(restConfig)
		if err != nil {
			return fmt.Errorf("create provisioning clientset: %w", err)
		}
		common.Client = client
		return run(ctx, common)
	})
}

// IsDisabled implements registry.CanBeDisabled.
func (s *loopbackService) IsDisabled() bool {
	return s.builder == nil || s.disabled
}

// Run implements registry.BackgroundService.
func (s *loopbackService) Run(ctx context.Context) error {
	if err := s.StartAsync(ctx); err != nil {
		return err
	}
	return s.AwaitTerminated(context.Background())
}

func (s *loopbackService) running(ctx context.Context) error {
	restConfig, err := s.awaitStart(ctx)
	if err == nil {
		logging.FromContext(ctx).Info("starting provisioning service", "service", s.ServiceName())
		err = s.run(ctx, restConfig)
	}
	if errors.Is(err, context.Canceled) && ctx.Err() != nil {
		return nil
	}
	return err
}

func (s *loopbackService) awaitStart(ctx context.Context) (*clientrest.Config, error) {
	restConfig, err := s.builder.awaitLoopbackConfig(ctx)
	if err != nil || s.waitFor == nil {
		return restConfig, err
	}
	select {
	case <-s.waitFor:
		return restConfig, nil
	case <-ctx.Done():
		return nil, context.Cause(ctx)
	}
}

func (s *loopbackService) stopping(error) error {
	if s.onStop != nil {
		s.onStop()
	}
	return nil
}
