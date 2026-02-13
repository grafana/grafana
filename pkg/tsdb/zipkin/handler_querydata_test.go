package zipkin

import (
	"encoding/json"
	"net"
	"testing"
	"time"

	"github.com/openzipkin/zipkin-go/model"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
)

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

func TestTransformAnnotationsToTraceLogs_JSONKeysAreLowercase(t *testing.T) {
	annotations := []model.Annotation{
		{Timestamp: time.Unix(0, 2*int64(time.Microsecond)), Value: "annotation text"},
	}

	got := transformAnnotationsToTraceLogs(annotations)

	b, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("marshal logs: %v", err)
	}

	var decoded []map[string]any
	if err := json.Unmarshal(b, &decoded); err != nil {
		t.Fatalf("unmarshal logs: %v", err)
	}
	if len(decoded) != 1 {
		t.Fatalf("expected 1 log entry, got %d", len(decoded))
	}

	if _, ok := decoded[0]["timestamp"]; !ok {
		t.Fatalf("expected key `timestamp` to exist, got keys: %v", keysOf(decoded[0]))
	}
	if _, ok := decoded[0]["fields"]; !ok {
		t.Fatalf("expected key `fields` to exist, got keys: %v", keysOf(decoded[0]))
	}

	if _, ok := decoded[0]["Timestamp"]; ok {
		t.Fatalf("did not expect key `Timestamp` to exist")
	}
	if _, ok := decoded[0]["Fields"]; ok {
		t.Fatalf("did not expect key `Fields` to exist")
	}
}

func keysOf(m map[string]any) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}
