package util

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSplitEmails(t *testing.T) {
	testcases := []struct {
		input    string
		expected []string
	}{
		{
			input:    "",
			expected: []string{},
		},
		{
			input:    "ops@grafana.org",
			expected: []string{"ops@grafana.org"},
		},
		{
			input:    "ops@grafana.org;dev@grafana.org",
			expected: []string{"ops@grafana.org", "dev@grafana.org"},
		},
		{
			input:    "ops@grafana.org;dev@grafana.org,",
			expected: []string{"ops@grafana.org", "dev@grafana.org"},
		},
		{
			input:    "dev@grafana.org,ops@grafana.org",
			expected: []string{"dev@grafana.org", "ops@grafana.org"},
		},
		{
			input:    "dev@grafana.org,ops@grafana.org,",
			expected: []string{"dev@grafana.org", "ops@grafana.org"},
		},
		{
			input:    "dev@grafana.org\nops@grafana.org",
			expected: []string{"dev@grafana.org", "ops@grafana.org"},
		},
		{
			input:    "dev@grafana.org\nops@grafana.org\n",
			expected: []string{"dev@grafana.org", "ops@grafana.org"},
		},
	}

	for _, tt := range testcases {
		emails := SplitEmails(tt.input)
		assert.Equal(t, tt.expected, emails)
	}
}
