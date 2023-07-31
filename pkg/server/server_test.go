package server

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/setting"
)

func testServer(t *testing.T, m *modules.MockModuleEngine) *Server {
	t.Helper()
	s, err := newServer(Options{}, setting.NewCfg(), nil, &acimpl.Service{}, m)
	require.NoError(t, err)
	// Required to skip configuration initialization that causes
	// DI errors in this test.
	s.isInitialized = true
	return s
}

func TestServer_Run_Error(t *testing.T) {
	testErr := errors.New("boom")

	t.Run("Modules Run error bubbles up", func(t *testing.T) {
		ctx := context.Background()
		s := testServer(t, &modules.MockModuleEngine{
			RunFunc: func(c context.Context) error {
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
	s := testServer(t, &modules.MockModuleEngine{
		ShutdownFunc: func(_ context.Context) error {
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

		s = testServer(t, &modules.MockModuleEngine{
			ShutdownFunc: func(_ context.Context) error {
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
