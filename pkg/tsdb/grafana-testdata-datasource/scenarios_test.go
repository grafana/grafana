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
