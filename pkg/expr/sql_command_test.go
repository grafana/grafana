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
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace"
)

func TestNewCommand(t *testing.T) {
	cmd, err := NewSQLCommand("a", "", "select a from foo, bar", 0)
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
			cmd, err := NewSQLCommand("a", "", "select a from foo, bar", tt.limit)
			require.NoError(t, err, "Failed to create SQL command")

			vars := mathexp.Vars{}

			for i, frame := range tt.frames {
				vars[tt.vars[i]] = mathexp.Results{
					Values: mathexp.Values{mathexp.TableData{Frame: frame}},
				}
			}

			_, err = cmd.Execute(context.Background(), time.Now(), vars, &testTracer{})

			if tt.expectError {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.errorContains)
			} else {
				require.NoError(t, err)
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
