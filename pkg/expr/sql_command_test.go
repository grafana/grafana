package expr

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/metrics"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

func TestNewCommand(t *testing.T) {
	cmd, err := NewSQLCommand(t.Context(), log.NewNullLogger(), "a", "", "select a from foo, bar", 0, 0, 0)
	if err != nil && strings.Contains(err.Error(), "feature is not enabled") {
		return
	}

	if err != nil {
		t.Fail()
		return
	}

	for _, v := range cmd.varsToQuery {
		if strings.Contains("foo bar", v) {
			continue
		}
		t.Fail()
		return
	}
}

// Helper function for creating test data
func createFrameWithRowsAndCols(rows int, cols int) *data.Frame {
	frame := data.NewFrame("dummy")

	for c := 0; c < cols; c++ {
		values := make([]string, rows)
		frame.Fields = append(frame.Fields, data.NewField(fmt.Sprintf("col%d", c), nil, values))
	}

	return frame
}

func TestSQLCommandCellLimits(t *testing.T) {
	tests := []struct {
		name          string
		limit         int64
		frames        []*data.Frame
		vars          []string
		expectError   bool
		errorContains string
	}{
		{
			name:  "single (long) frame within cell limit",
			limit: 10,
			frames: []*data.Frame{
				createFrameWithRowsAndCols(10, 1), // 10 cells
			},
			vars: []string{"foo"},
		},
		{
			name:  "single (wide) frame within cell limit",
			limit: 10,
			frames: []*data.Frame{
				createFrameWithRowsAndCols(1, 10), // 10 cells
			},
			vars: []string{"foo"},
		},
		{
			name:  "multiple frames within cell limit",
			limit: 12,
			frames: []*data.Frame{
				createFrameWithRowsAndCols(2, 3), // 6 cells
				createFrameWithRowsAndCols(2, 3), // 6 cells
			},
			vars: []string{"foo", "bar"},
		},
		{
			name:  "single (long) frame exceeds cell limit",
			limit: 9,
			frames: []*data.Frame{
				createFrameWithRowsAndCols(10, 1), // 10 cells > 9 limit
			},
			vars:          []string{"foo"},
			expectError:   true,
			errorContains: "exceeded the configured limit",
		},
		{
			name:  "single (wide) frame exceeds cell limit",
			limit: 9,
			frames: []*data.Frame{
				createFrameWithRowsAndCols(1, 10), // 10 cells > 9 limit
			},
			vars:          []string{"foo"},
			expectError:   true,
			errorContains: "exceeded the configured limit",
		},
		{
			name:  "multiple frames exceed cell limit",
			limit: 11,
			frames: []*data.Frame{
				createFrameWithRowsAndCols(2, 3), // 6 cells
				createFrameWithRowsAndCols(2, 3), // 6 cells
			},
			vars:          []string{"foo", "bar"},
			expectError:   true,
			errorContains: "exceeded the configured limit",
		},
		{
			name:  "limit of 0 means no limit: allow large frame",
			limit: 0,
			frames: []*data.Frame{
				createFrameWithRowsAndCols(200000, 1), // 200,000 cells
			},
			vars: []string{"foo", "bar"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd, err := NewSQLCommand(t.Context(), log.New(), "a", "", "select a from foo, bar", tt.limit, 0, 0)
			require.NoError(t, err, "Failed to create SQL command")

			vars := mathexp.Vars{}

			for i, frame := range tt.frames {
				vars[tt.vars[i]] = mathexp.Results{
					Values: mathexp.Values{mathexp.TableData{Frame: frame}},
				}
			}

			res, _ := cmd.Execute(context.Background(), time.Now(), vars, &testTracer{}, metrics.NewTestMetrics())

			if tt.expectError {
				require.Error(t, res.Error)
				require.ErrorContains(t, res.Error, tt.errorContains)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestSQLCommandMetrics(t *testing.T) {
	// Create test metrics
	m := metrics.NewTestMetrics()

	// Create a command
	cmd, err := NewSQLCommand(t.Context(), log.NewNullLogger(), "A", "someformat", "select * from foo", 0, 0, 0)
	require.NoError(t, err)

	// Execute successful command
	_, err = cmd.Execute(context.Background(), time.Now(), mathexp.Vars{}, &testTracer{}, m)
	require.NoError(t, err)

	// Verify count metric was recorded
	require.Equal(t, 1, testutil.CollectAndCount(m.SqlCommandCount), "Expected count metric to be recorded")

	// Verify duration was recorded
	require.Equal(t, 1, testutil.CollectAndCount(m.SqlCommandDuration), "Expected duration metric to be recorded")

	// Verify cell count was recorded
	require.Equal(t, 1, testutil.CollectAndCount(m.SqlCommandCellCount), "Expected cell count metric to be recorded")
}

func TestSQLCommandFunctionMetrics(t *testing.T) {
	t.Run("allowed functions are counted with allowed=true", func(t *testing.T) {
		m := metrics.NewTestMetrics()
		cmd, err := NewSQLCommand(t.Context(), log.NewNullLogger(), "A", "",
			"SELECT SUM(val), ROUND(AVG(val), 2) FROM foo", 0, 0, 0)
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"avg", "round", "sum"}, cmd.functions)

		_, _ = cmd.Execute(t.Context(), time.Now(), mathexp.Vars{}, &testTracer{}, m)

		require.Equal(t, float64(1),
			testutil.ToFloat64(m.SqlCommandFunctionCount.WithLabelValues("sum", "true")),
			"sum should be counted as allowed")
		require.Equal(t, float64(1),
			testutil.ToFloat64(m.SqlCommandFunctionCount.WithLabelValues("avg", "true")),
			"avg should be counted as allowed")
		require.Equal(t, float64(1),
			testutil.ToFloat64(m.SqlCommandFunctionCount.WithLabelValues("round", "true")),
			"round should be counted as allowed")
	})

	t.Run("known disallowed function is counted under its own name with allowed=false", func(t *testing.T) {
		m := metrics.NewTestMetrics()
		// SLEEP is syntactically valid, not in the allowlist, and is a known GMS built-in.
		cmd, err := NewSQLCommand(t.Context(), log.NewNullLogger(), "A", "",
			"SELECT SLEEP(1) FROM foo", 0, 0, 0)
		require.NoError(t, err)
		require.Equal(t, []string{"sleep"}, cmd.functions)

		_, _ = cmd.Execute(t.Context(), time.Now(), mathexp.Vars{}, &testTracer{}, m)

		require.Equal(t, float64(1),
			testutil.ToFloat64(m.SqlCommandFunctionCount.WithLabelValues("sleep", "false")),
			"sleep should be counted under its own name")
		require.Equal(t, float64(0),
			testutil.ToFloat64(m.SqlCommandFunctionCount.WithLabelValues("sleep", "true")),
			"sleep must not appear with allowed=true")
	})

	t.Run("GMS built-in not in allowlist is emitted under its own name with allowed=false", func(t *testing.T) {
		m := metrics.NewTestMetrics()
		// LPAD is in the GMS built-in registry but not in our allowlist,
		// so it should be named in the metric rather than bucketed.
		cmd, err := NewSQLCommand(t.Context(), log.NewNullLogger(), "A", "",
			"SELECT LPAD(col, 10, '0') FROM foo", 0, 0, 0)
		require.NoError(t, err)
		require.Equal(t, []string{"lpad"}, cmd.functions)

		_, _ = cmd.Execute(t.Context(), time.Now(), mathexp.Vars{}, &testTracer{}, m)

		require.Equal(t, float64(1),
			testutil.ToFloat64(m.SqlCommandFunctionCount.WithLabelValues("lpad", "false")),
			"lpad is a known GMS function and should appear under its own name")
		require.Equal(t, float64(0),
			testutil.ToFloat64(m.SqlCommandFunctionCount.WithLabelValues("unknown", "false")),
			"lpad must not be bucketed as unknown")
	})

	t.Run("truly unknown function is bucketed as unknown", func(t *testing.T) {
		m := metrics.NewTestMetrics()
		// MY_CUSTOM_UDF is not in the GMS registry or the allowlist, so its
		// raw name must never appear as a Prometheus label value.
		cmd, err := NewSQLCommand(t.Context(), log.NewNullLogger(), "A", "",
			"SELECT MY_CUSTOM_UDF(col) FROM foo", 0, 0, 0)
		require.NoError(t, err)
		require.Equal(t, []string{"my_custom_udf"}, cmd.functions)

		_, _ = cmd.Execute(t.Context(), time.Now(), mathexp.Vars{}, &testTracer{}, m)

		require.Equal(t, float64(1),
			testutil.ToFloat64(m.SqlCommandFunctionCount.WithLabelValues("unknown", "false")),
			"unrecognised function should be bucketed as unknown")
		require.Equal(t, float64(0),
			testutil.ToFloat64(m.SqlCommandFunctionCount.WithLabelValues("my_custom_udf", "false")),
			"raw UDF name must not appear as a label value")
	})

	t.Run("each function is counted once per execution even if called multiple times", func(t *testing.T) {
		m := metrics.NewTestMetrics()
		cmd, err := NewSQLCommand(t.Context(), log.NewNullLogger(), "A", "",
			"SELECT ROUND(SUM(a), 0), ROUND(AVG(b), 0) FROM foo", 0, 0, 0)
		require.NoError(t, err)
		// ROUND appears twice but should only produce one entry in cmd.functions.
		require.ElementsMatch(t, []string{"avg", "round", "sum"}, cmd.functions)

		_, _ = cmd.Execute(t.Context(), time.Now(), mathexp.Vars{}, &testTracer{}, m)

		require.Equal(t, float64(1),
			testutil.ToFloat64(m.SqlCommandFunctionCount.WithLabelValues("round", "true")),
			"round should be counted exactly once despite appearing twice in the query")
	})

	t.Run("query with no functions records nothing in the function counter", func(t *testing.T) {
		m := metrics.NewTestMetrics()
		cmd, err := NewSQLCommand(t.Context(), log.NewNullLogger(), "A", "",
			"SELECT col FROM foo WHERE col > 1", 0, 0, 0)
		require.NoError(t, err)
		require.Empty(t, cmd.functions)

		_, _ = cmd.Execute(t.Context(), time.Now(), mathexp.Vars{}, &testTracer{}, m)

		require.Equal(t, 0, testutil.CollectAndCount(m.SqlCommandFunctionCount),
			"no function metrics should be emitted for a query with no function calls")
	})
}

func TestHandleSqlInput(t *testing.T) {
	tests := []struct {
		name        string
		frames      data.Frames
		expectErr   string
		expectFrame bool
		converted   bool
	}{
		{
			name:        "single frame with no fields and no type is passed through",
			frames:      data.Frames{data.NewFrame("")},
			expectFrame: true,
		},
		{
			name:        "single frame with no fields but type timeseries-multi is passed through",
			frames:      data.Frames{data.NewFrame("").SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti})},
			expectFrame: true,
		},
		{
			name: "single frame, no labels, no type → passes through",
			frames: data.Frames{
				data.NewFrame("",
					data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
					data.NewField("value", nil, []*float64{new(2.0)}),
				),
			},
			expectFrame: true,
		},
		{
			name: "single frame with labels, but missing FrameMeta.Type → error",
			frames: data.Frames{
				data.NewFrame("",
					data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
					data.NewField("value", data.Labels{"foo": "bar"}, []*float64{new(2.0)}),
				),
			},
			expectErr: "labels in the response that can not be mapped to a table",
		},
		{
			name: "multiple frames, no type → error",
			frames: data.Frames{
				data.NewFrame("",
					data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
					data.NewField("value", nil, []*float64{new(2.0)}),
				),
				data.NewFrame("",
					data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
					data.NewField("value", nil, []*float64{new(2.0)}),
				),
			},
			expectErr: "more than one dataframe that can not be automatically mapped to a single table",
		},
		{
			name: "supported type (timeseries-multi) triggers ConvertToFullLong",
			frames: data.Frames{
				data.NewFrame("",
					data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
					data.NewField("value", data.Labels{"host": "a"}, []*float64{new(2.0)}),
				).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}),
			},
			expectFrame: true,
			converted:   true,
		},
		{
			name: "supported type (timeseries-multi) but malformed returns error",
			frames: data.Frames{
				data.NewFrame("",
					data.NewField("time", nil, []string{"1"}), // string is not valid for time field
					data.NewField("value", data.Labels{"host": "a"}, []*float64{new(2.0)}),
				).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}),
			},
			expectErr: "missing time field",
			converted: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			res, c := handleSqlInput(t.Context(), &testTracer{}, "a", map[string]struct{}{"b": {}}, "fakeDS", tc.frames)
			require.Equal(t, tc.converted, c, "conversion bool mismatch")
			if tc.expectErr != "" {
				require.Error(t, res.Error)
				require.ErrorContains(t, res.Error, tc.expectErr)
			} else {
				require.NoError(t, res.Error)
				if tc.expectFrame {
					require.Len(t, res.Values, 1)
					require.IsType(t, mathexp.TableData{}, res.Values[0])
					require.NotNil(t, res.Values[0].(mathexp.TableData).Frame)
				}
			}
		})
	}
}

type testTracer struct {
	trace.Tracer
}

func (t *testTracer) Start(ctx context.Context, name string, s ...trace.SpanStartOption) (context.Context, trace.Span) {
	return ctx, &testSpan{}
}
func (t *testTracer) Inject(context.Context, http.Header, trace.Span) {

}

type testSpan struct {
	trace.Span
}

func (ts *testSpan) End(opt ...trace.SpanEndOption) {
}

func (ts *testSpan) RecordError(err error, opt ...trace.EventOption) {
}

func (ts *testSpan) SetStatus(code codes.Code, msg string) {}

func (ts *testSpan) AddEvent(name string, opts ...trace.EventOption) {}

func (ts *testSpan) SetAttributes(kv ...attribute.KeyValue) {}

func (ts *testSpan) SpanContext() trace.SpanContext {
	return trace.SpanContext{}
}
