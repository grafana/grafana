package frontendlogging

import (
	"testing"
	"time"

	"go.opentelemetry.io/collector/pdata/pcommon"
	"go.opentelemetry.io/collector/pdata/ptrace"
)

func TestSpanToKeyValUsesEndTimestamp(t *testing.T) {
	start := time.Date(2026, time.June, 16, 10, 0, 0, 0, time.UTC)
	end := start.Add(5 * time.Second)

	span := ptrace.NewSpan()
	span.SetStartTimestamp(pcommon.NewTimestampFromTime(start))
	span.SetEndTimestamp(pcommon.NewTimestampFromTime(end))

	kv := SpanToKeyVal(span)

	endTimestamp, ok := kv.Get("end_timestamp")
	if !ok {
		t.Fatal("expected end_timestamp to be set")
	}

	if got, want := endTimestamp, end.String(); got != want {
		t.Fatalf("unexpected end_timestamp: got %q, want %q", got, want)
	}

	startTimestamp, ok := kv.Get("timestamp")
	if !ok {
		t.Fatal("expected timestamp to be set")
	}

	if got, want := startTimestamp, start.String(); got != want {
		t.Fatalf("unexpected timestamp: got %q, want %q", got, want)
	}
}
