package folder

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/operators/runner"
	"github.com/grafana/grafana/pkg/setting"
)

func TestBuildRESTClientRequiresServerURL(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.SectionWithEnvOverrides("operator").Key("folders_server_url").SetValue("https://localhost:6443")

	_, err := buildRESTClient(runner.NewClients(cfg), "dashboards_server_url", "dashboard.grafana.app")
	require.ErrorContains(t, err, "dashboards_server_url is required")
}

func TestBuildSearchClientSharesOneRegistry(t *testing.T) {
	cfg := setting.NewCfg()
	sec := cfg.SectionWithEnvOverrides("unified_storage")
	sec.Key("grpc_address").SetValue("127.0.0.1:1")
	sec.Key("grpc_index_address").SetValue("127.0.0.1:2")
	sec.Key("allow_insecure").SetValue("true")
	auth := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	auth.Key("token").SetValue("test-token")
	auth.Key("token_exchange_url").SetValue("http://127.0.0.1:3/exchange")

	// Both connections register the same client metrics, so they only fit on one registry when told
	// apart by a label; registering them twice under one set of labels would panic.
	require.NotPanics(t, func() {
		client, closeConns, err := buildSearchClient(cfg, noop.NewTracerProvider().Tracer("test"), prometheus.NewRegistry())
		require.NoError(t, err)
		require.NotNil(t, client)
		closeConns()
	})
}
