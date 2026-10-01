package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveAppURL(t *testing.T) {
	// The in-process loopback client calls the goto subresource with a request
	// path that has the configured subpath already stripped, e.g.
	// "/apis/shorturl.grafana.app/v1beta1/namespaces/org-3/shorturls/abc/goto".
	const loopbackPath = "/apis/shorturl.grafana.app/v1beta1/namespaces/org-3/shorturls/abc/goto"

	tests := []struct {
		name             string
		configuredAppURL string
		requestPath      string
		want             string
		wantErr          bool
	}{
		{
			name:             "configured root URL with subpath is preserved",
			configuredAppURL: "https://fqdn/grafana",
			requestPath:      loopbackPath,
			want:             "https://fqdn/grafana",
		},
		{
			name:             "configured root URL without subpath",
			configuredAppURL: "http://localhost:3000",
			requestPath:      loopbackPath,
			want:             "http://localhost:3000",
		},
		{
			name:             "falls back to request path when not configured",
			configuredAppURL: "",
			requestPath:      "/grafana" + loopbackPath,
			want:             "/grafana",
		},
		{
			name:             "fallback errors when request path has no apis segment",
			configuredAppURL: "",
			requestPath:      "/not-an-api-path",
			wantErr:          true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := resolveAppURL(tt.configuredAppURL, tt.requestPath)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}
