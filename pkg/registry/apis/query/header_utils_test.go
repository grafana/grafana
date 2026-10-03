package query

import (
	"net/http"
	"testing"
)

func TestExtractKnownHeadersQueryPurpose(t *testing.T) {
	for _, name := range []string{"X-Grafana-Query-Purpose", "x-grafana-query-purpose", "X-GRAFANA-QUERY-PURPOSE"} {
		t.Run(name, func(t *testing.T) {
			headers := http.Header{
				name:               {"variable"},
				"Fromalert":        {"true"},
				"X-Rule-Type":      {"recording"},
				"X-Unknown-Header": {"ignored"},
			}
			got := ExtractKnownHeaders(headers)
			if got["X-Grafana-Query-Purpose"] != "variable" || got["X-Rule-Type"] != "recording" || got["FromAlert"] != "true" {
				t.Fatalf("unexpected forwarded query headers: %v", got)
			}
			if _, exists := got["X-Unknown-Header"]; exists {
				t.Fatal("unrecognized header was forwarded")
			}
		})
	}
}
