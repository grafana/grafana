package pluginrouter

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

// The API navigator is Grafana's own page: this target serves the page and the
// bundle it loads, and the page finds the plugin groups through /openapi/v3.
func TestSwaggerUI(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "views", "swagger.html"),
		`<html><head>[[range $a := .Assets.CSSFiles]]<link href="[[$a.FilePath]]">[[end]]</head>`+
			`<body>[[range $a := .Assets.JSFiles]]<script src="[[$a.FilePath]]"></script>[[end]]</body></html>`)
	writeFile(t, filepath.Join(root, "build-swagger", "assets-manifest.json"),
		`{"entrypoints":{"app":{"assets":{"css":["public/build-swagger/app.css"],"js":["public/build-swagger/app.js"]}}}}`)
	writeFile(t, filepath.Join(root, "build-swagger", "app.js"), "console.log('swagger')")

	httpRouter := mux.NewRouter()
	// A route the shared server already has, to prove the root redirect and the
	// asset prefix do not swallow it.
	httpRouter.HandleFunc("/metrics", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("metrics"))
	})
	newSwaggerUI(testCfg(root), &licensing.OSSLicensingService{}).register(httpRouter)

	t.Run("the page loads the bundle", func(t *testing.T) {
		res := serve(httpRouter, "/swagger")
		require.Equal(t, http.StatusOK, res.Code, res.Body.String())
		require.Contains(t, res.Body.String(), `src="public/build-swagger/app.js"`)
		require.Contains(t, res.Body.String(), `href="public/build-swagger/app.css"`)
	})

	// The paths in the page are relative, so they resolve under /public/ and
	// have to be served from the static root.
	t.Run("the bundle is served", func(t *testing.T) {
		res := serve(httpRouter, "/public/build-swagger/app.js")
		require.Equal(t, http.StatusOK, res.Code)
		require.Equal(t, "console.log('swagger')", res.Body.String())
	})

	t.Run("other routes are untouched", func(t *testing.T) {
		res := serve(httpRouter, "/metrics")
		require.Equal(t, http.StatusOK, res.Code)
		require.Equal(t, "metrics", res.Body.String())
	})
}

// The frontend is built separately from the backend, so a backend-only checkout
// reaches the navigator with nothing to serve. That has to say which build is
// missing, not 500.
func TestSwaggerUIWithoutAFrontendBuild(t *testing.T) {
	httpRouter := mux.NewRouter()
	newSwaggerUI(testCfg(t.TempDir()), &licensing.OSSLicensingService{}).register(httpRouter)

	res := serve(httpRouter, "/swagger")
	require.Equal(t, http.StatusServiceUnavailable, res.Code)
	require.Contains(t, res.Body.String(), "yarn build")
}

func testCfg(staticRoot string) *setting.Cfg {
	cfg := setting.NewCfg()
	cfg.StaticRootPath = staticRoot
	// Dev skips the asset cache, so each test reads its own static root rather
	// than whichever one ran first.
	cfg.Env = setting.Dev
	return cfg
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()

	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o750))
	require.NoError(t, os.WriteFile(path, []byte(content), 0o600))
}
