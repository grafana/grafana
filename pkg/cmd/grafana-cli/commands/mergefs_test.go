package commands

import (
	"io/fs"
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/require"
)

func TestMergeFS(t *testing.T) {
	var filePaths = []struct {
		path           string
		dirArrayLength int
		dirs           []string
	}{
		// MapFS takes in account the current directory in addition to all included directories and produces a "" dir
		{"a", 2, []string{"", "z"}},
		{"a/z", 2, []string{"", "bar.cue"}},
		{"b", 1, []string{"z"}},
		{"b/z", 1, []string{"foo.cue"}},
	}

	tempDir := os.DirFS(filepath.Join("testdata", "mergefs"))
	a := fstest.MapFS{
		"a/":          &fstest.MapFile{},
		"a/z/":        &fstest.MapFile{},
		"a/z/bar.cue": &fstest.MapFile{Data: []byte("bar")},
	}

	filesystem := Merge(tempDir, a)

	t.Run("testing mergefs.ReadDir", func(t *testing.T) {
		for _, fp := range filePaths {
			t.Run("testing path: "+fp.path, func(t *testing.T) {
				dirs, err := fs.ReadDir(filesystem, fp.path)
				require.NoError(t, err)
				require.Len(t, dirs, fp.dirArrayLength)

				for i := 0; i < len(dirs); i++ {
					require.Equal(t, dirs[i].Name(), fp.dirs[i])
				}
			})
		}
	})

	t.Run("testing mergefs.Open", func(t *testing.T) {
		data := make([]byte, 3)
		file, err := filesystem.Open("a/z/bar.cue")
		require.NoError(t, err)

		_, err = file.Read(data)
		require.NoError(t, err)
		require.Equal(t, "bar", string(data))

		file, err = filesystem.Open("b/z/foo.cue")
		require.NoError(t, err)

		_, err = file.Read(data)
		require.NoError(t, err)
		require.Equal(t, "foo", string(data))

		err = file.Close()
		require.NoError(t, err)
	})
}
