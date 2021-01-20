package testdatasource

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
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

func TestTestdataScenariosV2(t *testing.T) {
	p := &testDataPlugin{}

	t.Run("random walk ", func(t *testing.T) {
		t.Run("Should start at the requested value", func(t *testing.T) {
			timeRange := tsdb.NewFakeTimeRange("5m", "now", time.Now())

			model := simplejson.New()
			model.Set("startValue", 1.234)
			modelBytes, err := model.MarshalJSON()
			require.NoError(t, err)

			query := backend.DataQuery{
				RefID: "A",
				TimeRange: backend.TimeRange{
					From: timeRange.MustGetFrom(),
					To:   timeRange.MustGetTo(),
				},
				Interval:      100 * time.Millisecond,
				MaxDataPoints: 100,
				JSON:          modelBytes,
			}

			req := &backend.QueryDataRequest{
				PluginContext: backend.PluginContext{},
				Queries:       []backend.DataQuery{query},
			}

			resp, err := p.handleRandomWalkScenario(context.Background(), req)
			require.NoError(t, err)
			require.NotNil(t, resp)

			dResp, exists := resp.Responses[query.RefID]
			require.True(t, exists)
			require.NoError(t, dResp.Error)

			require.Len(t, dResp.Frames, 1)
			frame := dResp.Frames[0]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, "time", frame.Fields[0].Name)
			require.Equal(t, "value", frame.Fields[1].Name)
			val, ok := frame.Fields[1].ConcreteAt(0)
			require.True(t, ok)
			require.Equal(t, 1.234, val)
		})
	})

	t.Run("random walk table", func(t *testing.T) {
		t.Run("Should return a table that looks like value/min/max", func(t *testing.T) {
			timeRange := tsdb.NewFakeTimeRange("5m", "now", time.Now())

			model := simplejson.New()
			modelBytes, err := model.MarshalJSON()
			require.NoError(t, err)

			query := backend.DataQuery{
				RefID: "A",
				TimeRange: backend.TimeRange{
					From: timeRange.MustGetFrom(),
					To:   timeRange.MustGetTo(),
				},
				Interval:      100 * time.Millisecond,
				MaxDataPoints: 100,
				JSON:          modelBytes,
			}

			req := &backend.QueryDataRequest{
				PluginContext: backend.PluginContext{},
				Queries:       []backend.DataQuery{query},
			}

			resp, err := p.handleRandomWalkTableScenario(context.Background(), req)
			require.NoError(t, err)
			require.NotNil(t, resp)

			dResp, exists := resp.Responses[query.RefID]
			require.True(t, exists)
			require.NoError(t, dResp.Error)

			require.Len(t, dResp.Frames, 1)
			frame := dResp.Frames[0]
			require.Greater(t, frame.Rows(), 50)
			require.Len(t, frame.Fields, 5)
			require.Equal(t, "Time", frame.Fields[0].Name)
			require.Equal(t, "Value", frame.Fields[1].Name)
			require.Equal(t, "Min", frame.Fields[2].Name)
			require.Equal(t, "Max", frame.Fields[3].Name)
			require.Equal(t, "Info", frame.Fields[4].Name)

			for i := 0; i < frame.Rows(); i++ {
				value, ok := frame.ConcreteAt(1, i)
				require.True(t, ok)
				min, ok := frame.ConcreteAt(2, i)
				require.True(t, ok)
				max, ok := frame.ConcreteAt(3, i)
				require.True(t, ok)

				require.Less(t, min, value)
				require.Greater(t, max, value)
			}
		})

		// t.Run("Should return a table with some nil values", func(t *testing.T) {
		// 	req := &tsdb.TsdbQuery{
		// 		TimeRange: tsdb.NewFakeTimeRange("5m", "now", time.Now()),
		// 		Queries: []*tsdb.Query{
		// 			{RefId: "A", IntervalMs: 100, MaxDataPoints: 100, Model: simplejson.New()},
		// 		},
		// 	}
		// 	query := req.Queries[0]
		// 	query.Model.Set("withNil", true)

		// 	result := scenario.Handler(req.Queries[0], req)
		// 	table := result.Tables[0]

		// 	nil1 := false
		// 	nil2 := false
		// 	nil3 := false

		// 	require.Greater(t, len(table.Rows), 50)
		// 	for _, row := range table.Rows {
		// 		if row[1] == nil {
		// 			nil1 = true
		// 		}
		// 		if row[2] == nil {
		// 			nil2 = true
		// 		}
		// 		if row[3] == nil {
		// 			nil3 = true
		// 		}
		// 	}

		// 	require.True(t, nil1)
		// 	require.True(t, nil2)
		// 	require.True(t, nil3)
		// })
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
