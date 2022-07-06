package store

import (
	_ "embed"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

var (
	//go:embed testdata/example_list_frame.json
	exampleListFrameJSON string

	//go:embed testdata/example_root_level_list.json
	exampleRootLevelListJSON string
)

func TestGetFileNames(t *testing.T) {
	frame := &data.Frame{}
	err := frame.UnmarshalJSON([]byte(exampleListFrameJSON))
	require.NoError(t, err)

	listFrame := StorageListFrame{frame}
	require.Equal(t, []string{
		"DL_1.jpg",
		"Screen Shot 2022-06-23 at 9.05.39 PM.png",
		"Screen Shot 2022-06-24 at 11.58.32 AM.png",
		"Screen Shot 2022-06-30 at 3.45.03 PM.png",
		"Screen Shot 2022-07-05 at 3.24.27 PM.png",
		"image.png", "rocket_1f680.png",
		"test-folder",
		"topcoder12.png",
	}, listFrame.GetFileNames())
}

func TestGetFileNamesRootLevel(t *testing.T) {
	frame := &data.Frame{}
	err := frame.UnmarshalJSON([]byte(exampleRootLevelListJSON))
	require.NoError(t, err)

	listFrame := StorageListFrame{frame}
	require.Equal(t, []string{
		"public-static",
		"resources",
	}, listFrame.GetFileNames())
}
