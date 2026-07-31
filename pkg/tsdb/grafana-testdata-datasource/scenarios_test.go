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

	t.Run("flaky query", func(t *testing.T) {
		s := &Service{}
		from := time.Now()
		to := from.Add(5 * time.Minute)

		makeReq := func(probability float64) *backend.QueryDataRequest {
			return &backend.QueryDataRequest{
				PluginContext: backend.PluginContext{},
				Queries: []backend.DataQuery{
					{
						RefID: "A",
						TimeRange: backend.TimeRange{
							From: from,
							To:   to,
						},
						Interval:      100 * time.Millisecond,
						MaxDataPoints: 100,
						JSON: []byte(fmt.Sprintf(
							`{"queryDelay":"0s","errorProbability":%v,"errorMessage":"test error","errorStatusCode":400,"errorSource":"downstream"}`,
							probability,
						)),
					},
				},
			}
		}

		t.Run("returns error when probability is 100", func(t *testing.T) {
			resp, err := s.handleFlakyQueryScenario(context.Background(), makeReq(100))
			require.NoError(t, err)
			require.NotNil(t, resp)

			dResp, exists := resp.Responses["A"]
			require.True(t, exists)
			require.Error(t, dResp.Error)
			require.Equal(t, "test error", dResp.Error.Error())
			require.Equal(t, backend.StatusBadRequest, dResp.Status)
			require.Equal(t, backend.ErrorSourceDownstream, dResp.ErrorSource)
			require.Empty(t, dResp.Frames)
		})

		t.Run("returns data when probability is 0", func(t *testing.T) {
			resp, err := s.handleFlakyQueryScenario(context.Background(), makeReq(0))
			require.NoError(t, err)
			require.NotNil(t, resp)

			dResp, exists := resp.Responses["A"]
			require.True(t, exists)
			require.NoError(t, dResp.Error)
			require.Len(t, dResp.Frames, 1)
		})
	})

	t.Run("errors and notices", func(t *testing.T) {
		t.Run("Should attach one notice of each severity to the frame meta", func(t *testing.T) {
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

			resp, err := s.handleErrorsAndNoticesScenario(context.Background(), req)
			require.NoError(t, err)
			require.NotNil(t, resp)

			dResp, exists := resp.Responses[query.RefID]
			require.True(t, exists)
			require.NoError(t, dResp.Error)

			require.Len(t, dResp.Frames, 1)
			frame := dResp.Frames[0]
			require.NotNil(t, frame.Meta)
			require.Len(t, frame.Meta.Notices, 3)

			severities := map[data.NoticeSeverity]string{}
			for _, n := range frame.Meta.Notices {
				severities[n.Severity] = n.Text
				require.NotEmpty(t, n.Text)
			}

			require.Contains(t, severities, data.NoticeSeverityInfo)
			require.Contains(t, severities, data.NoticeSeverityWarning)
			require.Contains(t, severities, data.NoticeSeverityError)

			// The error notice points the inspector at the error tab.
			var errNotice *data.Notice
			for i := range frame.Meta.Notices {
				if frame.Meta.Notices[i].Severity == data.NoticeSeverityError {
					errNotice = &frame.Meta.Notices[i]
				}
			}
			require.NotNil(t, errNotice)
			require.Equal(t, data.InspectTypeError, errNotice.Inspect)
		})
	})
}

func TestFlakyQueryDelay(t *testing.T) {
	t.Run("returns 0 for non-positive base", func(t *testing.T) {
		require.Equal(t, time.Duration(0), flakyQueryDelay(0, 100))
		require.Equal(t, time.Duration(0), flakyQueryDelay(-time.Second, 100))
	})

	t.Run("returns base unchanged with 0 variability", func(t *testing.T) {
		base := time.Second
		for i := 0; i < 100; i++ {
			require.Equal(t, base, flakyQueryDelay(base, 0))
		}
	})

	t.Run("stays within +/- variability percentage of base", func(t *testing.T) {
		base := time.Second
		// 100% variability => uniform in [0, 2*base]
		for i := 0; i < 1000; i++ {
			delay := flakyQueryDelay(base, 100)
			require.GreaterOrEqual(t, delay, time.Duration(0))
			require.LessOrEqual(t, delay, 2*base)
		}

		// 50% variability => uniform in [0.5*base, 1.5*base]
		for i := 0; i < 1000; i++ {
			delay := flakyQueryDelay(base, 50)
			require.GreaterOrEqual(t, delay, base/2)
			require.LessOrEqual(t, delay, base+base/2)
		}
	})
}

func TestExemplarsScenario(t *testing.T) {
	s := &Service{}
	from := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	to := from.Add(time.Hour)

	newQuery := func(json string) backend.DataQuery {
		return backend.DataQuery{
			RefID: "A",
			TimeRange: backend.TimeRange{
				From: from,
				To:   to,
			},
			Interval:      time.Second,
			MaxDataPoints: 100,
			JSON:          []byte(json),
		}
	}

	runScenario := func(t *testing.T, json string) backend.DataResponse {
		t.Helper()
		query := newQuery(json)
		resp, err := s.handleExemplarsScenario(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{},
			Queries:       []backend.DataQuery{query},
		})
		require.NoError(t, err)
		require.NotNil(t, resp)

		dResp, exists := resp.Responses[query.RefID]
		require.True(t, exists)
		return dResp
	}

	singleFrame := func(t *testing.T, json string) *data.Frame {
		t.Helper()
		dResp := runScenario(t, json)
		require.NoError(t, dResp.Error)
		require.Len(t, dResp.Frames, 1)
		return dResp.Frames[0]
	}

	values := func(t *testing.T, frame *data.Frame) []float64 {
		t.Helper()
		out := make([]float64, frame.Rows())
		for i := range out {
			v, ok := frame.Fields[1].At(i).(float64)
			require.True(t, ok)
			out[i] = v
		}
		return out
	}

	times := func(t *testing.T, frame *data.Frame) []time.Time {
		t.Helper()
		out := make([]time.Time, frame.Rows())
		for i := range out {
			v, ok := frame.Fields[0].At(i).(time.Time)
			require.True(t, ok)
			out[i] = v
		}
		return out
	}

	t.Run("is registered and reachable by scenario id", func(t *testing.T) {
		svc := ProvideService()

		scenario, registered := svc.scenarios[kinds.TestDataQueryTypeExemplars]
		require.True(t, registered)
		require.Equal(t, "Exemplars", scenario.Name)
		require.NotEmpty(t, scenario.Description)

		resp, err := svc.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{},
			Queries:       []backend.DataQuery{newQuery(`{"scenarioId": "exemplars"}`)},
		})
		require.NoError(t, err)
		require.Len(t, resp.Responses["A"].Frames, 1)
		require.Equal(t, "exemplar", resp.Responses["A"].Frames[0].Name)
	})

	t.Run("returns a frame the panel recognises as exemplars", func(t *testing.T) {
		frame := singleFrame(t, `{}`)

		require.Equal(t, "exemplar", frame.Name)
		require.NotNil(t, frame.Meta)
		require.Equal(t, data.DataTopicAnnotations, frame.Meta.DataTopic)
		require.Equal(t, map[string]any{"resultType": "exemplar"}, frame.Meta.Custom)

		require.Len(t, frame.Fields, 2)
		require.Equal(t, data.TimeSeriesTimeFieldName, frame.Fields[0].Name)
		require.Equal(t, data.TimeSeriesValueFieldName, frame.Fields[1].Name)
		require.Equal(t, 100, frame.Rows())
	})

	t.Run("count defaults, is honoured and is capped", func(t *testing.T) {
		require.Equal(t, 100, singleFrame(t, `{}`).Rows())
		require.Equal(t, 100, singleFrame(t, `{"exemplarCount": 0}`).Rows())
		require.Equal(t, 100, singleFrame(t, `{"exemplarCount": -5}`).Rows())
		require.Equal(t, 7, singleFrame(t, `{"exemplarCount": 7}`).Rows())
		require.Equal(t, 1, singleFrame(t, `{"exemplarCount": 1}`).Rows())
		require.Equal(t, maxExemplarCount, singleFrame(t, `{"exemplarCount": 999999}`).Rows())
	})

	t.Run("is seeded by the time range", func(t *testing.T) {
		first := singleFrame(t, `{}`)
		second := singleFrame(t, `{}`)
		require.Equal(t, times(t, first), times(t, second))
		require.Equal(t, values(t, first), values(t, second))

		other := Exemplars(backend.DataQuery{
			RefID:     "A",
			TimeRange: backend.TimeRange{From: from.Add(-time.Hour), To: to},
			Interval:  time.Second,
		}, kinds.TestDataQuery{})
		require.NotEqual(t, values(t, first), values(t, other))
	})

	t.Run("values stay inside an explicit min and max", func(t *testing.T) {
		frame := singleFrame(t, `{"min": 5, "max": 6}`)
		for _, v := range values(t, frame) {
			require.GreaterOrEqual(t, v, 5.0)
			require.LessOrEqual(t, v, 6.0)
		}

		// Bounds given the wrong way round are swapped rather than producing NaN.
		frame = singleFrame(t, `{"min": 6, "max": 5}`)
		for _, v := range values(t, frame) {
			require.GreaterOrEqual(t, v, 5.0)
			require.LessOrEqual(t, v, 6.0)
		}
	})

	t.Run("values fall in the derived band when min and max are blank", func(t *testing.T) {
		query := newQuery(`{}`)
		model, err := GetJSONModel(query.JSON)
		require.NoError(t, err)

		seeded := rand.New(rand.NewSource(query.TimeRange.From.UnixNano() + query.TimeRange.To.UnixNano()))
		minValue, maxValue := exemplarValueRange(query, model, seeded)
		require.Less(t, minValue, maxValue)

		for _, v := range values(t, singleFrame(t, `{}`)) {
			require.GreaterOrEqual(t, v, minValue)
			require.LessOrEqual(t, v, maxValue)
		}
	})

	t.Run("timestamps are in range, on the interval grid and non-decreasing", func(t *testing.T) {
		frame := singleFrame(t, `{}`)
		ts := times(t, frame)
		require.Len(t, ts, 100)

		for i, ti := range ts {
			require.False(t, ti.Before(from), "exemplar %d is before the range start", i)
			require.False(t, ti.After(to), "exemplar %d is after the range end", i)
			require.Zero(t, ti.Sub(from)%time.Second, "exemplar %d is off the interval grid", i)
			if i > 0 {
				require.False(t, ti.Before(ts[i-1]), "exemplar %d is out of order", i)
			}
		}
	})

	t.Run("handles a zero interval and an empty time range", func(t *testing.T) {
		require.NotPanics(t, func() {
			frame := Exemplars(backend.DataQuery{
				RefID:     "A",
				TimeRange: backend.TimeRange{From: from, To: to},
			}, kinds.TestDataQuery{})
			require.Equal(t, defaultExemplarCount, frame.Rows())
		})

		require.NotPanics(t, func() {
			frame := Exemplars(backend.DataQuery{
				RefID:     "A",
				TimeRange: backend.TimeRange{From: from, To: from},
				Interval:  time.Second,
			}, kinds.TestDataQuery{})
			require.Equal(t, defaultExemplarCount, frame.Rows())
			for _, ti := range times(t, frame) {
				require.True(t, ti.Equal(from))
			}
		})
	})

	t.Run("fails per query when the error rate is set", func(t *testing.T) {
		dResp := runScenario(t, `{"errorProbability": 100, "errorStatusCode": 400, "errorSource": "downstream"}`)
		require.Error(t, dResp.Error)
		require.Equal(t, "Exemplar query error", dResp.Error.Error())
		require.Equal(t, backend.StatusBadRequest, dResp.Status)
		require.Equal(t, backend.ErrorSourceDownstream, dResp.ErrorSource)
		require.Empty(t, dResp.Frames)

		dResp = runScenario(t, `{"errorProbability": 100, "errorMessage": "custom message"}`)
		require.Error(t, dResp.Error)
		require.Equal(t, "custom message", dResp.Error.Error())
		require.Equal(t, backend.ErrorSourcePlugin, dResp.ErrorSource)

		for i := 0; i < 50; i++ {
			require.NoError(t, runScenario(t, `{"errorProbability": 0}`).Error)
		}
	})

	t.Run("only the failing query in a request errors", func(t *testing.T) {
		failing := newQuery(`{"errorProbability": 100}`)
		failing.RefID = "A"
		succeeding := newQuery(`{}`)
		succeeding.RefID = "B"

		resp, err := s.handleExemplarsScenario(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{},
			Queries:       []backend.DataQuery{failing, succeeding},
		})
		require.NoError(t, err)
		require.Error(t, resp.Responses["A"].Error)
		require.NoError(t, resp.Responses["B"].Error)
		require.Len(t, resp.Responses["B"].Frames, 1)
	})

	t.Run("adds a string field per label", func(t *testing.T) {
		frame := singleFrame(t, `{"exemplarCount": 3, "exemplarLabels": [{"name": "traceID", "length": 32}, {"name": "service", "length": 8}]}`)

		require.Len(t, frame.Fields, 4)
		require.Equal(t, "traceID", frame.Fields[2].Name)
		require.Equal(t, "service", frame.Fields[3].Name)

		seenTraceIDs := map[string]bool{}
		for i := 0; i < frame.Rows(); i++ {
			traceID, ok := frame.Fields[2].At(i).(string)
			require.True(t, ok)
			require.Len(t, traceID, 32)
			seenTraceIDs[traceID] = true

			service, ok := frame.Fields[3].At(i).(string)
			require.True(t, ok)
			require.Len(t, service, 8)
		}
		require.Len(t, seenTraceIDs, frame.Rows(), "label values should differ from row to row")

		// Deterministic for the same time range.
		require.Equal(t,
			frame.Fields[2].At(0),
			singleFrame(t, `{"exemplarCount": 3, "exemplarLabels": [{"name": "traceID", "length": 32}, {"name": "service", "length": 8}]}`).Fields[2].At(0),
		)
	})

	t.Run("label length defaults and is capped", func(t *testing.T) {
		frame := singleFrame(t, `{"exemplarCount": 1, "exemplarLabels": [{"name": "a"}, {"name": "b", "length": 9999}]}`)
		require.Len(t, frame.Fields, 4)
		require.Len(t, frame.Fields[2].At(0), defaultExemplarLabelLength)
		require.Len(t, frame.Fields[3].At(0), maxExemplarLabelLength)
	})

	t.Run("drops empty, duplicate and reserved label names", func(t *testing.T) {
		frame := singleFrame(t, `{"exemplarLabels": [{"name": ""}, {"name": "traceID"}, {"name": "traceID"}, {"name": "Time"}, {"name": "Value"}]}`)
		require.Len(t, frame.Fields, 3)
		require.Equal(t, "traceID", frame.Fields[2].Name)
	})

	t.Run("attaches a data link to a labelled field", func(t *testing.T) {
		frame := singleFrame(t, `{"exemplarLabels": [{"name": "traceID", "link": "https://example.com/trace/${__value.raw}"}, {"name": "service"}]}`)

		require.Len(t, frame.Fields, 4)
		require.NotNil(t, frame.Fields[2].Config)
		require.Len(t, frame.Fields[2].Config.Links, 1)
		require.Equal(t, "https://example.com/trace/${__value.raw}", frame.Fields[2].Config.Links[0].URL)
		require.Equal(t, "Go to traceID", frame.Fields[2].Config.Links[0].Title)
		require.True(t, frame.Fields[2].Config.Links[0].TargetBlank)

		require.Nil(t, frame.Fields[3].Config)
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
