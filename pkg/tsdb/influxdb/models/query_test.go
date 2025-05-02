package models

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/influxdata/influxql"
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

		timeRange := backend.TimeRange{
			From: time.Date(2020, 8, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2020, 8, 1, 0, 5, 0, 0, time.UTC),
		}
		queryContext := &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					TimeRange: timeRange,
				},
			},
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
			require.Equal(t, rawQuery, `SELECT mean("value") FROM "policy"."cpu" WHERE time >= 1596240000000ms and time <= 1596240300000ms GROUP BY time(10s) fill(null)`)
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
			require.Equal(t, rawQuery,
				`SELECT mean("value") FROM "cpu" WHERE time >= 1596240000000ms and time <= 1596240300000ms GROUP BY time(5s) tz('Europe/Paris')`)
		})

		t.Run("can build query with tz, limit, slimit, orderByTime and puts them in the correct order", func(t *testing.T) {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				GroupBy:     []*QueryPart{groupBy1},
				Tz:          "Europe/Paris",
				Limit:       "1",
				Slimit:      "1",
				OrderByTime: "ASC",
				Interval:    time.Second * 5,
			}

			rawQuery, err := query.Build(queryContext)
			require.NoError(t, err)
			require.Equal(t, rawQuery,
				`SELECT mean("value") FROM "cpu" WHERE time >= 1596240000000ms and time <= 1596240300000ms GROUP BY time(5s) ORDER BY time ASC limit 1 slimit 1 tz('Europe/Paris')`)
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
			require.Equal(t, rawQuery, `SELECT mean("value") FROM "cpu" WHERE ("hostname" = 'server1' OR "hostname" = 'server2') AND time >= 1596240000000ms and time <= 1596240300000ms GROUP BY time(5s), "datacenter" fill(null)`)
		})

		t.Run("can build query with math part", func(t *testing.T) {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2, *mathPartDivideBy100}},
				Measurement: "cpu",
				Interval:    time.Second * 5,
			}

			rawQuery, err := query.Build(queryContext)
			require.NoError(t, err)
			require.Equal(t, rawQuery,
				`SELECT mean("value") / 100 FROM "cpu" WHERE time >= 1596240000000ms and time <= 1596240300000ms`)
		})

		t.Run("can build query with math part using $__interval_ms variable", func(t *testing.T) {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2, *mathPartDivideByIntervalMs}},
				Measurement: "cpu",
				Interval:    time.Second * 5,
			}

			rawQuery, err := query.Build(queryContext)
			require.NoError(t, err)
			require.Equal(t, rawQuery,
				`SELECT mean("value") / 5000 FROM "cpu" WHERE time >= 1596240000000ms and time <= 1596240300000ms`)
		})

		t.Run("can build query with old $interval variable", func(t *testing.T) {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				Policy:      "",
				GroupBy:     []*QueryPart{groupByOldInterval},
				Interval:    time.Millisecond * 200,
			}

			rawQuery, err := query.Build(queryContext)
			require.NoError(t, err)
			require.Equal(t, rawQuery,
				`SELECT mean("value") FROM "cpu" WHERE time >= 1596240000000ms and time <= 1596240300000ms GROUP BY time(200ms)`)
		})

		t.Run("can render time range", func(t *testing.T) {
			query := Query{}
			t.Run("render from: 2h to now-1h", func(t *testing.T) {
				query := Query{}
				timeRange = backend.TimeRange{
					From: time.Date(2020, 8, 1, 0, 0, 0, 0, time.UTC),
					To:   time.Date(2020, 8, 1, 1, 0, 0, 0, time.UTC),
				}
				queryContext = &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							TimeRange: timeRange,
						},
					},
				}
				require.Equal(t, query.renderTimeFilter(queryContext),
					"time >= 1596240000000ms and time <= 1596243600000ms")
			})

			t.Run("render from: 10m", func(t *testing.T) {
				timeRange = backend.TimeRange{
					From: time.Date(2020, 8, 1, 0, 0, 0, 0, time.UTC),
					To:   time.Date(2020, 8, 1, 0, 10, 0, 0, time.UTC),
				}
				queryContext = &backend.QueryDataRequest{
					Queries: []backend.DataQuery{
						{
							TimeRange: timeRange,
						},
					},
				}
				require.Equal(t, query.renderTimeFilter(queryContext),
					"time >= 1596240000000ms and time <= 1596240600000ms")
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
			require.Equal(t, rawQuery, `Raw query`)
		})

		t.Run("can render normal tags without operator", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "", Value: `value`, Key: "key"}}}

			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" = 'value'`)
		})

		t.Run("can render regex tags without operator", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "", Value: `/value/`, Key: "key"}}}

			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" =~ /value/`)
		})

		t.Run("can render regex tags", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "=~", Value: `/value/`, Key: "key"}}}

			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" =~ /value/`)
		})

		t.Run("can render number tags", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "=", Value: "10001", Key: "key"}}}

			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" = '10001'`)
		})

		t.Run("can render numbers less then condition tags", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "<", Value: "10001", Key: "key"}}}

			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" < 10001`)
		})

		t.Run("can render number greater then condition tags", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: ">", Value: "10001", Key: "key"}}}

			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" > 10001`)
		})

		t.Run("can render number greater than or equal to condition tags", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: ">=", Value: "10001", Key: "key"}}}

			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" >= 10001`)
		})
		t.Run("can render number less than or equal to condition tags", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "<=", Value: "10001", Key: "key"}}}

			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" <= 10001`)
		})

		t.Run("can render boolean equality tags", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "Is", Value: "false", Key: "key"}}}

			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" = false`)
		})

		t.Run("can render boolean inequality tags", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "Is Not", Value: "true", Key: "key"}}}
			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" != true`)
		})

		t.Run("can correct case of boolean tags", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "Is", Value: "False", Key: "key"}}}
			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" = false`)
		})

		t.Run("can use strings with Is", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "Is", Value: "A string", Key: "key"}}}
			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" = 'A string'`)
		})

		t.Run("can use integers with Is", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "Is", Value: "123", Key: "key"}}}
			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" = 123`)
		})

		t.Run("can use negative integers with Is", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "Is", Value: "-123", Key: "key"}}}
			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" = -123`)
		})

		t.Run("can use floats with Is", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "Is", Value: "1.23", Key: "key"}}}
			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" = 1.23`)
		})

		t.Run("can use negative floats with Is", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "Is", Value: "-1.23", Key: "key"}}}
			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" = -1.23`)
		})

		t.Run("can render string tags", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "=", Value: "value", Key: "key"}}}

			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" = 'value'`)
		})

		t.Run("can escape backslashes when rendering string tags", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: "=", Value: `C:\test\`, Key: "key"}}}

			require.Equal(t, strings.Join(query.renderTags(), ""), `"key" = 'C:\\test\\'`)
		})

		t.Run("can render regular measurement", func(t *testing.T) {
			query := &Query{Measurement: `apa`, Policy: "policy"}

			require.Equal(t, query.renderMeasurement(), ` FROM "policy"."apa"`)
		})

		t.Run("can render regexp measurement", func(t *testing.T) {
			query := &Query{Measurement: `/apa/`, Policy: "policy"}

			require.Equal(t, query.renderMeasurement(), ` FROM "policy"./apa/`)
		})

		t.Run("can render single quoted tag value when regexed value has been sent", func(t *testing.T) {
			query := &Query{Tags: []*Tag{{Operator: ">", Value: `/^12.2$/`, Key: "key"}}}

			require.Equal(t, `"key" > '12.2'`, strings.Join(query.renderTags(), ""))
		})
	})
}

func TestRemoveRegexWrappers(t *testing.T) {
	t.Run("remove regex wrappers", func(t *testing.T) {
		wrappedText := `/^someValue$/`
		expected := `'someValue'`
		result := removeRegexWrappers(wrappedText, `'`)

		require.Equal(t, expected, result)
	})

	t.Run("return same value if the value is not wrapped by regex wrappers", func(t *testing.T) {
		wrappedText := `someValue`
		expected := `someValue`
		result := removeRegexWrappers(wrappedText, "")

		require.Equal(t, expected, result)
	})
}

func TestRawQueryWithAdhocFilters(t *testing.T) {
	noAdhocFilters := []*Tag{}
	adhocFilter := &Tag{
		Key:   "lol",
		Value: "sob",
	}

	cases := []struct {
		Name          string
		RawQuery      string
		ExpectedQuery string
		AdhocFilters  []*Tag
	}{
		{
			Name:          "no filters",
			RawQuery:      `SELECT "gauge" FROM "a"."b" WHERE time >= 123456780 and time <= 123456789`,
			ExpectedQuery: `SELECT "gauge" FROM "a"."b" WHERE time >= 123456780 and time <= 123456789`,
			AdhocFilters:  noAdhocFilters,
		},
		{
			Name:          "multi-byte chars, single filter",
			RawQuery:      `SELECT "gauge" as "世界" FROM "a"."b"`,
			ExpectedQuery: `SELECT "gauge" as "世界" FROM "a"."b" WHERE "lol" = 'sob'`,
			AdhocFilters:  []*Tag{adhocFilter},
		},
		{
			Name:          "multi-byte chars, single filter, existing where condition",
			RawQuery:      `SELECT "gauge" as "世界" FROM "a"."b" WHERE time >= 123456780 AND time <= 123456789`,
			ExpectedQuery: `SELECT "gauge" as "世界" FROM "a"."b" WHERE "lol" = 'sob' AND time >= 123456780 AND time <= 123456789`,
			AdhocFilters:  []*Tag{adhocFilter},
		},
		{
			Name:          "quoted where, single filter",
			RawQuery:      `SELECT "gauge" as "where is my thing" FROM "a"."b"`,
			ExpectedQuery: `SELECT "gauge" as "where is my thing" FROM "a"."b" WHERE "lol" = 'sob'`,
			AdhocFilters:  []*Tag{adhocFilter},
		},
		{
			Name:          "quoted where, single filter, existing where condition",
			RawQuery:      `SELECT "gauge" as "where is my thing" FROM "a"."b" WHERE time >= 123456780 AND time <= 123456789`,
			ExpectedQuery: `SELECT "gauge" as "where is my thing" FROM "a"."b" WHERE "lol" = 'sob' AND time >= 123456780 AND time <= 123456789`,
			AdhocFilters:  []*Tag{adhocFilter},
		},
		{
			Name:          "multiple filters",
			RawQuery:      `SELECT "gauge" FROM "a"."b"`,
			ExpectedQuery: `SELECT "gauge" FROM "a"."b" WHERE "lol" = 'sob' AND "lol" = 'sob'`,
			AdhocFilters:  []*Tag{adhocFilter, adhocFilter},
		},
		{
			Name:          "multiple filters, existing where condition",
			RawQuery:      `SELECT "gauge" FROM "a"."b" WHERE time >= 123456780 AND time <= 123456789`,
			ExpectedQuery: `SELECT "gauge" FROM "a"."b" WHERE "lol" = 'sob' AND "lol" = 'sob' AND time >= 123456780 AND time <= 123456789`,
			AdhocFilters:  []*Tag{adhocFilter, adhocFilter},
		},
		{
			Name:          "multiple filters, existing where condition",
			RawQuery:      `SELECT first("gauge") *3.28 FROM "alolb" WHERE time >= 123456780 AND time <= 123456789 GROUP BY time(10s), "LolSob"::tag fill(null)`,
			ExpectedQuery: `SELECT first("gauge") *3.28 FROM "alolb" WHERE "lol" = 'sob' AND time >= 123456780 AND time <= 123456789 GROUP BY time(10s), "LolSob"::tag fill(null)`,
			AdhocFilters:  []*Tag{adhocFilter},
		},
	}

	for _, c := range cases {
		t.Run(fmt.Sprintf("raw query + adhoc filters: %s", c.Name), func(t *testing.T) {
			query := &Query{
				RawQuery:    c.RawQuery,
				UseRawQuery: true,
				Tags:        c.AdhocFilters,
			}
			actualQuery := query.getRawQueryWithAdhocFilters()
			require.Equal(t, c.ExpectedQuery, actualQuery)
			_, err := influxql.ParseStatement(actualQuery)
			require.NoError(t, err)
		})
	}
}
