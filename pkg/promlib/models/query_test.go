package models_test

import (
	"context"
	"reflect"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkapi "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/schemabuilder"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/grafana/grafana/pkg/promlib/intervalv2"
	"github.com/grafana/grafana/pkg/promlib/models"
)

var (
	now                = time.Now()
	intervalCalculator = intervalv2.NewCalculator()
	tracer             = otel.Tracer("instrumentation/package/name")
)

func TestParse(t *testing.T) {
	_, span := tracer.Start(context.Background(), "operation")
	defer span.End()
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

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, true)
		require.NoError(t, err)
		require.Equal(t, false, res.ExemplarQuery)
	})

	t.Run("parsing query model with $__interval variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		q := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__interval]})",
			"format": "time_series",
			"intervalFactor": 1,
			"intervalMs": 60000,
			"refId": "A"
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [2m]})", res.Expr)
		require.Equal(t, 120*time.Second, res.Step)
	})

	t.Run("parsing query model with ${__interval} variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		q := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [${__interval}]})",
			"format": "time_series",
			"intervalFactor": 1,
			"interval": "1m",
			"intervalMs": 60000,
			"refId": "A"
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [1m]})", res.Expr)
	})

	t.Run("parsing query model with $__interval_ms variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		q := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__interval_ms]})",
			"format": "time_series",
			"intervalFactor": 1,
			"intervalMs": 60000,
			"refId": "A"
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [120000]})", res.Expr)
	})

	t.Run("parsing query model with $__interval_ms and $__interval variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		q := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__interval_ms]}) + rate(ALERTS{job=\"test\" [$__interval]})",
			"format": "time_series",
			"intervalFactor": 1,
			"intervalMs": 60000,
			"refId": "A"
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [120000]}) + rate(ALERTS{job=\"test\" [2m]})", res.Expr)
	})

	t.Run("parsing query model with ${__interval_ms} and ${__interval} variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		q := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [${__interval_ms}]}) + rate(ALERTS{job=\"test\" [${__interval}]})",
			"format": "time_series",
			"intervalFactor": 1,
			"intervalMs": 60000,
			"refId": "A"
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [120000]}) + rate(ALERTS{job=\"test\" [2m]})", res.Expr)
	})

	t.Run("parsing query model with $__range variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		q := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__range]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [172800s]})", res.Expr)
	})

	t.Run("parsing query model with $__range_s variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		q := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__range_s]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [172800]})", res.Expr)
	})

	t.Run("parsing query model with ${__range_s} variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		q := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [${__range_s}s]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [172800s]})", res.Expr)
	})

	t.Run("parsing query model with $__range_s variable below 0.5s", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(40 * time.Millisecond),
		}

		q := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__range_s]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [0]})", res.Expr)
	})

	t.Run("parsing query model with $__range_s variable between 1-0.5s", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(800 * time.Millisecond),
		}

		q := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__range_s]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [1]})", res.Expr)
	})

	t.Run("parsing query model with $__range_ms variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		q := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__range_ms]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [172800000]})", res.Expr)
	})

	t.Run("parsing query model with $__range_ms variable below 1s", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(20 * time.Millisecond),
		}

		q := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__range_ms]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [20]})", res.Expr)
	})

	t.Run("parsing query model with $__rate_interval variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(5 * time.Minute),
		}

		q := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__rate_interval]})",
			"format": "time_series",
			"intervalFactor": 1,
			"interval": "5m",
			"refId": "A"
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [20m0s]})", res.Expr)
	})

	t.Run("parsing query model with $__rate_interval variable in expr and interval", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(5 * time.Minute),
		}

		q := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__rate_interval]})",
			"format": "time_series",
			"intervalFactor": 1,
			"interval": "$__rate_interval",
			"refId": "A"
		}`, timeRange, 1*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [1m0s]})", res.Expr)
		require.Equal(t, 1*time.Minute, res.Step)
	})

	t.Run("parsing query model with $__rate_interval_ms variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		q := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__rate_interval_ms]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange, 2*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [135000]})", res.Expr)
	})

	t.Run("parsing query model with $__rate_interval_ms and $__rate_interval variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		q := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [$__rate_interval_ms]}) + rate(ALERTS{job=\"test\" [$__rate_interval]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange, 2*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [135000]}) + rate(ALERTS{job=\"test\" [2m15s]})", res.Expr)
	})

	t.Run("parsing query model with legacy datasource reference", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		// query with legacy datasource reference
		q := queryContext(`{
			"datasource": "hello",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange, 2*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "A", res.RefId)
	})

	t.Run("parsing query model with ${__rate_interval_ms} and ${__rate_interval} variable", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		q := queryContext(`{
			"expr": "rate(ALERTS{job=\"test\" [${__rate_interval_ms}]}) + rate(ALERTS{job=\"test\" [${__rate_interval}]})",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange, 2*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [135000]}) + rate(ALERTS{job=\"test\" [2m15s]})", res.Expr)
	})

	t.Run("parsing query model of range query", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		q := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A",
			"range": true
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, true, res.RangeQuery)
	})

	t.Run("parsing query model of range and instant query", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		q := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A",
			"range": true,
			"instant": true
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, true, res.RangeQuery)
		require.Equal(t, true, res.InstantQuery)
	})

	t.Run("parsing query model of with no query type", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		q := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, true, res.RangeQuery)
	})
}

func queryContext(json string, timeRange backend.TimeRange, queryInterval time.Duration) backend.DataQuery {
	return backend.DataQuery{
		Interval:  queryInterval,
		JSON:      []byte(json),
		TimeRange: timeRange,
		RefID:     "A",
	}
}

func TestAlignTimeRange(t *testing.T) {
	type args struct {
		t      time.Time
		step   time.Duration
		offset int64
	}

	var monday int64 = 1704672000
	var thursday int64 = 1704326400
	var one_week_min_step = 604800 * time.Second

	tests := []struct {
		name string
		args args
		want time.Time
	}{
		{
			name: "second step",
			args: args{t: time.Unix(1664816826, 0), step: 10 * time.Second, offset: 0},
			want: time.Unix(1664816820, 0).UTC(),
		},
		{name: "millisecond step", args: args{t: time.Unix(1664816825, 5*int64(time.Millisecond)), step: 10 * time.Millisecond, offset: 0}, want: time.Unix(1664816825, 0).UTC()},
		{name: "second step with offset", args: args{t: time.Unix(1664816825, 5*int64(time.Millisecond)), step: 2 * time.Second, offset: -3}, want: time.Unix(1664816825, 0).UTC()},
		// we may not want this functionality in the future but if we change this we break Prometheus caching.
		{
			name: "1w step with range date of Monday that changes the range to a Thursday.",
			args: args{t: time.Unix(monday, 0), step: one_week_min_step, offset: 0},
			want: time.Unix(thursday, 0).UTC(),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := models.AlignTimeRange(tt.args.t, tt.args.step, tt.args.offset); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("AlignTimeRange() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestParseWithAdhocFilters(t *testing.T) {
	_, span := tracer.Start(context.Background(), "operation")
	defer span.End()

	t.Run("parsing query with adhoc filters", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		queryJson := `{
			"expr": "http_requests_total",
			"refId": "A",
			"adhocFilters": [
				{
					"key": "job",
					"value": "prometheus", 
					"operator": "equals"
				},
				{
					"key": "method",
					"value": "get",
					"operator": "equals"
				}
			]
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, `http_requests_total{job="prometheus",method="get"}`, res.Expr)
	})

	t.Run("parsing query with adhoc filters using not-equals operator", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		queryJson := `{
			"expr": "http_requests_total{job=\"grafana\"}",
			"refId": "A",
			"adhocFilters": [
				{
					"key": "status", 
					"value": "500",
					"operator": "not-equals"
				}
			]
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, `http_requests_total{job="grafana",status!="500"}`, res.Expr)
	})

	t.Run("parsing query with adhoc filters using one-of operator", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		queryJson := `{
			"expr": "http_requests_total", 
			"refId": "A",
			"adhocFilters": [
				{
					"key": "status",
					"values": ["200", "201", "202"],
					"operator": "one-of"
				}
			]
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, `http_requests_total{status=~"200|201|202"}`, res.Expr)
	})

	t.Run("parsing complex query with adhoc filters", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		queryJson := `{
			"expr": "rate(http_requests_total{job=\"prometheus\"}[5m]) + rate(http_errors_total{job=\"grafana\"}[5m])",
			"refId": "A", 
			"adhocFilters": [
				{
					"key": "environment",
					"value": "production",
					"operator": "equals"
				}
			]
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, `rate(http_requests_total{environment="production",job="prometheus"}[5m]) + rate(http_errors_total{environment="production",job="grafana"}[5m])`, res.Expr)
	})
}

func TestParseWithScopes(t *testing.T) {
	_, span := tracer.Start(context.Background(), "operation")
	defer span.End()

	t.Run("parsing query with scope filters", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		queryJson := `{
			"expr": "http_requests_total",
			"refId": "A",
			"scopes": [
				{
					"name": "production-scope",
					"title": "Production Environment",
					"filters": [
						{
							"key": "environment",
							"value": "production",
							"operator": "equals"
						},
						{
							"key": "region", 
							"value": "us-west-2",
							"operator": "equals"
						}
					]
				}
			]
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, `http_requests_total{environment="production",region="us-west-2"}`, res.Expr)
	})

	t.Run("parsing query with multiple scopes having same filter key", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		queryJson := `{
			"expr": "http_requests_total",
			"refId": "A", 
			"scopes": [
				{
					"name": "namespace-scope-1", 
					"title": "Default Namespace",
					"filters": [
						{
							"key": "namespace",
							"value": "default",
							"operator": "equals"
						}
					]
				},
				{
					"name": "namespace-scope-2",
					"title": "Kube System Namespace", 
					"filters": [
						{
							"key": "namespace",
							"value": "kube-system", 
							"operator": "equals"
						}
					]
				}
			]
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, `http_requests_total{namespace=~"default|kube-system"}`, res.Expr)
	})
}

func TestParseWithScopesAndAdhocFilters(t *testing.T) {
	_, span := tracer.Start(context.Background(), "operation")
	defer span.End()

	t.Run("parsing query with both scopes and adhoc filters", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		queryJson := `{
			"expr": "http_requests_total",
			"refId": "A",
			"scopes": [
				{
					"name": "production-scope",
					"title": "Production Environment", 
					"filters": [
						{
							"key": "environment",
							"value": "production",
							"operator": "equals"
						}
					]
				}
			],
			"adhocFilters": [
				{
					"key": "job",
					"value": "prometheus",
					"operator": "equals"
				}
			]
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, `http_requests_total{environment="production",job="prometheus"}`, res.Expr)
	})

	t.Run("adhoc filters override scope filters on conflict", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		queryJson := `{
			"expr": "http_requests_total",
			"refId": "A",
			"scopes": [
				{
					"name": "staging-scope",
					"title": "Staging Environment",
					"filters": [
						{
							"key": "environment", 
							"value": "staging",
							"operator": "equals"
						}
					]
				}
			],
			"adhocFilters": [
				{
					"key": "environment",
					"value": "production",
					"operator": "equals"
				}
			]
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, `http_requests_total{environment="production"}`, res.Expr)
	})
}

func TestParseWithGroupByKeys(t *testing.T) {
	_, span := tracer.Start(context.Background(), "operation")
	defer span.End()

	t.Run("parsing query with group by keys", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		queryJson := `{
			"expr": "sum(http_requests_total)", 
			"refId": "A",
			"groupByKeys": ["job", "instance"]
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, `sum by (job, instance) (http_requests_total)`, res.Expr)
	})

	t.Run("parsing query with group by keys and existing group by", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		queryJson := `{
			"expr": "sum by (job) (http_requests_total)",
			"refId": "A",
			"groupByKeys": ["status"]
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, `sum by (job, status) (http_requests_total)`, res.Expr)
	})

	t.Run("parsing query with filters and group by keys", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		queryJson := `{
			"expr": "sum(http_requests_total)",
			"refId": "A",
			"adhocFilters": [
				{
					"key": "job",
					"value": "prometheus", 
					"operator": "equals"
				}
			],
			"groupByKeys": ["status", "method"]
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, `sum by (status, method) (http_requests_total{job="prometheus"})`, res.Expr)
	})
}

func TestParseComplexScenariosWithFilters(t *testing.T) {
	_, span := tracer.Start(context.Background(), "operation")
	defer span.End()

	t.Run("parsing query with regex filters and variables", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		queryJson := `{
			"expr": "rate(http_requests_total[$__interval])",
			"refId": "A",
			"intervalMs": 60000,
			"adhocFilters": [
				{
					"key": "job",
					"value": "prometheus.*",
					"operator": "regex-match" 
				}
			]
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
			Interval:  time.Minute,
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, `rate(http_requests_total{job=~"prometheus.*"}[2m])`, res.Expr)
	})

	t.Run("parsing query with complex expression, scopes, adhoc filters, and group by", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		queryJson := `{
			"expr": "sum(rate(http_requests_total[5m])) / sum(rate(http_requests_total[5m])) * 100",
			"refId": "A",
			"scopes": [
				{
					"name": "production-scope",
					"title": "Production Environment",
					"filters": [
						{
							"key": "environment",
							"value": "production", 
							"operator": "equals"
						}
					]
				}
			],
			"adhocFilters": [
				{
					"key": "region",
					"values": ["us-west-1", "us-west-2", "us-east-1"],
					"operator": "one-of"
				}
			],
			"groupByKeys": ["job"]
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, `sum by (job) (rate(http_requests_total{environment="production",region=~"us-west-1|us-west-2|us-east-1"}[5m])) / sum by (job) (rate(http_requests_total{environment="production",region=~"us-west-1|us-west-2|us-east-1"}[5m])) * 100`, res.Expr)
	})

	t.Run("parsing query with __name__ selector and filters", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		queryJson := `{
			"expr": "{__name__=\"http_requests_total\"}",
			"refId": "A", 
			"adhocFilters": [
				{
					"key": "namespace",
					"value": "monitoring",
					"operator": "equals"
				}
			]
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, `{__name__="http_requests_total",namespace="monitoring"}`, res.Expr)
	})
}

func TestParseNumericFormatError(t *testing.T) {
	_, span := tracer.Start(context.Background(), "operation")
	defer span.End()

	timeRange := backend.TimeRange{
		From: now,
		To:   now.Add(12 * time.Hour),
	}

	t.Run("format as number 0 should be handled gracefully", func(t *testing.T) {
		queryJson := `{
			"expr": "up",
			"format": 0,
			"refId": "A"
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.NotNil(t, res)
		require.Equal(t, "up", res.Expr)
	})

	t.Run("format as number 1 should default to time_series", func(t *testing.T) {
		queryJson := `{
			"expr": "up",
			"format": 1,
			"refId": "A"
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.NotNil(t, res)
	})

	t.Run("format as number 2 should map to table", func(t *testing.T) {
		queryJson := `{
			"expr": "up",
			"format": 2,
			"refId": "A"
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.NotNil(t, res)
	})

	t.Run("format as number 3 should map to heatmap", func(t *testing.T) {
		queryJson := `{
			"expr": "up",
			"format": 3,
			"refId": "A"
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.NotNil(t, res)
	})

	t.Run("format as unknown number should default to time_series", func(t *testing.T) {
		queryJson := `{
			"expr": "up",
			"format": 999,
			"refId": "A"
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.NotNil(t, res)
	})

	t.Run("format as float should be handled gracefully", func(t *testing.T) {
		queryJson := `{
			"expr": "up",
			"format": 1.5,
			"refId": "A"
		}`

		q := backend.DataQuery{
			JSON:      []byte(queryJson),
			TimeRange: timeRange,
			RefID:     "A",
		}

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.NotNil(t, res)
	})
}

func TestQueryTypeDefinitions(t *testing.T) {
	builder, err := schemabuilder.NewSchemaBuilder(
		schemabuilder.BuilderOptions{
			PluginID: []string{"prometheus"},
			ScanCode: []schemabuilder.CodePaths{{
				BasePackage: "github.com/grafana/grafana/pkg/promlib/models",
				CodePath:    "./",
			}},
			Enums: []reflect.Type{
				reflect.TypeOf(models.PromQueryFormatTimeSeries), // pick an example value (not the root)
				reflect.TypeOf(models.QueryEditorModeBuilder),
			},
		})
	require.NoError(t, err)
	err = builder.AddQueries(
		schemabuilder.QueryTypeInfo{
			Name:   "default",
			GoType: reflect.TypeOf(&models.PrometheusQueryProperties{}),
			Examples: []sdkapi.QueryExample{
				{
					Name: "simple health check",
					SaveModel: sdkapi.AsUnstructured(
						models.PrometheusQueryProperties{
							Expr: "1+1",
						},
					),
				},
			},
		},
	)

	require.NoError(t, err)
	builder.UpdateQueryDefinition(t, "./")
}
