package fswebassets_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	fswebassets "github.com/grafana/grafana/pkg/services/frontend/webassets"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetWebAssets_WithoutCDNConfigured(t *testing.T) {
	cfg := &setting.Cfg{
		StaticRootPath: "../../../api/webassets/testdata",
	}
	license := licensingtest.NewFakeLicensing()
	license.On("ContentDeliveryPrefix").Return("grafana")
	ctx := context.Background()

	assets, err := fswebassets.GetWebAssets(ctx, cfg, license, false, "", "")
	assert.NoError(t, err)
	assert.NotNil(t, assets)

	assert.Equal(t, "public/build/runtime.js", assets.JSFiles[0].FilePath)
}

func TestGetWebAssets_PrefixFromLicense(t *testing.T) {
	cdnConfigUrl, _ := url.Parse("http://example.com")
	cfg := &setting.Cfg{
		StaticRootPath: "../../../api/webassets/testdata",
		CDNRootURL:     cdnConfigUrl,
		BuildVersion:   "10.3.0",
	}
	license := licensingtest.NewFakeLicensing()
	license.On("ContentDeliveryPrefix").Return("grafana-pro-max")
	ctx := context.Background()

	assets, err := fswebassets.GetWebAssets(ctx, cfg, license, false, "", "")
	assert.NoError(t, err)
	assert.NotNil(t, assets)

	assert.Equal(t, "http://example.com/grafana-pro-max/10.3.0/public/build/runtime.js", assets.JSFiles[0].FilePath)
}
func TestGetWebAssets_PrefixFromConfig(t *testing.T) {
	cdnConfigUrl, _ := url.Parse("http://example.com/grafana-super-plus")
	cfg := &setting.Cfg{
		StaticRootPath: "../../../api/webassets/testdata",
		CDNRootURL:     cdnConfigUrl,
		BuildVersion:   "10.3.0",
	}
	license := licensingtest.NewFakeLicensing()
	license.On("ContentDeliveryPrefix").Return("should-not-be-used")
	ctx := context.Background()

	assets, err := fswebassets.GetWebAssets(ctx, cfg, license, false, "", "")
	assert.NoError(t, err)
	assert.NotNil(t, assets)

	assert.Equal(t, "http://example.com/grafana-super-plus/10.3.0/public/build/runtime.js", assets.JSFiles[0].FilePath)
}

func TestGetWebAssets_PrefixFromConfigTrailingSlash(t *testing.T) {
	cdnConfigUrl, _ := url.Parse("http://example.com/grafana-mega/")
	cfg := &setting.Cfg{
		StaticRootPath: "../../../api/webassets/testdata",
		CDNRootURL:     cdnConfigUrl,
		BuildVersion:   "10.3.0",
	}
	license := licensingtest.NewFakeLicensing()
	license.On("ContentDeliveryPrefix").Return("should-not-be-used")
	ctx := context.Background()

	assets, err := fswebassets.GetWebAssets(ctx, cfg, license, false, "", "")
	assert.NoError(t, err)
	assert.NotNil(t, assets)

	assert.Equal(t, "http://example.com/grafana-mega/10.3.0/public/build/runtime.js", assets.JSFiles[0].FilePath)
}

func TestGetWebAssets_AssetsBaseOverrideURL(t *testing.T) {
	manifest := `{
		"entrypoints": {
			"app": {
				"assets": {
					"js": ["public/build/runtime.preview.js", "public/build/app.preview.js"],
					"css": ["public/build/grafana.app.preview.css"]
				}
			},
			"swagger": {
				"assets": {
					"js": ["public/build/runtime.preview.js", "public/build/swagger.preview.js"],
					"css": ["public/build/grafana.swagger.preview.css"]
				}
			},
			"dark": { "assets": { "css": ["public/build/grafana.dark.preview.css"] } },
			"light": { "assets": { "css": ["public/build/grafana.light.preview.css"] } }
		}
	}`

	cdnServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/pr_grafana_42_featbar/public/build/assets-manifest.json" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(manifest))
			return
		}
		http.NotFound(w, r)
	}))
	defer cdnServer.Close()

	overrideBaseURL := cdnServer.URL + "/"
	overrideURL := cdnServer.URL + "/pr_grafana_42_featbar/"
	cfg := &setting.Cfg{
		StaticRootPath: "../../../api/webassets/testdata",
	}
	license := licensingtest.NewFakeLicensing()
	license.On("ContentDeliveryPrefix").Return("grafana")
	ctx := context.Background()

	assets, err := fswebassets.GetWebAssets(ctx, cfg, license, true, overrideBaseURL, overrideURL)
	require.NoError(t, err)

	// Asset paths should be prefixed with the override URL
	assert.Equal(t, overrideURL+"public/build/runtime.preview.js", assets.JSFiles[0].FilePath)
	assert.Equal(t, overrideURL+"public/build/app.preview.js", assets.JSFiles[1].FilePath)
	assert.Equal(t, overrideURL+"public/build/grafana.dark.preview.css", assets.Dark)
	assert.Equal(t, overrideURL+"public/build/grafana.light.preview.css", assets.Light)
	assert.Equal(t, overrideURL, assets.ContentDeliveryURL)
}

func TestGetWebAssets_AssetsBaseOverrideURL_EmptyFallsBackToDefault(t *testing.T) {
	cfg := &setting.Cfg{
		StaticRootPath: "../../../api/webassets/testdata",
	}
	license := licensingtest.NewFakeLicensing()
	license.On("ContentDeliveryPrefix").Return("grafana")
	ctx := context.Background()

	// Empty override URL should use default local assets
	assets, err := fswebassets.GetWebAssets(ctx, cfg, license, false, "", "")
	require.NoError(t, err)

	// Should be local filesystem paths (no CDN prefix since CDNRootURL is nil)
	assert.Equal(t, "public/build/runtime.js", assets.JSFiles[0].FilePath)
}

func TestGetWebAssets_AssetsBaseOverrideURL_RejectedWhenDisabled(t *testing.T) {
	cfg := &setting.Cfg{
		StaticRootPath: "../../../api/webassets/testdata",
	}
	license := licensingtest.NewFakeLicensing()
	license.On("ContentDeliveryPrefix").Return("grafana")
	ctx := context.Background()

	// Should fall back to default assets when the feature is disabled
	assets, err := fswebassets.GetWebAssets(ctx, cfg, license, false, "", "https://evil.example.com/assets/")
	require.NoError(t, err)
	assert.Equal(t, "public/build/runtime.js", assets.JSFiles[0].FilePath)
}

func TestGetWebAssets_AssetsBaseOverrideURL_RejectedWhenBaseDoesNotMatch(t *testing.T) {
	cfg := &setting.Cfg{
		StaticRootPath: "../../../api/webassets/testdata",
	}
	license := licensingtest.NewFakeLicensing()
	license.On("ContentDeliveryPrefix").Return("grafana")
	ctx := context.Background()

	// Should fall back to default assets when URL doesn't match configured base
	assets, err := fswebassets.GetWebAssets(ctx, cfg, license, true, "https://trusted-bucket.example.com/", "https://evil.example.com/assets/")
	require.NoError(t, err)
	assert.Equal(t, "public/build/runtime.js", assets.JSFiles[0].FilePath)
}
