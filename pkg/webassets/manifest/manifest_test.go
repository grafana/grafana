package manifest

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRead(t *testing.T) {
	manifestJSON := `{
  "public/build/runtime.js": {
    "src": "public/build/runtime.js",
    "integrity": "sha256-runtime"
  },
  "public/build/app.js": {
    "src": "public/build/app.js",
    "integrity": "sha256-app"
  },
  "public/build/swagger.js": {
    "src": "public/build/swagger.js",
    "integrity": "sha256-swagger"
  },
  "entrypoints": {
    "app": {
      "assets": {
        "js": ["public/build/runtime.js", "public/build/app.js"],
        "css": ["public/build/grafana.app.css"]
      }
    },
    "dark": { "assets": { "css": ["public/build/grafana.dark.css"] } },
    "light": { "assets": { "css": ["public/build/grafana.light.css"] } },
    "swagger": {
      "assets": {
        "js": ["public/build/runtime.js", "public/build/swagger.js"],
        "css": ["public/build/grafana.swagger.css"]
      }
    }
  }
}`

	assets, err := Read(strings.NewReader(manifestJSON))
	require.NoError(t, err)

	require.Equal(t, "public/build/grafana.dark.css", assets.Dark)
	require.Equal(t, "public/build/grafana.light.css", assets.Light)
	require.Len(t, assets.JSFiles, 2)
	require.Len(t, assets.CSSFiles, 1)
	require.Len(t, assets.Swagger, 2)
	require.Len(t, assets.SwaggerCSSFiles, 1)
	require.Equal(t, "sha256-runtime", assets.JSFiles[0].Integrity)
}

func TestReadMissingDarkEntry(t *testing.T) {
	invalidManifestJSON := `{
  "entrypoints": {
    "app": { "assets": { "js": ["public/build/app.js"], "css": ["public/build/grafana.app.css"] } },
    "light": { "assets": { "css": ["public/build/grafana.light.css"] } },
    "swagger": { "assets": { "js": ["public/build/swagger.js"], "css": ["public/build/grafana.swagger.css"] } }
  }
}`

	_, err := Read(strings.NewReader(invalidManifestJSON))
	require.Error(t, err)
	require.ErrorContains(t, err, "missing dark entry")
}
