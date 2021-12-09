package loki

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

func TestParseQuery(t *testing.T) {
	t.Run("parsing query model", func(t *testing.T) {
		queryContext := &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					JSON: []byte(`
					{
						"expr": "go_goroutines $__interval $__interval_ms $__range $__range_s $__range_ms",
						"format": "time_series",
						"refId": "A"
					}`,
					),
					TimeRange: backend.TimeRange{
						From: time.Now().Add(-3000 * time.Second),
						To:   time.Now(),
					},
					Interval:      time.Second * 15,
					MaxDataPoints: 200,
				},
			},
		}
		models, err := parseQuery(queryContext)
		require.NoError(t, err)
		require.Equal(t, time.Second*15, models[0].Step)
		require.Equal(t, "go_goroutines 15s 15000 3000s 3000 3000000", models[0].Expr)
	})
	t.Run("interpolate variables, range between 1s and 0.5s", func(t *testing.T) {
		expr := "go_goroutines $__interval $__interval_ms $__range $__range_s $__range_ms"

		interval := time.Millisecond * 50
		timeRange := time.Millisecond * 750

		require.Equal(t, "go_goroutines 50ms 50 1s 1 750", interpolateVariables(expr, interval, timeRange))
	})
	t.Run("parsing query model, range below 0.5s", func(t *testing.T) {
		expr := "go_goroutines $__interval $__interval_ms $__range $__range_s $__range_ms"

		interval := time.Millisecond * 50
		timeRange := time.Millisecond * 250

		require.Equal(t, "go_goroutines 50ms 50 0s 0 250", interpolateVariables(expr, interval, timeRange))
	})
	t.Run("interpolate variables, curly-braces syntax", func(t *testing.T) {
		expr := "go_goroutines ${__interval} ${__interval_ms} ${__range} ${__range_s} ${__range_ms}"

		interval := time.Second * 2
		timeRange := time.Second * 50

		require.Equal(t, "go_goroutines 2s 2000 50s 50 50000", interpolateVariables(expr, interval, timeRange))
	})
}
