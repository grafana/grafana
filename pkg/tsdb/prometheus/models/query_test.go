package models_test

import (
	"reflect"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/models"
)

var (
	now                = time.Now()
	intervalCalculator = intervalv2.NewCalculator()
)

func TestParse(t *testing.T) {
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

		res, err := models.Parse(q, "15s", intervalCalculator, true)
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
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
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
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
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
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
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
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
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
		}`, timeRange)

		res, err := models.Parse(q, "240s", intervalCalculator, false)
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
			"refId": "A"
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [2m]})", res.Expr)
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
			"refId": "A"
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
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
			"refId": "A"
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
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
			"refId": "A"
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
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
			"refId": "A"
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
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
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
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
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
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
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
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
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
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
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
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
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
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
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
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
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [5m15s]})", res.Expr)
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
			"intervalMs": 60000,
			"refId": "A"
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, "rate(ALERTS{job=\"test\" [1m0s]})", res.Expr)
		require.Equal(t, 1*time.Minute, res.Step)
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
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
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
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
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
		}`, timeRange)

		res, err := models.Parse(q, "15s", intervalCalculator, false)
		require.NoError(t, err)
		require.Equal(t, true, res.RangeQuery)
	})
}

func queryContext(json string, timeRange backend.TimeRange) backend.DataQuery {
	return backend.DataQuery{
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
	tests := []struct {
		name string
		args args
		want time.Time
	}{
		{name: "second step", args: args{t: time.Unix(1664816826, 0), step: 10 * time.Second, offset: 0}, want: time.Unix(1664816820, 0).UTC()},
		{name: "millisecond step", args: args{t: time.Unix(1664816825, 5*int64(time.Millisecond)), step: 10 * time.Millisecond, offset: 0}, want: time.Unix(1664816825, 0).UTC()},
		{name: "second step with offset", args: args{t: time.Unix(1664816825, 5*int64(time.Millisecond)), step: 2 * time.Second, offset: -3}, want: time.Unix(1664816825, 0).UTC()},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := models.AlignTimeRange(tt.args.t, tt.args.step, tt.args.offset); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("AlignTimeRange() = %v, want %v", got, tt.want)
			}
		})
	}
}
