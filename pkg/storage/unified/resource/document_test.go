package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestStandardDocumentBuilder(t *testing.T) {
	ctx := context.Background()
	builder := StandardDocumentBuilder(nil)

	body, err := os.ReadFile("testdata/playlist-resource.json")
	require.NoError(t, err)
	doc, err := builder.BuildDocument(ctx, &resourcepb.ResourceKey{
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
		"ownerReferences": [
			"iam.grafana.app/Team/engineering",
			"iam.grafana.app/User/test"
		],
		"source": {
			"path": "path/in/system.json",
			"checksum": "xyz"
		}
	}`, string(jj))
}

func TestNewIndexableDocumentDefaultsFolder(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "dashboards.grafana.app/v1beta1",
		"kind":       "Dashboard",
		"metadata":   map[string]any{"name": "abc"},
	}}
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)

	t.Run("stamps general on root-parented dashboards and folders", func(t *testing.T) {
		for _, group := range []string{"dashboards.grafana.app", "folders.grafana.app"} {
			doc := NewIndexableDocument(&resourcepb.ResourceKey{Group: group, Name: "abc"}, 1, meta, "")
			require.Equal(t, folder.GeneralFolderUID, doc.Folder, group)
		}
	})

	t.Run("leaves an explicit folder untouched", func(t *testing.T) {
		meta.SetFolder("parent-uid")
		doc := NewIndexableDocument(&resourcepb.ResourceKey{Group: "dashboards.grafana.app", Name: "abc"}, 1, meta, "")
		require.Equal(t, "parent-uid", doc.Folder)
		meta.SetFolder("")
	})

	t.Run("does not stamp other resource types", func(t *testing.T) {
		doc := NewIndexableDocument(&resourcepb.ResourceKey{Group: "playlists.grafana.app", Name: "abc"}, 1, meta, "")
		require.Equal(t, "", doc.Folder)
	})
}
