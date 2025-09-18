package plugins

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"sort"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLocalFS_Remove(t *testing.T) {
	pluginDir := t.TempDir()
	pluginJSON := filepath.Join(pluginDir, "plugin.json")
	//nolint:gosec
	f, err := os.Create(pluginJSON)
	require.NoError(t, err)
	err = f.Close()
	require.NoError(t, err)
	fs := NewLocalFS(pluginDir)
	err = fs.Remove()
	require.NoError(t, err)

	_, err = os.Stat(pluginDir)
	require.Error(t, err)
	require.True(t, os.IsNotExist(err))

	_, err = os.Stat(pluginJSON)
	require.Error(t, err)
	require.True(t, os.IsNotExist(err))

	t.Run("Uninstall will search in nested dist folder for plugin.json", func(t *testing.T) {
		pluginDistDir := filepath.Join(t.TempDir(), "dist")
		err = os.Mkdir(pluginDistDir, 0o750)
		require.NoError(t, err)
		pluginJSON = filepath.Join(pluginDistDir, "plugin.json")
		//nolint:gosec
		f, err = os.Create(pluginJSON)
		require.NoError(t, err)
		err = f.Close()
		require.NoError(t, err)

		pluginDir = filepath.Dir(pluginDistDir)

		fs = NewLocalFS(pluginDir)

		err = fs.Remove()
		require.NoError(t, err)

		_, err = os.Stat(pluginDir)
		require.True(t, os.IsNotExist(err))

		_, err = os.Stat(pluginJSON)
		require.Error(t, err)
		require.True(t, os.IsNotExist(err))
	})

	t.Run("Uninstall will not delete folder if cannot recognize plugin structure", func(t *testing.T) {
		pluginDir = filepath.Join(t.TempDir(), "system32")
		err = os.Mkdir(pluginDir, 0o750)
		require.NoError(t, err)
		testFile := filepath.Join(pluginDir, "important.exe")
		//nolint:gosec
		f, err = os.Create(testFile)
		require.NoError(t, err)
		err = f.Close()
		require.NoError(t, err)

		fs = NewLocalFS(pluginDir)

		err = fs.Remove()
		require.ErrorIs(t, err, ErrUninstallInvalidPluginDir)

		_, err = os.Stat(pluginDir)
		require.NoError(t, err)

		_, err = os.Stat(testFile)
		require.NoError(t, err)
	})
}

func TestLocalFile_Read(t *testing.T) {
	t.Run("not exists", func(t *testing.T) {
		var out []byte
		f := LocalFile{path: "does not exist"}
		n, err := f.Read(out)
		require.Zero(t, n)
		require.Equal(t, ErrFileNotExist, err)
	})

	t.Run("read", func(t *testing.T) {
		t.Run("extra", func(t *testing.T) {
			s := newTempFileScenarioForTest(t)
			f := s.newLocalFile()

			const bufSize = 512
			out := make([]byte, bufSize)
			n, err := f.Read(out)
			require.NoError(t, err)
			require.NoError(t, f.Close())
			const exp = "hello\n"
			require.Equal(t, len(exp), n)
			require.Equal(t, []byte(exp), out[:len(exp)])
			require.Equal(t, make([]byte, bufSize-len(exp)), out[len(exp):])
		})

		t.Run("empty", func(t *testing.T) {
			s := newTempFileScenarioForTest(t)
			f := s.newLocalFile()

			var out []byte
			n, err := f.Read(out)
			require.NoError(t, err)
			require.NoError(t, f.Close())
			require.Zero(t, n)
			require.Empty(t, out)
		})

		t.Run("multiple", func(t *testing.T) {
			s := newTempFileScenarioForTest(t)
			f := s.newLocalFile()

			a := make([]byte, 2)
			b := make([]byte, 3)
			c := make([]byte, 2)

			t.Cleanup(func() {
				require.NoError(t, f.Close())
			})

			n, err := f.Read(a)
			require.NoError(t, err)
			require.Equal(t, 2, n)
			require.Equal(t, []byte("he"), a)

			n, err = f.Read(b)
			require.NoError(t, err)
			require.Equal(t, 3, n)
			require.Equal(t, []byte("llo"), b)

			n, err = f.Read(c)
			require.NoError(t, err)
			require.Equal(t, 1, n)
			require.Equal(t, []byte{'\n', 0}, c)

			n, err = f.Read(c)
			require.Zero(t, n)
			require.Equal(t, io.EOF, err)
		})
	})
}

func TestLocalFile_Close(t *testing.T) {
	t.Run("once after read", func(t *testing.T) {
		s := newTempFileScenarioForTest(t)
		f := s.newLocalFile()

		_, err := f.Read(nil)
		require.NoError(t, err)
		require.NoError(t, f.Close())
	})

	t.Run("never opened", func(t *testing.T) {
		s := newTempFileScenarioForTest(t)
		f := s.newLocalFile()

		require.NoError(t, f.Close())
	})

	t.Run("twice", func(t *testing.T) {
		s := newTempFileScenarioForTest(t)
		f := s.newLocalFile()

		_, err := f.Read(nil)
		require.NoError(t, err)
		require.NoError(t, f.Close())
		require.Error(t, f.Close())
	})
}

type tempFileScenario struct {
	filePath string
}

func (s tempFileScenario) newLocalFile() LocalFile {
	return LocalFile{path: s.filePath}
}

func newTempFileScenario(t *testing.T) (tempFileScenario, error) {
	tf, err := os.CreateTemp(t.TempDir(), "*")
	if err != nil {
		return tempFileScenario{}, err
	}
	defer tf.Close() //nolint
	if _, err := tf.Write([]byte("hello\n")); err != nil {
		return tempFileScenario{}, err
	}
	return tempFileScenario{
		filePath: tf.Name(),
	}, nil
}

func newTempFileScenarioForTest(t *testing.T) tempFileScenario {
	s, err := newTempFileScenario(t)
	require.NoError(t, err)
	return s
}

func createDummyTempFile(dir, fn string) (err error) {
	f, err := os.Create(filepath.Join(dir, fn)) // nolint: gosec
	if err != nil {
		return err
	}
	defer func() {
		if closeErr := f.Close(); closeErr != nil && err == nil {
			err = closeErr
		}
	}()
	_, err = f.WriteString(fn)
	return
}

func TestStaticFS(t *testing.T) {
	tmp := t.TempDir()
	const allowedFn, deniedFn = "allowed.txt", "denied.txt"
	require.NoError(t, createDummyTempFile(tmp, allowedFn))

	localFS := NewLocalFS(tmp)
	staticFS, err := NewStaticFS(localFS)
	require.NoError(t, err)

	t.Run("open allowed", func(t *testing.T) {
		f, err := staticFS.Open(allowedFn)
		require.NoError(t, err)
		t.Cleanup(func() { require.NoError(t, f.Close()) })
		b, err := io.ReadAll(f)
		require.NoError(t, err)
		require.Equal(t, []byte(allowedFn), b)
	})

	t.Run("open denied", func(t *testing.T) {
		// Add file after initialization
		require.NoError(t, createDummyTempFile(tmp, deniedFn))

		// StaticFS should fail
		_, err := staticFS.Open(deniedFn)
		require.True(t, errors.Is(err, ErrFileNotExist))

		// Underlying FS should succeed
		f, err := localFS.Open(deniedFn)
		require.NoError(t, err)
		t.Cleanup(func() { require.NoError(t, f.Close()) })
		b, err := io.ReadAll(f)
		require.NoError(t, err)
		require.Equal(t, []byte("denied.txt"), b)
	})

	t.Run("open not existing", func(t *testing.T) {
		_, err := staticFS.Open("unknown.txt")
		require.True(t, errors.Is(err, ErrFileNotExist))
	})

	t.Run("list files", func(t *testing.T) {
		t.Run("underlying fs has extra files", func(t *testing.T) {
			files, err := localFS.Files()
			require.NoError(t, err)
			sort.Strings(files)
			require.Equal(t, []string{allowedFn, deniedFn}, files)
		})

		t.Run("staticfs filters underlying fs's files", func(t *testing.T) {
			files, err := staticFS.Files()
			require.NoError(t, err)
			require.Equal(t, []string{allowedFn}, files)
		})
	})

	t.Run("FSRemover interface implementation verification", func(t *testing.T) {
		tmpDir := t.TempDir()

		lfs := NewLocalFS(tmpDir)
		var localFSInterface FS = lfs
		_, isRemover := localFSInterface.(FSRemover)
		require.True(t, isRemover)

		sfs, err := NewStaticFS(localFS)
		require.NoError(t, err)
		var staticFSInterface FS = sfs
		_, isRemover = staticFSInterface.(FSRemover)
		require.True(t, isRemover)
	})
}

// TestFSTwoDotsInFileName ensures that LocalFS and StaticFS allow two dots in file names.
// This makes sure that FSes do not believe that two dots in a file name (anywhere in the path)
// represent a path traversal attempt.
func TestFSTwoDotsInFileName(t *testing.T) {
	tmp := t.TempDir()
	const fn = "test..png"
	require.NoError(t, createDummyTempFile(tmp, fn))

	localFS := NewLocalFS(tmp)
	staticFS, err := NewStaticFS(localFS)
	require.NoError(t, err)

	// Test both with localFS and staticFS

	files, err := localFS.Files()
	require.NoError(t, err)
	require.Equal(t, []string{"test..png"}, files)

	files, err = staticFS.Files()
	require.NoError(t, err)
	require.Equal(t, []string{"test..png"}, files)
}
