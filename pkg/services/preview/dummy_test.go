package preview

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDrawImage(t *testing.T) {
	t.Skip()

	fpath := "temp.png"
	err := renderDummyImage(fpath, &previewRequest{
		UID:   "aaa",
		Size:  PreviewSizeLarge,
		Theme: "dark",
	})

	require.NoError(t, err)
	// t.Cleanup(func() {
	// 	err := os.RemoveAll(fpath)
	// 	assert.NoError(t, err)
	// })
}
