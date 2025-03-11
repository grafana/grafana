package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStandardDocumentBuilder(t *testing.T) {
	ctx := context.Background()
	builder := StandardDocumentBuilder()

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
	fmt.Printf("%s\n", string(jj))
	require.JSONEq(t, `{
		"key": {
			"namespace": "default",
			"group": "playlists.grafana.app",
			"resource": "playlists",
			"name": "test1"
		},
		"name": "test1",
		"rv": 10,
		"title": "Test Playlist from Unified Storage",
		"title_ngram": "Test Playlist from Unified Storage",
		"title_phrase": "test playlist from unified storage",
		"created": 1717236672000,
		"createdBy": "user:ABC",
		"updatedBy": "user:XYZ",
		"manager": {
			"kind": "repo",
			"id": "something"
		},
		"managedBy": "repo:something",
		"source": {
			"path": "path/in/system.json",
			"checksum": "xyz"
		}
	}`, string(jj))
}
