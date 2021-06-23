package influxdb

import (
	"testing"
	"time"

	"strings"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/stretchr/testify/require"
)

func TestInfluxdbQueryBuilder(t *testing.T) {
	t.Run("Influxdb query builder", func(t *testing.T) {
		qp1, _ := NewQueryPart("field", []string{"value"})
		qp2, _ := NewQueryPart("mean", []string{})

		mathPartDivideBy100, _ := NewQueryPart("math", []string{"/ 100"})
		mathPartDivideByIntervalMs, _ := NewQueryPart("math", []string{"/ $__interval_ms"})

		groupBy1, _ := NewQueryPart("time", []string{"$__interval"})
		groupBy2, _ := NewQueryPart("tag", []string{"datacenter"})
		groupBy3, _ := NewQueryPart("fill", []string{"null"})

		groupByOldInterval, _ := NewQueryPart("time", []string{"$interval"})

		tag1 := &Tag{Key: "hostname", Value: "server1", Operator: "="}
		tag2 := &Tag{Key: "hostname", Value: "server2", Operator: "=", Condition: "OR"}

		timeRange := plugins.NewDataTimeRange("5m", "now")
		queryContext := plugins.DataQuery{
			TimeRange: &timeRange,
		}

		t.Run("can build simple query", func(t *testing.T) {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				Policy:      "policy",
				GroupBy:     []*QueryPart{groupBy1, groupBy3},
				Interval:    time.Second * 10,
			}

			rawQuery, err := query.Build(queryContext)
			require.NoError(t, err)
			require.Equal(t, `SELECT mean("value") FROM "policy"."cpu" WHERE time > now() - 5m GROUP BY time(10s) fill(null)`, rawQuery)
		})

		t.Run("can build query with tz", func(t *testing.T) {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				GroupBy:     []*QueryPart{groupBy1},
				Tz:          "Europe/Paris",
				Interval:    time.Second * 5,
			}

			rawQuery, err := query.Build(queryContext)
			require.NoError(t, err)
			require.Equal(t, `SELECT mean("value") FROM "cpu" WHERE time > now() - 5m GROUP BY time(5s) tz('Europe/Paris')`, rawQuery)
		})

		t.Run("can build query with group bys", func(t *testing.T) {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				GroupBy:     []*QueryPart{groupBy1, groupBy2, groupBy3},
				Tags:        []*Tag{tag1, tag2},
				Interval:    time.Second * 5,
			}

			rawQuery, err := query.Build(queryContext)
			require.NoError(t, err)
			require.Equal(t, `SELECT mean("value") FROM "cpu" WHERE ("hostname" = 'server1' OR "hostname" = 'server2') AND time > now() - 5m GROUP BY time(5s), "datacenter" fill(null)`, rawQuery)
		})

		t.Run("can build query with math part", func(t *testing.T) {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2, *mathPartDivideBy100}},
				Measurement: "cpu",
				Interval:    time.Second * 5,
			}

			rawQuery, err := query.Build(queryContext)
			require.NoError(t, err)
			require.Equal(t, `SELECT mean("value") / 100 FROM "cpu" WHERE time > now() - 5m`, rawQuery)
		})

		t.Run("can build query with math part using $__interval_ms variable", func(t *testing.T) {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2, *mathPartDivideByIntervalMs}},
				Measurement: "cpu",
				Interval:    time.Second * 5,
			}

			rawQuery, err := query.Build(queryContext)
			require.NoError(t, err)
			require.Equal(t, `SELECT mean("value") / 5000 FROM "cpu" WHERE time > now() - 5m`, rawQuery)
		})

		t.Run("can build query with old $interval variable", func(t *testing.T) {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				Policy:      "",
				GroupBy:     []*QueryPart{groupByOldInterval},
			}

			rawQuery, err := query.Build(queryContext)
			require.NoError(t, err)
			require.Equal(t, `SELECT mean("value") FROM "cpu" WHERE time > now() - 5m GROUP BY time(200ms)`, rawQuery)
		})

		t.Run("can render time range", func(t *testing.T) {
			query := Query{}
			t.Run("render from: 2h to now-1h", func(t *testing.T) {
				query := Query{}
				timeRange := plugins.NewDataTimeRange("2h", "now-1h")
				queryContext := plugins.DataQuery{TimeRange: &timeRange}
				require.Equal(t, "time > now() - 2h and time < now() - 1h", query.renderTimeFilter(queryContext))
			})

			t.Run("render from: 10m", func(t *testing.T) {
				timeRange := plugins.NewDataTimeRange("10m", "now")
				queryContext := plugins.DataQuery{TimeRange: &timeRange}
				require.Equal(t, "time > now() - 10m", query.renderTimeFilter(queryContext))
			})
		})

		t.Run("can build query from raw query", func(t *testing.T) {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				Policy:      "policy",
				GroupBy:     []*QueryPart{groupBy1, groupBy3},
				Interval:    time.Second * 10,
				RawQuery:    "Raw query",
				UseRawQuery: true,
			}

			rawQuery, err := query.Build(queryContext)
			require.NoError(t, err)
			require.Equal(t, `Raw query`, rawQuery)
		})

		t.Run("can render normal tags without operator", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "", Value: `value`, Key: "key"}}}

			require.Equal(t, `"key" = 'value'`, strings.Join(query.renderTags(), ""))
		})

		t.Run("can render regex tags without operator", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "", Value: `/value/`, Key: "key"}}}

			require.Equal(t, `"key" =~ /value/`, strings.Join(query.renderTags(), ""))
		})

		t.Run("can render regex tags", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "=~", Value: `/value/`, Key: "key"}}}

			require.Equal(t, `"key" =~ /value/`, strings.Join(query.renderTags(), ""))
		})

		t.Run("can render number tags", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "=", Value: "10001", Key: "key"}}}

			require.Equal(t, `"key" = '10001'`, strings.Join(query.renderTags(), ""))
		})

		t.Run("can render numbers less then condition tags", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "<", Value: "10001", Key: "key"}}}

			require.Equal(t, `"key" < 10001`, strings.Join(query.renderTags(), ""))
		})

		t.Run("can render number greater then condition tags", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: ">", Value: "10001", Key: "key"}}}

			require.Equal(t, `"key" > 10001`, strings.Join(query.renderTags(), ""))
		})

		t.Run("can render string tags", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "=", Value: "value", Key: "key"}}}

			require.Equal(t, `"key" = 'value'`, strings.Join(query.renderTags(), ""))
		})

		t.Run("can escape backslashes when rendering string tags", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "=", Value: `C:\test\`, Key: "key"}}}

			require.Equal(t, `"key" = 'C:\\test\\'`, strings.Join(query.renderTags(), ""))
		})

		t.Run("can render regular measurement", func(t *testing.T) {
			query := &Query{Measurement: `apa`, Policy: "policy"}

			require.Equal(t, ` FROM "policy"."apa"`, query.renderMeasurement())
		})

		t.Run("can render regexp measurement", func(t *testing.T) {
			query := &Query{Measurement: `/apa/`, Policy: "policy"}

			require.Equal(t, ` FROM "policy"./apa/`, query.renderMeasurement())
		})
	})
}
