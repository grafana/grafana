package fswebassets_test

import (
	"net/url"
	"testing"

	fswebassets "github.com/grafana/grafana/pkg/services/frontend/webassets"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestGetWebAssets_WithoutCDNConfigured(t *testing.T) {
	cfg := &setting.Cfg{
		StaticRootPath: "../../../api/webassets/testdata",
	}
	license := licensingtest.NewFakeLicensing()
	license.On("ContentDeliveryPrefix").Return("grafana")

	assets, err := fswebassets.GetWebAssets(cfg, license)
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

	assets, err := fswebassets.GetWebAssets(cfg, license)
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

	assets, err := fswebassets.GetWebAssets(cfg, license)
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

	assets, err := fswebassets.GetWebAssets(cfg, license)
	assert.NoError(t, err)
	assert.NotNil(t, assets)

	assert.Equal(t, "http://example.com/grafana-mega/10.3.0/public/build/runtime.js", assets.JSFiles[0].FilePath)
}
