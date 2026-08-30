package contextmodel_test

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	_ "github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestReqContext_Handle(t *testing.T) {
	viewsPath, err := filepath.Abs("../../../../public/views")
	require.NoError(t, err)

	t.Run("renders error template with fallback assets when manifest is missing", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.ErrTemplateName = "error"
		cfg.DefaultTheme = "dark"
		cfg.StaticRootPath = t.TempDir()

		rec := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/render/test", nil)
		require.NoError(t, err)

		handler := web.EmptyMacaronMiddleware(
			web.Renderer(viewsPath, "[[", "]]")(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					webCtx := web.FromContext(r.Context())
					reqCtx := &contextmodel.ReqContext{
						Context: webCtx,
						Logger:  log.New("test"),
					}
					reqCtx.Handle(cfg, http.StatusBadRequest, "Render parameters error", errors.New("timeout is invalid"))
				}),
			),
		)

		handler.ServeHTTP(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		body := rec.Body.String()
		require.Contains(t, body, "<title>Grafana - Error</title>")
		require.Contains(t, body, `<body class="theme-dark">`)
		require.NotContains(t, body, "Error rendering template")
	})

	t.Run("renders error template with dark stylesheet from manifest", func(t *testing.T) {
		tempDir := t.TempDir()
		buildDir := filepath.Join(tempDir, "build")
		require.NoError(t, os.MkdirAll(buildDir, 0755))

		manifestJSON := `{
			"entrypoints": {
				"app": { "assets": { "css": ["public/build/grafana.app.12345.css"] } },
				"dark": { "assets": { "css": ["public/build/grafana.dark.12345.css"] } },
				"light": { "assets": { "css": ["public/build/grafana.light.12345.css"] } }
			}
		}`
		require.NoError(t, os.WriteFile(filepath.Join(buildDir, "assets-manifest.json"), []byte(manifestJSON), 0600))

		cfg := setting.NewCfg()
		cfg.ErrTemplateName = "error"
		cfg.DefaultTheme = "dark"
		cfg.StaticRootPath = tempDir

		rec := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/render/test", nil)
		require.NoError(t, err)

		handler := web.EmptyMacaronMiddleware(
			web.Renderer(viewsPath, "[[", "]]")(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					webCtx := web.FromContext(r.Context())
					reqCtx := &contextmodel.ReqContext{
						Context: webCtx,
						Logger:  log.New("test"),
					}
					reqCtx.Handle(cfg, http.StatusBadRequest, "Render parameters error", errors.New("timeout is invalid"))
				}),
			),
		)

		handler.ServeHTTP(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		body := rec.Body.String()
		require.Contains(t, body, "<title>Grafana - Error</title>")
		require.Contains(t, body, `<body class="theme-dark">`)
		require.Contains(t, body, `<link rel="stylesheet" href="public/build/grafana.app.12345.css" />`)
		require.Contains(t, body, `<link rel="stylesheet" href="public/build/grafana.dark.12345.css" />`)
		require.NotContains(t, body, "public/build/grafana.light.12345.css")
		require.NotContains(t, body, "Error rendering template")
	})

	t.Run("renders error template with light stylesheet from manifest", func(t *testing.T) {
		tempDir := t.TempDir()
		buildDir := filepath.Join(tempDir, "build")
		require.NoError(t, os.MkdirAll(buildDir, 0755))

		manifestJSON := `{
			"entrypoints": {
				"app": { "assets": { "css": ["public/build/grafana.app.12345.css"] } },
				"dark": { "assets": { "css": ["public/build/grafana.dark.12345.css"] } },
				"light": { "assets": { "css": ["public/build/grafana.light.12345.css"] } }
			}
		}`
		require.NoError(t, os.WriteFile(filepath.Join(buildDir, "assets-manifest.json"), []byte(manifestJSON), 0600))

		cfg := setting.NewCfg()
		cfg.ErrTemplateName = "error"
		cfg.DefaultTheme = "light"
		cfg.StaticRootPath = tempDir

		rec := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/render/test", nil)
		require.NoError(t, err)

		handler := web.EmptyMacaronMiddleware(
			web.Renderer(viewsPath, "[[", "]]")(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					webCtx := web.FromContext(r.Context())
					reqCtx := &contextmodel.ReqContext{
						Context: webCtx,
						Logger:  log.New("test"),
					}
					reqCtx.Handle(cfg, http.StatusBadRequest, "Render parameters error", errors.New("timeout is invalid"))
				}),
			),
		)

		handler.ServeHTTP(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		body := rec.Body.String()
		require.Contains(t, body, "<title>Grafana - Error</title>")
		require.Contains(t, body, `<body class="theme-light">`)
		require.Contains(t, body, `<link rel="stylesheet" href="public/build/grafana.app.12345.css" />`)
		require.Contains(t, body, `<link rel="stylesheet" href="public/build/grafana.light.12345.css" />`)
		require.NotContains(t, body, "public/build/grafana.dark.12345.css")
		require.NotContains(t, body, "Error rendering template")
	})

	t.Run("renders error template gracefully when manifest is malformed", func(t *testing.T) {
		tempDir := t.TempDir()
		buildDir := filepath.Join(tempDir, "build")
		require.NoError(t, os.MkdirAll(buildDir, 0755))
		require.NoError(t, os.WriteFile(filepath.Join(buildDir, "assets-manifest.json"), []byte("invalid-json"), 0600))

		cfg := setting.NewCfg()
		cfg.ErrTemplateName = "error"
		cfg.DefaultTheme = "dark"
		cfg.StaticRootPath = tempDir

		rec := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/render/test", nil)
		require.NoError(t, err)

		handler := web.EmptyMacaronMiddleware(
			web.Renderer(viewsPath, "[[", "]]")(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					webCtx := web.FromContext(r.Context())
					reqCtx := &contextmodel.ReqContext{
						Context: webCtx,
						Logger:  log.New("test"),
					}
					reqCtx.Handle(cfg, http.StatusBadRequest, "Render parameters error", errors.New("timeout is invalid"))
				}),
			),
		)

		handler.ServeHTTP(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		body := rec.Body.String()
		require.Contains(t, body, "<title>Grafana - Error</title>")
		require.Contains(t, body, `<body class="theme-dark">`)
		require.NotContains(t, body, "Error rendering template")
	})

	t.Run("handles nil cfg gracefully", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/render/test", nil)
		require.NoError(t, err)

		handler := web.EmptyMacaronMiddleware(
			web.Renderer(viewsPath, "[[", "]]")(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					webCtx := web.FromContext(r.Context())
					reqCtx := &contextmodel.ReqContext{
						Context: webCtx,
						Logger:  log.New("test"),
					}
					reqCtx.Handle(nil, http.StatusBadRequest, "Render parameters error", errors.New("timeout is invalid"))
				}),
			),
		)

		handler.ServeHTTP(rec, req)

		require.Equal(t, http.StatusBadRequest, rec.Code)
		body := rec.Body.String()
		require.Contains(t, body, "<title>Grafana - Error</title>")
		require.Contains(t, body, `<body class="theme-dark">`)
		require.NotContains(t, body, "Error rendering template")
	})
}
