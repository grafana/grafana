package v2

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFileSinkIsAnOptionalOnPremAdapter(t *testing.T) {
	root := t.TempDir()
	sink, err := NewFileSink(FileSinkInput{
		ImagesDirectory: filepath.Join(root, "images"),
		CSVsDirectory:   filepath.Join(root, "csvs"),
		PDFsDirectory:   filepath.Join(root, "pdfs"),
	})
	require.NoError(t, err)

	result := newResult(io.NopCloser(bytes.NewBufferString("image")), RenderPNG, fileName{}, responseBytesLimit{bytes: 16}, nil)
	t.Cleanup(func() { require.NoError(t, result.Close()) })
	fileResult, err := sink.Write(result)
	require.NoError(t, err)
	require.Equal(t, filepath.Join(root, "images"), filepath.Dir(fileResult.Path()))

	contents, err := os.ReadFile(fileResult.Path())
	require.NoError(t, err)
	require.Equal(t, "image", string(contents))
}
