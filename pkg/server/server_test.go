package server

import (
	"context"
	"errors"
	"fmt"
	"net"
	"path/filepath"
	"runtime"
	"sync"
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

// startSystemdNotifyRecorder listens on a unix datagram socket like systemd's
// NOTIFY_SOCKET and records every state notification sent to it. It skips the
// test when unixgram sockets are unavailable (systemd only exists on linux).
func startSystemdNotifyRecorder(t *testing.T) (received func() []string) {
	t.Helper()

	socketPath := filepath.Join(t.TempDir(), "notify.sock")
	addr := &net.UnixAddr{Name: socketPath, Net: "unixgram"}
	listener, err := net.ListenUnixgram("unixgram", addr)
	if err != nil {
		t.Skipf("unixgram sockets are not available on %s: %v", runtime.GOOS, err)
	}
	t.Cleanup(func() {
		require.NoError(t, listener.Close())
	})

	var mu sync.Mutex
	var messages []string
	done := make(chan struct{})
	go func() {
		defer close(done)
		buf := make([]byte, 128)
		for {
			n, _, err := listener.ReadFrom(buf)
			if err != nil {
				return
			}
			mu.Lock()
			messages = append(messages, string(buf[:n]))
			mu.Unlock()
		}
	}()
	t.Cleanup(func() {
		select {
		case <-done:
		case <-time.After(time.Second):
		}
	})

	t.Setenv("NOTIFY_SOCKET", socketPath)

	return func() []string {
		mu.Lock()
		defer mu.Unlock()
		return append([]string(nil), messages...)
	}
}

// TestServer_Run_NotifiesSystemdOnlyAfterServicesAreRunning guards against
// issue #126879: READY=1 tells systemd startup succeeded, so it must not be sent
// while a background service can still fail the startup.
func TestServer_Run_NotifiesSystemdOnlyAfterServicesAreRunning(t *testing.T) {
	received := startSystemdNotifyRecorder(t)

	t.Run("does not notify when a background service fails to start", func(t *testing.T) {
		testErr := errors.New("provisioning failed")
		boom := newBoomService(testErr)
		s := testServer(t, newTestService(nil, false, boom), boom)

		err := s.Run()
		require.Error(t, err)
		require.Contains(t, err.Error(), testErr.Error())

		require.Empty(t, received(), "systemd must not be notified when startup fails")
	})

	t.Run("notifies readiness once services are running", func(t *testing.T) {
		s := testServer(t, newTestService(nil, false, nil))

		runErr := make(chan error, 1)
		go func() { runErr <- s.Run() }()

		stopPolling := make(chan struct{})
		defer close(stopPolling)

		waitMsg := make(chan string, 1)
		go func() {
			for {
				select {
				case <-stopPolling:
					return
				default:
				}
				msgs := received()
				if len(msgs) > 0 {
					waitMsg <- msgs[len(msgs)-1]
					return
				}
				time.Sleep(10 * time.Millisecond)
			}
		}()

		select {
		case msg := <-waitMsg:
			require.Equal(t, "READY=1", msg)
		case err := <-runErr:
			t.Fatalf("server exited before notifying systemd: %v", err)
		case <-time.After(10 * time.Second):
			t.Fatal("timed out waiting for the systemd readiness notification")
		}

		require.NoError(t, s.Shutdown(context.Background(), "test done"))
		require.NoError(t, <-runErr)
	})
}
