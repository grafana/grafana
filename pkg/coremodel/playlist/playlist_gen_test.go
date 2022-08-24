package playlist

import (
	"embed"
	"path"
	"testing"

	"github.com/grafana/grafana/pkg/framework/coremodel"

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

			cm, err := New(cuectx.ProvideThemaLibrary())
			require.NoError(t, err)

			val, _, err := coremodel.Mux(cm).Converge(bs)
			require.NoError(t, err)

			_, ok := val.(*Model)
			require.True(t, ok)
		})
	}
}

func TestPlaylist_parseInvalid(t *testing.T) {
	const dirName = "testdata/invalid"
	files, err := fs.ReadDir(dirName)
	require.NoError(t, err, "failed to read testdata files")

	for _, f := range files {
		t.Run(f.Name(), func(t *testing.T) {
			bs, err := fs.ReadFile(path.Join(dirName, f.Name()))
			require.NoError(t, err, "reading test file")

			cm, err := New(cuectx.ProvideThemaLibrary())
			require.NoError(t, err)

			_, _, err = coremodel.Mux(cm).Converge(bs)
			require.Error(t, err)
		})
	}
}
