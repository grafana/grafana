package features

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateHTTPClientUserAgent(t *testing.T) {
	tests := []struct {
		name          string
		userAgent     string
		expectedValue string
	}{
		{
			name:          "custom user agent is prefixed with the client marker",
			userAgent:     "grafana ns/stacks-1234",
			expectedValue: "feature-service-client:grafana ns/stacks-1234",
		},
		{
			name:          "different custom user agent is also prefixed",
			userAgent:     "mtff-internal",
			expectedValue: "feature-service-client:mtff-internal",
		},
		{
			name:          "not set falls back to Go stdlib default",
			userAgent:     "",
			expectedValue: "Go-http-client/1.1",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var received *http.Request
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				received = r
				w.WriteHeader(http.StatusOK)
			}))
			defer srv.Close()

			cli, err := CreateHTTPClient(HTTPClientOptions{UserAgent: tc.userAgent})
			require.NoError(t, err)

			resp, err := cli.Get(srv.URL)
			require.NoError(t, err)
			defer func() { _ = resp.Body.Close() }()

			require.NotNil(t, received)
			assert.Equal(t, []string{tc.expectedValue}, received.Header.Values("User-Agent"))
		})
	}
}
