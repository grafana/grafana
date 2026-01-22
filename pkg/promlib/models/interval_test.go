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
			name:             "min step 2m with 300000 intervalMs",
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
			want:    2 * time.Minute,
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
			want:    2 * time.Minute,
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
			want:    1 * time.Minute,
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
