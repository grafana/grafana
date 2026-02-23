package github

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExtractEnterpriseBaseURL(t *testing.T) {
	tests := []struct {
		name        string
		repoURL     string
		wantBaseURL string
		wantErr     bool
		errMsg      string
	}{
		{
			name:        "empty URL returns empty",
			repoURL:     "",
			wantBaseURL: "",
			wantErr:     false,
		},
		{
			name:        "github.com HTTPS returns empty",
			repoURL:     "https://github.com/owner/repo",
			wantBaseURL: "",
			wantErr:     false,
		},
		{
			name:        "github.com HTTP returns empty",
			repoURL:     "http://github.com/owner/repo",
			wantBaseURL: "",
			wantErr:     false,
		},
		{
			name:        "github.com case insensitive returns empty",
			repoURL:     "https://GITHUB.COM/owner/repo",
			wantBaseURL: "",
			wantErr:     false,
		},
		{
			name:        "github.com mixed case returns empty",
			repoURL:     "https://GitHub.Com/owner/repo",
			wantBaseURL: "",
			wantErr:     false,
		},
		{
			name:        "enterprise HTTPS URL returns base URL",
			repoURL:     "https://example.com/owner/repo",
			wantBaseURL: "https://example.com",
			wantErr:     false,
		},
		{
			name:        "enterprise HTTP URL returns base URL",
			repoURL:     "http://example.com/owner/repo",
			wantBaseURL: "http://example.com",
			wantErr:     false,
		},
		{
			name:        "enterprise with port HTTPS",
			repoURL:     "https://example.com:8443/owner/repo",
			wantBaseURL: "https://example.com:8443",
			wantErr:     false,
		},
		{
			name:        "enterprise with port HTTP",
			repoURL:     "http://example.com:8080/owner/repo",
			wantBaseURL: "http://example.com:8080",
			wantErr:     false,
		},
		{
			name:        "invalid URL returns error",
			repoURL:     "not a url:///invalid",
			wantBaseURL: "",
			wantErr:     true,
		},
		{
			name:        "enterprise with subdomain",
			repoURL:     "https://github.enterprise.com/owner/repo",
			wantBaseURL: "https://github.enterprise.com",
			wantErr:     false,
		},
		{
			name:        "IP address enterprise",
			repoURL:     "https://192.168.1.1:8443/owner/repo",
			wantBaseURL: "https://192.168.1.1:8443",
			wantErr:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotBaseURL, err := extractEnterpriseBaseURL(tt.repoURL)

			if tt.wantErr {
				require.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.wantBaseURL, gotBaseURL)
			}
		})
	}
}
