package graphite

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFormatTimeRange(t *testing.T) {
	testCases := []struct {
		input    string
		expected string
	}{
		{"now", "now"},
		{"now-1m", "-1min"},
		{"now-1M", "-1mon"},
	}

	for _, tc := range testCases {
		t.Run(tc.input, func(t *testing.T) {
			tr := formatTimeRange(tc.input)
			assert.Equal(t, tc.expected, tr)
		})
	}
}

func TestFixIntervalFormat(t *testing.T) {
	testCases := []struct {
		name     string
		target   string
		expected string
	}{
		{
			name:     "should transform 1m to graphite unit (1min) when used as interval string",
			target:   "aliasByNode(hitcount(averageSeries(app.grafana.*.dashboards.views.count), '1m'), 4)",
			expected: "aliasByNode(hitcount(averageSeries(app.grafana.*.dashboards.views.count), '1min'), 4)",
		},
		{
			name:     "should transform 1M to graphite unit (1mon) when used as interval string",
			target:   "aliasByNode(hitcount(averageSeries(app.grafana.*.dashboards.views.count), '1M'), 4)",
			expected: "aliasByNode(hitcount(averageSeries(app.grafana.*.dashboards.views.count), '1mon'), 4)",
		},
		{
			name:     "should not transform 1m when not used as interval string",
			target:   "app.grafana.*.dashboards.views.1m.count",
			expected: "app.grafana.*.dashboards.views.1m.count",
		},
		{
			name:     "should not transform 1M when not used as interval string",
			target:   "app.grafana.*.dashboards.views.1M.count",
			expected: "app.grafana.*.dashboards.views.1M.count",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			tr := fixIntervalFormat(tc.target)
			assert.Equal(t, tc.expected, tr)
		})
	}
}
