package github

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// TestFactoryNew_EnterpriseBaseURL verifies that a resolved REST API base URL (as produced by
// the githubenterprise config's CustomServerURL) maps to the expected go-github BaseURL. The
// web-URL -> API-URL resolution per deployment type is tested where it lives, in that config.
func TestFactoryNew_EnterpriseBaseURL(t *testing.T) {
	tests := []struct {
		name      string
		serverURL string
		expected  string
	}{
		{
			name:      "no custom server url uses default api.github.com",
			serverURL: "",
			expected:  "https://api.github.com/",
		},
		{
			name:      "GHES self-hosted appends /api/v3",
			serverURL: "https://custom-ghe-url.com",
			expected:  "https://custom-ghe-url.com/api/v3/",
		},
		{
			name:      "GHEC data residency api host stays without /api/v3",
			serverURL: "https://api.acme.ghe.com",
			expected:  "https://api.acme.ghe.com/",
		},
	}

	factory := &Factory{}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, err := factory.New(context.Background(), common.RawSecureValue(""), WithCustomServerURL(tt.serverURL))
			require.NoError(t, err)

			gc, ok := c.(*githubClient)
			require.True(t, ok, "expected *githubClient")
			require.Equal(t, tt.expected, gc.gh.BaseURL.String())
		})
	}
}
