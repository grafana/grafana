package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
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

// hostRecordingTransport redirects like redirectTransport but records each
// request's original host first, so tests can assert which endpoint a batch
// request was aimed at before the redirect.
type hostRecordingTransport struct {
	target *url.URL
	mu     sync.Mutex
	hosts  []string
}

func (t *hostRecordingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	t.mu.Lock()
	t.hosts = append(t.hosts, req.URL.Host)
	t.mu.Unlock()
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

	t.Run("empty batch response still assigns a response entry per refID", func(t *testing.T) {
		// Regression: a successful batch that parses to zero frames (e.g. empty
		// timeseries for the window) must still leave an entry for the refID,
		// matching the legacy path.
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"values":[]}`))
		}))
		defer srv.Close()

		dsInfo := makeBatchDsInfo(srv)
		q := makeBatchQuery("A", "sub-123", "eastus", []dataquery.AzureMonitorResource{
			{Subscription: strPtr("sub-123"), ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm1"), Region: strPtr("eastus")},
		})

		resp, err := ds.ExecuteTimeSeriesQuery(batchCtx(), []backend.DataQuery{q}, dsInfo, &http.Client{}, "", false)
		require.NoError(t, err)
		dr, ok := resp.Responses["A"]
		require.True(t, ok, "refID must have a response entry even with no frames")
		assert.NoError(t, dr.Error)
		assert.Empty(t, dr.Frames)
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
		// Context has the feature flag but BatchAPIEnabled is false; should NOT use batch path
		resp, err := ds.ExecuteTimeSeriesQuery(batchCtx(), []backend.DataQuery{q}, dsInfo, cli, srv.URL, false)
		require.NoError(t, err)
		assert.Contains(t, resp.Responses, "A")
	})

	t.Run("batch service missing: fails the request with a downstream configuration error", func(t *testing.T) {
		// With batch mode on but no batch metrics service configured (e.g. a
		// customized-cloud datasource without a metricsDataPlane route), the
		// request must fail with a downstream error prompting the user to fix
		// their cloud configuration rather than silently using another endpoint.
		armResponse := loadTestFile(t, "azuremonitor/1-azure-monitor-response-avg.json")
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			b, _ := json.Marshal(armResponse)
			_, _ = w.Write(b)
		}))
		defer srv.Close()

		// BatchAPIEnabled = true, feature toggle on, but Services lacks the
		// "Azure Monitor Batch Metrics" entry.
		dsInfo := types.DatasourceInfo{
			Settings: types.AzureMonitorSettings{BatchAPIEnabled: true, SubscriptionId: "sub-123"},
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
		resp, err := ds.ExecuteTimeSeriesQuery(batchCtx(), []backend.DataQuery{q}, dsInfo, cli, srv.URL, false)
		require.Error(t, err, "missing batch service must fail the request")
		assert.Nil(t, resp, "no partial response should be returned when the batch service is missing")
		assert.True(t, backend.IsDownstreamError(err), "a missing cloud configuration route is a downstream error")
		assert.Contains(t, err.Error(), "cloud configuration")
	})

	t.Run("query without resources is not silently dropped by the batch path", func(t *testing.T) {
		// Regression: a batchable-looking query with an empty Resources array
		// produced no batch entries, so its refID received neither frames nor an
		// error. It must now take the legacy ARM path and receive a response.
		armResponse := loadTestFile(t, "azuremonitor/1-azure-monitor-response-avg.json")
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			b, _ := json.Marshal(armResponse)
			_, _ = w.Write(b)
		}))
		defer srv.Close()

		dsInfo := makeBatchDsInfo(srv)
		q := makeBatchQuery("A", "sub-123", "eastus", nil) // no resources

		cli := &http.Client{Transport: &redirectTransport{target: mustParseURL(srv.URL)}}
		resp, err := ds.ExecuteTimeSeriesQuery(batchCtx(), []backend.DataQuery{q}, dsInfo, cli, srv.URL, false)
		require.NoError(t, err)
		require.Contains(t, resp.Responses, "A", "resource-less query must receive a response, not vanish")
	})

	t.Run("batch requests target the regional host of the configured data-plane URL", func(t *testing.T) {
		// Regression: the batch host must be derived from the batch metrics
		// service URL (cloud-dependent, e.g. metrics.monitor.azure.cn for
		// China), not from the ARM URL passed to ExecuteTimeSeriesQuery.
		resourceID := "/subscriptions/sub-123/resourcegroups/rg/providers/microsoft.compute/virtualmachines/vm1"
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write(batchSuccessResponse([]string{resourceID}, 42.0))
		}))
		defer srv.Close()

		recorder := &hostRecordingTransport{target: mustParseURL(srv.URL)}
		dsInfo := makeBatchDsInfo(srv)
		dsInfo.Services["Azure Monitor Batch Metrics"] = types.DatasourceService{
			URL:        "https://metrics.monitor.azure.cn",
			HTTPClient: &http.Client{Transport: recorder},
		}
		q := makeBatchQuery("A", "sub-123", "chinaeast2", []dataquery.AzureMonitorResource{
			{Subscription: strPtr("sub-123"), ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm1"), Region: strPtr("chinaeast2")},
		})

		resp, err := ds.ExecuteTimeSeriesQuery(batchCtx(), []backend.DataQuery{q}, dsInfo, &http.Client{}, "https://management.chinacloudapi.cn", false)
		require.NoError(t, err)
		assert.NoError(t, resp.Responses["A"].Error)
		require.Len(t, recorder.hosts, 1)
		assert.Equal(t, "chinaeast2.metrics.monitor.azure.cn", recorder.hosts[0])
	})
}

func TestIsBatchableModel(t *testing.T) {
	makeQuery := func(metricNamespace string, customNamespace *string) backend.DataQuery {
		az := &dataquery.AzureMetricQuery{
			MetricName: strPtr("Percentage CPU"),
			Resources: []dataquery.AzureMonitorResource{
				{Subscription: strPtr("sub-123"), ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm1")},
			},
		}
		if metricNamespace != "" {
			az.MetricNamespace = strPtr(metricNamespace)
		}
		az.CustomNamespace = customNamespace
		raw, _ := json.Marshal(dataquery.AzureMonitorQuery{AzureMonitor: az})
		return backend.DataQuery{JSON: raw}
	}

	tests := []struct {
		name            string
		metricNamespace string
		customNamespace *string
		want            bool
	}{
		{"standard resource-type namespace is batchable", "Microsoft.Compute/virtualMachines", nil, true},
		{"custom namespace is not batchable", "Microsoft.Compute/virtualMachines", strPtr("myCustomNs"), false},
		{"guest OS metrics are not batchable", "azure.vm.windows.guestmetrics", nil, false},
		{"guest OS namespace match is case-insensitive", "Azure.VM.Linux.GuestMetrics", nil, false},
		{"WAD namespace is not batchable", "WAD", nil, false},
		{"windows azure diagnostics namespace is not batchable", "Windows Azure Diagnostics", nil, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := makeQuery(tt.metricNamespace, tt.customNamespace)
			var m dataquery.AzureMonitorQuery
			require.NoError(t, json.Unmarshal(q.JSON, &m))
			assert.Equal(t, tt.want, isBatchableModel(m))
		})
	}

	t.Run("query without resources is not batchable", func(t *testing.T) {
		// The batch API requires resource IDs in the request body; resource-less
		// queries (subscription-scoped, or legacy top-level resourceGroup/
		// resourceName shapes) must take the legacy ARM path.
		m := dataquery.AzureMonitorQuery{AzureMonitor: &dataquery.AzureMetricQuery{
			MetricNamespace: strPtr("Microsoft.Compute/virtualMachines"),
			MetricName:      strPtr("Percentage CPU"),
		}}
		assert.False(t, isBatchableModel(m))
	})
}

func TestApplyLegacyDimensions(t *testing.T) {
	strP := func(s string) *string { return &s }
	makeModel := func(dim, dimFilter *string, filters []dataquery.AzureMetricDimension) dataquery.AzureMonitorQuery {
		return dataquery.AzureMonitorQuery{AzureMonitor: &dataquery.AzureMetricQuery{
			Dimension:        dim,
			DimensionFilter:  dimFilter,
			DimensionFilters: filters,
		}}
	}

	t.Run("folds legacy dimension into Dimensions so the batch filter honours it", func(t *testing.T) {
		model := makeModel(strP("VMName"), strP("vm1"), nil)
		q := &types.AzureMonitorQuery{Params: url.Values{}}
		applyLegacyDimensions([]*types.AzureMonitorQuery{q}, model)
		require.Len(t, q.Dimensions, 1)
		// Same filter string the single-resource legacy branch produces.
		assert.Equal(t, "VMName eq 'vm1'", dimensionFilterKey(q))
	})

	t.Run("does nothing when modern dimensionFilters is present", func(t *testing.T) {
		model := makeModel(strP("VMName"), strP("vm1"), []dataquery.AzureMetricDimension{
			{Dimension: strP("Other"), Operator: strP("eq"), Filters: []string{"x"}},
		})
		q := &types.AzureMonitorQuery{Params: url.Values{}}
		applyLegacyDimensions([]*types.AzureMonitorQuery{q}, model)
		assert.Empty(t, q.Dimensions)
	})

	t.Run("does nothing when dimension is empty or None", func(t *testing.T) {
		for _, dim := range []string{"", "None"} {
			model := makeModel(strP(dim), strP("vm1"), nil)
			q := &types.AzureMonitorQuery{Params: url.Values{}}
			applyLegacyDimensions([]*types.AzureMonitorQuery{q}, model)
			assert.Empty(t, q.Dimensions, "dim=%q", dim)
		}
	})

	t.Run("does not overwrite a query that already has dimensions", func(t *testing.T) {
		model := makeModel(strP("VMName"), strP("vm1"), nil)
		existing := []dataquery.AzureMetricDimension{{Dimension: strP("Existing"), Operator: strP("eq"), Filters: []string{"y"}}}
		q := &types.AzureMonitorQuery{Params: url.Values{}, Dimensions: existing}
		applyLegacyDimensions([]*types.AzureMonitorQuery{q}, model)
		assert.Equal(t, existing, q.Dimensions)
	})
}

// TestFanOutByResource is a regression test: each fanned-out sub-query must
// carry its resource's own subscription AND region (previously the query-level
// region was kept on every sub-query, sending a wrong region param to ARM for
// resources outside the query default).
func TestFanOutByResource(t *testing.T) {
	regionDefault := "eastus"
	model := dataquery.AzureMonitorQuery{
		Subscription: strPtr("sub-default"),
		AzureMonitor: &dataquery.AzureMetricQuery{
			MetricNamespace: strPtr("Microsoft.Compute/virtualMachines"),
			CustomNamespace: strPtr("myCustomNs"), // non-batchable, so it fans out
			MetricName:      strPtr("requests"),
			Region:          &regionDefault,
			Resources: []dataquery.AzureMonitorResource{
				{Subscription: strPtr("sub-1"), ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm1"), Region: strPtr("westus")},
				{ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm2")}, // no explicit sub/region
			},
		},
	}
	raw, err := json.Marshal(model)
	require.NoError(t, err)
	q := backend.DataQuery{RefID: "A", JSON: raw}

	subQueries, err := fanOutByResource(q, model)
	require.NoError(t, err)
	require.Len(t, subQueries, 2)

	var m1, m2 dataquery.AzureMonitorQuery
	require.NoError(t, json.Unmarshal(subQueries[0].JSON, &m1))
	require.NoError(t, json.Unmarshal(subQueries[1].JSON, &m2))

	// A resource with explicit values gets its own subscription and region.
	assert.Equal(t, "sub-1", *m1.Subscription)
	assert.Equal(t, "westus", *m1.AzureMonitor.Region)
	// A resource without explicit values keeps the query-level defaults.
	assert.Equal(t, "sub-default", *m2.Subscription)
	assert.Equal(t, "eastus", *m2.AzureMonitor.Region)
}

// TestExecuteBatchTimeSeriesQuerySharedResources is an end-to-end regression
// test: the batch group key excludes RefID/Alias, so queries with identical
// parameters (e.g. a duplicated panel query) co-batch and share a deduplicated
// resource ID. Previously parseBatchResponse kept only the last owner of each
// resource, so the other refID silently received neither frames nor an error.
func TestExecuteBatchTimeSeriesQuerySharedResources(t *testing.T) {
	ds := &AzureMonitorDatasource{Logger: log.DefaultLogger}
	resourceID := "/subscriptions/sub-123/resourcegroups/rg/providers/microsoft.compute/virtualmachines/vm1"

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(batchSuccessResponse([]string{resourceID}, 42.0))
	}))
	defer srv.Close()

	dsInfo := makeBatchDsInfo(srv)
	resources := []dataquery.AzureMonitorResource{
		{Subscription: strPtr("sub-123"), ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm1"), Region: strPtr("eastus")},
	}
	qA := makeBatchQuery("A", "sub-123", "eastus", resources)
	qB := makeBatchQuery("B", "sub-123", "eastus", resources)

	resp, err := ds.ExecuteTimeSeriesQuery(batchCtx(), []backend.DataQuery{qA, qB}, dsInfo, &http.Client{}, "", false)
	require.NoError(t, err)

	drA := resp.Responses["A"]
	drB := resp.Responses["B"]
	require.Len(t, drA.Frames, 1, "refID A must receive frames")
	require.Len(t, drB.Frames, 1, "refID B must receive frames")
	assert.NoError(t, drA.Error)
	assert.NoError(t, drB.Error)
	// Each frame must carry its own query's RefID.
	assert.Equal(t, "A", drA.Frames[0].RefID)
	assert.Equal(t, "B", drB.Frames[0].RefID)
}

func TestExecuteBatchTimeSeriesQueryFallback(t *testing.T) {
	ds := &AzureMonitorDatasource{Logger: log.NewNullLogger()}
	armResponse := loadTestFile(t, "azuremonitor/1-azure-monitor-response-avg.json")
	armContent, _ := json.Marshal(armResponse)

	// armBatchOK echoes each incoming sub-request name with a 200 + the metrics fixture,
	// imitating the undocumented ARM /batch response envelope.
	armBatchOK := func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Requests []struct {
				Name string `json:"name"`
			} `json:"requests"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		type sub struct {
			Name           string          `json:"name"`
			HTTPStatusCode int             `json:"httpStatusCode"`
			Content        json.RawMessage `json:"content"`
		}
		out := struct {
			Responses []sub `json:"responses"`
		}{}
		for _, req := range body.Requests {
			out.Responses = append(out.Responses, sub{Name: req.Name, HTTPStatusCode: 200, Content: armContent})
		}
		w.Header().Set("Content-Type", "application/json")
		b, _ := json.Marshal(out)
		_, _ = w.Write(b)
	}

	oneResource := []dataquery.AzureMonitorResource{
		{Subscription: strPtr("sub-123"), ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm1"), Region: strPtr("eastus")},
	}

	t.Run("retryable failure falls back to ARM /batch and returns frames", func(t *testing.T) {
		var batchHit, fallbackHit bool
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch {
			case strings.Contains(r.URL.Path, "metrics:getBatch"):
				batchHit = true
				http.Error(w, `{"error":{"code":"TooManyRequests"}}`, http.StatusTooManyRequests)
			case strings.HasSuffix(r.URL.Path, "/batch"):
				fallbackHit = true
				armBatchOK(w, r)
			case strings.HasSuffix(r.URL.Path, "/subscriptions/sub-123"):
				// Subscription display-name lookup for {{subscription}} legends.
				_, _ = w.Write([]byte(`{"displayName":"sub-123"}`))
			default:
				t.Errorf("unexpected request path: %s", r.URL.Path)
			}
		}))
		defer srv.Close()

		dsInfo := makeBatchDsInfo(srv)
		q := makeBatchQuery("A", "sub-123", "eastus", oneResource)
		cli := &http.Client{Transport: &redirectTransport{target: mustParseURL(srv.URL)}}

		resp, err := ds.ExecuteTimeSeriesQuery(batchCtx(), []backend.DataQuery{q}, dsInfo, cli, srv.URL, false)
		require.NoError(t, err)
		assert.True(t, batchHit, "metrics:getBatch should have been attempted")
		assert.True(t, fallbackHit, "ARM /batch fallback should have been called")
		dr := resp.Responses["A"]
		assert.Nil(t, dr.Error)
		assert.NotEmpty(t, dr.Frames, "fallback should have produced frames")
	})

	t.Run("non-retryable failure (400): no fallback", func(t *testing.T) {
		var fallbackHit bool
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasSuffix(r.URL.Path, "/batch") {
				fallbackHit = true
			}
			http.Error(w, `{"error":{"code":"BadRequest"}}`, http.StatusBadRequest)
		}))
		defer srv.Close()

		dsInfo := makeBatchDsInfo(srv)
		q := makeBatchQuery("A", "sub-123", "eastus", oneResource)
		cli := &http.Client{Transport: &redirectTransport{target: mustParseURL(srv.URL)}}

		resp, err := ds.ExecuteTimeSeriesQuery(batchCtx(), []backend.DataQuery{q}, dsInfo, cli, srv.URL, false)
		require.NoError(t, err)
		assert.False(t, fallbackHit, "400 is not retryable; fallback must not run")
		assert.NotNil(t, resp.Responses["A"].Error)
	})

	t.Run("ARM /batch itself fails: query fails, no fan-out to individual", func(t *testing.T) {
		var individualHit bool
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch {
			case strings.Contains(r.URL.Path, "metrics:getBatch"):
				http.Error(w, `{"error":{}}`, http.StatusTooManyRequests)
			case strings.HasSuffix(r.URL.Path, "/batch"):
				http.Error(w, `{"error":{}}`, http.StatusInternalServerError) // ARM /batch fails
			case strings.Contains(r.URL.Path, "/providers/microsoft.insights/metrics"):
				individualHit = true
				w.Header().Set("Content-Type", "application/json")
				b, _ := json.Marshal(armResponse)
				_, _ = w.Write(b)
			default:
				// subscription-details lookup used for legend formatting
				_, _ = w.Write([]byte(`{"displayName":"Test Sub"}`))
			}
		}))
		defer srv.Close()

		dsInfo := makeBatchDsInfo(srv)
		q := makeBatchQuery("A", "sub-123", "eastus", oneResource)
		cli := &http.Client{Transport: &redirectTransport{target: mustParseURL(srv.URL)}}

		resp, err := ds.ExecuteTimeSeriesQuery(batchCtx(), []backend.DataQuery{q}, dsInfo, cli, srv.URL, false)
		require.NoError(t, err)
		assert.False(t, individualHit, "must not fan out to individual /metrics when ARM /batch fails")
		assert.NotNil(t, resp.Responses["A"].Error, "query should fail when the ARM /batch fallback fails")
	})

	t.Run("more than maxARMBatchSize resources: fallback chunks into multiple ARM /batch calls", func(t *testing.T) {
		const resourceCount = maxARMBatchSize + 5 // 25 -> chunks of 20 + 5
		resources := make([]dataquery.AzureMonitorResource, 0, resourceCount)
		for i := 0; i < resourceCount; i++ {
			resources = append(resources, dataquery.AzureMonitorResource{
				Subscription:  strPtr("sub-123"),
				ResourceGroup: strPtr("rg"),
				ResourceName:  strPtr(fmt.Sprintf("vm%d", i)),
				Region:        strPtr("eastus"),
			})
		}

		// The single failed batch fans out after wg.Wait(), so this counter is only
		// ever touched from the calling goroutine.
		var batchCalls int
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch {
			case strings.Contains(r.URL.Path, "metrics:getBatch"):
				http.Error(w, `{"error":{"code":"TooManyRequests"}}`, http.StatusTooManyRequests)
			case strings.HasSuffix(r.URL.Path, "/batch"):
				batchCalls++
				armBatchOK(w, r)
			case strings.HasSuffix(r.URL.Path, "/subscriptions/sub-123"):
				// Subscription display-name lookup for {{subscription}} legends.
				_, _ = w.Write([]byte(`{"displayName":"sub-123"}`))
			default:
				t.Errorf("unexpected request path: %s", r.URL.Path)
			}
		}))
		defer srv.Close()

		dsInfo := makeBatchDsInfo(srv)
		q := makeBatchQuery("A", "sub-123", "eastus", resources)
		cli := &http.Client{Transport: &redirectTransport{target: mustParseURL(srv.URL)}}

		resp, err := ds.ExecuteTimeSeriesQuery(batchCtx(), []backend.DataQuery{q}, dsInfo, cli, srv.URL, false)
		require.NoError(t, err)
		assert.Equal(t, 2, batchCalls, "25 resources should chunk into two ARM /batch calls (20 + 5)")
		dr := resp.Responses["A"]
		assert.Nil(t, dr.Error)
		assert.NotEmpty(t, dr.Frames)
	})

	t.Run("partial failure in ARM /batch response: failed resource errors, others still return frames", func(t *testing.T) {
		resources := []dataquery.AzureMonitorResource{
			{Subscription: strPtr("sub-123"), ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm1"), Region: strPtr("eastus")},
			{Subscription: strPtr("sub-123"), ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm2"), Region: strPtr("eastus")},
		}

		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch {
			case strings.Contains(r.URL.Path, "metrics:getBatch"):
				http.Error(w, `{"error":{}}`, http.StatusTooManyRequests)
			case strings.HasSuffix(r.URL.Path, "/batch"):
				// Return 200 for the first sub-request and 403 for the rest, so the
				// response is a successful envelope carrying a per-resource failure.
				var body struct {
					Requests []struct {
						Name string `json:"name"`
					} `json:"requests"`
				}
				_ = json.NewDecoder(r.Body).Decode(&body)
				type sub struct {
					Name           string          `json:"name"`
					HTTPStatusCode int             `json:"httpStatusCode"`
					Content        json.RawMessage `json:"content"`
				}
				out := struct {
					Responses []sub `json:"responses"`
				}{}
				for i, req := range body.Requests {
					if i == 0 {
						out.Responses = append(out.Responses, sub{Name: req.Name, HTTPStatusCode: 200, Content: armContent})
					} else {
						out.Responses = append(out.Responses, sub{Name: req.Name, HTTPStatusCode: 403, Content: json.RawMessage(`{"error":{"code":"Forbidden"}}`)})
					}
				}
				w.Header().Set("Content-Type", "application/json")
				b, _ := json.Marshal(out)
				_, _ = w.Write(b)
			case strings.HasSuffix(r.URL.Path, "/subscriptions/sub-123"):
				// Subscription display-name lookup for {{subscription}} legends.
				_, _ = w.Write([]byte(`{"displayName":"sub-123"}`))
			default:
				t.Errorf("unexpected request path: %s", r.URL.Path)
			}
		}))
		defer srv.Close()

		dsInfo := makeBatchDsInfo(srv)
		q := makeBatchQuery("A", "sub-123", "eastus", resources)
		cli := &http.Client{Transport: &redirectTransport{target: mustParseURL(srv.URL)}}

		resp, err := ds.ExecuteTimeSeriesQuery(batchCtx(), []backend.DataQuery{q}, dsInfo, cli, srv.URL, false)
		require.NoError(t, err)
		dr := resp.Responses["A"]
		assert.NotNil(t, dr.Error, "the failed sub-response should surface an error")
		assert.NotEmpty(t, dr.Frames, "the successful sub-response should still produce frames")
	})
}
