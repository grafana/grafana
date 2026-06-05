package client

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
)

func TestTestReceivers_RateLimitedReturns429(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte("too many test notification requests\n"))
	}))
	defer server.Close()

	serverURL, err := url.Parse(server.URL)
	require.NoError(t, err)

	cfg := &Config{
		URL:    serverURL,
		Logger: log.NewNopLogger(),
	}
	mc, err := New(cfg, metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry()), tracing.InitializeTracerForTest())
	require.NoError(t, err)

	_, _, err = mc.TestReceivers(context.Background(), alertingNotify.TestReceiversConfigBodyParams{})
	require.Error(t, err)

	var gErr errutil.Error
	require.True(t, errors.As(err, &gErr), "expected errutil.Error, got %T: %v", err, err)
	require.Equal(t, http.StatusTooManyRequests, gErr.Public().StatusCode)
}
