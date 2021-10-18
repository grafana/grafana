package prometheus

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	p "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

var now = time.Now()

func TestPrometheus_formatLeged(t *testing.T) {
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
}

func TestPrometheus_parseQuery(t *testing.T) {
	service := Service{
		intervalCalculator: intervalv2.NewCalculator(),
	}

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

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(query, dsInfo)
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

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(query, dsInfo)
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

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(query, dsInfo)
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

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(query, dsInfo)
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

		dsInfo := &DatasourceInfo{
			TimeInterval: "240s",
		}
		models, err := service.parseQuery(query, dsInfo)
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

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(query, dsInfo)
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

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(query, dsInfo)
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

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(query, dsInfo)
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

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(query, dsInfo)
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

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(query, dsInfo)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [172800]})", models[0].Expr)
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

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(query, dsInfo)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [172800000]})", models[0].Expr)
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
			"refId": "A"
		}`, timeRange)

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(query, dsInfo)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [1m]})", models[0].Expr)
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

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(query, dsInfo)
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

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(query, dsInfo)
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

		dsInfo := &DatasourceInfo{}
		models, err := service.parseQuery(query, dsInfo)
		require.NoError(t, err)
		require.Equal(t, true, models[0].RangeQuery)
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
