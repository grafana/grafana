package server

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/backgroundsvcs"
	"github.com/grafana/grafana/pkg/registry/backgroundsvcs/adapter"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type testService struct {
	started    chan struct{}
	runErr     error
	isDisabled bool
	dependsOn  *boomService
}

func newTestService(runErr error, disabled bool, dependsOn *boomService) *testService {
	return &testService{
		started:    make(chan struct{}),
		runErr:     runErr,
		isDisabled: disabled,
		dependsOn:  dependsOn,
	}
}

func (s *testService) Run(ctx context.Context) error {
	if s.dependsOn != nil {
		select {
		case <-s.dependsOn.started:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	if s.isDisabled {
		return fmt.Errorf("Shouldn't run disabled service")
	}

	if s.runErr != nil {
		return s.runErr
	}
	close(s.started)
	<-ctx.Done()
	return ctx.Err()
}

func (s *testService) IsDisabled() bool {
	return s.isDisabled
}

type boomService struct {
	started chan struct{}
	runErr  error
}

func newBoomService(runErr error) *boomService {
	return &boomService{
		started: make(chan struct{}),
		runErr:  runErr,
	}
}

func (s *boomService) Run(ctx context.Context) error {
	if s.runErr != nil {
		// Unblock testService (and any other waiters on started) before failing; otherwise
		// testService.Run would wait forever on <-dependsOn.started.
		close(s.started)
		return s.runErr
	}
	close(s.started)
	<-ctx.Done()
	return ctx.Err()
}

func (s *boomService) IsDisabled() bool {
	return false
}

// shutdownDisabledBGTestService is skipped by the adapter (Shutdown test only; distinct dskit module name).
type shutdownDisabledBGTestService struct{}

func (shutdownDisabledBGTestService) Run(ctx context.Context) error {
	return fmt.Errorf("Shouldn't run disabled service")
}

func (shutdownDisabledBGTestService) IsDisabled() bool {
	return true
}

func testServer(t *testing.T, services ...registry.BackgroundService) *Server {
	t.Helper()
	s, err := newServer(Options{}, setting.NewCfg(), nil, &acimpl.Service{}, nil, backgroundsvcs.NewBackgroundServiceRegistry(services...), tracing.NewNoopTracerService(), featuremgmt.WithFeatures(), prometheus.NewRegistry())
	require.NoError(t, err)
	s.managerAdapter.WithDependencies(map[string][]string{
		adapter.Core:               {},
		adapter.BackgroundServices: {adapter.Core},
	})
	// Required to skip configuration initialization that causes
	// DI errors in this test.
	s.isInitialized = true
	return s
}

func TestServer_Run_Error(t *testing.T) {
	// Two services use different concrete types (*testService vs *boomService) so dskit gets two
	// module names; two *testService values would share one name and overwrite each other.
	//
	// testService waits on boom.started before running so boom is ordered before the stable
	// sibling in practice, avoiding flaky lifecycle errors when a peer fails during its startup.
	testErr := errors.New("boom")
	boom := newBoomService(testErr)
	s := testServer(t, newTestService(nil, false, boom), boom)
	err := s.Run()
	require.Error(t, err)
	require.Contains(t, err.Error(), testErr.Error())
}

func TestServer_Shutdown(t *testing.T) {
	t.Run("successful shutdown", func(t *testing.T) {
		ctx := context.Background()
		// Dedicated types so dskit module names differ (*testService vs shutdownDisabledBGTestService).
		s := testServer(t, newTestService(nil, false, nil), shutdownDisabledBGTestService{})
		ch := make(chan error)
		go func() {
			defer close(ch)
			err := s.managerAdapter.AwaitRunning(ctx)
			require.NoError(t, err)
			ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
			defer cancel()
			err = s.Shutdown(ctx, "test interrupt")
			ch <- err
		}()
		err := s.Run()
		require.NoError(t, err)

		err = <-ch
		require.NoError(t, err)
	})
}
