package loki

import (
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/loki/kinds/dataquery"
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
		models, err := parseQuery(queryContext, false)
		require.NoError(t, err)
		require.Equal(t, time.Second*15, models[0].Step)
		require.Equal(t, "go_goroutines 15s 15000 3000s 3000 3000000", models[0].Expr)
	})

	t.Run("parsing query model with logsVolume supporting query type", func(t *testing.T) {
		queryContext := &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					JSON: []byte(`
					{
						"expr": "go_goroutines $__interval $__interval_ms $__range $__range_s $__range_ms",
						"format": "time_series",
						"refId": "A",
						"supportingQueryType": "logsVolume"
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
		models, err := parseQuery(queryContext, false)
		require.NoError(t, err)
		require.Equal(t, SupportingQueryLogsVolume, models[0].SupportingQueryType)
	})

	t.Run("parsing query model with any supporting query type", func(t *testing.T) {
		queryContext := &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					JSON: []byte(`
					{
						"expr": "go_goroutines $__interval $__interval_ms $__range $__range_s $__range_ms",
						"format": "time_series",
						"refId": "A",
						"supportingQueryType": "foo"
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
		models, err := parseQuery(queryContext, false)
		require.NoError(t, err)
		require.Equal(t, SupportingQueryType("foo"), models[0].SupportingQueryType)
	})

	t.Run("parsing query model with any empty query type", func(t *testing.T) {
		queryContext := &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					JSON: []byte(`
					{
						"expr": "go_goroutines $__interval $__interval_ms $__range $__range_s $__range_ms",
						"format": "time_series",
						"refId": "A",
						"supportingQueryType": ""
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
		models, err := parseQuery(queryContext, false)
		require.NoError(t, err)
		require.Equal(t, SupportingQueryNone, models[0].SupportingQueryType)
	})

	t.Run("parsing query model with scopes", func(t *testing.T) {
		queryContext := &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					JSON: []byte(`
					{
						"expr": "{} |= \"problems\"",
						"format": "time_series",
						"refId": "A",
						"scopes": [{"key": "namespace", "value": "logish", "operator": "equals"}]
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
		models, err := parseQuery(queryContext, true)
		require.NoError(t, err)
		require.Equal(t, time.Second*15, models[0].Step)
		require.Equal(t, 1, len(models[0].Scopes))
		require.Equal(t, "namespace", models[0].Scopes[0].Key)
		require.Equal(t, "logish", models[0].Scopes[0].Value)
		require.Equal(t, "equals", string(models[0].Scopes[0].Operator))
		require.Equal(t, `{namespace="logish"} |= "problems"`, models[0].Expr)
	})

	t.Run("parsing query model with invalid query limits context expr", func(t *testing.T) {
		from := time.Now().Add(-3000 * time.Second)
		fullFrom := time.Now().Add(-1 * time.Hour)
		to := time.Now()

		queryContext := &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					JSON: []byte(`
					{
						"expr": "count_over_time({service_name=\"apache\", __stream_shard__=\"2\"}[$__auto])",
						"format": "time_series",
						"refId": "A",
						"limitsContext": {"expr": "", "from": ` + strconv.FormatInt(fullFrom.UnixMilli(), 10) + `, "to": ` + strconv.FormatInt(to.UnixMilli(), 10) + `}
					}`,
					),
					TimeRange: backend.TimeRange{
						From: from,
						To:   to,
					},
					Interval:      time.Second * 15,
					MaxDataPoints: 200,
				},
			},
		}
		models, err := parseQuery(queryContext, true)
		require.NoError(t, err)
		require.Equal(t, `count_over_time({service_name="apache", __stream_shard__="2"}[15s])`, models[0].Expr)
		// If the limits context expression is missing, we don't set any limits context
		require.Equal(t, ``, models[0].LimitsContext.Expr)
		require.Equal(t, time.Time{}, models[0].LimitsContext.To)
		require.Equal(t, time.Time{}, models[0].LimitsContext.From)
	})

	t.Run("parsing query model with query limits context", func(t *testing.T) {
		from := time.Now().Add(-3000 * time.Second)
		fullFrom := time.Now().Add(-1 * time.Hour)
		to := time.Now()

		queryContext := &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					JSON: []byte(`
					{
						"expr": "count_over_time({service_name=\"apache\", __stream_shard__=\"2\"}[$__auto])",
						"format": "time_series",
						"refId": "A",
						"limitsContext": {"expr": "count_over_time({service_name=\"apache\"}[$__auto])", "from": ` + strconv.FormatInt(fullFrom.UnixMilli(), 10) + `, "to": ` + strconv.FormatInt(to.UnixMilli(), 10) + `}
					}`,
					),
					TimeRange: backend.TimeRange{
						From: from,
						To:   to,
					},
					Interval:      time.Second * 15,
					MaxDataPoints: 200,
				},
			},
		}
		models, err := parseQuery(queryContext, true)
		require.NoError(t, err)
		require.Equal(t, time.Second*15, models[0].Step)
		require.Equal(t, `count_over_time({service_name="apache", __stream_shard__="2"}[15s])`, models[0].Expr)
		require.Equal(t, `count_over_time({service_name="apache"}[15s])`, models[0].LimitsContext.Expr)
		require.Equal(t, to.Truncate(time.Millisecond), models[0].LimitsContext.To)
		require.Equal(t, fullFrom.Truncate(time.Millisecond), models[0].LimitsContext.From)
	})

	t.Run("interpolate variables, range between 1s and 0.5s", func(t *testing.T) {
		expr := "go_goroutines $__interval $__interval_ms $__range $__range_s $__range_ms"
		queryType := dataquery.LokiQueryTypeRange
		interval := time.Millisecond * 50
		step := time.Millisecond * 100
		timeRange := time.Millisecond * 750

		require.Equal(t, "go_goroutines 50ms 50 1s 1 750", interpolateVariables(expr, interval, timeRange, queryType, step))
	})
	t.Run("parsing query model, range below 0.5s", func(t *testing.T) {
		expr := "go_goroutines $__interval $__interval_ms $__range $__range_s $__range_ms"
		queryType := dataquery.LokiQueryTypeRange
		interval := time.Millisecond * 50
		step := time.Millisecond * 100
		timeRange := time.Millisecond * 250

		require.Equal(t, "go_goroutines 50ms 50 0s 0 250", interpolateVariables(expr, interval, timeRange, queryType, step))
	})
	t.Run("interpolate variables, curly-braces syntax", func(t *testing.T) {
		expr := "go_goroutines ${__interval} ${__interval_ms} ${__range} ${__range_s} ${__range_ms}"
		queryType := dataquery.LokiQueryTypeRange
		interval := time.Second * 2
		step := time.Millisecond * 100
		timeRange := time.Second * 50

		require.Equal(t, "go_goroutines 2s 2000 50s 50 50000", interpolateVariables(expr, interval, timeRange, queryType, step))
	})

	t.Run("interpolate variables should work with $__auto and instant query type", func(t *testing.T) {
		expr := "rate({compose_project=\"docker-compose\"}[$__auto])"
		queryType := dataquery.LokiQueryTypeInstant
		interval := time.Second * 2
		step := time.Millisecond * 100
		timeRange := time.Second * 50

		require.Equal(t, "rate({compose_project=\"docker-compose\"}[50s])", interpolateVariables(expr, interval, timeRange, queryType, step))
	})

	t.Run("interpolate variables should work with $__auto and range query type", func(t *testing.T) {
		expr := "rate({compose_project=\"docker-compose\"}[$__auto])"
		queryType := dataquery.LokiQueryTypeRange
		interval := time.Second * 2
		step := time.Millisecond * 100
		timeRange := time.Second * 50

		require.Equal(t, "rate({compose_project=\"docker-compose\"}[100ms])", interpolateVariables(expr, interval, timeRange, queryType, step))
	})

	t.Run("interpolate variables should return original query if no variables", func(t *testing.T) {
		expr := "rate({compose_project=\"docker-compose\"}[10s])"
		queryType := dataquery.LokiQueryTypeRange
		interval := time.Second * 2
		step := time.Millisecond * 100
		timeRange := time.Second * 50

		require.Equal(t, "rate({compose_project=\"docker-compose\"}[10s])", interpolateVariables(expr, interval, timeRange, queryType, step))
	})
}
