package server

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/server/backgroundsvcs"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/setting"
)

func testServer(m *MockModuleService) *Server {
	cfg := setting.NewCfg()
	return newServer(Options{}, cfg, m, acimpl.ProvideOSSService(cfg, nil, nil, nil),
		backgroundsvcs.NewBackgroundServiceRegistry(), nil)
}

func TestServer_Run_Error(t *testing.T) {
	testErr := errors.New("boom")

	t.Run("Modules Init error bubbles up", func(t *testing.T) {
		ctx := context.Background()
		s := testServer(&MockModuleService{
			initFunc: func(c context.Context) error {
				require.Equal(t, ctx, c)
				return testErr
			},
		})

		err := s.Run(ctx)
		require.ErrorIs(t, err, testErr)
	})

	t.Run("Modules Run error bubbles up", func(t *testing.T) {
		ctx := context.Background()
		s := testServer(&MockModuleService{
			runFunc: func(c context.Context) error {
				require.Equal(t, ctx, c)
				return testErr
			},
		})

		err := s.Run(ctx)
		require.ErrorIs(t, err, testErr)
	})
}

func TestServer_Shutdown(t *testing.T) {
	ctx := context.Background()

	modulesShutdown := false
	s := testServer(&MockModuleService{
		shutdownFunc: func(_ context.Context) error {
			modulesShutdown = true
			return nil
		},
	})

	ch := make(chan error)
	go func() {
		defer close(ch)
		ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
		defer cancel()
		err := s.Shutdown(ctx, "test interrupt")
		ch <- err
	}()
	err := s.Run(ctx)
	require.NoError(t, err)

	err = <-ch
	require.NoError(t, err)
	require.True(t, modulesShutdown)

	t.Run("Modules Shutdown error bubbles up", func(t *testing.T) {
		testErr := errors.New("boom")

		s = testServer(&MockModuleService{
			shutdownFunc: func(_ context.Context) error {
				return testErr
			},
		})

		ch = make(chan error)
		go func() {
			defer close(ch)
			ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
			defer cancel()
			err = s.Shutdown(ctx, "test interrupt")
			ch <- err
		}()
		err = s.Run(ctx)
		require.NoError(t, err)

		err = <-ch
		require.ErrorIs(t, err, testErr)
	})
}

type MockModuleService struct {
	initFunc     func(context.Context) error
	runFunc      func(context.Context) error
	shutdownFunc func(context.Context) error
}

func (m *MockModuleService) Init(ctx context.Context) error {
	if m.initFunc != nil {
		return m.initFunc(ctx)
	}
	return nil
}

func (m *MockModuleService) Run(ctx context.Context) error {
	if m.runFunc != nil {
		return m.runFunc(ctx)
	}
	return nil
}

func (m *MockModuleService) Shutdown(ctx context.Context) error {
	if m.shutdownFunc != nil {
		return m.shutdownFunc(ctx)
	}
	return nil
}
