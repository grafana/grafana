package plugins

import (
	"io"
	"os"
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
