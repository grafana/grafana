package models_test

import (
	"context"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkapi "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/schemabuilder"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/promlib/intervalv2"
	"github.com/grafana/grafana/pkg/promlib/models"
)

var (
	now                = time.Now()
	intervalCalculator = intervalv2.NewCalculator()
	tracer             = otel.Tracer("instrumentation/package/name")
)

func TestDDInterval(t *testing.T) {
	testCases := []struct {
		timeRange        time.Duration
		expectedInterval time.Duration
	}{
		{
			timeRange:        30 * time.Minute,
			expectedInterval: 20 * time.Second,
		},
		{
			timeRange:        time.Hour,
			expectedInterval: 20 * time.Second,
		},
		{
			timeRange:        75 * time.Minute,
			expectedInterval: 20 * time.Second,
		},
		{
			timeRange:        2 * time.Hour,
			expectedInterval: 30 * time.Second,
		},
		{
			timeRange:        2*time.Hour + 30*time.Minute,
			expectedInterval: 30 * time.Second,
		},
		{
			timeRange:        3 * time.Hour,
			expectedInterval: time.Minute,
		},
		{
			timeRange:        5 * time.Hour,
			expectedInterval: time.Minute,
		},
		{
			timeRange:        8 * time.Hour,
			expectedInterval: 2 * time.Minute,
		},
		{
			timeRange:        12 * time.Hour,
			expectedInterval: 2 * time.Minute,
		},
		{
			timeRange:        12*time.Hour + 30*time.Minute,
			expectedInterval: 2 * time.Minute,
		},
		{
			timeRange:        24 * time.Hour,
			expectedInterval: 5 * time.Minute,
		},
		{
			timeRange:        25 * time.Hour,
			expectedInterval: 5 * time.Minute,
		},
		{
			timeRange:        48 * time.Hour,
			expectedInterval: 10 * time.Minute,
		},
		{
			timeRange:        50 * time.Hour,
			expectedInterval: 10 * time.Minute,
		},
		{
			timeRange:        72 * time.Hour,
			expectedInterval: 20 * time.Minute,
		},
		{
			timeRange:        75 * time.Hour,
			expectedInterval: 20 * time.Minute,
		},
		{
			timeRange:        144 * time.Hour,
			expectedInterval: 30 * time.Minute,
		},
		{
			timeRange:        150 * time.Hour,
			expectedInterval: 30 * time.Minute,
		},
		{
			timeRange:        7 * 24 * time.Hour,
			expectedInterval: time.Hour,
		},
		{
			timeRange:        15 * 24 * time.Hour,
			expectedInterval: 4 * time.Hour,
		},
		{
			timeRange:        31 * 24 * time.Hour,
			expectedInterval: 4 * time.Hour,
		},
		{
			timeRange:        60 * 24 * time.Hour,
			expectedInterval: 4 * time.Hour,
		},
		{
			timeRange:        365 * 24 * time.Hour,
			expectedInterval: 4 * time.Hour,
		},
	}

	for _, tc := range testCases {
		t.Run(fmt.Sprintf("timeRange: %s", tc.timeRange), func(t *testing.T) {
			interval := models.CalculateIntervalDatadogDefault(tc.timeRange)
			require.Equal(t, tc.expectedInterval, interval)
		})
	}
}

func TestLargeInterval(t *testing.T) {
	testCases := []struct {
		timeRange        time.Duration
		expectedInterval time.Duration
	}{
		{
			timeRange:        30 * time.Minute,
			expectedInterval: time.Minute,
		},
		{
			timeRange:        time.Hour,
			expectedInterval: time.Minute,
		},
		{
			timeRange:        2 * time.Hour,
			expectedInterval: 2 * time.Minute,
		},
		{
			timeRange:        4 * time.Hour,
			expectedInterval: 2 * time.Minute,
		},
		{
			timeRange:        6 * time.Hour,
			expectedInterval: 5 * time.Minute,
		},
		{
			timeRange:        8 * time.Hour,
			expectedInterval: 5 * time.Minute,
		},
		{
			timeRange:        12 * time.Hour,
			expectedInterval: 10 * time.Minute,
		},
		{
			timeRange:        16 * time.Hour,
			expectedInterval: 10 * time.Minute,
		},
		{
			timeRange:        20 * time.Hour,
			expectedInterval: 20 * time.Minute,
		},
		{
			timeRange:        24 * time.Hour,
			expectedInterval: 20 * time.Minute,
		},
		{
			timeRange:        36 * time.Hour,
			expectedInterval: 30 * time.Minute,
		},
		{
			timeRange:        2 * 24 * time.Hour,
			expectedInterval: 30 * time.Minute,
		},
		{
			timeRange:        3 * 24 * time.Hour,
			expectedInterval: time.Hour,
		},
		{
			timeRange:        4 * 24 * time.Hour,
			expectedInterval: 2 * time.Hour,
		},
		{
			timeRange:        5 * 24 * time.Hour,
			expectedInterval: 2 * time.Hour,
		},
		{
			timeRange:        10 * 24 * time.Hour,
			expectedInterval: 4 * time.Hour,
		},
		{
			timeRange:        14 * 24 * time.Hour,
			expectedInterval: 4 * time.Hour,
		},
		{
			timeRange:        20 * 24 * time.Hour,
			expectedInterval: 8 * time.Hour,
		},
		{
			timeRange:        21 * 24 * time.Hour,
			expectedInterval: 8 * time.Hour,
		},
		{
			timeRange:        25 * 24 * time.Hour,
			expectedInterval: 12 * time.Hour,
		},
		{
			timeRange:        31 * 24 * time.Hour,
			expectedInterval: 12 * time.Hour,
		},
		{
			timeRange:        60 * 24 * time.Hour,
			expectedInterval: 12 * time.Hour, // Returns barChartMaxInterval for ranges beyond predefined thresholds
		},
		{
			timeRange:        365 * 24 * time.Hour,
			expectedInterval: 12 * time.Hour, // Returns barChartMaxInterval for ranges beyond predefined thresholds
		},
	}

	for _, tc := range testCases {
		t.Run(fmt.Sprintf("timeRange: %s", tc.timeRange), func(t *testing.T) {
			interval := models.CalculateIntervalDatadogBarChart(tc.timeRange)
			require.Equal(t, tc.expectedInterval, interval)
		})
	}
}

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

		res, err := models.Parse(span, q, "15s", intervalCalculator, true, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "240s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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

		res, err := models.Parse(span, q, "15s", intervalCalculator, false, false)
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
			res, err := models.Parse(span, q, tt.args.dsScrapeInterval, intervalCalculator, false, false)
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
		res, err := models.Parse(span, query, "30s", intervalCalculator, false, false)
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
		res, err := models.Parse(span, query, "15s", intervalCalculator, false, false)
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
