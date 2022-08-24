package playlist

import (
	"os"
	"path"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/framework/coremodel"
)

func TestPlaylist_parseValid(t *testing.T) {
	const dirName = "testdata/valid"
	files, err := os.ReadDir(dirName)
	require.NoError(t, err, "failed to read testdata files")

	for _, f := range files {
		t.Run(f.Name(), func(t *testing.T) {
			bs, err := os.ReadFile(path.Join(dirName, f.Name()))
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
	files, err := os.ReadDir(dirName)
	require.NoError(t, err, "failed to read testdata files")

	for _, f := range files {
		t.Run(f.Name(), func(t *testing.T) {
			bs, err := os.ReadFile(path.Join(dirName, f.Name()))
			require.NoError(t, err, "reading test file")

			cm, err := New(cuectx.ProvideThemaLibrary())
			require.NoError(t, err)

			_, _, err = coremodel.Mux(cm).Converge(bs)
			require.Error(t, err)
		})
	}
}
