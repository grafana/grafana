package conversion

import (
	"fmt"
	"testing"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// benchmarkSpec builds an Unstructured dashboard spec padded with nPanels panels,
// so the size benchmark runs on input in the size range seen in real LIST responses.
func benchmarkSpec(nPanels int) common.Unstructured {
	panels := make([]any, nPanels)
	for i := range panels {
		panels[i] = map[string]any{
			"id":      i,
			"type":    "timeseries",
			"title":   fmt.Sprintf("panel number %d with a reasonably long description string", i),
			"gridPos": map[string]any{"x": 0, "y": i * 8, "w": 12, "h": 8},
			"targets": []any{
				map[string]any{"refId": "A", "expr": "sum(rate(http_requests_total[5m])) by (handler, method, status)"},
				map[string]any{"refId": "B", "expr": "histogram_quantile(0.99, sum(rate(request_latency_bucket[5m])) by (le))"},
			},
		}
	}
	return common.Unstructured{Object: map[string]any{
		"title":         "benchmark dashboard",
		"schemaVersion": 41,
		"panels":        panels,
	}}
}

// BenchmarkSpecSizeBytes guards the counting-writer implementation: it streams the
// encoding into a discarding writer rather than allocating (and throwing away) a
// full-size json.Marshal copy just to read its length. bytes/op should stay close
// to the reflective encode cost and must not grow by a second spec-sized buffer.
func BenchmarkSpecSizeBytes(b *testing.B) {
	spec := benchmarkSpec(500)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = specSizeBytes(spec)
	}
}
