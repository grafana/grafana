package folder

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	natsserver "github.com/nats-io/nats-server/v2/server"
	natstest "github.com/nats-io/nats-server/v2/test"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/setting"
)

func TestFolderControllerOwnsNATSSubscriber(t *testing.T) {
	for _, tc := range []struct {
		name               string
		recovery, resource bool
	}{
		{name: "default off"},
		{name: "resource alone does not enable recovery", resource: true},
		{name: "recovery opt in", recovery: true, resource: true},
		{name: "recovery with unavailable resource", recovery: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			testFolderControllerOwnsNATSSubscriber(t, tc.recovery, tc.resource)
		})
	}
}

func testFolderControllerOwnsNATSSubscriber(t *testing.T, recovery, resource bool) {
	t.Helper()
	srv, err := natsserver.NewServer(&natsserver.Options{Host: "127.0.0.1", Port: natsserver.RANDOM_PORT, NoLog: true, NoSigs: true})
	require.NoError(t, err)
	go srv.Start()
	t.Cleanup(func() { srv.Shutdown(); srv.WaitForShutdown() })
	require.True(t, srv.ReadyForConnections(5*time.Second))

	pendingRequests := make(chan string, 1)
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/" {
			_, _ = io.WriteString(w, `{"data":{"token":"test-access-token"}}`)
			return
		}
		if strings.Contains(r.URL.Path, "pendingfolderdeletions") {
			pendingRequests <- r.Method + " " + r.URL.RequestURI()
			if !resource {
				w.WriteHeader(http.StatusNotFound)
				_, _ = io.WriteString(w, `{"apiVersion":"v1","kind":"Status","status":"Failure","reason":"NotFound","code":404}`)
				return
			}
			_, _ = io.WriteString(w, `{"apiVersion":"folder.grafana.app/v1alpha1","kind":"PendingFolderDeletionList","items":[]}`)
			return
		}
		_, _ = io.WriteString(w, `{"apiVersion":"storage.grafana.app/v0alpha1","kind":"ListKeyResponse","resourceVersion":"1","items":[]}`)
	}))
	t.Cleanup(api.Close)
	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{Enabled: true, Mode: setting.NATSModeExternal, ClientURLs: []string{srv.ClientURL()}}
	cfg.SectionWithEnvOverrides("operator").Key("folders_server_url").SetValue(api.URL)
	cfg.SectionWithEnvOverrides("operator").Key("dashboards_server_url").SetValue(api.URL)
	cfg.SectionWithEnvOverrides("grpc_client_authentication").Key("token").SetValue("test-token")
	cfg.SectionWithEnvOverrides("grpc_client_authentication").Key("token_exchange_url").SetValue(api.URL)
	// Dialing is lazy, so nothing needs to listen here.
	cfg.SectionWithEnvOverrides("unified_storage").Key("grpc_address").SetValue("127.0.0.1:1")

	cfg.PendingDeletionResourceEnabled = resource
	if recovery {
		cfg.SectionWithEnvOverrides("operator").Key("pending_deletion_recovery").SetValue("true")
	}
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	health := server.NewHealthNotifier()
	done := make(chan error, 1)
	go func() {
		done <- RunFolderController(ctx, server.OperatorDependencies{
			Config: cfg, Registerer: prometheus.NewRegistry(), HealthNotifier: health, Tracer: tracing.NewNoopTracerService(),
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
	if recovery {
		select {
		case request := <-pendingRequests:
			require.Equal(t, "GET /apis/folder.grafana.app/v1alpha1/pendingfolderdeletions?limit=100", request)
		case <-time.After(5 * time.Second):
			t.Fatal("startup recovery did not scan pending entries")
		}
	}
	cancel()
	select {
	case err := <-done:
		require.NoError(t, err)
		require.False(t, health.IsReady())
	case <-time.After(5 * time.Second):
		t.Fatal("folder controller did not stop")
	}
	require.Eventually(t, func() bool { return srv.NumClients() == 0 }, time.Second, time.Millisecond)
	require.Empty(t, pendingRequests, "disabled recovery must not scan; enabled recovery must not repeat before its period")
}

func TestFolderControllerCacheSyncFailureCause(t *testing.T) {
	srv := natstest.RunServer(&natsserver.Options{Host: "127.0.0.1", Port: -1})
	t.Cleanup(func() { srv.Shutdown(); srv.WaitForShutdown() })
	listing := make(chan struct{}, 1)
	release := make(chan struct{})
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/" {
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
	cfg.SectionWithEnvOverrides("operator").Key("dashboards_server_url").SetValue(api.URL)
	cfg.SectionWithEnvOverrides("grpc_client_authentication").Key("token").SetValue("test-token")
	cfg.SectionWithEnvOverrides("grpc_client_authentication").Key("token_exchange_url").SetValue(api.URL)
	// Dialing is lazy, so nothing needs to listen here.
	cfg.SectionWithEnvOverrides("unified_storage").Key("grpc_address").SetValue("127.0.0.1:1")
	health := server.NewHealthNotifier()
	failure := errors.New("subscriber failed during initial list")
	cancelOperator := make(chan context.CancelCauseFunc, 1)
	operator := services.NewBasicService(nil, func(ctx context.Context) error {
		ctx, cancel := context.WithCancelCause(ctx)
		defer cancel(nil)
		cancelOperator <- cancel
		return RunFolderController(ctx, server.OperatorDependencies{
			Config: cfg, Registerer: prometheus.NewRegistry(), HealthNotifier: health, Tracer: tracing.NewNoopTracerService(),
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
