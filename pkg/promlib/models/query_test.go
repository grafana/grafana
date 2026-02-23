package models_test

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	sdkapi "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/schemabuilder"
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

	t.Run("parsing query model with step", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(12 * time.Hour),
		}

		q := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"refId": "A"
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, time.Second*30, res.Step)
	})

	t.Run("parsing query model without step parameter", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(1 * time.Hour),
		}

		q := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, time.Second*15, res.Step)
	})

	t.Run("parsing query model with high intervalFactor", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: now,
			To:   now.Add(48 * time.Hour),
		}

		q := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 10,
			"refId": "A"
		}`, timeRange, time.Duration(1)*time.Minute)

		res, err := models.Parse(context.Background(), log.New(), span, q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, time.Minute*20, res.Step)
	})

	t.Run("parsing query model with low intervalFactor", func(t *testing.T) {
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
		require.Equal(t, time.Minute*2, res.Step)
	})

	t.Run("parsing query model specified scrape-interval in the data source", func(t *testing.T) {
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

		res, err := models.Parse(context.Background(), log.New(), span, q, "240s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, time.Minute*4, res.Step)
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
		require.Equal(t, "rate(ALERTS{job=\"test\" [2m]})", res.Expr)
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

func TestRateInterval(t *testing.T) {
	_, span := tracer.Start(context.Background(), "operation")
	defer span.End()
	type args struct {
		expr             string
		interval         string
		intervalMs       int64
		dsScrapeInterval string
		timeRange        *backend.TimeRange
	}
	tests := []struct {
		name string
		args args
		want *models.Query
	}{
		{
			name: "intervalMs 100s, minStep override 150s and scrape interval 30s",
			args: args{
				expr:             "rate(rpc_durations_seconds_count[$__rate_interval])",
				interval:         "150s",
				intervalMs:       100000,
				dsScrapeInterval: "30s",
			},
			want: &models.Query{
				Expr: "rate(rpc_durations_seconds_count[10m0s])",
				Step: time.Second * 150,
			},
		},
		{
			name: "intervalMs 120s, minStep override 150s and ds scrape interval 30s",
			args: args{
				expr:             "rate(rpc_durations_seconds_count[$__rate_interval])",
				interval:         "150s",
				intervalMs:       120000,
				dsScrapeInterval: "30s",
			},
			want: &models.Query{
				Expr: "rate(rpc_durations_seconds_count[10m0s])",
				Step: time.Second * 150,
			},
		},
		{
			name: "intervalMs 120s, minStep auto (interval not overridden) and ds scrape interval 30s",
			args: args{
				expr:             "rate(rpc_durations_seconds_count[$__rate_interval])",
				interval:         "120s",
				intervalMs:       120000,
				dsScrapeInterval: "30s",
			},
			want: &models.Query{
				Expr: "rate(rpc_durations_seconds_count[8m0s])",
				Step: time.Second * 120,
			},
		},
		{
			name: "interval and minStep are automatically calculated and ds scrape interval 30s and time range 1 hour",
			args: args{
				expr:             "rate(rpc_durations_seconds_count[$__rate_interval])",
				interval:         "30s",
				intervalMs:       30000,
				dsScrapeInterval: "30s",
				timeRange: &backend.TimeRange{
					From: now,
					To:   now.Add(1 * time.Hour),
				},
			},
			want: &models.Query{
				Expr: "rate(rpc_durations_seconds_count[2m0s])",
				Step: time.Second * 30,
			},
		},
		{
			name: "minStep is $__rate_interval and ds scrape interval 30s and time range 1 hour",
			args: args{
				expr:             "rate(rpc_durations_seconds_count[$__rate_interval])",
				interval:         "$__rate_interval",
				intervalMs:       30000,
				dsScrapeInterval: "30s",
				timeRange: &backend.TimeRange{
					From: now,
					To:   now.Add(1 * time.Hour),
				},
			},
			want: &models.Query{
				Expr: "rate(rpc_durations_seconds_count[2m0s])",
				Step: time.Minute * 2,
			},
		},
		{
			name: "minStep is $__rate_interval and ds scrape interval 30s and time range 2 days",
			args: args{
				expr:             "rate(rpc_durations_seconds_count[$__rate_interval])",
				interval:         "$__rate_interval",
				intervalMs:       120000,
				dsScrapeInterval: "30s",
				timeRange: &backend.TimeRange{
					From: now,
					To:   now.Add(2 * 24 * time.Hour),
				},
			},
			want: &models.Query{
				Expr: "rate(rpc_durations_seconds_count[2m30s])",
				Step: time.Second * 150,
			},
		},
		{
			name: "minStep is $__rate_interval and ds scrape interval 15s and time range 2 days",
			args: args{
				expr:             "rate(rpc_durations_seconds_count[$__rate_interval])",
				interval:         "$__interval",
				intervalMs:       120000,
				dsScrapeInterval: "15s",
				timeRange: &backend.TimeRange{
					From: now,
					To:   now.Add(2 * 24 * time.Hour),
				},
			},
			want: &models.Query{
				Expr: "rate(rpc_durations_seconds_count[8m0s])",
				Step: time.Second * 120,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := mockQuery(tt.args.expr, tt.args.interval, tt.args.intervalMs, tt.args.timeRange)
			q.MaxDataPoints = 12384
			res, err := models.Parse(context.Background(), log.New(), span, q, tt.args.dsScrapeInterval, intervalCalculator, false)
			require.NoError(t, err)
			require.Equal(t, tt.want.Expr, res.Expr)
			require.Equal(t, tt.want.Step, res.Step)
		})
	}

	t.Run("minStep is auto and ds scrape interval 30s and time range 1 hour", func(t *testing.T) {
		query := backend.DataQuery{
			RefID:         "G",
			QueryType:     "",
			MaxDataPoints: 1613,
			Interval:      30 * time.Second,
			TimeRange: backend.TimeRange{
				From: now,
				To:   now.Add(1 * time.Hour),
			},
			JSON: []byte(`{
			"datasource":{"type":"prometheus","uid":"zxS5e5W4k"},
			"datasourceId":38,
			"editorMode":"code",
			"exemplar":false,
			"expr":"sum(rate(process_cpu_seconds_total[$__rate_interval]))",
			"instant":false,
			"interval":"",
			"intervalMs":30000,
			"key":"Q-f96b6729-c47a-4ea8-8f71-a79774cf9bd5-0",
			"legendFormat":"__auto",
			"maxDataPoints":1613,
			"range":true,
			"refId":"G",
			"requestId":"1G",
			"utcOffsetSec":3600
		}`),
		}
		res, err := models.Parse(context.Background(), log.New(), span, query, "30s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "sum(rate(process_cpu_seconds_total[2m0s]))", res.Expr)
		require.Equal(t, 30*time.Second, res.Step)
	})

	t.Run("minStep is auto and ds scrape interval 15s and time range 5 minutes", func(t *testing.T) {
		query := backend.DataQuery{
			RefID:         "A",
			QueryType:     "",
			MaxDataPoints: 1055,
			Interval:      15 * time.Second,
			TimeRange: backend.TimeRange{
				From: now,
				To:   now.Add(5 * time.Minute),
			},
			JSON: []byte(`{
			"datasource": {
		        "type": "prometheus",
		        "uid": "2z9d6ElGk"
		    },
		    "editorMode": "code",
		    "expr": "sum(rate(cache_requests_total[$__rate_interval]))",
		    "legendFormat": "__auto",
		    "range": true,
		    "refId": "A",
		    "exemplar": false,
		    "requestId": "1A",
		    "utcOffsetSec": 0,
		    "interval": "",
		    "datasourceId": 508,
		    "intervalMs": 15000,
		    "maxDataPoints": 1055
		}`),
		}
		res, err := models.Parse(context.Background(), log.New(), span, query, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "sum(rate(cache_requests_total[1m0s]))", res.Expr)
		require.Equal(t, 15*time.Second, res.Step)
	})
}

func mockQuery(expr string, interval string, intervalMs int64, timeRange *backend.TimeRange) backend.DataQuery {
	if timeRange == nil {
		timeRange = &backend.TimeRange{
			From: now,
			To:   now.Add(1 * time.Hour),
		}
	}
	return backend.DataQuery{
		Interval: time.Duration(intervalMs) * time.Millisecond,
		JSON: []byte(fmt.Sprintf(`{
			"expr": "%s",
			"format": "time_series",
			"interval": "%s",
			"intervalMs": %v,
			"intervalFactor": 1,
			"refId": "A"
		}`, expr, interval, intervalMs)),
		TimeRange: *timeRange,
		RefID:     "A",
	}
}

func queryContext(json string, timeRange backend.TimeRange, queryInterval time.Duration) backend.DataQuery {
	return backend.DataQuery{
		Interval:  queryInterval,
		JSON:      []byte(json),
		TimeRange: timeRange,
		RefID:     "A",
	}
}

// AlignTimeRange aligns query range to step and handles the time offset.
// It rounds start and end down to a multiple of step.
// Prometheus caching is dependent on the range being aligned with the step.
// Rounding to the step can significantly change the start and end of the range for larger steps, i.e. a week.
// In rounding the range to a 1w step the range will always start on a Thursday.
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

func TestPromQueryFormatUnmarshalJSON(t *testing.T) {
	t.Run("valid string format values", func(t *testing.T) {
		tests := []struct {
			name     string
			json     string
			expected models.PromQueryFormat
		}{
			{
				name:     "time_series format",
				json:     `{"format": "time_series"}`,
				expected: models.PromQueryFormatTimeSeries,
			},
			{
				name:     "table format",
				json:     `{"format": "table"}`,
				expected: models.PromQueryFormatTable,
			},
			{
				name:     "heatmap format",
				json:     `{"format": "heatmap"}`,
				expected: models.PromQueryFormatHeatmap,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				var props models.PrometheusQueryProperties
				err := json.Unmarshal([]byte(tt.json), &props)
				require.NoError(t, err)
				require.Equal(t, tt.expected, props.Format)
			})
		}
	})

	t.Run("invalid string format values default to time_series", func(t *testing.T) {
		tests := []struct {
			name string
			json string
		}{
			{
				name: "unknown format string",
				json: `{"format": "invalid_format"}`,
			},
			{
				name: "empty string",
				json: `{"format": ""}`,
			},
			{
				name: "random string",
				json: `{"format": "foobar"}`,
			},
			{
				name: "typo in format",
				json: `{"format": "time_serie"}`,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				var props models.PrometheusQueryProperties
				err := json.Unmarshal([]byte(tt.json), &props)
				require.NoError(t, err)
				require.Equal(t, models.PromQueryFormatTimeSeries, props.Format, "invalid format should default to time_series")
			})
		}
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
