package commands

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/require"
)

func TestMergeFS(t *testing.T) {
	tempDir := os.DirFS(filepath.Join("testdata", "mergefs"))
	a := fstest.MapFS{
		"a/":          &fstest.MapFile{Data: []byte("a")},
		"a/z/":        &fstest.MapFile{Data: []byte("a/z")},
		"a/z/foo.cue": &fstest.MapFile{Data: []byte("foo")},
	}

	filesystem := Merge(a, tempDir)
	require.NoError(t, fs.WalkDir(filesystem, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		file, err := filesystem.Open(path)
		require.NoError(t, err)
		require.NotNil(t, file)

		if !d.IsDir() && d.Name() != "" {
			data := make([]byte, 3)
			_, err := file.Read(data)
			require.NoError(t, err)

			actual := string(data)
			require.Equal(t, "foo", strings.TrimSuffix(actual, "\n"))
		}

		return nil
	}),
	)
}

func TestMerge_dummy(t *testing.T) {
	tempDir := os.DirFS(filepath.Join("testdata", "mergefs"))
	tempDir2 := os.DirFS(filepath.Join("testdata", "mergefs2"))

	filesystem := Merge(tempDir2, tempDir)
	require.NoError(t, fs.WalkDir(filesystem, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		file, err := filesystem.Open(path)
		require.NoError(t, err)
		require.NotNil(t, file)

		if !d.IsDir() {
			data := make([]byte, 3)
			_, err := file.Read(data)
			require.NoError(t, err)

			actual := string(data)

			if path == "b/z/foo.cue" {
				require.Equal(t, "foo", strings.TrimSuffix(actual, "\n"))
			} else {
				require.Equal(t, "bar", strings.TrimSuffix(actual, "\n"))
			}
		}

		return nil
	}),
	)
}
