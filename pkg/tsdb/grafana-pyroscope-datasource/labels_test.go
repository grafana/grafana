package pyroscope

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func Test_labelNameNeedsQuoting(t *testing.T) {
	tests := []struct {
		name     string
		expected bool
	}{
		{"service", false},
		{"_private", false},
		{"__name__", false},
		{"k8s.namespace", true},
		{"some-label", true},
		{"http/url", true},
		{"9lives", true},
		{"", true},
		{`has"quote`, true},
		{`has\backslash`, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, labelNameNeedsQuoting(tt.name))
		})
	}
}

func Test_formatLabelName(t *testing.T) {
	tests := []struct {
		name     string
		expected string
	}{
		{"service", "service"},
		{"_private", "_private"},
		{"k8s.namespace", `"k8s.namespace"`},
		{"some-label", `"some-label"`},
		{`has"quote`, `"has\"quote"`},
		{`has\backslash`, `"has\\backslash"`},
		{`both"and\`, `"both\"and\\"`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, formatLabelName(tt.name))
		})
	}
}

func Test_setUTF8AcceptHeader(t *testing.T) {
	tests := []struct {
		description    string
		existingAccept string
		expectedAccept string
	}{
		{
			description:    "no existing Accept header",
			existingAccept: "",
			expectedAccept: "*/*; allow-utf8-labelnames=true",
		},
		{
			description:    "existing Accept header",
			existingAccept: "application/json",
			expectedAccept: "application/json; allow-utf8-labelnames=true",
		},
	}

	for _, tt := range tests {
		t.Run(tt.description, func(t *testing.T) {
			h := http.Header{}
			if tt.existingAccept != "" {
				h.Set("Accept", tt.existingAccept)
			}
			setUTF8AcceptHeader(h)
			require.Equal(t, tt.expectedAccept, h.Get("Accept"))
		})
	}
}
