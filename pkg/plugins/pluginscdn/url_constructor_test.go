package pluginscdn

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestURLConstructor_StringURLFor(t *testing.T) {
	uc := URLConstructor{
		cdnURLTemplate: "https://the.cdn/{id}/{version}/{assetPath}",
		pluginID:       "the-plugin",
		pluginVersion:  "0.1",
	}
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
			u, err := uc.StringPath(c.path)
			require.NoError(t, err)
			require.Equal(t, c.exp, u)
		})
	}
}
