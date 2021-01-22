package testdatasource

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/require"
)

func TestTestdataScenarios(t *testing.T) {
	t.Run("random walk ", func(t *testing.T) {
		scenario := ScenarioRegistry["random_walk"]

		t.Run("Should start at the requested value", func(t *testing.T) {
			req := &tsdb.TsdbQuery{
				TimeRange: tsdb.NewFakeTimeRange("5m", "now", time.Now()),
				Queries: []*tsdb.Query{
					{RefId: "A", IntervalMs: 100, MaxDataPoints: 100, Model: simplejson.New()},
				},
			}
			query := req.Queries[0]
			query.Model.Set("startValue", 1.234)

			result := scenario.Handler(req.Queries[0], req)
			require.NotNil(t, result.Series)

			points := result.Series[0].Points
			require.Equal(t, 1.234, points[0][0].Float64)
		})
	})

	t.Run("random walk table", func(t *testing.T) {
		scenario := ScenarioRegistry["random_walk_table"]

		t.Run("Should return a table that looks like value/min/max", func(t *testing.T) {
			req := &tsdb.TsdbQuery{
				TimeRange: tsdb.NewFakeTimeRange("5m", "now", time.Now()),
				Queries: []*tsdb.Query{
					{RefId: "A", IntervalMs: 100, MaxDataPoints: 100, Model: simplejson.New()},
				},
			}

			result := scenario.Handler(req.Queries[0], req)
			table := result.Tables[0]

			require.Greater(t, len(table.Rows), 50)
			for _, row := range table.Rows {
				value := row[1]
				min := row[2]
				max := row[3]

				require.Less(t, min, value)
				require.Greater(t, max, value)
			}
		})

		t.Run("Should return a table with some nil values", func(t *testing.T) {
			req := &tsdb.TsdbQuery{
				TimeRange: tsdb.NewFakeTimeRange("5m", "now", time.Now()),
				Queries: []*tsdb.Query{
					{RefId: "A", IntervalMs: 100, MaxDataPoints: 100, Model: simplejson.New()},
				},
			}
			query := req.Queries[0]
			query.Model.Set("withNil", true)

			result := scenario.Handler(req.Queries[0], req)
			table := result.Tables[0]

			nil1 := false
			nil2 := false
			nil3 := false

			require.Greater(t, len(table.Rows), 50)
			for _, row := range table.Rows {
				if row[1] == nil {
					nil1 = true
				}
				if row[2] == nil {
					nil2 = true
				}
				if row[3] == nil {
					nil3 = true
				}
			}

			require.True(t, nil1)
			require.True(t, nil2)
			require.True(t, nil3)
		})
	})
}

func TestParseLabels(t *testing.T) {
	expectedTags := map[string]string{
		"job":      "foo",
		"instance": "bar",
	}

	query1 := tsdb.Query{
		Model: simplejson.NewFromAny(map[string]interface{}{
			"labels": `{job="foo", instance="bar"}`,
		}),
	}
	require.Equal(t, expectedTags, parseLabels(&query1))

	query2 := tsdb.Query{
		Model: simplejson.NewFromAny(map[string]interface{}{
			"labels": `job=foo, instance=bar`,
		}),
	}
	require.Equal(t, expectedTags, parseLabels(&query2))

	query3 := tsdb.Query{
		Model: simplejson.NewFromAny(map[string]interface{}{
			"labels": `job = foo,instance = bar`,
		}),
	}
	require.Equal(t, expectedTags, parseLabels(&query3))
}
