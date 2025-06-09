package httpstatic

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStatic(t *testing.T) {
	// Create a temporary directory for test files
	tmpDir, err := os.MkdirTemp("", "static-test")
	require.NoError(t, err)
	defer func() {
		err := os.RemoveAll(tmpDir)
		require.NoError(t, err)
	}()

	// Create test files
	testFiles := map[string]string{
		"test.txt":        "Test content",
		"subdir/test.txt": "Subdir content",
	}

	for path, content := range testFiles {
		fullPath := filepath.Join(tmpDir, path)
		err := os.MkdirAll(filepath.Dir(fullPath), 0o750)
		require.NoError(t, err)
		err = os.WriteFile(fullPath, []byte(content), 0o644)
		require.NoError(t, err)
	}

	tests := []struct {
		dir              string
		name             string
		path             string
		options          StaticOptions
		expectedStatus   int
		expectedBody     string
		expectedLocation string
	}{
		{
			name:           "should serve existing file",
			path:           "/test.txt",
			expectedStatus: http.StatusOK,
			expectedBody:   "Test content",
			dir:            tmpDir,
		},
		{
			name:           "should serve file from subdirectory",
			path:           "/subdir/test.txt",
			expectedStatus: http.StatusOK,
			expectedBody:   "Subdir content",
			dir:            tmpDir,
		},

		{
			name:             "should redirect directory without trailing slash",
			path:             "/subdir",
			expectedStatus:   http.StatusFound,
			expectedLocation: "/subdir/",
			dir:              tmpDir,
		},
		{
			name:           "should handle prefix",
			path:           "/static/test.txt",
			options:        StaticOptions{Prefix: "/static"},
			expectedStatus: http.StatusOK,
			expectedBody:   "Test content",
			dir:            tmpDir,
		},
		{
			name:           "should handle excluded path",
			path:           "/test.txt",
			options:        StaticOptions{Exclude: []string{"/test.txt"}},
			expectedStatus: http.StatusNotFound,
			dir:            tmpDir,
		},
		{
			name:           "should add custom headers",
			path:           "/test.txt",
			options:        StaticOptions{AddHeaders: func(ctx *web.Context) { ctx.Resp.Header().Set("X-Test", "test") }},
			expectedStatus: http.StatusOK,
			expectedBody:   "Test content",
			dir:            tmpDir,
		},
		{
			name:             "should clean up path before redirecting",
			path:             "/subdir/..%2F%5C127.0.0.1:80%2F%3F%2F..%2F..",
			options:          StaticOptions{Prefix: "subdir"},
			expectedStatus:   http.StatusFound,
			expectedLocation: "/",
			dir:              tmpDir,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sc := setupScenarioContext(t, "")
			sc.m.Use(Static(tt.dir, tt.options))

			// Create a test request
			req := httptest.NewRequest("GET", tt.path, nil)
			w := httptest.NewRecorder()

			// Execute the handler
			sc.m.ServeHTTP(w, req)

			// Verify the response
			resp := w.Result()
			require.Equal(t, tt.expectedStatus, resp.StatusCode)

			if tt.expectedBody != "" {
				body, err := io.ReadAll(resp.Body)
				require.NoError(t, err)
				assert.Equal(t, tt.expectedBody, string(body))
			}

			if tt.options.AddHeaders != nil {
				assert.Equal(t, "test", resp.Header.Get("X-Test"))
			}

			if tt.expectedLocation != "" {
				assert.Equal(t, tt.expectedLocation, resp.Header.Get("Location"))
			}
		})
	}
}

type scenarioContext struct {
	t       *testing.T
	cfg     *setting.Cfg
	m       *web.Mux
	ctxHdlr *contexthandler.ContextHandler
}

func getContextHandler(t *testing.T, cfg *setting.Cfg) *contexthandler.ContextHandler {
	t.Helper()

	if cfg == nil {
		cfg = setting.NewCfg()
	}

	return contexthandler.ProvideService(
		cfg,
		tracing.InitializeTracerForTest(),
		&authntest.FakeService{ExpectedIdentity: &authn.Identity{ID: "0", Type: claims.TypeAnonymous, SessionToken: &usertoken.UserToken{}}},
		featuremgmt.WithFeatures(),
	)
}

func setupScenarioContext(t *testing.T, url string) *scenarioContext {
	cfg := setting.NewCfg()
	ctxHdlr := getContextHandler(t, cfg)
	sc := &scenarioContext{
		t:       t,
		cfg:     cfg,
		ctxHdlr: ctxHdlr,
	}

	sc.m = web.New()
	sc.m.Use(ctxHdlr.Middleware)

	return sc
}
