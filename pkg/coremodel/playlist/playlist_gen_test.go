package playlist

import (
	"embed"
	"path"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/cuectx"
)

//go:embed testdata
var fs embed.FS

func TestPlaylist_parseValid(t *testing.T) {
	const dirName = "testdata/valid"
	files, err := fs.ReadDir(dirName)
	require.NoError(t, err, "failed to read testdata files")

	for _, f := range files {
		t.Run(f.Name(), func(t *testing.T) {
			bs, err := fs.ReadFile(path.Join(dirName, f.Name()))
			require.NoError(t, err, "reading test file")

			data, err := cuectx.JSONtoCUE(f.Name(), bs)
			require.NoError(t, err)

			cm, err := New(cuectx.ProvideThemaLibrary())
			require.NoError(t, err)

			_, err = cm.CurrentSchema().Validate(data)
			require.NoError(t, err)

			playlist, ok := cm.GoType().(*Model)
			require.True(t, ok)
			assert.Nil(t, playlist.Interval)
		})
	}
}
