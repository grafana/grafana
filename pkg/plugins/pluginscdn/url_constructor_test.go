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

func TestCDNBaseURL(t *testing.T) {
	type tc struct {
		name  string
		input string
		exp   string
	}
	for _, c := range []tc{
		{
			name:  "valid",
			input: "https://grafana-assets.grafana.net/plugin-cdn-test/plugin-cdn/{id}/{version}/public/plugins/{id}/{assetPath}",
			exp:   "https://grafana-assets.grafana.net",
		},
		{
			name:  "empty",
			input: "",
			exp:   "",
		},
	} {
		t.Run(c.name, func(t *testing.T) {
			u, err := CDNBaseURL(c.input)
			require.NoError(t, err)
			assert.Equal(t, c.exp, u)
		})
	}
}
