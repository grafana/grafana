package resource

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStandardDocumentBuilder(t *testing.T) {
	ctx := context.Background()
	builder := GetStandardDocumentBuilder().Builder()

	body, err := os.ReadFile("testdata/playlist-resource.json")
	require.NoError(t, err)
	doc, err := builder.BuildDocument(ctx, &ResourceKey{
		Namespace: "default",
		Group:     "playlists.grafana.app",
		Resource:  "playlists",
		Name:      "test1",
	}, 10, body)
	require.NoError(t, err)

	jj, _ := json.MarshalIndent(doc, "", "  ")
	// fmt.Printf("%s\n", string(jj))
	require.JSONEq(t, `{
		"key": {
			"namespace": "default",
			"group": "playlists.grafana.app",
			"resource": "playlists",
			"name": "test1"
		},
		"rv": 10,
		"title": "test1",
		"meta": {
			"created": 1730490142000,
			"createdBy": "user:1",
			"repository": {
				"name": "SQL",
				"path": "15",
				"time": "2024-11-01T19:42:22Z"
			}
		}
	}`, string(jj))
}
