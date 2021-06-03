package server

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/backgroundsvcs"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/require"
)

type testService struct {
	started chan struct{}
	initErr error
	runErr  error
}

func newTestService(initErr, runErr error) *testService {
	return &testService{
		started: make(chan struct{}),
		initErr: initErr,
		runErr:  runErr,
	}
}

func (s *testService) Run(ctx context.Context) error {
	if s.runErr != nil {
		return s.runErr
	}
	close(s.started)
	<-ctx.Done()
	return ctx.Err()
}

func testServer(t *testing.T) *Server {
	t.Helper()
	s, err := newServer(Options{}, setting.NewCfg(), nil, nil, nil, backgroundsvcs.ProvideService())
	require.NoError(t, err)
	// Required to skip configuration initialization that causes
	// DI errors in this test.
	s.isInitialized = true
	return s
}

func TestServer_Run_Error(t *testing.T) {
	s := testServer(t)
	testErr := errors.New("boom")
	s.backgroundServices.AddBackgroundService(newTestService(nil, nil))
	s.backgroundServices.AddBackgroundService(newTestService(nil, testErr))

	err := s.Run()
	require.ErrorIs(t, err, testErr)
	require.NotZero(t, s.ExitCode(err))
}

func TestServer_Shutdown(t *testing.T) {
	ctx := context.Background()

	s := testServer(t)
	s.backgroundServices.AddBackgroundService(newTestService(nil, nil))

	ch := make(chan error)

	go func() {
		defer close(ch)

		// Wait until all services launched.
		for _, svc := range s.backgroundServices.BackgroundServices {
			<-svc.(*testService).started
		}
		ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
		defer cancel()
		err := s.Shutdown(ctx, "test interrupt")
		ch <- err
	}()
	err := s.Run()
	require.NoError(t, err)
	require.Zero(t, s.ExitCode(err))

	err = <-ch
	require.NoError(t, err)
}
