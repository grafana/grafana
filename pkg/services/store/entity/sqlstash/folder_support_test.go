package sqlstash

import (
	_ "embed"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"
)

func TestFolderSupport(t *testing.T) {
	root, lost, err := buildFolderTree([]*folderInfo{
		{UID: "A", parentUID: "", Name: "A", originalSlug: "a"},
		{UID: "AA", parentUID: "A", Name: "AA", originalSlug: "aa"},
		{UID: "B", parentUID: "", Name: "B", originalSlug: "b"},
	})
	require.NoError(t, err)
	require.NotNil(t, root)
	require.NotNil(t, lost)
	require.Empty(t, lost)

	frame := treeToFrame(root)
	experimental.CheckGoldenJSONFrame(t, "testdata", "simple", frame, true)
}

func treeToFrame(root *folderInfo) *data.Frame {
	frame := data.NewFrame("",
		data.NewFieldFromFieldType(data.FieldTypeString, 0), // UID
		data.NewFieldFromFieldType(data.FieldTypeString, 0), // Name
		data.NewFieldFromFieldType(data.FieldTypeString, 0), // Slug
		data.NewFieldFromFieldType(data.FieldTypeInt32, 0),  // Depth
		data.NewFieldFromFieldType(data.FieldTypeInt32, 0),  // Left
		data.NewFieldFromFieldType(data.FieldTypeInt32, 0),  // Right
		data.NewFieldFromFieldType(data.FieldTypeJSON, 0),   // Tree
	)
	frame.Fields[0].Name = "UID"
	frame.Fields[1].Name = "name"
	frame.Fields[2].Name = "slug"
	frame.Fields[3].Name = "depth"
	frame.Fields[4].Name = "left"
	frame.Fields[5].Name = "right"
	frame.Fields[6].Name = "tree"
	appendFolder(root, frame)
	return frame
}

func appendFolder(folder *folderInfo, frame *data.Frame) {
	b, _ := json.Marshal(folder.stack)
	frame.AppendRow(
		folder.UID,
		folder.Name,
		folder.Slug,
		folder.depth,
		folder.left,
		folder.right,
		json.RawMessage(b),
	)
	for _, sub := range folder.children {
		appendFolder(sub, frame)
	}
}
