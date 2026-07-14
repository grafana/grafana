package appplugin

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestResourceRequest(t *testing.T) {
	tests := []struct {
		name        string
		inputURL    string
		expectPath  string
		expectQuery string
		expectErr   bool
	}{
		{
			name:       "empty subpath",
			inputURL:   "/apis/plugin-id/v0alpha1/namespaces/default/app/instance/resources",
			expectPath: "",
		},
		{
			name:       "trailing slash only",
			inputURL:   "/apis/plugin-id/v0alpha1/namespaces/default/app/instance/resources/",
			expectPath: "",
		},
		{
			name:       "single segment subpath",
			inputURL:   "/apis/plugin-id/v0alpha1/namespaces/default/app/instance/resources/health",
			expectPath: "health",
		},
		{
			name:       "multi segment subpath",
			inputURL:   "/apis/plugin-id/v0alpha1/namespaces/default/app/instance/resources/api/v1/items",
			expectPath: "api/v1/items",
		},
		{
			name:       "subpath contains 'resources' literal",
			inputURL:   "/apis/plugin-id/v0alpha1/namespaces/default/app/instance/resources/api/resources/list",
			expectPath: "api/resources/list",
		},
		{
			name:       "subpath ends with 'resources'",
			inputURL:   "/apis/plugin-id/v0alpha1/namespaces/default/app/instance/resources/resources",
			expectPath: "resources",
		},
		{
			name:       "subpath is exactly 'app/instance/resources' again",
			inputURL:   "/apis/plugin-id/v0alpha1/namespaces/default/app/instance/resources/app/instance/resources/foo",
			expectPath: "app/instance/resources/foo",
		},
		{
			name:        "subpath with query string",
			inputURL:    "/apis/plugin-id/v0alpha1/namespaces/default/app/instance/resources/search?q=hello&limit=10",
			expectPath:  "search",
			expectQuery: "q=hello&limit=10",
		},
		{
			name:        "empty subpath with query string",
			inputURL:    "/apis/plugin-id/v0alpha1/namespaces/default/app/instance/resources?foo=bar",
			expectPath:  "",
			expectQuery: "foo=bar",
		},
		{
			name:        "subpath containing 'resources' with query string",
			inputURL:    "/apis/plugin-id/v0alpha1/namespaces/default/app/instance/resources/api/resources?type=alert",
			expectPath:  "api/resources",
			expectQuery: "type=alert",
		},
		{
			name:       "multiple leading slashes after slug are trimmed",
			inputURL:   "/apis/plugin-id/v0alpha1/namespaces/default/app/instance/resources///foo/bar",
			expectPath: "foo/bar",
		},
		{
			name:      "missing slug returns error",
			inputURL:  "/apis/plugin-id/v0alpha1/namespaces/default/app/instance/health",
			expectErr: true,
		},
		{
			name:      "path with 'resources' but missing 'app/instance' prefix returns error",
			inputURL:  "/apis/plugin-id/v0alpha1/namespaces/default/app/resources/foo",
			expectErr: true,
		},
		{
			name:      "empty path returns error",
			inputURL:  "/",
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, tt.inputURL, nil)
			require.NoError(t, err)

			got, err := resourceRequest(req)
			if tt.expectErr {
				require.Error(t, err)
				require.Nil(t, got)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, got)
			require.Equal(t, tt.expectPath, got.URL.Path)
			require.Equal(t, tt.expectQuery, got.URL.RawQuery)

			// the original request must not be mutated
			require.Equal(t, tt.inputURL, req.URL.RequestURI())
		})
	}
}

func TestResourceRequest_PreservesMethodAndHeaders(t *testing.T) {
	req, err := http.NewRequest(
		http.MethodPost,
		"/apis/plugin-id/v0alpha1/namespaces/default/app/instance/resources/api/resources/create",
		nil,
	)
	require.NoError(t, err)
	req.Header.Set("X-Test-Header", "value")

	got, err := resourceRequest(req)
	require.NoError(t, err)
	require.Equal(t, http.MethodPost, got.Method)
	require.Equal(t, "value", got.Header.Get("X-Test-Header"))
	require.Equal(t, "api/resources/create", got.URL.Path)
}
