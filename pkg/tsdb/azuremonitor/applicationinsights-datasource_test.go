package azuremonitor

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	. "github.com/smartystreets/goconvey/convey"
)

func TestApplicationInsightsDatasource(t *testing.T) {
	Convey("ApplicationInsightsDatasource", t, func() {
		datasource := &ApplicationInsightsDatasource{}

		Convey("Parse queries from frontend and build AzureMonitor API queries", func() {
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
			Convey("and is a normal query", func() {
				queries, err := datasource.buildQueries(tsdbQuery)
				So(err, ShouldBeNil)

				So(len(queries), ShouldEqual, 1)
				So(queries[0].RefID, ShouldEqual, "A")
				So(queries[0].ApiURL, ShouldEqual, "metrics/server/exceptions")
				So(queries[0].Target, ShouldEqual, "aggregation=Average&interval=PT1M&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z")
				So(len(queries[0].Params), ShouldEqual, 3)
				So(queries[0].Params["timespan"][0], ShouldEqual, "2018-03-15T13:00:00Z/2018-03-15T13:34:00Z")
				So(queries[0].Params["aggregation"][0], ShouldEqual, "Average")
				So(queries[0].Params["interval"][0], ShouldEqual, "PT1M")
				So(queries[0].Alias, ShouldEqual, "testalias")
			})

			Convey("and has a time grain set to auto", func() {
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
				So(err, ShouldBeNil)

				So(queries[0].Params["interval"][0], ShouldEqual, "PT15M")
			})

			Convey("and has an empty time grain", func() {
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
				So(err, ShouldBeNil)

				So(queries[0].Params["interval"][0], ShouldEqual, "PT15M")
			})

			Convey("and has a time grain set to auto and the metric has a limited list of allowed time grains", func() {
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
				So(err, ShouldBeNil)

				So(queries[0].Params["interval"][0], ShouldEqual, "PT5M")
			})

			Convey("and has a dimension filter", func() {
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
				So(err, ShouldBeNil)

				So(queries[0].Target, ShouldEqual, "aggregation=Average&filter=blob+eq+%27%2A%27&interval=PT1M&segment=blob&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z")
				So(queries[0].Params["filter"][0], ShouldEqual, "blob eq '*'")
			})

			Convey("and has a dimension filter set to None", func() {
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
				So(err, ShouldBeNil)

				So(queries[0].Target, ShouldEqual, "aggregation=Average&interval=PT1M&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z")
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
	url := "http://ds"
	dsInfo := datasourceInfo{
		Settings: azureMonitorSettings{AppInsightsAppId: "foo"},
		DecryptedSecureJSONData: map[string]string{
			"appInsightsApiKey": "key",
		},
	}

	tests := []struct {
		name        string
		expectedURL string
		Err         require.ErrorAssertionFunc
	}{
		{
			name:        "creates a request",
			expectedURL: "http://ds/v1/apps/foo",
			Err:         require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ds := ApplicationInsightsDatasource{}
			req, err := ds.createRequest(ctx, dsInfo, url)
			tt.Err(t, err)
			if req.URL.String() != tt.expectedURL {
				t.Errorf("Expecting %s, got %s", tt.expectedURL, req.URL.String())
			}
		})
	}
}
