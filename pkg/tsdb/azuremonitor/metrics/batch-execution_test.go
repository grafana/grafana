package metrics

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/config"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// redirectTransport rewrites every request's host+scheme to the target server,
// allowing tests to intercept hardcoded batch API URLs.
type redirectTransport struct {
	target *url.URL
}

func (t *redirectTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req = req.Clone(req.Context())
	req.URL.Scheme = t.target.Scheme
	req.URL.Host = t.target.Host
	return http.DefaultTransport.RoundTrip(req)
}

// batchCtx returns a context with both the azureMonitorBatchAPI feature toggle
// and the azureMonitorEnableUserAuth toggle set so that the batch dispatch path
// in ExecuteTimeSeriesQuery is active.
func batchCtx() context.Context {
	cfg := config.NewGrafanaCfg(map[string]string{
		featuretoggles.EnabledFeatures: "azureMonitorBatchAPI",
	})
	return config.WithGrafanaConfig(context.Background(), cfg)
}

// makeBatchDsInfo builds a minimal DatasourceInfo with batch mode enabled and
// a mock HTTP client that redirects all requests to srv.
func makeBatchDsInfo(srv *httptest.Server) types.DatasourceInfo {
	cli := &http.Client{Transport: &redirectTransport{target: mustParseURL(srv.URL)}}
	return types.DatasourceInfo{
		Settings: types.AzureMonitorSettings{
			BatchAPIEnabled: true,
			SubscriptionId:  "sub-123",
		},
		Routes: map[string]types.AzRoute{
			"Azure Monitor":               {URL: srv.URL},
			"Azure Portal":                {URL: "https://portal.azure.com"},
			"Azure Monitor Batch Metrics": {URL: srv.URL},
		},
		Services: map[string]types.DatasourceService{
			"Azure Monitor Batch Metrics": {
				URL:        srv.URL,
				HTTPClient: cli,
			},
		},
	}
}

func mustParseURL(raw string) *url.URL {
	u, err := url.Parse(raw)
	if err != nil {
		panic(err)
	}
	return u
}

// makeBatchQuery builds a backend.DataQuery for a batchable (standard namespace) metric.
func makeBatchQuery(refID, sub, region string, resources []dataquery.AzureMonitorResource) backend.DataQuery {
	model := dataquery.AzureMonitorQuery{
		Subscription: &sub,
		AzureMonitor: &dataquery.AzureMetricQuery{
			MetricNamespace: strPtr("Microsoft.Compute/virtualMachines"),
			MetricName:      strPtr("Percentage CPU"),
			Aggregation:     strPtr("Average"),
			TimeGrain:       strPtr("PT1M"),
			Region:          &region,
			Resources:       resources,
		},
	}
	raw, _ := json.Marshal(model)
	return backend.DataQuery{
		RefID:     refID,
		QueryType: "Azure Monitor",
		JSON:      raw,
		TimeRange: backend.TimeRange{
			From: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2024, 1, 1, 1, 0, 0, 0, time.UTC),
		},
	}
}

// batchSuccessResponse returns a valid batch API JSON response for the given
// resource IDs, all reporting Percentage CPU = avg.
func batchSuccessResponse(resourceIDs []string, avg float64) []byte {
	type tsData struct {
		TimeStamp time.Time `json:"timeStamp"`
		Average   *float64  `json:"average"`
	}
	type tseries struct {
		Data []tsData `json:"data"`
	}
	type metricName struct {
		Value          string `json:"value"`
		LocalizedValue string `json:"localizedValue"`
	}
	type metric struct {
		Name       metricName `json:"name"`
		Unit       string     `json:"unit"`
		Timeseries []tseries  `json:"timeseries"`
		ErrorCode  string     `json:"errorCode"`
	}
	type value struct {
		ResourceID string   `json:"resourceid"`
		Namespace  string   `json:"namespace"`
		Value      []metric `json:"value"`
	}
	type response struct {
		Values []value `json:"values"`
	}

	ts := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	values := make([]value, 0, len(resourceIDs))
	for _, id := range resourceIDs {
		values = append(values, value{
			ResourceID: id,
			Namespace:  "microsoft.compute/virtualmachines",
			Value: []metric{{
				Name:      metricName{Value: "Percentage CPU", LocalizedValue: "Percentage CPU"},
				Unit:      "Percent",
				ErrorCode: "Success",
				Timeseries: []tseries{{
					Data: []tsData{{TimeStamp: ts, Average: &avg}},
				}},
			}},
		})
	}
	b, _ := json.Marshal(response{Values: values})
	return b
}

func TestExecuteBatchTimeSeriesQuery(t *testing.T) {
	ds := &AzureMonitorDatasource{Logger: log.DefaultLogger}

	resourceID := "/subscriptions/sub-123/resourcegroups/rg/providers/microsoft.compute/virtualmachines/vm1"

	t.Run("all-success: returns one frame per resource", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write(batchSuccessResponse([]string{resourceID}, 42.0))
		}))
		defer srv.Close()

		dsInfo := makeBatchDsInfo(srv)
		q := makeBatchQuery("A", "sub-123", "eastus", []dataquery.AzureMonitorResource{
			{Subscription: strPtr("sub-123"), ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm1"), Region: strPtr("eastus")},
		})

		resp, err := ds.ExecuteTimeSeriesQuery(batchCtx(), []backend.DataQuery{q}, dsInfo, &http.Client{}, "", false)
		require.NoError(t, err)
		require.Len(t, resp.Responses["A"].Frames, 1)
		assert.NoError(t, resp.Responses["A"].Error)
	})

	t.Run("batch HTTP failure: error set on all queries in batch", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, `{"error":{"code":"Unauthorized"}}`, http.StatusUnauthorized)
		}))
		defer srv.Close()

		dsInfo := makeBatchDsInfo(srv)
		q := makeBatchQuery("A", "sub-123", "eastus", []dataquery.AzureMonitorResource{
			{Subscription: strPtr("sub-123"), ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm1"), Region: strPtr("eastus")},
		})

		resp, err := ds.ExecuteTimeSeriesQuery(batchCtx(), []backend.DataQuery{q}, dsInfo, &http.Client{}, "", false)
		require.NoError(t, err)
		assert.Error(t, resp.Responses["A"].Error)
	})

	t.Run("mixed batchable and non-batchable queries both return frames", func(t *testing.T) {
		// The non-batchable query (custom namespace) hits the ARM endpoint, which
		// is also the mock server here. Serve a standard ARM metrics response.
		armResponse := loadTestFile(t, "azuremonitor/1-azure-monitor-response-avg.json")

		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			// Batch requests go to /subscriptions/.../metrics:getBatch
			if r.URL.Path == "/subscriptions/sub-123/metrics:getBatch" {
				_, _ = w.Write(batchSuccessResponse([]string{resourceID}, 10.0))
				return
			}
			// Non-batchable ARM requests go to the resource metrics path
			b, _ := json.Marshal(armResponse)
			_, _ = w.Write(b)
		}))
		defer srv.Close()

		dsInfo := makeBatchDsInfo(srv)

		// Batchable query
		batchQ := makeBatchQuery("A", "sub-123", "eastus", []dataquery.AzureMonitorResource{
			{Subscription: strPtr("sub-123"), ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm1"), Region: strPtr("eastus")},
		})

		// Non-batchable: custom namespace
		customNS := strPtr("MyApp/customMetrics")
		nonBatchModel := dataquery.AzureMonitorQuery{
			Subscription: strPtr("sub-123"),
			AzureMonitor: &dataquery.AzureMetricQuery{
				MetricNamespace: strPtr("Microsoft.Compute/virtualMachines"),
				CustomNamespace: customNS,
				MetricName:      strPtr("requests"),
				Aggregation:     strPtr("Average"),
				TimeGrain:       strPtr("PT1M"),
				Region:          strPtr("eastus"),
				Resources: []dataquery.AzureMonitorResource{
					{Subscription: strPtr("sub-123"), ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm1"), Region: strPtr("eastus")},
				},
			},
		}
		raw, _ := json.Marshal(nonBatchModel)
		nonBatchQ := backend.DataQuery{
			RefID:     "B",
			QueryType: "Azure Monitor",
			JSON:      raw,
			TimeRange: backend.TimeRange{
				From: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
				To:   time.Date(2024, 1, 1, 1, 0, 0, 0, time.UTC),
			},
		}

		resp, err := ds.ExecuteTimeSeriesQuery(batchCtx(), []backend.DataQuery{batchQ, nonBatchQ}, dsInfo, dsInfo.Services["Azure Monitor Batch Metrics"].HTTPClient, srv.URL, false)
		require.NoError(t, err)
		assert.Contains(t, resp.Responses, "A", "batchable query should have a response")
		assert.Contains(t, resp.Responses, "B", "non-batchable query should have a response")
	})

	t.Run("batch disabled: falls through to legacy ARM path", func(t *testing.T) {
		armResponse := loadTestFile(t, "azuremonitor/1-azure-monitor-response-avg.json")
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			b, _ := json.Marshal(armResponse)
			_, _ = w.Write(b)
		}))
		defer srv.Close()

		// BatchAPIEnabled = false
		dsInfo := types.DatasourceInfo{
			Settings: types.AzureMonitorSettings{SubscriptionId: "sub-123"},
			Routes: map[string]types.AzRoute{
				"Azure Monitor": {URL: srv.URL},
				"Azure Portal":  {URL: "https://portal.azure.com"},
			},
			Services: map[string]types.DatasourceService{},
		}

		q := makeBatchQuery("A", "sub-123", "eastus", []dataquery.AzureMonitorResource{
			{Subscription: strPtr("sub-123"), ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm1"), Region: strPtr("eastus")},
		})

		cli := &http.Client{Transport: &redirectTransport{target: mustParseURL(srv.URL)}}
		// Context has the feature flag but BatchAPIEnabled is false — should NOT use batch path
		resp, err := ds.ExecuteTimeSeriesQuery(batchCtx(), []backend.DataQuery{q}, dsInfo, cli, srv.URL, false)
		require.NoError(t, err)
		assert.Contains(t, resp.Responses, "A")
	})
}
