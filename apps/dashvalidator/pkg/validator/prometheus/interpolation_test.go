package prometheus

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestInterpolateForParsing(t *testing.T) {
	tests := []struct {
		name     string
		expr     string
		expected string
	}{
		// No variables — passthrough
		{
			name:     "no variables passthrough",
			expr:     `rate(http_requests_total{job="api"}[5m])`,
			expected: `rate(http_requests_total{job="api"}[5m])`,
		},

		// Built-in duration variables
		{
			name:     "builtin $__rate_interval",
			expr:     `rate(metric[$__rate_interval])`,
			expected: `rate(metric[5m])`,
		},
		{
			name:     "builtin $__interval",
			expr:     `rate(metric[$__interval])`,
			expected: `rate(metric[5m])`,
		},
		{
			name:     "builtin $__range",
			expr:     `avg_over_time(metric[$__range])`,
			expected: `avg_over_time(metric[5m])`,
		},
		{
			name:     "builtin ${__rate_interval} alt syntax",
			expr:     `rate(metric[${__rate_interval}])`,
			expected: `rate(metric[5m])`,
		},

		// User-defined duration variables
		{
			name:     "user duration var [$interval]",
			expr:     `increase(metric[$interval])`,
			expected: `increase(metric[5m])`,
		},
		{
			name:     "user duration var [${custom}]",
			expr:     `rate(metric[${custom_interval}])`,
			expected: `rate(metric[5m])`,
		},

		// User-defined grouping variables
		{
			name:     "grouping var by($grouping)",
			expr:     `sum(metric) by($grouping)`,
			expected: `sum(metric) by(placeholder_label)`,
		},
		{
			name:     "grouping var mixed with literal labels",
			expr:     `sum(metric) by($grouping, job)`,
			expected: `sum(metric) by(placeholder_label, job)`,
		},
		{
			name:     "without clause with var",
			expr:     `sum(metric) without($excluded)`,
			expected: `sum(metric) without(placeholder_label)`,
		},

		// Label context — should NOT be modified
		{
			name:     "label context vars unchanged",
			expr:     `up{namespace=~"$namespace", job="api"}`,
			expected: `up{namespace=~"$namespace", job="api"}`,
		},

		// Real-world integration
		{
			name:     "real world Istio query",
			expr:     `sum by (pod) (irate(container_cpu_usage_seconds_total{container="discovery",pod=~"istiod-.*"}[$__rate_interval]))`,
			expected: `sum by (pod) (irate(container_cpu_usage_seconds_total{container="discovery",pod=~"istiod-.*"}[5m]))`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := interpolateForParsing(tt.expr)
			require.Equal(t, tt.expected, result)
		})
	}
}
