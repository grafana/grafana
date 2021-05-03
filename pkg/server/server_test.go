package server

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/registry"

	"github.com/stretchr/testify/require"
)

type testServiceRegistry struct {
	services []*registry.Descriptor
}

func (r *testServiceRegistry) GetServices() []*registry.Descriptor {
	return r.services
}

func (r *testServiceRegistry) IsDisabled(_ registry.Service) bool {
	return false
}

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

func (s *testService) Init() error {
	return s.initErr
}

func (s *testService) Run(ctx context.Context) error {
	if s.runErr != nil {
		return s.runErr
	}
	close(s.started)
	<-ctx.Done()
	return ctx.Err()
}

func testServer() *Server {
	s := newServer(Config{})
	// Required to skip configuration initialization that causes
	// DI errors in this test.
	s.isInitialized = true
	return s
}

func TestServer_Run_Error(t *testing.T) {
	s := testServer()

	var testErr = errors.New("boom")

	s.serviceRegistry = &testServiceRegistry{
		services: []*registry.Descriptor{
			{
				Name:         "TestService1",
				Instance:     newTestService(nil, nil),
				InitPriority: registry.High,
			},
			{
				Name:         "TestService2",
				Instance:     newTestService(nil, testErr),
				InitPriority: registry.High,
			},
		},
	}

	err := s.Run()
	require.ErrorIs(t, err, testErr)
	require.NotZero(t, s.ExitCode(err))
}

func TestServer_Shutdown(t *testing.T) {
	ctx := context.Background()

	s := testServer()
	services := []*registry.Descriptor{
		{
			Name:         "TestService1",
			Instance:     newTestService(nil, nil),
			InitPriority: registry.High,
		},
		{
			Name:         "TestService2",
			Instance:     newTestService(nil, nil),
			InitPriority: registry.High,
		},
	}
	s.serviceRegistry = &testServiceRegistry{
		services: services,
	}

	ch := make(chan error)

	go func() {
		defer close(ch)

		// Wait until all services launched.
		for _, svc := range services {
			<-svc.Instance.(*testService).started
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
