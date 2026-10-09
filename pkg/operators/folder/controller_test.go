package folder

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	natsserver "github.com/nats-io/nats-server/v2/server"
	natstest "github.com/nats-io/nats-server/v2/test"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/setting"
)

func TestFolderControllerOwnsNATSSubscriber(t *testing.T) {
	srv, err := natsserver.NewServer(&natsserver.Options{Host: "127.0.0.1", Port: natsserver.RANDOM_PORT, NoLog: true, NoSigs: true})
	require.NoError(t, err)
	go srv.Start()
	t.Cleanup(func() { srv.Shutdown(); srv.WaitForShutdown() })
	require.True(t, srv.ReadyForConnections(5*time.Second))

	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodPost {
			_, _ = io.WriteString(w, `{"data":{"token":"test-access-token"}}`)
			return
		}
		_, _ = io.WriteString(w, `{"apiVersion":"folder.grafana.app/v1","kind":"FolderList","metadata":{"resourceVersion":"1"},"items":[]}`)
	}))
	t.Cleanup(api.Close)
	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{Enabled: true, Mode: setting.NATSModeExternal, ClientURLs: []string{srv.ClientURL()}}
	cfg.SectionWithEnvOverrides("operator").Key("folders_server_url").SetValue(api.URL)
	cfg.SectionWithEnvOverrides("grpc_client_authentication").Key("token").SetValue("test-token")
	cfg.SectionWithEnvOverrides("grpc_client_authentication").Key("token_exchange_url").SetValue(api.URL)

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	health := server.NewHealthNotifier()
	done := make(chan error, 1)
	go func() {
		done <- RunFolderController(ctx, server.OperatorDependencies{
			Config: cfg, Registerer: prometheus.NewRegistry(), HealthNotifier: health,
		})
	}()
	require.NoError(t, wait.PollUntilContextTimeout(ctx, 10*time.Millisecond, 5*time.Second, true, func(context.Context) (bool, error) {
		select {
		case err := <-done:
			return false, fmt.Errorf("folder controller stopped before becoming ready (error: %v)", err)
		default:
		}
		stats, err := srv.Varz(nil)
		return health.IsReady() && err == nil && stats.TotalConnections == 1 && stats.Connections == 1 && stats.Subscriptions > 0, err
	}))
	cancel()
	select {
	case err := <-done:
		require.NoError(t, err)
		require.False(t, health.IsReady())
	case <-time.After(5 * time.Second):
		t.Fatal("folder controller did not stop")
	}
	require.Eventually(t, func() bool { return srv.NumClients() == 0 }, time.Second, time.Millisecond)
}

func TestFolderControllerCacheSyncFailureCause(t *testing.T) {
	srv := natstest.RunServer(&natsserver.Options{Host: "127.0.0.1", Port: -1})
	t.Cleanup(func() { srv.Shutdown(); srv.WaitForShutdown() })
	listing := make(chan struct{}, 1)
	release := make(chan struct{})
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodPost {
			_, _ = io.WriteString(w, `{"data":{"token":"test-access-token"}}`)
			return
		}
		select {
		case listing <- struct{}{}:
		default:
		}
		select {
		case <-r.Context().Done():
		case <-release:
		}
	}))
	t.Cleanup(api.Close)
	t.Cleanup(func() { close(release) })
	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{Enabled: true, Mode: setting.NATSModeExternal, ClientURLs: []string{srv.ClientURL()}}
	cfg.SectionWithEnvOverrides("operator").Key("folders_server_url").SetValue(api.URL)
	cfg.SectionWithEnvOverrides("grpc_client_authentication").Key("token").SetValue("test-token")
	cfg.SectionWithEnvOverrides("grpc_client_authentication").Key("token_exchange_url").SetValue(api.URL)
	health := server.NewHealthNotifier()
	failure := errors.New("subscriber failed during initial list")
	cancelOperator := make(chan context.CancelCauseFunc, 1)
	operator := services.NewBasicService(nil, func(ctx context.Context) error {
		ctx, cancel := context.WithCancelCause(ctx)
		defer cancel(nil)
		cancelOperator <- cancel
		return RunFolderController(ctx, server.OperatorDependencies{
			Config: cfg, Registerer: prometheus.NewRegistry(), HealthNotifier: health,
		})
	}, nil)
	owner := modules.New(log.NewNopLogger(), []string{"operator"}).WithDependencies(map[string][]string{})
	owner.RegisterModule("operator", func() (services.Service, error) { return operator, nil })
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = services.StopAndAwaitTerminated(ctx, owner)
	})
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	require.NoError(t, services.StartAndAwaitRunning(ctx, owner))
	select {
	case <-listing:
	case <-ctx.Done():
		t.Fatal("initial list did not start")
	}
	// Model the cancellation cause supplied by subscriber supervision.
	(<-cancelOperator)(failure)
	require.Error(t, owner.AwaitTerminated(ctx))
	require.Equal(t, services.Failed, owner.State())
	require.ErrorIs(t, owner.FailureCase(), failure)
	require.NotErrorIs(t, owner.FailureCase(), context.Canceled)
	require.False(t, health.IsReady())
}
