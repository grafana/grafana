package expr

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/metrics"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

func TestNewCommand(t *testing.T) {
	cmd, err := NewSQLCommand(t.Context(), "a", "", "select a from foo, bar", 0, 0, 0)
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
			errorContains: "exceeds limit",
		},
		{
			name:  "single (wide) frame exceeds cell limit",
			limit: 9,
			frames: []*data.Frame{
				createFrameWithRowsAndCols(1, 10), // 10 cells > 9 limit
			},
			vars:          []string{"foo"},
			expectError:   true,
			errorContains: "exceeds limit",
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
			errorContains: "exceeds limit",
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
			cmd, err := NewSQLCommand(t.Context(), "a", "", "select a from foo, bar", tt.limit, 0, 0)
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
	cmd, err := NewSQLCommand(t.Context(), "A", "someformat", "select * from foo", 0, 0, 0)
	require.NoError(t, err)

	// Execute successful command
	_, err = cmd.Execute(context.Background(), time.Now(), mathexp.Vars{}, &testTracer{}, m)
	require.NoError(t, err)

	// Verify error count was not incremented
	require.Equal(t, 1, testutil.CollectAndCount(m.SqlCommandCount), "Expected error metric not to be recorded")

	// Verify duration was recorded
	require.Equal(t, 1, testutil.CollectAndCount(m.SqlCommandDuration), "Expected duration metric to be recorded")

	// Verify cell count was recorded
	require.Equal(t, 1, testutil.CollectAndCount(m.SqlCommandCellCount), "Expected cell count metric to be recorded")
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
