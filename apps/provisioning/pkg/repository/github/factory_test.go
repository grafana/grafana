package github

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestWithCustomServerURL(t *testing.T) {
	tests := []struct {
		name      string
		serverURL string
		expected  string
	}{
		{
			name:      "default github.com is ignored",
			serverURL: "https://github.com",
			expected:  "",
		},
		{
			name:      "github.com with path is ignored",
			serverURL: "https://github.com/example/test",
			expected:  "",
		},
		{
			name:      "empty url is ignored",
			serverURL: "",
			expected:  "",
		},
		{
			name:      "GitHub Enterprise Server url is kept",
			serverURL: "https://ghes.example.com/example/test",
			expected:  "https://ghes.example.com",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var options ClientOptions
			WithCustomServerURL(tt.serverURL)(&options)
			assert.Equal(t, tt.expected, options.customServerURL)
		})
	}
}
