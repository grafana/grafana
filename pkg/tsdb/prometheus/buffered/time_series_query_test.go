package buffered

import (
	"context"
	"math"
	"net/http"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
	p "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

var now = time.Now()

type FakeRoundTripper struct {
	Req *http.Request
}

func (frt *FakeRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	frt.Req = req
	return &http.Response{}, nil
}

func FakeMiddleware(rt *FakeRoundTripper) sdkhttpclient.Middleware {
	return sdkhttpclient.NamedMiddlewareFunc("fake", func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return rt
	})
}

func TestPrometheus_ExecuteTimeSeriesQuery(t *testing.T) {
	t.Run("adding req headers", func(t *testing.T) {
		// This makes sure we add req headers from the front end request to the request to prometheus. We do that
		// through contextual middleware so this setup is a bit complex and the test itself goes a bit too much into
		// internals.

		// This ends the trip and saves the request on the instance so we can inspect it.
		rt := &FakeRoundTripper{}
		// DefaultMiddlewares also contain contextual middleware which is the one we need to use.
		middlewares := sdkhttpclient.DefaultMiddlewares()
		middlewares = append(middlewares, FakeMiddleware(rt))

		// Setup http client in at least similar way to how grafana provides it to the service
		provider := sdkhttpclient.NewProvider(sdkhttpclient.ProviderOptions{Middlewares: sdkhttpclient.DefaultMiddlewares()})
		roundTripper, err := provider.GetTransport(sdkhttpclient.Options{
			Middlewares: middlewares,
		})
		require.NoError(t, err)

		buffered, err := New(roundTripper, nil, backend.DataSourceInstanceSettings{JSONData: []byte("{}")}, &logtest.Fake{})
		require.NoError(t, err)

		_, err = buffered.ExecuteTimeSeriesQuery(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{},
			// This header is dropped, as only FromAlert header will be added to outgoing requests
			Headers: map[string]string{"foo": "bar"},
			Queries: []backend.DataQuery{{
				JSON: []byte(`{"expr": "metric{label=\"test\"}", "rangeQuery": true}`),
			}},
		})
		require.NoError(t, err)
		require.NotNil(t, rt.Req)
		require.Equal(t, http.Header{"Content-Type": []string{"application/x-www-form-urlencoded"}, "Idempotency-Key": []string(nil)}, rt.Req.Header)
	})
}

func TestPrometheus_timeSeriesQuery_formatLegend(t *testing.T) {
	t.Run("converting metric name", func(t *testing.T) {
		metric := map[p.LabelName]p.LabelValue{
			p.LabelName("app"):    p.LabelValue("backend"),
			p.LabelName("device"): p.LabelValue("mobile"),
		}

		query := &PrometheusQuery{
			LegendFormat: "legend {{app}} {{ device }} {{broken}}",
		}

		require.Equal(t, "legend backend mobile ", formatLegend(metric, query))
	})

	t.Run("build full series name", func(t *testing.T) {
		metric := map[p.LabelName]p.LabelValue{
			p.LabelName(p.MetricNameLabel): p.LabelValue("http_request_total"),
			p.LabelName("app"):             p.LabelValue("backend"),
			p.LabelName("device"):          p.LabelValue("mobile"),
		}

		query := &PrometheusQuery{
			LegendFormat: "",
		}

		require.Equal(t, `http_request_total{app="backend", device="mobile"}`, formatLegend(metric, query))
	})

	t.Run("use query expr when no labels", func(t *testing.T) {
		metric := map[p.LabelName]p.LabelValue{}

		query := &PrometheusQuery{
			LegendFormat: "",
			Expr:         `{job="grafana"}`,
		}

		require.Equal(t, `{job="grafana"}`, formatLegend(metric, query))
	})

	t.Run("When legendFormat = __auto and no labels", func(t *testing.T) {
		metric := map[p.LabelName]p.LabelValue{}

		query := &PrometheusQuery{
			LegendFormat: legendFormatAuto,
			Expr:         `{job="grafana"}`,
		}

		require.Equal(t, `{job="grafana"}`, formatLegend(metric, query))
	})

	t.Run("When legendFormat = __auto with labels", func(t *testing.T) {
		metric := map[p.LabelName]p.LabelValue{
			p.LabelName("app"): p.LabelValue("backend"),
		}

		query := &PrometheusQuery{
			LegendFormat: legendFormatAuto,
			Expr:         `{job="grafana"}`,
		}

		require.Equal(t, "", formatLegend(metric, query))
	})
}

func TestPrometheus_timeSeriesQuery_parseTimeSeriesQuery(t *testing.T) {
	service := Buffered{
		intervalCalculator: intervalv2.NewCalculator(),
	}

	t.Run("parsing query from unified alerting", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		queryJson := `{
			"expr": "go_goroutines",
			"refId": "A",
			"exemplar": true
		}`

		query := &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					JSON:      []byte(queryJson),
					TimeRange: timeRange,
					RefID:     "A",
				},
			},
			Headers: map[string]string{
				"FromAlert": "true",
			},
		}

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, false, models[0].ExemplarQuery)
	})

	t.Run("parsing query model with step", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, time.Second*30, models[0].Step)
	})

	t.Run("parsing query model without step parameter", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(1 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, time.Second*15, models[0].Step)
	})

	t.Run("parsing query model with high intervalFactor", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 10,
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, time.Minute*20, models[0].Step)
	})

	t.Run("parsing query model with low intervalFactor", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, time.Minute*2, models[0].Step)
	})

	t.Run("parsing query model specified scrape-interval in the data source", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "240s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, time.Minute*4, models[0].Step)
	})

	t.Run("parsing query model with $__interval variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__interval]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [2m]})", models[0].Expr)
	})

	t.Run("parsing query model with ${__interval} variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [${__interval}]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [2m]})", models[0].Expr)
	})

	t.Run("parsing query model with $__interval_ms variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__interval_ms]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [120000]})", models[0].Expr)
	})

	t.Run("parsing query model with $__interval_ms and $__interval variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__interval_ms]}) + rate(ALERTS{job=\"test\" [$__interval]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [120000]}) + rate(ALERTS{job=\"test\" [2m]})", models[0].Expr)
	})

	t.Run("parsing query model with ${__interval_ms} and ${__interval} variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [${__interval_ms}]}) + rate(ALERTS{job=\"test\" [${__interval}]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [120000]}) + rate(ALERTS{job=\"test\" [2m]})", models[0].Expr)
	})

	t.Run("parsing query model with $__range variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__range]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [172800s]})", models[0].Expr)
	})

	t.Run("parsing query model with $__range_s variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__range_s]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [172800]})", models[0].Expr)
	})

	t.Run("parsing query model with ${__range_s} variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [${__range_s}s]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [172800s]})", models[0].Expr)
	})

	t.Run("parsing query model with $__range_s variable below 0.5s", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(40 * time.Millisecond),
		}

		query := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__range_s]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [0]})", models[0].Expr)
	})

	t.Run("parsing query model with $__range_s variable between 1-0.5s", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(800 * time.Millisecond),
		}

		query := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__range_s]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [1]})", models[0].Expr)
	})

	t.Run("parsing query model with $__range_ms variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__range_ms]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [172800000]})", models[0].Expr)
	})

	t.Run("parsing query model with $__range_ms variable below 1s", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(20 * time.Millisecond),
		}

		query := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__range_ms]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [20]})", models[0].Expr)
	})

	t.Run("parsing query model with $__rate_interval variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(5 * time.Minute),
		}

		query := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__rate_interval]})",
			"format": "time_series",
			"intervalFactor": 1,
			"interval": "5m",
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [5m15s]})", models[0].Expr)
	})

	t.Run("parsing query model with $__rate_interval variable in expr and interval", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(5 * time.Minute),
		}

		query := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__rate_interval]})",
			"format": "time_series",
			"intervalFactor": 1,
			"interval": "$__rate_interval",
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [1m0s]})", models[0].Expr)
		require.Equal(t, 1*time.Minute, models[0].Step)
	})

	t.Run("parsing query model of range query", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A",
			"range": true
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, true, models[0].RangeQuery)
	})

	t.Run("parsing query model of range and instant query", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A",
			"range": true,
			"instant": true
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, true, models[0].RangeQuery)
		require.Equal(t, true, models[0].InstantQuery)
	})

	t.Run("parsing query model of with no query type", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange)

		service.TimeInterval = "15s"
		models, err := service.parseTimeSeriesQuery(query)
		require.NoError(t, err)
		require.Equal(t, true, models[0].RangeQuery)
	})
}

func TestPrometheus_parseTimeSeriesResponse(t *testing.T) {
	t.Run("exemplars response should be sampled and parsed normally", func(t *testing.T) {
		value := make(map[TimeSeriesQueryType]bufferedResponse)
		exemplars := []apiv1.ExemplarQueryResult{
			{
				SeriesLabels: p.LabelSet{
					"__name__": "tns_request_duration_seconds_bucket",
					"instance": "app:80",
					"job":      "tns/app",
				},
				Exemplars: []apiv1.Exemplar{
					{
						Labels:    p.LabelSet{"traceID": "test1"},
						Value:     0.003535405,
						Timestamp: p.TimeFromUnixNano(time.Now().Add(-2 * time.Minute).UnixNano()),
					},
					{
						Labels:    p.LabelSet{"traceID": "test2"},
						Value:     0.005555605,
						Timestamp: p.TimeFromUnixNano(time.Now().Add(-4 * time.Minute).UnixNano()),
					},
					{
						Labels:    p.LabelSet{"traceID": "test3"},
						Value:     0.007545445,
						Timestamp: p.TimeFromUnixNano(time.Now().Add(-6 * time.Minute).UnixNano()),
					},
					{
						Labels:    p.LabelSet{"traceID": "test4"},
						Value:     0.009545445,
						Timestamp: p.TimeFromUnixNano(time.Now().Add(-7 * time.Minute).UnixNano()),
					},
				},
			},
		}

		value[ExemplarQueryType] = bufferedResponse{
			Response: exemplars,
			Warnings: nil,
		}
		query := &PrometheusQuery{
			LegendFormat: "legend {{app}}",
		}
		res, err := parseTimeSeriesResponse(value, query)
		require.NoError(t, err)

		// Test fields
		require.Len(t, res, 1)
		require.Equal(t, res[0].Name, "exemplar")
		require.Equal(t, res[0].Fields[0].Name, "Time")
		require.Equal(t, res[0].Fields[1].Name, "Value")
		require.Len(t, res[0].Fields, 6)

		// Test correct values (sampled to 2)
		require.Equal(t, res[0].Fields[1].Len(), 2)
		require.Equal(t, res[0].Fields[1].At(0), 0.009545445)
		require.Equal(t, res[0].Fields[1].At(1), 0.003535405)
	})

	t.Run("exemplars response with inconsistent labels should marshal json ok", func(t *testing.T) {
		value := make(map[TimeSeriesQueryType]bufferedResponse)
		exemplars := []apiv1.ExemplarQueryResult{
			{
				SeriesLabels: p.LabelSet{
					"__name__": "tns_request_duration_seconds_bucket",
					"instance": "app:80",
					"service":  "example",
				},
				Exemplars: []apiv1.Exemplar{
					{
						Labels:    p.LabelSet{"traceID": "test1"},
						Value:     0.003535405,
						Timestamp: 1,
					},
				},
			},
			{
				SeriesLabels: p.LabelSet{
					"__name__":         "tns_request_duration_seconds_bucket",
					"instance":         "app:80",
					"service":          "example2",
					"additional_label": "foo",
				},
				Exemplars: []apiv1.Exemplar{
					{
						Labels:    p.LabelSet{"traceID": "test2", "userID": "test3"},
						Value:     0.003535405,
						Timestamp: 10,
					},
				},
			},
		}

		value[ExemplarQueryType] = bufferedResponse{
			Response: exemplars,
			Warnings: nil,
		}
		query := &PrometheusQuery{
			LegendFormat: "legend {{app}}",
		}
		res, err := parseTimeSeriesResponse(value, query)
		require.NoError(t, err)

		// Test frame marshal json no error.
		_, err = res[0].MarshalJSON()
		require.NoError(t, err)

		fields := []*data.Field{
			data.NewField("Time", map[string]string{}, []time.Time{time.UnixMilli(1), time.UnixMilli(10)}),
			data.NewField("Value", map[string]string{}, []float64{0.003535405, 0.003535405}),
			data.NewField("__name__", map[string]string{}, []string{"tns_request_duration_seconds_bucket", "tns_request_duration_seconds_bucket"}),
			data.NewField("additional_label", map[string]string{}, []string{"", "foo"}),
			data.NewField("instance", map[string]string{}, []string{"app:80", "app:80"}),
			data.NewField("service", map[string]string{}, []string{"example", "example2"}),
			data.NewField("traceID", map[string]string{}, []string{"test1", "test2"}),
			data.NewField("userID", map[string]string{}, []string{"", "test3"}),
		}

		newFrame := newDataFrame("exemplar", "exemplar", fields...)
		newFrame.Meta.Type = ""

		if diff := cmp.Diff(newFrame, res[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("matrix response should be parsed normally", func(t *testing.T) {
		values := []p.SamplePair{
			{Value: 1, Timestamp: 1000},
			{Value: 2, Timestamp: 2000},
			{Value: 3, Timestamp: 3000},
			{Value: 4, Timestamp: 4000},
			{Value: 5, Timestamp: 5000},
		}
		value := make(map[TimeSeriesQueryType]bufferedResponse)
		value[RangeQueryType] = bufferedResponse{
			Response: p.Matrix{
				&p.SampleStream{
					Metric: p.Metric{"app": "Application", "tag2": "tag2"},
					Values: values,
				},
			},
			Warnings: nil,
		}
		query := &PrometheusQuery{
			LegendFormat: "legend {{app}}",
			Step:         1 * time.Second,
			Start:        time.Unix(1, 0).UTC(),
			End:          time.Unix(5, 0).UTC(),
			UtcOffsetSec: 0,
		}
		res, err := parseTimeSeriesResponse(value, query)
		require.NoError(t, err)

		require.Len(t, res, 1)
		require.Equal(t, res[0].Name, "legend Application")
		require.Len(t, res[0].Fields, 2)
		require.Len(t, res[0].Fields[0].Labels, 0)
		require.Equal(t, res[0].Fields[0].Name, "Time")
		require.Len(t, res[0].Fields[1].Labels, 2)
		require.Equal(t, res[0].Fields[1].Labels.String(), "app=Application, tag2=tag2")
		require.Equal(t, res[0].Fields[1].Name, "Value")
		require.Equal(t, res[0].Fields[1].Config.DisplayNameFromDS, "legend Application")

		// Ensure the timestamps are UTC zoned
		testValue := res[0].Fields[0].At(0)
		require.Equal(t, "UTC", testValue.(time.Time).Location().String())
	})

	t.Run("matrix response with missed data points should be parsed correctly", func(t *testing.T) {
		values := []p.SamplePair{
			{Value: 1, Timestamp: 1000},
			{Value: 4, Timestamp: 4000},
		}
		value := make(map[TimeSeriesQueryType]bufferedResponse)
		value[RangeQueryType] = bufferedResponse{
			Response: p.Matrix{
				&p.SampleStream{
					Metric: p.Metric{"app": "Application", "tag2": "tag2"},
					Values: values,
				},
			},
			Warnings: nil,
		}
		query := &PrometheusQuery{
			LegendFormat: "",
			Step:         1 * time.Second,
			Start:        time.Unix(1, 0).UTC(),
			End:          time.Unix(4, 0).UTC(),
			UtcOffsetSec: 0,
		}
		res, err := parseTimeSeriesResponse(value, query)

		require.NoError(t, err)
		require.Len(t, res, 1)
		require.Equal(t, res[0].Fields[0].Len(), 2)
		require.Equal(t, time.Unix(1, 0).UTC(), res[0].Fields[0].At(0))
		require.Equal(t, time.Unix(4, 0).UTC(), res[0].Fields[0].At(1))
		require.Equal(t, res[0].Fields[1].Len(), 2)
		require.Equal(t, float64(1), res[0].Fields[1].At(0).(float64))
		require.Equal(t, float64(4), res[0].Fields[1].At(1).(float64))
	})

	t.Run("matrix response with from alerting missed data points should be parsed correctly", func(t *testing.T) {
		values := []p.SamplePair{
			{Value: 1, Timestamp: 1000},
			{Value: 4, Timestamp: 4000},
		}
		value := make(map[TimeSeriesQueryType]bufferedResponse)
		value[RangeQueryType] = bufferedResponse{
			Response: p.Matrix{
				&p.SampleStream{
					Metric: p.Metric{"app": "Application", "tag2": "tag2"},
					Values: values,
				},
			},
			Warnings: nil,
		}
		query := &PrometheusQuery{
			LegendFormat: "",
			Step:         1 * time.Second,
			Start:        time.Unix(1, 0).UTC(),
			End:          time.Unix(4, 0).UTC(),
			UtcOffsetSec: 0,
		}
		res, err := parseTimeSeriesResponse(value, query)

		require.NoError(t, err)
		require.Len(t, res, 1)
		require.Equal(t, res[0].Name, "{app=\"Application\", tag2=\"tag2\"}")
		require.Len(t, res[0].Fields, 2)
		require.Len(t, res[0].Fields[0].Labels, 0)
		require.Equal(t, res[0].Fields[0].Name, "Time")
		require.Len(t, res[0].Fields[1].Labels, 2)
		require.Equal(t, res[0].Fields[1].Labels.String(), "app=Application, tag2=tag2")
		require.Equal(t, res[0].Fields[1].Name, "Value")
		require.Equal(t, res[0].Fields[1].Config.DisplayNameFromDS, "{app=\"Application\", tag2=\"tag2\"}")
	})

	t.Run("matrix response with NaN value should be changed to null", func(t *testing.T) {
		value := make(map[TimeSeriesQueryType]bufferedResponse)
		value[RangeQueryType] = bufferedResponse{
			Response: p.Matrix{
				&p.SampleStream{
					Metric: p.Metric{"app": "Application"},
					Values: []p.SamplePair{
						{Value: p.SampleValue(math.NaN()), Timestamp: 1000},
					},
				},
			},
			Warnings: nil,
		}
		query := &PrometheusQuery{
			LegendFormat: "",
			Step:         1 * time.Second,
			Start:        time.Unix(1, 0).UTC(),
			End:          time.Unix(4, 0).UTC(),
			UtcOffsetSec: 0,
		}
		res, err := parseTimeSeriesResponse(value, query)
		require.NoError(t, err)

		require.Equal(t, "Value", res[0].Fields[1].Name)
		require.True(t, math.IsNaN(res[0].Fields[1].At(0).(float64)))
	})

	t.Run("vector response should be parsed normally", func(t *testing.T) {
		value := make(map[TimeSeriesQueryType]bufferedResponse)
		value[RangeQueryType] = bufferedResponse{
			Response: p.Vector{
				&p.Sample{
					Metric:    p.Metric{"app": "Application", "tag2": "tag2"},
					Value:     1,
					Timestamp: 123,
				},
			},
			Warnings: nil,
		}
		query := &PrometheusQuery{
			LegendFormat: "legend {{app}}",
		}
		res, err := parseTimeSeriesResponse(value, query)
		require.NoError(t, err)

		require.Len(t, res, 1)
		require.Equal(t, res[0].Name, "legend Application")
		require.Len(t, res[0].Fields, 2)
		require.Len(t, res[0].Fields[0].Labels, 0)
		require.Equal(t, res[0].Fields[0].Name, "Time")
		require.Equal(t, res[0].Fields[0].Name, "Time")
		require.Len(t, res[0].Fields[1].Labels, 2)
		require.Equal(t, res[0].Fields[1].Labels.String(), "app=Application, tag2=tag2")
		require.Equal(t, res[0].Fields[1].Name, "Value")
		require.Equal(t, res[0].Fields[1].Config.DisplayNameFromDS, "legend Application")

		// Ensure the timestamps are UTC zoned
		testValue := res[0].Fields[0].At(0)
		require.Equal(t, "UTC", testValue.(time.Time).Location().String())
		require.Equal(t, int64(123), testValue.(time.Time).UnixMilli())
	})

	t.Run("scalar response should be parsed normally", func(t *testing.T) {
		value := make(map[TimeSeriesQueryType]bufferedResponse)
		value[RangeQueryType] = bufferedResponse{
			Response: &p.Scalar{
				Value:     1,
				Timestamp: 123,
			},
			Warnings: nil,
		}

		query := &PrometheusQuery{}
		res, err := parseTimeSeriesResponse(value, query)
		require.NoError(t, err)

		require.Len(t, res, 1)
		require.Equal(t, res[0].Name, "1")
		require.Len(t, res[0].Fields, 2)
		require.Len(t, res[0].Fields[0].Labels, 0)
		require.Equal(t, res[0].Fields[0].Name, "Time")
		require.Equal(t, res[0].Fields[1].Name, "Value")
		require.Equal(t, res[0].Fields[1].Config.DisplayNameFromDS, "1")

		// Ensure the timestamps are UTC zoned
		testValue := res[0].Fields[0].At(0)
		require.Equal(t, "UTC", testValue.(time.Time).Location().String())
		require.Equal(t, int64(123), testValue.(time.Time).UnixMilli())
	})

	t.Run("warnings, if there is any, should be added to each frame",
		func(t *testing.T) {
			value := make(map[TimeSeriesQueryType]bufferedResponse)
			value[RangeQueryType] = bufferedResponse{
				Response: &p.Scalar{
					Value:     1,
					Timestamp: 123,
				},
				Warnings: []string{"warning1", "warning2"},
			}

			query := &PrometheusQuery{}
			res, err := parseTimeSeriesResponse(value, query)
			require.NoError(t, err)

			require.Len(t, res, 1)
			require.Equal(t, res[0].Name, "1")
			require.Len(t, res[0].Fields, 2)
			require.Len(t, res[0].Fields[0].Labels, 0)
			require.Equal(t, res[0].Fields[0].Name, "Time")
			require.Equal(t, res[0].Fields[1].Name, "Value")
			require.Equal(t, res[0].Fields[1].Config.DisplayNameFromDS, "1")

			require.Equal(t, res[0].Meta.Notices[0].Text, "warning1")
			require.Equal(t, res[0].Meta.Notices[1].Text, "warning2")
		})
}

func queryContext(json string, timeRange backend.TimeRange) *backend.QueryDataRequest {
	return &backend.QueryDataRequest{
		Queries: []backend.DataQuery{
			{
				JSON:      []byte(json),
				TimeRange: timeRange,
				RefID:     "A",
			},
		},
	}
}
