package expr

import (
	"context"
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
	cmd, err := NewSQLCommand("a", "select a from foo, bar")
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

func TestSQLCommandRowLimits(t *testing.T) {
	tests := []struct {
		name          string
		limit         int64
		frames        []*data.Frame
		vars          []string
		expectError   bool
		errorContains string
	}{
		{
			name:   "single frame within limit",
			limit:  2,
			frames: []*data.Frame{data.NewFrame("a", data.NewField("a", nil, []string{"1", "2"}))},
			vars:   []string{"foo"},
		},
		{
			name:  "multiple frames within limit",
			limit: 4,
			frames: []*data.Frame{
				data.NewFrame("a", data.NewField("a", nil, []string{"1", "2"})),
				data.NewFrame("b", data.NewField("a", nil, []string{"3", "4"})),
			},
			vars: []string{"foo", "bar"},
		},
		{
			name:          "single frame exceeds limit",
			limit:         1,
			frames:        []*data.Frame{data.NewFrame("a", data.NewField("a", nil, []string{"1", "2"}))},
			vars:          []string{"foo"},
			expectError:   true,
			errorContains: "exceeds limit",
		},
		{
			name:  "multiple frames exceed limit",
			limit: 3,
			frames: []*data.Frame{
				data.NewFrame("a", data.NewField("a", nil, []string{"1", "2"})),
				data.NewFrame("b", data.NewField("a", nil, []string{"3", "4"})),
			},
			vars:          []string{"foo", "bar"},
			expectError:   true,
			errorContains: "exceeds limit",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd, err := NewSQLCommand("a", "select a from foo, bar")
			require.NoError(t, err, "Failed to create SQL command")

			cmd.limit = tt.limit
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
