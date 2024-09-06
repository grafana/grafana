package middleware

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestMiddlewareValidateActionUrl(t *testing.T) {
	tests := []struct {
		name                string
		method              string
		path                string
		actionsAllowPostURL string
		addHeader           bool
		code                int
	}{
		{
			name:                "POST without action header",
			method:              "POST",
			path:                "/api/plugins/org-generic-app",
			actionsAllowPostURL: "",
			addHeader:           false,
			code:                http.StatusOK,
		},
		{
			name:                "POST with action header, no paths defined",
			method:              "POST",
			path:                "/api/plugins/org-generic-app",
			actionsAllowPostURL: "",
			addHeader:           true,
			code:                http.StatusMethodNotAllowed,
		},
		{
			name:                "POST action with allowed path",
			method:              "POST",
			path:                "/api/plugins/org-generic-app",
			actionsAllowPostURL: "/api/plugins/*",
			addHeader:           true,
			code:                http.StatusOK,
		},
		{
			name:                "POST action with invalid path",
			method:              "POST",
			path:                "/api/notplugins/org-generic-app",
			actionsAllowPostURL: "/api/plugins/*",
			addHeader:           true,
			code:                http.StatusMethodNotAllowed,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			middlewareScenario(t, tt.name, func(t *testing.T, sc *scenarioContext) {
				sc.m.Post(tt.path, sc.defaultHandler)
				sc.fakeReq(tt.method, tt.path)
				if tt.addHeader {
					sc.req.Header.Add("X-Grafana-Action", "1")
				}
				sc.exec()
				resp := sc.resp.Result()
				t.Cleanup(func() {
					err := resp.Body.Close()
					assert.NoError(t, err)
				})
				// nolint:bodyclose
				assert.Equal(t, tt.code, sc.resp.Result().StatusCode)
			}, func(cfg *setting.Cfg) {
				cfg.ActionsAllowPostURL = tt.actionsAllowPostURL
			})
		})
	}
}

func TestMatchesAllowedPath(t *testing.T) {
	tests := []struct {
		name      string
		aPath     string
		allowList string
		matches   bool
	}{
		{
			name:      "single url with match",
			allowList: "/api/plugins/*",
			aPath:     "/api/plugins/my-plugin",
			matches:   true,
		},
		{
			name:      "single url no match",
			allowList: "/api/plugins/*",
			aPath:     "/api/plugin/my-plugin",
			matches:   false,
		},
		{
			name:      "multiple urls with match",
			allowList: "/api/plugins/*, /api/other/**",
			aPath:     "/api/other/my-plugin",
			matches:   true,
		},
		{
			name:      "multiple urls no match",
			allowList: "/api/plugins/*, /api/other/**",
			aPath:     "/api/misc/my-plugin",
			matches:   false,
		},
	}

	for _, tc := range tests {
		tc := tc

		t.Run(tc.name, func(t *testing.T) {
			allGlobs, err := cacheGlobs(tc.allowList)
			matched := matchesAllowedPath(allGlobs, tc.aPath)
			assert.NoError(t, err)
			assert.Equal(t, matched, tc.matches)
		})
	}
}

func TestCacheGlobs(t *testing.T) {
	tests := []struct {
		name           string
		allowList      string
		expectedLength int
	}{
		{
			name:           "single url",
			allowList:      "/api/plugins",
			expectedLength: 1,
		},
		{
			name:           "multiple urls",
			allowList:      "/api/plugins, /api/other/**",
			expectedLength: 2,
		},
	}

	for _, tc := range tests {
		tc := tc

		t.Run(tc.name, func(t *testing.T) {
			cache, err := cacheGlobs(tc.allowList)
			assert.NoError(t, err)
			assert.Equal(t, len(*cache), tc.expectedLength)
		})
	}
}
