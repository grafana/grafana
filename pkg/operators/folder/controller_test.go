package folder

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

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
	require.Eventually(t, func() bool {
		select {
		case err := <-done:
			require.NoError(t, err)
			t.Fatal("folder controller stopped before becoming ready")
		default:
		}
		stats, err := srv.Varz(nil)
		return health.IsReady() && err == nil && stats.TotalConnections == 1 && stats.Connections == 1 && stats.Subscriptions > 0
	}, 5*time.Second, 10*time.Millisecond)
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
