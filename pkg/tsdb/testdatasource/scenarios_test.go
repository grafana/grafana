package testdatasource

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTestdataScenarios(t *testing.T) {
	s := &Service{}

	t.Run("random walk ", func(t *testing.T) {
		t.Run("Should start at the requested value", func(t *testing.T) {
			timeRange := legacydata.DataTimeRange{From: "5m", To: "now", Now: time.Now()}

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

			resp, err := s.handleRandomWalkScenario(context.Background(), req)
			require.NoError(t, err)
			require.NotNil(t, resp)

			dResp, exists := resp.Responses[query.RefID]
			require.True(t, exists)
			require.NoError(t, dResp.Error)

			require.Len(t, dResp.Frames, 1)
			frame := dResp.Frames[0]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, "time", frame.Fields[0].Name)
			require.Equal(t, "A-series", frame.Fields[1].Name)
			val, ok := frame.Fields[1].ConcreteAt(0)
			require.True(t, ok)
			require.Equal(t, 1.234, val)
		})
	})

	t.Run("random walk table", func(t *testing.T) {
		t.Run("Should return a table that looks like value/min/max", func(t *testing.T) {
			timeRange := legacydata.DataTimeRange{From: "5m", To: "now", Now: time.Now()}

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

			resp, err := s.handleRandomWalkTableScenario(context.Background(), req)
			require.NoError(t, err)
			require.NotNil(t, resp)

			dResp, exists := resp.Responses[query.RefID]
			require.True(t, exists)
			require.NoError(t, dResp.Error)

			require.Len(t, dResp.Frames, 1)
			frame := dResp.Frames[0]
			require.Greater(t, frame.Rows(), 50)
			require.Len(t, frame.Fields, 6)
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

		t.Run("Should return a table with some nil values", func(t *testing.T) {
			timeRange := legacydata.DataTimeRange{From: "5m", To: "now", Now: time.Now()}

			model := simplejson.New()
			model.Set("withNil", true)

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

			resp, err := s.handleRandomWalkTableScenario(context.Background(), req)
			require.NoError(t, err)
			require.NotNil(t, resp)

			dResp, exists := resp.Responses[query.RefID]
			require.True(t, exists)
			require.NoError(t, dResp.Error)

			require.Len(t, dResp.Frames, 1)
			frame := dResp.Frames[0]
			require.Greater(t, frame.Rows(), 50)
			require.Len(t, frame.Fields, 6)
			require.Equal(t, "Time", frame.Fields[0].Name)
			require.Equal(t, "Value", frame.Fields[1].Name)
			require.Equal(t, "Min", frame.Fields[2].Name)
			require.Equal(t, "Max", frame.Fields[3].Name)
			require.Equal(t, "Info", frame.Fields[4].Name)
			require.Equal(t, "State", frame.Fields[5].Name)

			valNil := false
			minNil := false
			maxNil := false

			for i := 0; i < frame.Rows(); i++ {
				_, ok := frame.ConcreteAt(1, i)
				if !ok {
					valNil = true
				}

				_, ok = frame.ConcreteAt(2, i)
				if !ok {
					minNil = true
				}

				_, ok = frame.ConcreteAt(3, i)
				if !ok {
					maxNil = true
				}
			}

			require.True(t, valNil)
			require.True(t, minNil)
			require.True(t, maxNil)
		})
	})
}

func TestParseLabels(t *testing.T) {
	expectedTags := data.Labels{
		"job":      "foo",
		"instance": "bar",
	}

	tcs := []struct {
		model map[string]interface{}
	}{
		{model: map[string]interface{}{
			"labels": `{job="foo", instance="bar"}`,
		}},
		{model: map[string]interface{}{
			"labels": `job=foo, instance=bar`,
		}},
		{model: map[string]interface{}{
			"labels": `job = foo,instance = bar`,
		}},
	}

	for i, tc := range tcs {
		model := simplejson.NewFromAny(tc.model)
		assert.Equal(t, expectedTags, parseLabels(model), fmt.Sprintf("Actual tags in test case %d doesn't match expected tags", i+1))
	}
}
