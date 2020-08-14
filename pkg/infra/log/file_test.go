package log

import (
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/stretchr/testify/assert"
)

func (w *FileLogWriter) WriteLine(line string) error {
	n, err := w.mw.Write([]byte(line))
	if err != nil {
		return err
	}
	w.docheck(n)
	return nil
}

func TestLogFile(t *testing.T) {
	fileLogWrite := NewFileWriter()
	require.NotNil(t, fileLogWrite)

	t.Cleanup(func() {
		fileLogWrite.Close()
		err := os.Remove(fileLogWrite.Filename)
		require.NoError(t, err)
	})

	fileLogWrite.Filename = "grafana_test.log"
	err := fileLogWrite.Init()
	require.NoError(t, err)

	assert.Zero(t, fileLogWrite.maxlines_curlines)

	t.Run("adding lines", func(t *testing.T) {
		err := fileLogWrite.WriteLine("test1\n")
		require.NoError(t, err)
		err = fileLogWrite.WriteLine("test2\n")
		require.NoError(t, err)
		err = fileLogWrite.WriteLine("test3\n")
		require.NoError(t, err)

		assert.Equal(t, 3, fileLogWrite.maxlines_curlines)
	})
}
