package models

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/promlib/intervalv2"
)

var (
	testNow                = time.Now()
	testIntervalCalculator = intervalv2.NewCalculator()
	testTracer             = otel.Tracer("test/interval")
)

func TestCalculatePrometheusInterval(t *testing.T) {
	_, span := testTracer.Start(context.Background(), "test")
	defer span.End()

	tests := []struct {
		name             string
		queryInterval    string
		dsScrapeInterval string
		intervalMs       int64
		intervalFactor   int64
		query            backend.DataQuery
		want             time.Duration
		wantErr          bool
	}{
		{
			name:             "use min step value when it's bigger than the calculated value",
			queryInterval:    "10m",
			dsScrapeInterval: "",
			intervalMs:       300000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(48 * time.Hour),
				},
				Interval:      5 * time.Minute,
				MaxDataPoints: 761,
			},
			want:    10 * time.Minute,
			wantErr: false,
		},
		{
			name:             "use calculated value when min step value is smaller",
			queryInterval:    "2m",
			dsScrapeInterval: "",
			intervalMs:       300000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(48 * time.Hour),
				},
				Interval:      5 * time.Minute,
				MaxDataPoints: 761,
			},
			want:    5 * time.Minute,
			wantErr: false,
		},
		{
			name:             "min step 2m with 900000 intervalMs",
			queryInterval:    "2m",
			dsScrapeInterval: "",
			intervalMs:       900000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(48 * time.Hour),
				},
				Interval:      15 * time.Minute,
				MaxDataPoints: 175,
			},
			want:    15 * time.Minute,
			wantErr: false,
		},
		{
			name:             "with step parameter",
			queryInterval:    "",
			dsScrapeInterval: "15s",
			intervalMs:       0,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(12 * time.Hour),
				},
				Interval: 1 * time.Minute,
			},
			want:    30 * time.Second,
			wantErr: false,
		},
		{
			name:             "without step parameter",
			queryInterval:    "",
			dsScrapeInterval: "15s",
			intervalMs:       0,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(1 * time.Hour),
				},
				Interval: 1 * time.Minute,
			},
			want:    15 * time.Second,
			wantErr: false,
		},
		{
			name:             "with high intervalFactor",
			queryInterval:    "",
			dsScrapeInterval: "15s",
			intervalMs:       0,
			intervalFactor:   10,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(48 * time.Hour),
				},
				Interval: 1 * time.Minute,
			},
			want:    20 * time.Minute,
			wantErr: false,
		},
		{
			name:             "with low intervalFactor",
			queryInterval:    "",
			dsScrapeInterval: "15s",
			intervalMs:       0,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(48 * time.Hour),
				},
				Interval: 1 * time.Minute,
			},
			want:    2 * time.Minute,
			wantErr: false,
		},
		{
			name:             "with specified scrape-interval in data source",
			queryInterval:    "",
			dsScrapeInterval: "240s",
			intervalMs:       0,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(48 * time.Hour),
				},
				Interval: 1 * time.Minute,
			},
			want:    4 * time.Minute,
			wantErr: false,
		},
		{
			name:             "with zero intervalFactor defaults to 1",
			queryInterval:    "",
			dsScrapeInterval: "15s",
			intervalMs:       0,
			intervalFactor:   0,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(1 * time.Hour),
				},
				Interval: 1 * time.Minute,
			},
			want:    15 * time.Second,
			wantErr: false,
		},
		{
			name:             "with $__interval variable",
			queryInterval:    "$__interval",
			dsScrapeInterval: "15s",
			intervalMs:       60000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(48 * time.Hour),
				},
				Interval: 1 * time.Minute,
			},
			want:    120 * time.Second,
			wantErr: false,
		},
		{
			name:             "with ${__interval} variable",
			queryInterval:    "${__interval}",
			dsScrapeInterval: "15s",
			intervalMs:       60000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(48 * time.Hour),
				},
				Interval: 1 * time.Minute,
			},
			want:    120 * time.Second,
			wantErr: false,
		},
		{
			name:             "with ${__interval} variable and explicit interval",
			queryInterval:    "1m",
			dsScrapeInterval: "15s",
			intervalMs:       60000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(48 * time.Hour),
				},
				Interval: 1 * time.Minute,
			},
			want:    2 * time.Minute,
			wantErr: false,
		},
		{
			name:             "with $__rate_interval variable",
			queryInterval:    "$__rate_interval",
			dsScrapeInterval: "30s",
			intervalMs:       100000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(2 * 24 * time.Hour),
				},
				Interval:      100 * time.Second,
				MaxDataPoints: 12384,
			},
			want:    130 * time.Second,
			wantErr: false,
		},
		{
			name:             "with ${__rate_interval} variable",
			queryInterval:    "${__rate_interval}",
			dsScrapeInterval: "30s",
			intervalMs:       100000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(2 * 24 * time.Hour),
				},
				Interval:      100 * time.Second,
				MaxDataPoints: 12384,
			},
			want:    130 * time.Second,
			wantErr: false,
		},
		{
			name:             "intervalMs 100s, minStep override 150s and scrape interval 30s",
			queryInterval:    "150s",
			dsScrapeInterval: "30s",
			intervalMs:       100000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(2 * 24 * time.Hour),
				},
				Interval:      100 * time.Second,
				MaxDataPoints: 12384,
			},
			want:    150 * time.Second,
			wantErr: false,
		},
		{
			name:             "intervalMs 120s, minStep override 150s and ds scrape interval 30s",
			queryInterval:    "150s",
			dsScrapeInterval: "30s",
			intervalMs:       120000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(2 * 24 * time.Hour),
				},
				Interval:      120 * time.Second,
				MaxDataPoints: 12384,
			},
			want:    150 * time.Second,
			wantErr: false,
		},
		{
			name:             "intervalMs 120s, minStep auto (interval not overridden) and ds scrape interval 30s",
			queryInterval:    "120s",
			dsScrapeInterval: "30s",
			intervalMs:       120000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(2 * 24 * time.Hour),
				},
				Interval:      120 * time.Second,
				MaxDataPoints: 12384,
			},
			want:    120 * time.Second,
			wantErr: false,
		},
		{
			name:             "interval and minStep are automatically calculated and ds scrape interval 30s and time range 1 hour",
			queryInterval:    "30s",
			dsScrapeInterval: "30s",
			intervalMs:       30000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(1 * time.Hour),
				},
				Interval:      30 * time.Second,
				MaxDataPoints: 12384,
			},
			want:    30 * time.Second,
			wantErr: false,
		},
		{
			name:             "minStep is $__rate_interval and ds scrape interval 30s and time range 1 hour",
			queryInterval:    "$__rate_interval",
			dsScrapeInterval: "30s",
			intervalMs:       30000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(1 * time.Hour),
				},
				Interval:      30 * time.Second,
				MaxDataPoints: 12384,
			},
			want:    2 * time.Minute,
			wantErr: false,
		},
		{
			name:             "minStep is $__rate_interval and ds scrape interval 30s and time range 2 days",
			queryInterval:    "$__rate_interval",
			dsScrapeInterval: "30s",
			intervalMs:       120000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(2 * 24 * time.Hour),
				},
				Interval:      120 * time.Second,
				MaxDataPoints: 12384,
			},
			want:    150 * time.Second,
			wantErr: false,
		},
		{
			name:             "minStep is $__interval and ds scrape interval 15s and time range 2 days",
			queryInterval:    "$__interval",
			dsScrapeInterval: "15s",
			intervalMs:       120000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(2 * 24 * time.Hour),
				},
				Interval:      120 * time.Second,
				MaxDataPoints: 12384,
			},
			want:    120 * time.Second,
			wantErr: false,
		},
		{
			name:             "with empty dsScrapeInterval defaults to 15s",
			queryInterval:    "",
			dsScrapeInterval: "",
			intervalMs:       0,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(1 * time.Hour),
				},
				Interval: 1 * time.Minute,
			},
			want:    15 * time.Second,
			wantErr: false,
		},
		{
			name:             "with very short time range",
			queryInterval:    "",
			dsScrapeInterval: "15s",
			intervalMs:       0,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(1 * time.Minute),
				},
				Interval: 1 * time.Minute,
			},
			want:    15 * time.Second,
			wantErr: false,
		},
		{
			name:             "with very long time range",
			queryInterval:    "",
			dsScrapeInterval: "15s",
			intervalMs:       0,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(30 * 24 * time.Hour),
				},
				Interval: 1 * time.Minute,
			},
			want:    30 * time.Minute,
			wantErr: false,
		},
		{
			name:             "with manual interval override",
			queryInterval:    "5m",
			dsScrapeInterval: "15s",
			intervalMs:       0,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(48 * time.Hour),
				},
				Interval: 1 * time.Minute,
			},
			want:    5 * time.Minute,
			wantErr: false,
		},
		{
			name:             "minStep is auto and ds scrape interval 30s and time range 1 hour",
			queryInterval:    "",
			dsScrapeInterval: "30s",
			intervalMs:       30000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(1 * time.Hour),
				},
				Interval:      30 * time.Second,
				MaxDataPoints: 1613,
			},
			want:    30 * time.Second,
			wantErr: false,
		},
		{
			name:             "minStep is auto and ds scrape interval 15s and time range 5 minutes",
			queryInterval:    "",
			dsScrapeInterval: "15s",
			intervalMs:       15000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(5 * time.Minute),
				},
				Interval:      15 * time.Second,
				MaxDataPoints: 1055,
			},
			want:    15 * time.Second,
			wantErr: false,
		},
		// Additional test cases for better coverage
		{
			name:             "with $__interval_ms variable",
			queryInterval:    "$__interval_ms",
			dsScrapeInterval: "15s",
			intervalMs:       60000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(48 * time.Hour),
				},
				Interval: 1 * time.Minute,
			},
			want:    120 * time.Second,
			wantErr: false,
		},
		{
			name:             "with ${__interval_ms} variable",
			queryInterval:    "${__interval_ms}",
			dsScrapeInterval: "15s",
			intervalMs:       60000,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(48 * time.Hour),
				},
				Interval: 1 * time.Minute,
			},
			want:    120 * time.Second,
			wantErr: false,
		},
		{
			name:             "with MaxDataPoints zero",
			queryInterval:    "",
			dsScrapeInterval: "15s",
			intervalMs:       0,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(1 * time.Hour),
				},
				Interval:      1 * time.Minute,
				MaxDataPoints: 0,
			},
			want:    15 * time.Second,
			wantErr: false,
		},
		{
			name:             "with negative intervalFactor",
			queryInterval:    "",
			dsScrapeInterval: "15s",
			intervalMs:       0,
			intervalFactor:   -5,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(48 * time.Hour),
				},
				Interval: 1 * time.Minute,
			},
			want:    -10 * time.Minute,
			wantErr: false,
		},
		{
			name:             "with invalid interval string that fails parsing",
			queryInterval:    "invalid-interval",
			dsScrapeInterval: "15s",
			intervalMs:       0,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(48 * time.Hour),
				},
				Interval: 1 * time.Minute,
			},
			want:    time.Duration(0),
			wantErr: true,
		},
		{
			name:             "with very small MaxDataPoints",
			queryInterval:    "",
			dsScrapeInterval: "15s",
			intervalMs:       0,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(1 * time.Hour),
				},
				Interval:      1 * time.Minute,
				MaxDataPoints: 10,
			},
			want:    5 * time.Minute,
			wantErr: false,
		},
		{
			name:             "when safeInterval is larger than calculatedInterval",
			queryInterval:    "",
			dsScrapeInterval: "15s",
			intervalMs:       0,
			intervalFactor:   1,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: testNow,
					To:   testNow.Add(1 * time.Hour),
				},
				Interval:      1 * time.Minute,
				MaxDataPoints: 10000,
			},
			want:    15 * time.Second,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := calculatePrometheusInterval(
				tt.queryInterval,
				tt.dsScrapeInterval,
				tt.intervalMs,
				tt.intervalFactor,
				tt.query,
				testIntervalCalculator,
			)

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestCalculateRateInterval(t *testing.T) {
	tests := []struct {
		name             string
		queryInterval    time.Duration
		requestedMinStep string
		want             time.Duration
	}{
		{
			name:             "with 30s scrape interval and 100s query interval",
			queryInterval:    100 * time.Second,
			requestedMinStep: "30s",
			want:             130 * time.Second, // max(100s + 30s, 4*30s) = max(130s, 120s) = 130s
		},
		{
			name:             "with 30s scrape interval and 60s query interval",
			queryInterval:    60 * time.Second,
			requestedMinStep: "30s",
			want:             120 * time.Second, // max(60s + 30s, 4*30s) = max(90s, 120s) = 120s
		},
		{
			name:             "with 15s scrape interval and 30s query interval",
			queryInterval:    30 * time.Second,
			requestedMinStep: "15s",
			want:             60 * time.Second, // max(30s + 15s, 4*15s) = max(45s, 60s) = 60s
		},
		{
			name:             "with empty scrape interval defaults to 15s",
			queryInterval:    30 * time.Second,
			requestedMinStep: "",
			want:             60 * time.Second, // max(30s + 15s, 4*15s) = max(45s, 60s) = 60s
		},
		{
			name:             "with 1m scrape interval and 5m query interval",
			queryInterval:    5 * time.Minute,
			requestedMinStep: "1m",
			want:             6 * time.Minute, // max(5m + 1m, 4*1m) = max(6m, 4m) = 6m
		},
		{
			name:             "with 1m scrape interval and 2m query interval",
			queryInterval:    2 * time.Minute,
			requestedMinStep: "1m",
			want:             4 * time.Minute, // max(2m + 1m, 4*1m) = max(3m, 4m) = 4m
		},
		{
			name:             "with zero query interval and 30s scrape interval",
			queryInterval:    0,
			requestedMinStep: "30s",
			want:             120 * time.Second, // max(0 + 30s, 4*30s) = max(30s, 120s) = 120s
		},
		{
			name:             "with very small query interval 10s and 30s scrape interval",
			queryInterval:    10 * time.Second,
			requestedMinStep: "30s",
			want:             120 * time.Second, // max(10s + 30s, 4*30s) = max(40s, 120s) = 120s
		},
		{
			name:             "with large query interval 10m and 30s scrape interval",
			queryInterval:    10 * time.Minute,
			requestedMinStep: "30s",
			want:             630 * time.Second, // max(10m + 30s, 4*30s) = max(630s, 120s) = 630s
		},
		{
			name:             "with 5s scrape interval and 10s query interval",
			queryInterval:    10 * time.Second,
			requestedMinStep: "5s",
			want:             20 * time.Second, // max(10s + 5s, 4*5s) = max(15s, 20s) = 20s
		},
		{
			name:             "with invalid scrape interval returns zero",
			queryInterval:    100 * time.Second,
			requestedMinStep: "invalid-interval",
			want:             0,
		},
		{
			name:             "with 1h scrape interval and 2h query interval",
			queryInterval:    2 * time.Hour,
			requestedMinStep: "1h",
			want:             4 * time.Hour, // max(2h + 1h, 4*1h) = max(3h, 4h) = 4h
		},
		{
			name:             "edge case: queryInterval equals minRateInterval boundary",
			queryInterval:    45 * time.Second, // 3 * 15s
			requestedMinStep: "15s",
			want:             60 * time.Second, // max(45s + 15s, 4*15s) = max(60s, 60s) = 60s
		},
		{
			name:             "with 10s scrape interval and 50s query interval",
			queryInterval:    50 * time.Second,
			requestedMinStep: "10s",
			want:             60 * time.Second, // max(50s + 10s, 4*10s) = max(60s, 40s) = 60s
		},
		{
			name:             "with 2m scrape interval and 1m query interval",
			queryInterval:    1 * time.Minute,
			requestedMinStep: "2m",
			want:             8 * time.Minute, // max(1m + 2m, 4*2m) = max(3m, 8m) = 8m
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := calculateRateInterval(tt.queryInterval, tt.requestedMinStep)
			require.Equal(t, tt.want, got)
		})
	}
}
