package querytemplate_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/tsdb/prometheus/querytemplate"
)

func TestNewQueryTemplateProcessor(t *testing.T) {
	tests := []struct {
		name string
		expr string
		want string
	}{
		{
			name: "Test with valid expression",
			expr: `sum(rate(http_request_duration_seconds_count[5m])) by (job)`,
			want: `sum by (label) (rate(metric[1m]))`,
		},
		{
			name: "Test with invalid expression",
			expr: `sum(rate(http_request_duration_seconds_count[5m])) by (job`,
			want: ``,
		},
		{
			name: "Test with labels",
			expr: `http_request_duration_seconds_count{job="api-server", cluster="dev"}`,
			want: `metric{label="value"}`,
		},
		{
			name: "Test with numerics",
			expr: `1 + 2 * 3 / 4`,
			want: `99 + 99 * 99 / 99`,
		},
		{
			name: "Test with @",
			expr: `sum(rate(http_request_duration_seconds_count[5m] @ 123))`,
			want: `sum(rate(metric[1m] @ 60000000.000))`,
		},
		{
			name: "Test with @ offset",
			expr: `sum(rate(http_request_duration_seconds_count[5m] offset 1h))`,
			want: `sum(rate(metric[1m] offset 1m))`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := querytemplate.NewQueryTemplateProcessor(tt.expr)
			if p.TemplateExpr != tt.want {
				t.Errorf("NewQueryTemplateProcessor() = %v, want %v", p.TemplateExpr, tt.want)
			}
		})
	}
}
