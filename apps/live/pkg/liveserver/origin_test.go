package liveserver

import (
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gobwas/glob"
	"github.com/stretchr/testify/require"
)

func TestCheckOrigin(t *testing.T) {
	testCases := []struct {
		name           string
		origin         string
		appURL         string
		allowedOrigins []string
		success        bool
		host           string
	}{
		{
			name:    "empty_origin",
			origin:  "",
			appURL:  "http://localhost:3000/",
			success: true,
		},
		{
			name:    "valid_origin",
			origin:  "http://localhost:3000",
			appURL:  "http://localhost:3000/",
			success: true,
		},
		{
			name:    "valid_origin_no_port",
			origin:  "https://www.example.com",
			appURL:  "https://www.example.com:443/grafana/",
			success: true,
		},
		{
			name:    "unauthorized_origin",
			origin:  "http://localhost:8000",
			appURL:  "http://localhost:3000/",
			success: false,
		},
		{
			name:    "bad_origin",
			origin:  ":::http://localhost:8000",
			appURL:  "http://localhost:3000/",
			success: false,
		},
		{
			name:    "different_scheme",
			origin:  "http://example.com",
			appURL:  "https://example.com",
			success: false,
		},
		{
			name:    "authorized_case_insensitive",
			origin:  "https://examplE.com",
			appURL:  "https://example.com",
			success: true,
		},
		{
			name:           "authorized_allowed_origins",
			origin:         "https://test.example.com",
			appURL:         "http://localhost:3000/",
			allowedOrigins: []string{"https://test.example.com"},
			success:        true,
		},
		{
			name:           "authorized_allowed_origins_pattern",
			origin:         "https://test.example.com",
			appURL:         "http://localhost:3000/",
			allowedOrigins: []string{"https://*.example.com"},
			success:        true,
		},
		{
			name:           "authorized_allowed_origins_all",
			origin:         "https://test.example.com",
			appURL:         "http://localhost:3000/",
			allowedOrigins: []string{"*"},
			success:        true,
		},
		{
			name:    "request_host_matches_origin_host",
			origin:  "http://example.com",
			appURL:  "https://example.com",
			success: true,
			host:    "example.com",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			appURL, err := url.Parse(tc.appURL)
			require.NoError(t, err)

			originGlobs := make([]glob.Glob, 0, len(tc.allowedOrigins))
			for _, pattern := range tc.allowedOrigins {
				originGlobs = append(originGlobs, glob.MustCompile(pattern))
			}

			checkOrigin := CheckOriginFunc(appURL, tc.allowedOrigins, originGlobs)

			r := httptest.NewRequest("GET", tc.appURL, nil)
			r.Host = tc.host
			r.Header.Set("Origin", tc.origin)
			require.Equal(t, tc.success, checkOrigin(r),
				"origin %s, appURL: %s", tc.origin, tc.appURL,
			)
		})
	}
}
