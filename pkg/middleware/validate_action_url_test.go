package middleware

import (
	"fmt"
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
			name:                "DELETE action with valid path",
			method:              "DELETE",
			path:                "/api/plugins/org-generic-app",
			actionsAllowPostURL: "/api/plugins/*",
			addHeader:           true,
			code:                http.StatusMethodNotAllowed,
		},
		{
			name:                "DELETE action with invalid path",
			method:              "DELETE",
			path:                "/api/notplugins/org-generic-app",
			actionsAllowPostURL: "/api/plugins/*",
			addHeader:           true,
			code:                http.StatusMethodNotAllowed,
		},
		{
			name:                "GET action with valid path",
			method:              "GET",
			path:                "/api/plugins/org-generic-app",
			actionsAllowPostURL: "/api/plugins/*",
			addHeader:           true,
			code:                http.StatusMethodNotAllowed,
		},
		{
			name:                "GET action with invalid path",
			method:              "GET",
			path:                "/api/notplugins/org-generic-app",
			actionsAllowPostURL: "/api/plugins/*",
			addHeader:           true,
			code:                http.StatusMethodNotAllowed,
		},
		{
			name:                "GET valid path without header",
			method:              "GET",
			path:                "/", // top-level get
			actionsAllowPostURL: "",
			addHeader:           false,
			code:                http.StatusOK,
		},
		{
			name:                "GET valid path with header",
			method:              "GET",
			path:                "/", // top-level get
			actionsAllowPostURL: "",
			addHeader:           true,
			code:                http.StatusMethodNotAllowed,
		},
		{
			name:                "HEAD request with header",
			method:              "HEAD",
			path:                "/", // top-level
			actionsAllowPostURL: "",
			addHeader:           true,
			code:                http.StatusMethodNotAllowed,
		},
		{
			name:                "OPTIONS request",
			method:              "OPTIONS",
			path:                "/", // top-level
			actionsAllowPostURL: "",
			addHeader:           false,
			code:                http.StatusOK,
		},
		{
			name:                "OPTIONS request with header",
			method:              "OPTIONS",
			path:                "/", // top-level
			actionsAllowPostURL: "",
			addHeader:           true,
			code:                http.StatusMethodNotAllowed,
		},
		{
			name:                "PATCH request with header",
			method:              "PATCH",
			path:                "/", // top-level
			actionsAllowPostURL: "",
			addHeader:           true,
			code:                http.StatusMethodNotAllowed,
		},
		{
			name:                "PATCH request without header",
			method:              "PATCH",
			path:                "/", // top-level
			actionsAllowPostURL: "",
			addHeader:           false,
			code:                http.StatusOK,
		},
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
		{
			name:                "PUT action with valid path with header",
			method:              "PUT",
			path:                "/api/plugins/org-generic-app",
			actionsAllowPostURL: "/api/plugins/*",
			addHeader:           true,
			code:                http.StatusOK,
		},
		{
			name:                "PUT action with invalid path",
			method:              "PUT",
			path:                "/api/notplugins/org-generic-app",
			actionsAllowPostURL: "/api/plugins/*",
			addHeader:           true,
			code:                http.StatusMethodNotAllowed,
		},
		{
			name:                "PUT action with valid path without header",
			method:              "PUT",
			path:                "/api/plugins/org-generic-app",
			actionsAllowPostURL: "/api/plugins/*",
			addHeader:           false,
			code:                http.StatusOK,
		},
		{
			name:                "PUT action with invalid path without header",
			method:              "PUT",
			path:                "/api/notplugins/org-generic-app",
			actionsAllowPostURL: "/api/plugins/*",
			addHeader:           false,
			code:                http.StatusOK,
		},
		{
			name:                "CONNECT unknown verb with header",
			method:              "CONNECT",
			path:                "/api/notplugins/org-generic-app",
			actionsAllowPostURL: "/api/plugins/*",
			addHeader:           true,
			code:                http.StatusMethodNotAllowed,
		},
		{
			name:                "CONNECT unknown verb without header",
			method:              "CONNECT",
			path:                "/api/notplugins/org-generic-app",
			actionsAllowPostURL: "/api/plugins/*",
			addHeader:           false,
			code:                http.StatusNotFound,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			middlewareScenario(t, tt.name, func(t *testing.T, sc *scenarioContext) {
				switch tt.method {
				case "DELETE":
					sc.m.Delete(tt.path, sc.defaultHandler)
				case "GET":
					sc.m.Get(tt.path, sc.defaultHandler)
				case "HEAD":
					sc.m.Head(tt.path, sc.defaultHandler)
				case "OPTIONS":
					sc.m.Options(tt.path, sc.defaultHandler)
				case "PATCH":
					sc.m.Patch(tt.path, sc.defaultHandler)
				case "POST":
					sc.m.Post(tt.path, sc.defaultHandler)
				case "PUT":
					sc.m.Put(tt.path, sc.defaultHandler)
				default:
					// anything else is an error
					anError := fmt.Errorf("unknown verb: %s", tt.method)
					if assert.Errorf(t, anError, "unknown verb: %s", tt.method) {
						assert.Contains(t, anError.Error(), "unknown verb")
					}
				}
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
