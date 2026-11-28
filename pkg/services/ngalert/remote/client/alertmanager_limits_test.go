package client

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
)

func TestGetLimits(t *testing.T) {
	tests := []struct {
		name           string
		body           string
		expectedConfig *ConfigLimits
	}{
		{
			name:           "returns config limits when present",
			body:           `{"status":"success","data":{"silences":{"max_silences_count":10},"templates":{"max_templates_count":5},"config":{"max_grafana_config_size_bytes":2097152}}}`,
			expectedConfig: &ConfigLimits{MaxGrafanaConfigSizeBytes: 2097152},
		},
		{
			// Alertmanager versions that predate the config category omit it entirely.
			name:           "leaves config limits nil when the alertmanager does not return them",
			body:           `{"status":"success","data":{"silences":{"max_silences_count":10},"templates":{"max_templates_count":5}}}`,
			expectedConfig: nil,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				require.Equal(t, alertmanagerLimitsPath, r.URL.Path)
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(tc.body))
			}))
			defer server.Close()

			serverURL, err := url.Parse(server.URL)
			require.NoError(t, err)

			mc, err := New(&Config{URL: serverURL, Logger: log.NewNopLogger()}, metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry()), tracing.InitializeTracerForTest())
			require.NoError(t, err)

			limits, err := mc.GetLimits(context.Background())
			require.NoError(t, err)
			require.NotNil(t, limits.Silences)
			require.NotNil(t, limits.Templates)
			require.Equal(t, tc.expectedConfig, limits.Config)
		})
	}
}
