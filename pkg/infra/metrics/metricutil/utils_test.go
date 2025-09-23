package metricutil

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLabelNameSanitization(t *testing.T) {
	testcases := []struct {
		input    string
		expected string
		err      bool
	}{
		{input: "job", expected: "job"},
		{input: "job._loal['", expected: "job_loal"},
		{input: "", expected: "", err: true},
		{input: ";;;", expected: "", err: true},
		{input: "Data source", expected: "Data_source"},
	}

	for _, tc := range testcases {
		got, err := SanitizeLabelName(tc.input)
		if tc.err {
			assert.Error(t, err)
		} else {
			require.NoError(t, err)
			assert.Equal(t, tc.expected, got)
		}
	}
}

func Test_buildLabelSets(t *testing.T) {
	testcases := map[string]struct {
		labels      []string
		labelValues map[string][]string
		expected    []prometheus.Labels
	}{
		"single label, single value": {
			labels: []string{"operation"},
			labelValues: map[string][]string{
				"operation": {"insert"},
			},
			expected: []prometheus.Labels{
				map[string]string{"operation": "insert"},
			},
		},
		"single label, multiple values": {
			labels: []string{"operation"},
			labelValues: map[string][]string{
				"operation": {"insert", "delete"},
			},
			expected: []prometheus.Labels{
				map[string]string{"operation": "insert"},
				map[string]string{"operation": "delete"},
			},
		},
		"multiple label, single value": {
			labels: []string{"operation", "success"},
			labelValues: map[string][]string{
				"operation": {"insert"},
				"success":   {"true"},
			},
			expected: []prometheus.Labels{
				map[string]string{"operation": "insert", "success": "true"},
			},
		},
		"multiple label, multiple values": {
			labels: []string{"operation", "success"},
			labelValues: map[string][]string{
				"operation": {"insert", "delete"},
				"success":   {"true", "false"},
			},
			expected: []prometheus.Labels{
				map[string]string{"operation": "insert", "success": "true"},
				map[string]string{"operation": "insert", "success": "false"},
				map[string]string{"operation": "delete", "success": "true"},
				map[string]string{"operation": "delete", "success": "false"},
			},
		},
		"irregular labels and values": {
			labels: []string{"operation", "success", "environment"},
			labelValues: map[string][]string{
				"operation":   {"insert", "update", "delete"},
				"success":     {"true", "false"},
				"environment": {"dev", "test", "staging"},
			},
			expected: []prometheus.Labels{
				map[string]string{"operation": "insert", "success": "true", "environment": "dev"},
				map[string]string{"operation": "insert", "success": "true", "environment": "test"},
				map[string]string{"operation": "insert", "success": "true", "environment": "staging"},
				map[string]string{"operation": "insert", "success": "false", "environment": "dev"},
				map[string]string{"operation": "insert", "success": "false", "environment": "test"},
				map[string]string{"operation": "insert", "success": "false", "environment": "staging"},
				map[string]string{"operation": "update", "success": "true", "environment": "dev"},
				map[string]string{"operation": "update", "success": "true", "environment": "test"},
				map[string]string{"operation": "update", "success": "true", "environment": "staging"},
				map[string]string{"operation": "update", "success": "false", "environment": "dev"},
				map[string]string{"operation": "update", "success": "false", "environment": "test"},
				map[string]string{"operation": "update", "success": "false", "environment": "staging"},
				map[string]string{"operation": "delete", "success": "true", "environment": "dev"},
				map[string]string{"operation": "delete", "success": "true", "environment": "test"},
				map[string]string{"operation": "delete", "success": "true", "environment": "staging"},
				map[string]string{"operation": "delete", "success": "false", "environment": "dev"},
				map[string]string{"operation": "delete", "success": "false", "environment": "test"},
				map[string]string{"operation": "delete", "success": "false", "environment": "staging"},
			},
		},
	}

	for name, tc := range testcases {
		t.Run(name, func(t *testing.T) {
			got := buildLabelSets(tc.labels, tc.labelValues)
			assert.Equal(t, tc.expected, got)
		})
	}
}
