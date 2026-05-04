package zipkin

import (
	"encoding/json"
	"net"
	"strings"
	"testing"
	"time"

	"github.com/openzipkin/zipkin-go/model"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
)

func TestTraceLogJSONCasing(t *testing.T) {
	// Verify that TraceLog fields serialize to lowercase JSON keys,
	// matching the frontend TraceLog type from @grafana/data which expects
	// "timestamp" and "fields" (not "Timestamp" and "Fields").
	span := model.SpanModel{
		SpanContext: model.SpanContext{
			TraceID: model.TraceID{High: 1, Low: 2},
			ID:      1,
		},
		Name:      "test-span",
		Timestamp: time.Unix(0, 1*int64(time.Microsecond)),
		Duration:  10 * time.Microsecond,
		LocalEndpoint: &model.Endpoint{
			ServiceName: "test-service",
		},
		Annotations: []model.Annotation{
			{Timestamp: time.Unix(0, 100*int64(time.Microsecond)), Value: "test annotation"},
		},
	}

	frame := transformResponse([]model.SpanModel{span}, "test")

	// The "logs" field is at index 8
	logsRaw := frame.Fields[8].At(0)
	logsJSON, ok := logsRaw.(json.RawMessage)
	if !ok {
		t.Fatalf("expected json.RawMessage, got %T", logsRaw)
	}

	logsStr := string(logsJSON)

	// Should use lowercase keys (matching @grafana/data TraceLog type)
	if !strings.Contains(logsStr, `"timestamp"`) {
		t.Errorf("expected lowercase \"timestamp\" in logs JSON, got: %s", logsStr)
	}
	if !strings.Contains(logsStr, `"fields"`) {
		t.Errorf("expected lowercase \"fields\" in logs JSON, got: %s", logsStr)
	}

	// Should NOT use uppercase keys
	if strings.Contains(logsStr, `"Timestamp"`) {
		t.Errorf("found uppercase \"Timestamp\" in logs JSON — frontend expects lowercase: %s", logsStr)
	}
	if strings.Contains(logsStr, `"Fields"`) {
		t.Errorf("found uppercase \"Fields\" in logs JSON — frontend expects lowercase: %s", logsStr)
	}
}

func TestTransformResponse(t *testing.T) {
	t.Run("simple_trace", func(t *testing.T) {
		span1 := model.SpanModel{
			SpanContext: model.SpanContext{
				TraceID: model.TraceID{
					High: 123,
					Low:  456,
				},
				ID: 1,
			},
			Name:      "span 1",
			Kind:      "CLIENT",
			Timestamp: time.Unix(0, 1*int64(time.Microsecond)),
			Duration:  10 * time.Microsecond,
			LocalEndpoint: &model.Endpoint{
				ServiceName: "service 1",
				IPv4:        net.IPv4(1, 0, 0, 1),
				Port:        42,
			},
			Annotations: []model.Annotation{
				{Timestamp: time.Unix(0, 2*int64(time.Microsecond)), Value: "annotation text"},
				{Timestamp: time.Unix(0, 6*int64(time.Microsecond)), Value: "annotation text 3"},
			},
			Tags: map[string]string{
				"tag1": "val1",
			},
		}
		span2 := model.SpanModel{
			SpanContext: model.SpanContext{
				TraceID: model.TraceID{
					High: 123,
					Low:  456,
				},
				ID:       2,
				ParentID: &span1.ID,
			},
			Name:      "span 2",
			Timestamp: time.Unix(0, 4*int64(time.Microsecond)),
			Duration:  5 * time.Microsecond,
			LocalEndpoint: &model.Endpoint{
				ServiceName: "service 2",
				IPv4:        net.IPv4(1, 0, 0, 1),
			},
			Tags: map[string]string{
				"error": "404",
			},
		}

		span3 := model.SpanModel{
			SpanContext: model.SpanContext{
				TraceID: model.TraceID{
					High: 123,
					Low:  456,
				},
				ID:       3,
				ParentID: &span1.ID,
			},
			Name:      "span 3",
			Timestamp: time.Unix(0, 6*int64(time.Microsecond)),
			Duration:  7 * time.Microsecond,
			RemoteEndpoint: &model.Endpoint{
				ServiceName: "spanstore-jdbc",
				IPv6:        net.ParseIP("::1"),
			},
		}

		spans := []model.SpanModel{span1, span2, span3}
		frames := transformResponse(spans, "test")
		experimental.CheckGoldenJSONFrame(t, "./testdata", "simple_trace.golden", frames, false)
	})
}
