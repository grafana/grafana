package server

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/server/backgroundsvcs"
	"github.com/grafana/grafana/pkg/server/modules"
	"github.com/grafana/grafana/pkg/setting"
)

type testService struct {
	started    chan struct{}
	runErr     error
	isDisabled bool
}

func newTestService(runErr error, disabled bool) *testService {
	return &testService{
		started:    make(chan struct{}),
		runErr:     runErr,
		isDisabled: disabled,
	}
}

func (s *testService) Run(ctx context.Context) error {
	if s.isDisabled {
		return fmt.Errorf("shouldn't run disabled service")
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

func testServer(t *testing.T, services ...registry.BackgroundService) *Server {
	t.Helper()
	cfg := setting.NewCfg()
	m := modules.ProvideService(cfg, backgroundsvcs.NewBackgroundServiceRegistry(services...))
	err := m.Init()
	require.NoError(t, err)

	s := newServer(Options{}, cfg, m)
	require.NoError(t, err)
	// Required to skip configuration initialization that causes
	// DI errors in this test.
	s.isInitialized = true
	return s
}

func TestServer_Run_Error(t *testing.T) {
	testErr := errors.New("boom")
	s := testServer(t, newTestService(nil, false), newTestService(testErr, false))
	err := s.Run()
	require.ErrorIs(t, err, testErr)
}

func TestServer_Shutdown(t *testing.T) {
	s := testServer(t, newTestService(nil, false), newTestService(nil, true))

	ch := make(chan error)

	go func() {
		defer close(ch)
		s.Shutdown()
		ch <- nil
	}()
	err := s.Run()
	require.NoError(t, err)

	err = <-ch
	require.NoError(t, err)
}
