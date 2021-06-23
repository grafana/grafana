package azuremonitor

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

func TestApplicationInsightsDatasource(t *testing.T) {
	t.Run("ApplicationInsightsDatasource", func(t *testing.T) {
		datasource := &ApplicationInsightsDatasource{}

		t.Run("Parse queries from frontend and build AzureMonitor API queries", func(t *testing.T) {
			fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
			tsdbQuery := []backend.DataQuery{
				{
					TimeRange: backend.TimeRange{
						From: fromStart,
						To:   fromStart.Add(34 * time.Minute),
					},
					JSON: []byte(`{
						"appInsights": {
							"rawQuery":    false,
							"timeGrain":   "PT1M",
							"aggregation": "Average",
							"metricName":  "server/exceptions",
							"alias":       "testalias",
							"queryType":   "Application Insights"
						}
					}`),
					RefID:    "A",
					Interval: 1234,
				},
			}
			t.Run("and is a normal query", func(t *testing.T) {
				queries, err := datasource.buildQueries(tsdbQuery)
				require.NoError(t, err)

				require.Equal(t, 1, len(queries))
				require.Equal(t, "A", queries[0].RefID)
				require.Equal(t, "metrics/server/exceptions", queries[0].ApiURL)
				require.Equal(t, "aggregation=Average&interval=PT1M&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z", queries[0].Target)
				require.Equal(t, 3, len(queries[0].Params))
				require.Equal(t, "2018-03-15T13:00:00Z/2018-03-15T13:34:00Z", queries[0].Params["timespan"][0])
				require.Equal(t, "Average", queries[0].Params["aggregation"][0])
				require.Equal(t, "PT1M", queries[0].Params["interval"][0])
				require.Equal(t, "testalias", queries[0].Alias)
			})

			t.Run("and has a time grain set to auto", func(t *testing.T) {
				tsdbQuery[0].JSON = []byte(`{
					"appInsights": {
						"rawQuery":    false,
						"timeGrain":   "auto",
						"aggregation": "Average",
						"metricName":  "Percentage CPU",
						"alias":       "testalias",
						"queryType":   "Application Insights"
					}
				}`)
				var err error
				tsdbQuery[0].Interval, err = time.ParseDuration("400s")
				require.NoError(t, err)

				queries, err := datasource.buildQueries(tsdbQuery)
				require.NoError(t, err)

				require.Equal(t, "PT15M", queries[0].Params["interval"][0])
			})

			t.Run("and has an empty time grain", func(t *testing.T) {
				tsdbQuery[0].JSON = []byte(`{
					"appInsights": {
						"rawQuery":    false,
						"timeGrain":   "",
						"aggregation": "Average",
						"metricName":  "Percentage CPU",
						"alias":       "testalias",
						"queryType":   "Application Insights"
					}
				}`)
				tsdbQuery[0].Interval, _ = time.ParseDuration("400s")

				queries, err := datasource.buildQueries(tsdbQuery)
				require.NoError(t, err)

				require.Equal(t, "PT15M", queries[0].Params["interval"][0])
			})

			t.Run("and has a time grain set to auto and the metric has a limited list of allowed time grains", func(t *testing.T) {
				tsdbQuery[0].JSON = []byte(`{
					"appInsights": {
						"rawQuery":            false,
						"timeGrain":           "auto",
						"aggregation":         "Average",
						"metricName":          "Percentage CPU",
						"alias":               "testalias",
						"queryType":           "Application Insights",
						"allowedTimeGrainsMs": [60000, 300000]
					}
				}`)
				tsdbQuery[0].Interval, _ = time.ParseDuration("400s")

				queries, err := datasource.buildQueries(tsdbQuery)
				require.NoError(t, err)

				require.Equal(t, "PT5M", queries[0].Params["interval"][0])
			})

			t.Run("and has a dimension filter", func(t *testing.T) {
				tsdbQuery[0].JSON = []byte(`{
					"appInsights": {
						"rawQuery":        false,
						"timeGrain":       "PT1M",
						"aggregation":     "Average",
						"metricName":      "Percentage CPU",
						"alias":           "testalias",
						"queryType":       "Application Insights",
						"dimension":       "blob",
						"dimensionFilter": "blob eq '*'"
					}
				}`)

				queries, err := datasource.buildQueries(tsdbQuery)
				require.NoError(t, err)

				require.Equal(t, "aggregation=Average&filter=blob+eq+%27%2A%27&interval=PT1M&segment=blob&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z", queries[0].Target)
				require.Equal(t, "blob eq '*'", queries[0].Params["filter"][0])
			})

			t.Run("and has a dimension filter set to None", func(t *testing.T) {
				tsdbQuery[0].JSON = []byte(`{
					"appInsights": {
						"rawQuery":    false,
						"timeGrain":   "PT1M",
						"aggregation": "Average",
						"metricName":  "Percentage CPU",
						"alias":       "testalias",
						"queryType":   "Application Insights",
						"dimension":   "None"
					}
				}`)

				queries, err := datasource.buildQueries(tsdbQuery)
				require.NoError(t, err)

				require.Equal(t, "aggregation=Average&interval=PT1M&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z", queries[0].Target)
			})
		})
	})
}

func TestInsightsDimensionsUnmarshalJSON(t *testing.T) {
	a := []byte(`"foo"`)
	b := []byte(`["foo"]`)
	c := []byte(`["none"]`)
	d := []byte(`["None"]`)
	e := []byte("null")
	f := []byte(`""`)
	g := []byte(`"none"`)

	var as InsightsDimensions
	var bs InsightsDimensions
	err := json.Unmarshal(a, &as)

	require.NoError(t, err)
	require.Equal(t, []string{"foo"}, []string(as))

	err = json.Unmarshal(b, &bs)
	require.NoError(t, err)

	require.Equal(t, []string{"foo"}, []string(bs))

	var cs InsightsDimensions
	err = json.Unmarshal(c, &cs)
	require.NoError(t, err)
	require.Empty(t, cs)

	var ds InsightsDimensions
	err = json.Unmarshal(d, &ds)
	require.NoError(t, err)
	require.Empty(t, ds)

	var es InsightsDimensions
	err = json.Unmarshal(e, &es)
	require.NoError(t, err)
	require.Empty(t, es)

	var fs InsightsDimensions
	err = json.Unmarshal(f, &fs)
	require.NoError(t, err)
	require.Empty(t, fs)

	var gs InsightsDimensions
	err = json.Unmarshal(g, &gs)
	require.NoError(t, err)
	require.Empty(t, gs)
}

func TestAppInsightsCreateRequest(t *testing.T) {
	ctx := context.Background()
	dsInfo := datasourceInfo{
		Settings: azureMonitorSettings{AppInsightsAppId: "foo"},
		Services: map[string]datasourceService{
			appInsights: {URL: "http://ds"},
		},
		DecryptedSecureJSONData: map[string]string{
			"appInsightsApiKey": "key",
		},
	}

	tests := []struct {
		name            string
		expectedURL     string
		expectedHeaders http.Header
		Err             require.ErrorAssertionFunc
	}{
		{
			name:        "creates a request",
			expectedURL: "http://ds/v1/apps/foo",
			expectedHeaders: http.Header{
				"X-Api-Key": []string{"key"},
			},
			Err: require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ds := ApplicationInsightsDatasource{}
			req, err := ds.createRequest(ctx, dsInfo)
			tt.Err(t, err)
			if req.URL.String() != tt.expectedURL {
				t.Errorf("Expecting %s, got %s", tt.expectedURL, req.URL.String())
			}
			if !cmp.Equal(req.Header, tt.expectedHeaders) {
				t.Errorf("Unexpected HTTP headers: %v", cmp.Diff(req.Header, tt.expectedHeaders))
			}
		})
	}
}
