package metrics

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
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
		// Context has the feature flag but BatchAPIEnabled is false — should NOT use batch path
		resp, err := ds.ExecuteTimeSeriesQuery(batchCtx(), []backend.DataQuery{q}, dsInfo, cli, srv.URL, false)
		require.NoError(t, err)
		assert.Contains(t, resp.Responses, "A")
	})

	t.Run("batch service missing: falls back to legacy instead of failing all queries", func(t *testing.T) {
		// Regression: with batch mode on but no batch metrics service configured
		// (e.g. a customized-cloud datasource without a metricsDataPlane route),
		// executeBatchTimeSeriesQuery used to return a top-level error, failing
		// the whole QueryData call. It must fall back to the legacy ARM path.
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
		require.NoError(t, err, "missing batch service must not fail the whole QueryData call")
		require.Contains(t, resp.Responses, "A")
		assert.NoError(t, resp.Responses["A"].Error)
		assert.NotEmpty(t, resp.Responses["A"].Frames)
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
