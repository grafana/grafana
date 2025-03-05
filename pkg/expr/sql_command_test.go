package expr

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr/mathexp"
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

func TestExecuteWithinLimit(t *testing.T) {
	cmd, err := NewSQLCommand("a", "select a from foo, bar")
	if err != nil {
		t.Fatalf("Failed to create SQL command: %v", err)
	}
	cmd.limit = 2

	frame := data.NewFrame("a", data.NewField("a", nil, []string{"1", "2"}))
	vars := mathexp.Vars{}
	vars["foo"] = mathexp.Results{
		Values: mathexp.Values{mathexp.TableData{Frame: frame}},
	}

	_, err = cmd.Execute(context.Background(), time.Now(), vars, &testTracer{})
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
}

func TestExecuteWithinLimitWithMultipleFrames(t *testing.T) {
	cmd, err := NewSQLCommand("a", "select a from foo, bar")
	if err != nil {
		t.Fatalf("Failed to create SQL command: %v", err)
	}
	cmd.limit = 4

	frame1 := data.NewFrame("a", data.NewField("a", nil, []string{"1", "2"}))
	frame2 := data.NewFrame("b", data.NewField("a", nil, []string{"3", "4"}))
	vars := mathexp.Vars{}
	vars["foo"] = mathexp.Results{
		Values: mathexp.Values{mathexp.TableData{Frame: frame1}},
	}
	vars["bar"] = mathexp.Results{
		Values: mathexp.Values{mathexp.TableData{Frame: frame2}},
	}

	_, err = cmd.Execute(context.Background(), time.Now(), vars, &testTracer{})
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
}

func TestExecuteExceedsLimit(t *testing.T) {
	cmd, err := NewSQLCommand("a", "select a from foo, bar")
	if err != nil {
		t.Fatalf("Failed to create SQL command: %v", err)
	}
	cmd.limit = 1

	frame := data.NewFrame("a", data.NewField("a", nil, []string{"1", "2"}))
	vars := mathexp.Vars{}
	vars["foo"] = mathexp.Results{
		Values: mathexp.Values{mathexp.TableData{Frame: frame}},
	}

	_, err = cmd.Execute(context.Background(), time.Now(), vars, &testTracer{})
	if err == nil {
		t.Fatal("Expected an error when total rows exceeds limit, but got nil")
	}

	expectedErrMsg := "exceeds limit"
	if !strings.Contains(err.Error(), expectedErrMsg) {
		t.Fatalf("Expected error message to contain '%s', got: '%s'", expectedErrMsg, err.Error())
	}
}

func TestExecuteExceedsLimitWithMultipleFrames(t *testing.T) {
	cmd, err := NewSQLCommand("a", "select a from foo, bar")
	if err != nil {
		t.Fatalf("Failed to create SQL command: %v", err)
	}
	cmd.limit = 3

	frame1 := data.NewFrame("a", data.NewField("a", nil, []string{"1", "2"}))
	frame2 := data.NewFrame("b", data.NewField("a", nil, []string{"3", "4"}))
	vars := mathexp.Vars{}
	vars["foo"] = mathexp.Results{
		Values: mathexp.Values{mathexp.TableData{Frame: frame1}},
	}
	vars["bar"] = mathexp.Results{
		Values: mathexp.Values{mathexp.TableData{Frame: frame2}},
	}

	_, err = cmd.Execute(context.Background(), time.Now(), vars, &testTracer{})
	if err == nil {
		t.Fatal("Expected an error when total rows exceeds limit, but got nil")
	}

	expectedErrMsg := "exceeds limit"
	if !strings.Contains(err.Error(), expectedErrMsg) {
		t.Fatalf("Expected error message to contain '%s', got: '%s'", expectedErrMsg, err.Error())
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
