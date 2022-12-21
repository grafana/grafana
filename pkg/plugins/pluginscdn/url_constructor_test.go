package pluginscdn

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestURLConstructor_StringURLFor(t *testing.T) {
	uc := NewCDNURLConstructor("https://the.cdn/{id}/{version}/{assetPath}", "the-plugin", "0.1")
	type tc struct {
		name string
		path string
		exp  string
	}
	for _, c := range []tc{
		{"simple", "file.txt", "https://the.cdn/the-plugin/0.1/file.txt"},
		{"multiple", "some/path/to/file.txt", "https://the.cdn/the-plugin/0.1/some/path/to/file.txt"},
		{"path traversal", "some/../to/file.txt", "https://the.cdn/the-plugin/0.1/to/file.txt"},
		{"above root", "../../../../../file.txt", "https://the.cdn/the-plugin/0.1/file.txt"},
		{"multiple slashes", "some/////file.txt", "https://the.cdn/the-plugin/0.1/some/file.txt"},
		{"dots", "some/././././file.txt", "https://the.cdn/the-plugin/0.1/some/file.txt"},
	} {
		t.Run(c.name, func(t *testing.T) {
			u, err := uc.StringURLFor(c.path)
			require.NoError(t, err)
			assert.Equal(t, c.exp, u)
		})
	}
}

func TestURLConstructor_RelativeURLFor(t *testing.T) {
	uc := NewCDNURLConstructor("https://the.cdn/plugins-cdn-test/{id}/{version}/public/plugins/{assetPath}", "the-plugin", "0.1")
	u, err := uc.RelativeURLFor("path/to/file.txt")
	require.NoError(t, err)
	assert.Equal(t, "/plugins-cdn-test/the-plugin/0.1/public/plugins/path/to/file.txt", u)
}

func TestRelativeURLForSystemJS(t *testing.T) {
	// Ensure that if the keyword "plugin-cdn" is present, the URL from that point on is returned.
	t.Run("valid", func(t *testing.T) {
		uc := NewCDNURLConstructor("https://grafana-assets.grafana.net/plugin-cdn-test/plugin-cdn/{id}/{version}/public/plugins/{id}/{assetPath}", "grafana-worldmap-panel", "0.3.3")
		u, err := uc.RelativeURLFor("module")
		require.NoError(t, err)
		sysJSURL := RelativeURLForSystemJS(u)
		assert.Equal(t, "plugin-cdn/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/module", sysJSURL)
	})

	// Ensure that it works also with absolute urls
	t.Run("valid absolute", func(t *testing.T) {
		uc := NewCDNURLConstructor("https://grafana-assets.grafana.net/plugin-cdn-test/plugin-cdn/{id}/{version}/public/plugins/{id}/{assetPath}", "grafana-worldmap-panel", "0.3.3")
		u, err := uc.StringURLFor("module")
		require.NoError(t, err)
		sysJSURL := RelativeURLForSystemJS(u)
		assert.Equal(t, "plugin-cdn/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/module", sysJSURL)
	})

	// Ensures that if the keyword "plugin-cdn" is not present, the relative URL is returned instead.
	t.Run("invalid", func(t *testing.T) {
		uc := NewCDNURLConstructor("https://the.cdn/{id}/{version}/{assetPath}", "the-plugin", "0.1")
		u, err := uc.RelativeURLFor("module")
		require.NoError(t, err)
		sysJSURL := RelativeURLForSystemJS(u)
		assert.Equal(t, u, sysJSURL)
	})

	// Ensures that if the keyword "plugin-cdn" is present more than once in the URL, it is accounted for only once.
	t.Run("system.js keyword multiple times", func(t *testing.T) {
		uc := NewCDNURLConstructor("https://grafana-assets.grafana.net/plugin-cdn-test/plugin-cdn/{id}/{version}/public/plugins/{id}/{assetPath}", "plugin-cdn", "0.1")
		u, err := uc.RelativeURLFor("folder/plugin-cdn/file.txt")
		require.NoError(t, err)
		sysJSURL := RelativeURLForSystemJS(u)
		assert.Equal(t, "plugin-cdn/plugin-cdn/0.1/public/plugins/plugin-cdn/folder/plugin-cdn/file.txt", sysJSURL)
	})
}
