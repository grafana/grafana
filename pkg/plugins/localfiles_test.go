package plugins

import (
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

type tempFileScenario struct {
	filePath string
}

func (s tempFileScenario) cleanup() error {
	return os.Remove(s.filePath)
}

func (s tempFileScenario) newLocalFile() LocalFile {
	return LocalFile{path: s.filePath}
}

func newTempFileScenario() (tempFileScenario, error) {
	tf, err := os.CreateTemp(os.TempDir(), "*")
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
	s, err := newTempFileScenario()
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, s.cleanup())
	})
	return s
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

func createDummyTempFile(dir, fn string) (err error) {
	f, err := os.Create(filepath.Join(dir, fn))
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

func TestAllowList(t *testing.T) {
	tmp := t.TempDir()
	const allowedFn, deniedFn = "allowed.txt", "denied.txt"
	for _, fn := range []string{allowedFn, deniedFn} {
		require.NoError(t, createDummyTempFile(tmp, fn))
	}

	localFS := NewLocalFS(tmp, nil)
	allowFS := NewAllowListFS(map[string]struct{}{allowedFn: {}}, localFS)

	t.Run("open allowed", func(t *testing.T) {
		f, err := allowFS.Open(allowedFn)
		require.NoError(t, err)
		defer func() { require.NoError(t, f.Close()) }()
		b, err := io.ReadAll(f)
		require.NoError(t, err)
		require.Equal(t, []byte(allowedFn), b)
	})

	t.Run("open denied", func(t *testing.T) {
		_, err := allowFS.Open(deniedFn)
		require.True(t, errors.Is(err, ErrFileNotExist))
	})

	t.Run("open not existing", func(t *testing.T) {
		_, err := allowFS.Open("unknown.txt")
		require.True(t, errors.Is(err, ErrFileNotExist))
	})

	t.Run("list files", func(t *testing.T) {
		t.Run("underlying fs has extra files", func(t *testing.T) {
			files, err := localFS.Files()
			require.NoError(t, err)
			require.Equal(t, []string{allowedFn, deniedFn}, files)
		})

		t.Run("allowfs filters underelying fs's files", func(t *testing.T) {
			files, err := allowFS.Files()
			require.NoError(t, err)
			require.Equal(t, []string{allowedFn}, files)
		})
	})
}

func TestAllowListFSNoFiles(t *testing.T) {
	lfs := NewLocalFS(".", func(acc map[string]struct{}) filepath.WalkFunc {
		return func(path string, info fs.FileInfo, err error) error {
			require.Fail(t, "WalkFunc shouldn't have been called")
			return errors.New("shouldn't have been called")
		}
	})
	const fn = "allowed.txt"
	afs := allowListFSNoFiles(NewAllowListFS(map[string]struct{}{fn: {}}, lfs))
	files, err := afs.Files()
	require.NoError(t, err)
	require.Equal(t, []string{fn}, files)
}
