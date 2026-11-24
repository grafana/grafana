package provisioning

import (
	"context"
	"errors"
	"testing"
	"testing/synctest"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"
	clientrest "k8s.io/client-go/rest"
)

func TestConnectionControllerService_IsDisabled(t *testing.T) {
	tests := []struct {
		name    string
		builder *APIBuilder
		want    bool
	}{
		{name: "provisioning disabled", builder: nil, want: true},
		{name: "controllers disabled", builder: &APIBuilder{onlyApiServer: true}, want: true},
		{name: "controllers enabled", builder: &APIBuilder{}, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := ProvideConnectionControllerService(tt.builder)
			require.Equal(t, tt.want, svc.IsDisabled())
			// The background service manager looks up this name in its
			// dependency map; any other name would start it after Core.
			require.Equal(t, ConnectionControllerServiceName, svc.ServiceName())
		})
	}
}

// newTestConnectionControllerService records the rest config the controller
// would run with, and runs until ctx is done or fails with runErr.
func newTestConnectionControllerService(runErr error) (*ConnectionControllerService, *APIBuilder, <-chan *clientrest.Config) {
	// bootstrapDone stays open: only the repository controller waits for the
	// bootstrap repository.
	builder := &APIBuilder{loopbackReady: make(chan struct{}), bootstrapDone: make(chan struct{})}
	svc := ProvideConnectionControllerService(builder)
	got := make(chan *clientrest.Config, 1)
	svc.run = func(ctx context.Context, restConfig *clientrest.Config) error {
		got <- restConfig
		if runErr != nil {
			return runErr
		}
		<-ctx.Done()
		return context.Cause(ctx)
	}
	return svc, builder, got
}

func TestConnectionControllerService_Run(t *testing.T) {
	t.Run("waits for the provisioning API and runs on the post-start hook's loopback config", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			svc, builder, got := newTestConnectionControllerService(nil)
			runErr := make(chan error, 1)
			go func() { runErr <- svc.Run(t.Context()) }()

			synctest.Wait()
			require.Empty(t, got, "controller started before the provisioning API was served")

			loopback := &clientrest.Config{Host: "https://loopback", BearerToken: "loopback-token"}
			builder.publishLoopbackConfig(loopback)
			synctest.Wait()
			require.Same(t, loopback, <-got, "controller must use the hook's loopback config for reads and writes")

			svc.StopAsync()
			require.NoError(t, <-runErr)
			require.Equal(t, services.Terminated, svc.State())
		})
	})

	t.Run("stops cleanly when cancelled while waiting for the provisioning API", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			svc, _, got := newTestConnectionControllerService(nil)
			runErr := make(chan error, 1)
			go func() { runErr <- svc.Run(t.Context()) }()
			synctest.Wait()

			svc.StopAsync()
			require.NoError(t, <-runErr)
			require.Equal(t, services.Terminated, svc.State())
			require.Empty(t, got, "controller must not start after cancellation")
		})
	})

	t.Run("fails when the controller fails", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			errController := errors.New("controller failed")
			svc, builder, _ := newTestConnectionControllerService(errController)
			builder.publishLoopbackConfig(&clientrest.Config{})

			require.ErrorIs(t, svc.Run(t.Context()), errController)
			require.Equal(t, services.Failed, svc.State())
		})
	})
}
