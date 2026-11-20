package provisioning

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/remote/client"
)

func TestRemoteLimitsProviderTimeout(t *testing.T) {
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-release:
		case <-r.Context().Done():
		}
	}))
	t.Cleanup(server.Close)
	t.Cleanup(func() { close(release) })

	u, err := url.Parse(server.URL)
	require.NoError(t, err)
	mimir, err := client.New(&client.Config{URL: u, Logger: log.NewNopLogger(), Timeout: time.Minute},
		metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry()), tracing.InitializeTracerForTest())
	require.NoError(t, err)

	require.Equal(t, 5*time.Second, NewRemoteLimitsProvider(mimir).timeout)

	p := NewRemoteLimitsProvider(mimir)
	p.timeout = 50 * time.Millisecond

	start := time.Now()
	_, err = p.GetLimits(context.Background())
	require.Error(t, err)
	require.Less(t, time.Since(start), 10*time.Second)
}
