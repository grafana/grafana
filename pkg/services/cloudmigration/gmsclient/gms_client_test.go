package gmsclient

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_buildBasePath(t *testing.T) {
	t.Parallel()

	tests := []struct {
		description string
		domain      string
		clusterSlug string
		expected    string
	}{
		{
			description: "domain starts with http://localhost, should return domain",
			domain:      "http://localhost:8080",
			clusterSlug: "anything",
			expected:    "http://localhost:8080",
		},
		{
			description: "domain doesn't start with http://localhost, should build a string using the domain and clusterSlug",
			domain:      "gms-dev",
			clusterSlug: "us-east-1",
			expected:    "https://cms-us-east-1.gms-dev/cloud-migrations",
		},
	}
	for _, tt := range tests {
		t.Run(tt.description, func(t *testing.T) {
			assert.Equal(t, tt.expected, buildBasePath(tt.domain, tt.clusterSlug))
		})
	}
}
