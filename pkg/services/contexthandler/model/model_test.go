package contextmodel

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestQueryBoolWithDefault(t *testing.T) {
	tc := map[string]struct {
		url          string
		defaultValue bool
		expected     bool
	}{
		"with no value specified, the default value is returned": {
			url:          "http://localhost/api/v2/alerts",
			defaultValue: true,
			expected:     true,
		},
		"with a value specified, the default value is overridden": {
			url:          "http://localhost/api/v2/alerts?silenced=false",
			defaultValue: true,
			expected:     false,
		},
	}

	for name, tt := range tc {
		t.Run(name, func(t *testing.T) {
			req, err := http.NewRequest("GET", tt.url, nil)
			require.NoError(t, err)
			r := ReqContext{
				Context: &web.Context{Req: req},
			}
			require.Equal(t, tt.expected, r.QueryBoolWithDefault("silenced", tt.defaultValue))
		})
	}
}

func TestGetErrorPageAssets(t *testing.T) {
	t.Run("uses default manifest when available", func(t *testing.T) {
		tempDir := t.TempDir()
		buildDir := filepath.Join(tempDir, "build")
		require.NoError(t, os.MkdirAll(buildDir, 0o755))
		require.NoError(t, os.WriteFile(filepath.Join(buildDir, "assets-manifest.json"), []byte(testManifestJSON(
			"public/build/grafana.dark.default.css",
			"public/build/grafana.light.default.css",
		)), 0o644))

		cfg := &setting.Cfg{StaticRootPath: tempDir}
		assets := getErrorPageAssets(cfg)

		require.Equal(t, "public/build/grafana.light.default.css", assets.Light)
		require.Equal(t, "public/build/grafana.dark.default.css", assets.Dark)
	})

	t.Run("falls back to react19 manifest", func(t *testing.T) {
		tempDir := t.TempDir()
		buildDir := filepath.Join(tempDir, "build")
		require.NoError(t, os.MkdirAll(buildDir, 0o755))
		require.NoError(t, os.WriteFile(filepath.Join(buildDir, "assets-manifest-react19.json"), []byte(testManifestJSON(
			"public/build/grafana.dark.react19.css",
			"public/build/grafana.light.react19.css",
		)), 0o644))

		cfg := &setting.Cfg{StaticRootPath: tempDir}
		assets := getErrorPageAssets(cfg)

		require.Equal(t, "public/build/grafana.light.react19.css", assets.Light)
		require.Equal(t, "public/build/grafana.dark.react19.css", assets.Dark)
	})

	t.Run("returns empty assets when no manifest exists", func(t *testing.T) {
		cfg := &setting.Cfg{StaticRootPath: t.TempDir()}
		assets := getErrorPageAssets(cfg)

		require.Empty(t, assets.Light)
		require.Empty(t, assets.Dark)
	})
}

func testManifestJSON(darkCSS, lightCSS string) string {
	return `{
  "entrypoints": {
    "app": { "assets": { "js": ["public/build/app.js"], "css": ["public/build/app.css"] } },
    "dark": { "assets": { "css": ["` + darkCSS + `"] } },
    "light": { "assets": { "css": ["` + lightCSS + `"] } },
    "swagger": { "assets": { "js": ["public/build/swagger.js"], "css": ["public/build/swagger.css"] } }
  }
}`
}
