package api

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewTextMatcher(t *testing.T) {
	tests := []struct {
		name          string
		input         string
		expectedWords []string
	}{
		{
			name:          "empty string",
			input:         "",
			expectedWords: []string{},
		},
		{
			name:          "whitespace only",
			input:         "   ",
			expectedWords: []string{},
		},
		{
			name:          "single word",
			input:         "alerts",
			expectedWords: []string{"alerts"},
		},
		{
			name:          "multiple words",
			input:         "parent alerts",
			expectedWords: []string{"parent", "alerts"},
		},
		{
			name:          "mixed case normalized to lowercase",
			input:         "Parent Alerts",
			expectedWords: []string{"parent", "alerts"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matcher := NewTextMatcher(tt.input)
			assert.Equal(t, tt.expectedWords, matcher.words)
		})
	}
}

func TestTextMatcher_Match(t *testing.T) {
	tests := []struct {
		name     string
		search   string
		text     string
		expected bool
	}{
		{
			name:     "empty search matches everything",
			search:   "",
			text:     "any text",
			expected: true,
		},
		{
			name:     "whitespace search matches everything",
			search:   "   ",
			text:     "any text",
			expected: true,
		},
		{
			name:     "exact match",
			search:   "alerts",
			text:     "alerts",
			expected: true,
		},
		{
			name:     "case insensitive match",
			search:   "parent alerts",
			text:     "Parent Folder/Alerts",
			expected: true,
		},
		{
			name:     "partial match",
			search:   "folder",
			text:     "Parent Folder/Alerts",
			expected: true,
		},
		{
			name:     "sequential words match",
			search:   "api time",
			text:     "API Response Time",
			expected: true,
		},
		{
			name:     "non-consecutive but sequential words match",
			search:   "parent rules",
			text:     "Parent Folder/Alert Rules",
			expected: true,
		},
		{
			name:     "word not found",
			search:   "missing",
			text:     "Parent Folder/Alerts",
			expected: false,
		},
		{
			name:     "words out of order",
			search:   "alerts parent",
			text:     "Parent Folder/Alerts",
			expected: false,
		},
		{
			name:     "folder path search",
			search:   "prod alerts",
			text:     "Monitoring/Production/Alerts",
			expected: true,
		},
		{
			name:     "multiple spaces in search",
			search:   "api   response   time",
			text:     "API Response Time",
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matcher := NewTextMatcher(tt.search)
			result := matcher.Match(tt.text)
			assert.Equal(t, tt.expected, result)
		})
	}
}
