package testdatasource

import (
	"context"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource/kinds"
)

func TestTestdataScenarios(t *testing.T) {
	s := &Service{}

	t.Run("random walk ", func(t *testing.T) {
		t.Run("Should start at the requested value", func(t *testing.T) {
			from := time.Now()
			to := from.Add(5 * time.Minute)

			query := backend.DataQuery{
				RefID: "A",
				TimeRange: backend.TimeRange{
					From: from,
					To:   to,
				},
				Interval:      100 * time.Millisecond,
				MaxDataPoints: 100,
				JSON:          []byte(`{"startValue": 1.234}`),
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
			from := time.Now()
			to := from.Add(5 * time.Minute)

			query := backend.DataQuery{
				RefID: "A",
				TimeRange: backend.TimeRange{
					From: from,
					To:   to,
				},
				Interval:      100 * time.Millisecond,
				MaxDataPoints: 100,
				JSON:          []byte(`{}`),
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
			from := time.Now()
			to := from.Add(5 * time.Minute)

			query := backend.DataQuery{
				RefID: "A",
				TimeRange: backend.TimeRange{
					From: from,
					To:   to,
				},
				Interval:      100 * time.Millisecond,
				MaxDataPoints: 100,
				JSON:          []byte(`{"withNil": true}`),
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

func TestPredictableAnnotationsScenario(t *testing.T) {
	// A UTC midnight is an exact multiple of 1h and 6h from the epoch, which makes
	// the anchored event/incident counts easy to reason about.
	base := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)

	annotationsFor := func(t *testing.T, from, to time.Time, model kinds.PredictableAnnotationsQuery) *data.Frame {
		t.Helper()
		frame, err := predictableAnnotations(backend.DataQuery{
			RefID:     "Anno",
			TimeRange: backend.TimeRange{From: from, To: to},
		}, kinds.TestDataQuery{PredictableAnnotations: &model})
		require.NoError(t, err)
		require.NotNil(t, frame)
		return frame
	}

	field := func(t *testing.T, frame *data.Frame, name string) *data.Field {
		t.Helper()
		for _, f := range frame.Fields {
			if f.Name == name {
				return f
			}
		}
		t.Fatalf("field %q not found in frame", name)
		return nil
	}

	t.Run("returns an annotations frame with the expected shape", func(t *testing.T) {
		frame := annotationsFor(t, base, base.Add(5*time.Hour), kinds.PredictableAnnotationsQuery{
			EventFrequency:    "1h",
			IncidentFrequency: "6h",
			IncidentDuration:  "30m",
			Seed:              42,
		})

		require.NotNil(t, frame.Meta)
		require.Equal(t, data.DataTopicAnnotations, frame.Meta.DataTopic)
		for _, name := range []string{"time", "timeEnd", "text", "tags"} {
			require.NotNil(t, field(t, frame, name))
		}

		timeField := field(t, frame, "time")
		timeEndField := field(t, frame, "timeEnd")
		var events, incidents int
		for i := 0; i < timeField.Len(); i++ {
			ts := timeField.At(i).(time.Time)
			require.False(t, ts.Before(base), "annotation before range start")
			require.False(t, ts.After(base.Add(5*time.Hour)), "annotation after range end")

			end := timeEndField.At(i).(*time.Time)
			if end == nil {
				events++
			} else {
				incidents++
				require.Equal(t, 30*time.Minute, end.Sub(ts), "incident duration should match incidentDuration")
			}
		}

		// Events at +0h..+5h (6), one incident starting at the range start (aligned to 6h).
		require.Equal(t, 6, events)
		require.Equal(t, 1, incidents)
	})

	t.Run("is stable across time ranges - overlapping annotations are identical", func(t *testing.T) {
		model := kinds.PredictableAnnotationsQuery{EventFrequency: "1h", IncidentFrequency: "6h", IncidentDuration: "30m", Seed: 7}

		collect := func(frame *data.Frame) map[int64][2]string {
			out := map[int64][2]string{}
			timeField := field(t, frame, "time")
			textField := field(t, frame, "text")
			tagsField := field(t, frame, "tags")
			for i := 0; i < timeField.Len(); i++ {
				ts := timeField.At(i).(time.Time).UnixMilli()
				out[ts] = [2]string{textField.At(i).(string), tagsField.At(i).(string)}
			}
			return out
		}

		rangeA := collect(annotationsFor(t, base, base.Add(5*time.Hour), model))
		// A different, shifted range.
		rangeB := collect(annotationsFor(t, base.Add(2*time.Hour), base.Add(10*time.Hour), model))

		overlaps := 0
		for ts, a := range rangeA {
			if b, ok := rangeB[ts]; ok {
				overlaps++
				require.Equal(t, a, b, "annotation at %d changed between time ranges", ts)
			}
		}
		require.Greater(t, overlaps, 0, "expected some annotations to appear in both ranges")
	})

	t.Run("same seed is deterministic, different seed changes content", func(t *testing.T) {
		from, to := base, base.Add(6*time.Hour)
		textsFor := func(seed int64) []string {
			frame := annotationsFor(t, from, to, kinds.PredictableAnnotationsQuery{EventFrequency: "1h", Seed: seed})
			textField := field(t, frame, "text")
			tagsField := field(t, frame, "tags")
			out := make([]string, textField.Len())
			for i := range out {
				out[i] = textField.At(i).(string) + "|" + tagsField.At(i).(string)
			}
			return out
		}

		require.Equal(t, textsFor(1), textsFor(1), "same seed should produce identical annotations")
		require.NotEqual(t, textsFor(1), textsFor(2), "different seeds should produce different annotations")
	})

	t.Run("defaults are used when durations are omitted", func(t *testing.T) {
		frame := annotationsFor(t, base, base.Add(24*time.Hour), kinds.PredictableAnnotationsQuery{Seed: 1})
		// Default event frequency is 1h -> 25 events across a 24h range (inclusive of both ends).
		timeEndField := field(t, frame, "timeEnd")
		var events int
		for i := 0; i < timeEndField.Len(); i++ {
			if timeEndField.At(i).(*time.Time) == nil {
				events++
			}
		}
		require.Equal(t, 25, events)
	})

	t.Run("invalid duration returns an error", func(t *testing.T) {
		_, err := predictableAnnotations(backend.DataQuery{
			TimeRange: backend.TimeRange{From: base, To: base.Add(time.Hour)},
		}, kinds.TestDataQuery{PredictableAnnotations: &kinds.PredictableAnnotationsQuery{EventFrequency: "not-a-duration"}})
		require.Error(t, err)
	})

	t.Run("handler wires the scenario end to end", func(t *testing.T) {
		s := &Service{}
		query := backend.DataQuery{
			RefID:     "Anno",
			TimeRange: backend.TimeRange{From: base, To: base.Add(3 * time.Hour)},
			JSON:      []byte(`{"scenarioId":"predictable_annotations","predictableAnnotations":{"eventFrequency":"1h","seed":3}}`),
		}
		resp, err := s.handlePredictableAnnotationsScenario(context.Background(), &backend.QueryDataRequest{
			Queries: []backend.DataQuery{query},
		})
		require.NoError(t, err)
		dResp, ok := resp.Responses["Anno"]
		require.True(t, ok)
		require.NoError(t, dResp.Error)
		require.Len(t, dResp.Frames, 1)
		require.Equal(t, data.DataTopicAnnotations, dResp.Frames[0].Meta.DataTopic)
	})
}

func TestParseLabels(t *testing.T) {
	expectedTags := data.Labels{
		"job":      "foo",
		"instance": "bar",
	}
	seriesIndex := rand.Int()

	tests := []struct {
		name     string
		model    kinds.TestDataQuery
		expected data.Labels
	}{
		{
			name:     "wrapped in {} and quoted value ",
			model:    kinds.TestDataQuery{Labels: `{job="foo", instance="bar"}`},
			expected: expectedTags,
		},
		{
			name:     "comma-separated non-quoted",
			model:    kinds.TestDataQuery{Labels: `job=foo, instance=bar`},
			expected: expectedTags,
		},
		{
			name:     "comma-separated quoted",
			model:    kinds.TestDataQuery{Labels: `job="foo"", instance="bar"`},
			expected: expectedTags,
		},
		{
			name:     "comma-separated with spaces, non quoted",
			model:    kinds.TestDataQuery{Labels: `job = foo,instance = bar`},
			expected: expectedTags,
		},
		{
			name:  "expands $seriesIndex",
			model: kinds.TestDataQuery{Labels: `job=series-$seriesIndex,instance=bar`},
			expected: data.Labels{
				"job":      fmt.Sprintf("series-%d", seriesIndex),
				"instance": "bar",
			},
		},
	}

	for i, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, parseLabels(tc.model, seriesIndex), fmt.Sprintf("Actual tags in test case %d doesn't match expected tags", i+1))
		})
	}
}
