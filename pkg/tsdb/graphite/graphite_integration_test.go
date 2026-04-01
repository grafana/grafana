package graphite

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/util/testutil"
)

// Integration tests for the Graphite backend datasource.
//
// These tests run against a real Graphite server (or compatible implementation such as
// carbonapi) and are designed to catch compatibility regressions that mock-HTTP tests
// cannot surface — encoding quirks, response format differences, and strictness around
// query formatting that varies between Graphite versions.
//
// Usage:
//
//	# Start a Graphite server (e.g. via devenv)
//	make devenv sources=graphite
//
//	# Run these tests
//	GRAPHITE_URL=http://localhost:8180 go test -run '^TestIntegrationGraphite' ./pkg/tsdb/graphite/...
//
// Tests are skipped when GRAPHITE_URL is not set.

func graphiteURL(t *testing.T) string {
	t.Helper()
	u, ok := os.LookupEnv("GRAPHITE_URL")
	if !ok || u == "" {
		t.Skip("GRAPHITE_URL not set — skipping Graphite integration tests")
	}
	return u
}

func newIntegrationService(t *testing.T) (*Service, *datasourceInfo) {
	t.Helper()
	url := graphiteURL(t)
	svc := ProvideService(httpclient.NewProvider(), noop.NewTracerProvider().Tracer("graphite-integration"))
	dsInfo := &datasourceInfo{
		Id:         1,
		URL:        url,
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	}
	return svc, dsInfo
}

// TestIntegrationGraphiteHealthCheck verifies the Graphite server is reachable and
// responds to a basic query (the same check the health check handler uses).
func TestIntegrationGraphiteHealthCheck(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	svc, dsInfo := newIntegrationService(t)

	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
				ID:  1,
				URL: dsInfo.URL,
			},
			OrgID: 1,
		},
		Queries: []backend.DataQuery{
			{
				RefID: "A",
				TimeRange: backend.TimeRange{
					From: time.Now().Add(-5 * time.Minute),
					To:   time.Now(),
				},
				MaxDataPoints: 100,
				JSON:          []byte(`{"target": "constantLine(100)"}`),
			},
		},
	}

	result, err := svc.RunQuery(context.Background(), req, dsInfo)
	require.NoError(t, err)
	require.NotNil(t, result)
	resp, ok := result.Responses["A"]
	require.True(t, ok)
	assert.NoError(t, resp.Error)
	assert.NotEmpty(t, resp.Frames)
}

// TestIntegrationGraphiteQuery verifies that a basic metric query returns valid data frames
// with DisplayNameFromDS set to the metric name returned by Graphite (not the refId).
//
// This is a regression guard for issue #20454, where a naming convention change caused
// DisplayNameFromDS to be set to the refId (#A) instead of the actual metric name.
func TestIntegrationGraphiteQuery(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	svc, dsInfo := newIntegrationService(t)

	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
				ID:  1,
				URL: dsInfo.URL,
			},
			OrgID: 1,
		},
		Queries: []backend.DataQuery{
			{
				RefID: "A",
				TimeRange: backend.TimeRange{
					From: time.Now().Add(-5 * time.Minute),
					To:   time.Now(),
				},
				MaxDataPoints: 100,
				JSON:          []byte(`{"target": "constantLine(42)"}`),
			},
		},
	}

	result, err := svc.RunQuery(context.Background(), req, dsInfo)
	require.NoError(t, err)
	require.NotNil(t, result)

	resp, ok := result.Responses["A"]
	require.True(t, ok)
	require.NoError(t, resp.Error)
	require.NotEmpty(t, resp.Frames)

	frame := resp.Frames[0]
	// Frame Name must be empty — it must NOT be the refId or the metric path.
	assert.Equal(t, "", frame.Name, "frame Name should be empty, not the refId or metric path")

	// DisplayNameFromDS must be the metric name returned by Graphite, not the refId.
	require.Len(t, frame.Fields, 2)
	valueField := frame.Fields[1]
	require.NotNil(t, valueField.Config)
	assert.NotEmpty(t, valueField.Config.DisplayNameFromDS, "DisplayNameFromDS should be set to the Graphite series name")
	assert.NotEqual(t, "A", valueField.Config.DisplayNameFromDS, "DisplayNameFromDS must not be the refId")
}

// TestIntegrationGraphiteQueryTargetTrimming verifies that query targets with trailing
// whitespace or newlines are trimmed before being sent to Graphite.
//
// This is a regression test for issue #17952, where trailing newlines in query targets
// caused HTTP 400 errors from Booking's carbonapi (stricter than graphite-web).
// The backend/alert query path does not wrap targets in aliasSub() as the frontend does,
// so without trimming the raw whitespace reaches carbonapi verbatim.
func TestIntegrationGraphiteQueryTargetTrimming(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	svc, dsInfo := newIntegrationService(t)

	tests := []struct {
		name      string
		queryJSON string
	}{
		{
			name:      "trailing newline",
			queryJSON: "{\"target\": \"constantLine(1)\\n\"}",
		},
		{
			name:      "leading and trailing whitespace",
			queryJSON: `{"target": "  constantLine(1)  "}`,
		},
		{
			name:      "targetFull with trailing newline",
			queryJSON: "{\"target\": \"constantLine(1)\", \"targetFull\": \"constantLine(1)\\n\"}",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &backend.QueryDataRequest{
				PluginContext: backend.PluginContext{
					DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
						ID:  1,
						URL: dsInfo.URL,
					},
					OrgID: 1,
				},
				Queries: []backend.DataQuery{
					{
						RefID: "A",
						TimeRange: backend.TimeRange{
							From: time.Now().Add(-5 * time.Minute),
							To:   time.Now(),
						},
						MaxDataPoints: 100,
						JSON:          []byte(tt.queryJSON),
					},
				},
			}
			result, err := svc.RunQuery(context.Background(), req, dsInfo)
			require.NoError(t, err)
			resp, ok := result.Responses["A"]
			require.True(t, ok)
			assert.NoError(t, resp.Error, "query with %s should not produce an error — check target trimming", tt.name)
		})
	}
}

// TestIntegrationGraphiteMetricsFind verifies that the /metrics/find resource endpoint
// returns a valid response from the live Graphite server.
func TestIntegrationGraphiteMetricsFind(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	url := graphiteURL(t)

	svc := ProvideService(httpclient.NewProvider(), noop.NewTracerProvider().Tracer("graphite-integration"))
	dsInfo := &datasourceInfo{
		Id:         1,
		URL:        url,
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	}

	// Use a wildcard that should match at least the built-in carbon.* metrics
	// available in graphite-statsd containers.
	req, err := svc.createRequest(context.Background(), dsInfo, URLParams{
		SubPath:     "metrics/find",
		Method:      http.MethodPost,
		Body:        nil,
		Headers:     map[string]string{"Content-Type": "application/x-www-form-urlencoded"},
		QueryParams: map[string][]string{"query": {"*"}},
	})
	require.NoError(t, err)

	resp, err := dsInfo.HTTPClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode,
		fmt.Sprintf("GET /metrics/find?query=* should return 200 from %s", url))
}
