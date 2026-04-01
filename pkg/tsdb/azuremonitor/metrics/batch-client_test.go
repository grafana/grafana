package metrics

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func makeBatch(region, subscription, namespace, metricNames, interval, aggregation, dimFilter string, from, to time.Time, resourceIDs []string, queries []*types.AzureMonitorQuery) Batch {
	return Batch{
		Key: batchGroupKey{
			Region:       region,
			Subscription: subscription,
			Namespace:    namespace,
			MetricNames:  metricNames,
			Interval:     interval,
			Aggregation:  aggregation,
			DimFilter:    dimFilter,
			From:         from.UTC().Format(time.RFC3339),
			To:           to.UTC().Format(time.RFC3339),
		},
		ResourceIDs: resourceIDs,
		Queries:     queries,
	}
}

func TestGetRegionalEndpoint(t *testing.T) {
	tests := []struct {
		region   string
		expected string
	}{
		{"westus2", "westus2.metrics.monitor.azure.com"},
		{"eastus", "eastus.metrics.monitor.azure.com"},
		{"WestUS2", "westus2.metrics.monitor.azure.com"}, // lowercased
		{"", "global.metrics.monitor.azure.com"},
	}
	for _, tc := range tests {
		assert.Equal(t, tc.expected, getRegionalEndpoint(tc.region), "region=%q", tc.region)
	}
}

func TestBuildBatchURL(t *testing.T) {
	from := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2024, 1, 1, 1, 0, 0, 0, time.UTC)

	t.Run("produces correct base URL", func(t *testing.T) {
		batch := makeBatch("westus2", "sub-123", "Microsoft.Compute/virtualMachines", "Percentage CPU",
			"PT1M", "Average", "", from, to, nil, nil)
		u := buildBatchURL(batch)
		assert.Contains(t, u, "https://westus2.metrics.monitor.azure.com/subscriptions/sub-123/metrics:getBatch")
	})

	t.Run("includes required query parameters", func(t *testing.T) {
		batch := makeBatch("westus2", "sub-123", "Microsoft.Compute/virtualMachines", "Percentage CPU",
			"PT1M", "Average", "", from, to, nil, nil)
		parsed, err := url.Parse(buildBatchURL(batch))
		require.NoError(t, err)
		q := parsed.Query()
		assert.Equal(t, batchAPIVersion, q.Get("api-version"))
		assert.Equal(t, "Microsoft.Compute/virtualMachines", q.Get("metricnamespace"))
		assert.Equal(t, "Percentage CPU", q.Get("metricnames"))
		assert.Equal(t, "2024-01-01T00:00:00Z", q.Get("starttime"))
		assert.Equal(t, "2024-01-01T01:00:00Z", q.Get("endtime"))
		assert.Equal(t, "PT1M", q.Get("interval"))
		assert.Equal(t, "Average", q.Get("aggregation"))
	})

	t.Run("omits interval and aggregation when empty", func(t *testing.T) {
		batch := makeBatch("westus2", "sub-123", "Microsoft.Compute/virtualMachines", "Percentage CPU",
			"", "", "", from, to, nil, nil)
		parsed, err := url.Parse(buildBatchURL(batch))
		require.NoError(t, err)
		q := parsed.Query()
		assert.Empty(t, q.Get("interval"))
		assert.Empty(t, q.Get("aggregation"))
	})

	t.Run("omits filter when no dimension filter is set", func(t *testing.T) {
		batch := makeBatch("westus2", "sub-123", "Microsoft.Compute/virtualMachines", "Percentage CPU",
			"PT1M", "Average", "", from, to, nil, nil)
		parsed, err := url.Parse(buildBatchURL(batch))
		require.NoError(t, err)
		assert.Empty(t, parsed.Query().Get("filter"))
	})

	t.Run("forwards dimension filter, stripping $ prefix", func(t *testing.T) {
		batch := makeBatch("westus2", "sub-123", "Microsoft.Compute/virtualMachines", "Percentage CPU",
			"PT1M", "Average", "$VMName eq 'vm1'", from, to, nil, nil)
		parsed, err := url.Parse(buildBatchURL(batch))
		require.NoError(t, err)
		assert.Equal(t, "VMName eq 'vm1'", parsed.Query().Get("filter"))
	})

	t.Run("forwards dimension filter without $ prefix unchanged", func(t *testing.T) {
		batch := makeBatch("westus2", "sub-123", "Microsoft.Compute/virtualMachines", "Percentage CPU",
			"PT1M", "Average", "VMName eq 'vm1'", from, to, nil, nil)
		parsed, err := url.Parse(buildBatchURL(batch))
		require.NoError(t, err)
		assert.Equal(t, "VMName eq 'vm1'", parsed.Query().Get("filter"))
	})

	t.Run("forwards top from group key when set", func(t *testing.T) {
		batch := makeBatch("westus2", "sub-123", "Microsoft.Compute/virtualMachines", "Percentage CPU",
			"PT1M", "Average", "", from, to, nil, nil)
		batch.Key.Top = "10"
		parsed, err := url.Parse(buildBatchURL(batch))
		require.NoError(t, err)
		assert.Equal(t, "10", parsed.Query().Get("top"))
	})

	t.Run("uses global endpoint for empty region", func(t *testing.T) {
		batch := makeBatch("", "sub-123", "Microsoft.Compute/virtualMachines", "Percentage CPU",
			"PT1M", "Average", "", from, to, nil, nil)
		assert.Contains(t, buildBatchURL(batch), "global.metrics.monitor.azure.com")
	})
}

func TestBuildBatchRequest(t *testing.T) {
	from := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2024, 1, 1, 1, 0, 0, 0, time.UTC)
	ids := []string{"/sub/rg/vm1", "/sub/rg/vm2"}

	t.Run("creates POST request", func(t *testing.T) {
		batch := makeBatch("westus2", "sub-123", "Microsoft.Compute/virtualMachines", "Percentage CPU",
			"PT1M", "Average", "", from, to, ids, nil)
		req, err := buildBatchRequest(context.Background(), batch)
		require.NoError(t, err)
		assert.Equal(t, "POST", req.Method)
	})

	t.Run("sets Content-Type header", func(t *testing.T) {
		batch := makeBatch("westus2", "sub-123", "Microsoft.Compute/virtualMachines", "Percentage CPU",
			"PT1M", "Average", "", from, to, ids, nil)
		req, err := buildBatchRequest(context.Background(), batch)
		require.NoError(t, err)
		assert.Equal(t, "application/json", req.Header.Get("Content-Type"))
	})

	t.Run("body contains resource IDs", func(t *testing.T) {
		batch := makeBatch("westus2", "sub-123", "Microsoft.Compute/virtualMachines", "Percentage CPU",
			"PT1M", "Average", "", from, to, ids, nil)
		req, err := buildBatchRequest(context.Background(), batch)
		require.NoError(t, err)

		bodyBytes, err := io.ReadAll(req.Body)
		require.NoError(t, err)

		var body batchRequestBody
		require.NoError(t, json.Unmarshal(bodyBytes, &body))
		assert.Equal(t, ids, body.ResourceIDs)
	})

	t.Run("body uses resourceids JSON key", func(t *testing.T) {
		batch := makeBatch("westus2", "sub-123", "Microsoft.Compute/virtualMachines", "Percentage CPU",
			"PT1M", "Average", "", from, to, ids, nil)
		req, err := buildBatchRequest(context.Background(), batch)
		require.NoError(t, err)

		bodyBytes, err := io.ReadAll(req.Body)
		require.NoError(t, err)

		var raw map[string]any
		require.NoError(t, json.Unmarshal(bodyBytes, &raw))
		assert.Contains(t, raw, "resourceids")
		assert.NotContains(t, raw, "resourceIds") // exact casing matters for Azure API
	})

	t.Run("URL matches buildBatchURL output", func(t *testing.T) {
		batch := makeBatch("westus2", "sub-123", "Microsoft.Compute/virtualMachines", "Percentage CPU",
			"PT1M", "Average", "", from, to, ids, nil)
		req, err := buildBatchRequest(context.Background(), batch)
		require.NoError(t, err)
		assert.Equal(t, buildBatchURL(batch), req.URL.String())
	})
}

// minimalBatchResponse returns a valid batch response JSON for a single resource.
func minimalBatchResponse(resourceID string) []byte {
	resp := batchResponse{
		Values: []batchResponseValue{
			{
				ResourceID:     resourceID,
				StartTime:      "2024-01-01T00:00:00Z",
				EndTime:        "2024-01-01T01:00:00Z",
				Interval:       "PT1M",
				Namespace:      "microsoft.compute/virtualmachines",
				ResourceRegion: "westus2",
				Value: []batchMetric{
					{
						AzureMetricValue: types.AzureMetricValue{
							Name: types.AzureMetricName{Value: "Percentage CPU", LocalizedValue: "Percentage CPU"},
							Unit: "Percent",
						},
						ErrorCode: "Success",
					},
				},
			},
		},
	}
	b, _ := json.Marshal(resp)
	return b
}

// roundTripFunc is a http.RoundTripper that redirects requests to a test server.
type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }

// redirectToServer returns an *http.Client whose requests are transparently
// forwarded to srv regardless of the original URL's host.
func redirectToServer(srv *httptest.Server) *http.Client {
	cli := srv.Client()
	cli.Transport = roundTripFunc(func(req *http.Request) (*http.Response, error) {
		req.URL.Host = srv.Listener.Addr().String()
		req.URL.Scheme = "http"
		return http.DefaultTransport.RoundTrip(req)
	})
	return cli
}

func TestExecuteBatchRequest(t *testing.T) {
	from := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2024, 1, 1, 1, 0, 0, 0, time.UTC)

	t.Run("returns parsed response on success", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write(minimalBatchResponse("/sub/rg/vm1"))
		}))
		defer srv.Close()

		batch := makeBatch("westus2", "sub-123", "Microsoft.Compute/virtualMachines", "Percentage CPU",
			"PT1M", "Average", "", from, to, []string{"/sub/rg/vm1"}, nil)

		resp, err := executeBatchRequest(context.Background(), batch, redirectToServer(srv))
		require.NoError(t, err)
		require.Len(t, resp.Values, 1)
		assert.Equal(t, "/sub/rg/vm1", resp.Values[0].ResourceID)
		assert.Equal(t, "PT1M", resp.Values[0].Interval)
	})

	t.Run("returns error on non-2xx status", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
		}))
		defer srv.Close()

		batch := makeBatch("westus2", "sub-123", "Microsoft.Compute/virtualMachines", "Percentage CPU",
			"PT1M", "Average", "", from, to, []string{"/sub/rg/vm1"}, nil)

		_, err := executeBatchRequest(context.Background(), batch, redirectToServer(srv))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "403")
	})

	t.Run("returns error on invalid JSON response", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte("not json"))
		}))
		defer srv.Close()

		batch := makeBatch("westus2", "sub-123", "Microsoft.Compute/virtualMachines", "Percentage CPU",
			"PT1M", "Average", "", from, to, []string{"/sub/rg/vm1"}, nil)

		_, err := executeBatchRequest(context.Background(), batch, redirectToServer(srv))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to unmarshal")
	})
}

func TestExecuteBatchRequests(t *testing.T) {
	from := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2024, 1, 1, 1, 0, 0, 0, time.UTC)

	t.Run("executes all batches and preserves order", func(t *testing.T) {
		var requestCount atomic.Int32
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requestCount.Add(1)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write(minimalBatchResponse("/sub/rg/vm1"))
		}))
		defer srv.Close()

		batches := []Batch{
			makeBatch("westus2", "sub-1", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", "", from, to, []string{"/sub/rg/vm1"}, nil),
			makeBatch("eastus", "sub-2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", "", from, to, []string{"/sub/rg/vm2"}, nil),
			makeBatch("westus2", "sub-3", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", "", from, to, []string{"/sub/rg/vm3"}, nil),
		}

		results := executeBatchRequests(context.Background(), batches, redirectToServer(srv))

		assert.Equal(t, int32(3), requestCount.Load())
		require.Len(t, results, 3)
		for i, res := range results {
			assert.Equal(t, batches[i].Key, res.Batch.Key, "result order must match input order")
			assert.NoError(t, res.Err)
		}
	})

	t.Run("records error per batch without stopping others", func(t *testing.T) {
		var callCount atomic.Int32
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			n := callCount.Add(1)
			if n == 2 {
				http.Error(w, "server error", http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write(minimalBatchResponse("/sub/rg/vm1"))
		}))
		defer srv.Close()

		batches := []Batch{
			makeBatch("westus2", "sub-1", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", "", from, to, nil, nil),
			makeBatch("eastus", "sub-2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", "", from, to, nil, nil),
			makeBatch("westus2", "sub-3", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", "", from, to, nil, nil),
		}

		results := executeBatchRequests(context.Background(), batches, redirectToServer(srv))

		require.Len(t, results, 3)
		var errCount int
		for _, res := range results {
			if res.Err != nil {
				errCount++
			}
		}
		assert.Equal(t, 1, errCount, "exactly one batch should have failed")
	})

	t.Run("empty input returns empty results", func(t *testing.T) {
		results := executeBatchRequests(context.Background(), nil, http.DefaultClient)
		assert.Empty(t, results)
	})
}
