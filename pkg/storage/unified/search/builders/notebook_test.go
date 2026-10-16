package builders

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	dashboardapp "github.com/grafana/grafana/apps/dashboard/pkg/apis"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestNotebookDocumentBuilder(t *testing.T) {
	selectable, hashes, providers, err := resource.SearchFieldsForManifests(dashboardapp.LocalManifest().ManifestData)
	require.NoError(t, err)
	assert.NotEmpty(t, hashes[resource.NewLowerGroupResource("dashboard.grafana.app", "notebooks")])
	registry := resource.NewSearchFieldsRegistry(selectable, hashes, providers)

	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "notebooks",
		Name:      "incident-notes",
	}
	info := NotebookBuilder(registry)
	assert.Equal(t, key.Group, info.GroupResource.Group)
	assert.Equal(t, key.Resource, info.GroupResource.Resource)
	builder, err := info.Namespaced(context.Background(), key.Namespace, nil)
	require.NoError(t, err)

	notebook := map[string]any{
		"apiVersion": "dashboard.grafana.app/v2beta1",
		"kind":       "Notebook",
		"metadata": map[string]any{
			"name":      key.Name,
			"namespace": key.Namespace,
		},
		"spec": map[string]any{
			"title": "Incident notes",
			"tags":  []string{"ops"},
			"elements": map[string]any{
				"markdown": map[string]any{"kind": "Cell", "spec": map[string]any{"content": map[string]any{"kind": "Markdown", "spec": map[string]any{"text": "checkout latency increased"}}}},
				"code":     map[string]any{"kind": "Cell", "spec": map[string]any{"content": map[string]any{"kind": "Code", "spec": map[string]any{"language": "javascript", "code": "const duration = 42;"}}}},
				"orphan":   map[string]any{"kind": "Cell", "spec": map[string]any{"content": map[string]any{"kind": "Markdown", "spec": map[string]any{"text": "removed secret"}}}},
				"panel":    map[string]any{"kind": "Panel", "spec": map[string]any{"title": "transient data"}},
			},
			"layout": map[string]any{"kind": "NotebookLayout", "spec": map[string]any{"cells": []any{
				map[string]any{"kind": "NotebookLayoutItem", "spec": map[string]any{"element": map[string]any{"kind": "ElementReference", "name": "markdown"}}},
				map[string]any{"kind": "NotebookLayoutItem", "spec": map[string]any{"element": map[string]any{"kind": "ElementReference", "name": "panel"}}},
				map[string]any{"kind": "NotebookLayoutItem", "spec": map[string]any{"element": map[string]any{"kind": "ElementReference", "name": "code"}}},
			}}},
		},
	}

	build := func() *resource.IndexableDocument {
		value, err := json.Marshal(notebook)
		require.NoError(t, err)
		doc, err := builder.BuildDocument(context.Background(), key, 1, value)
		require.NoError(t, err)
		return doc
	}

	doc := build()
	assert.Equal(t, "Incident notes", doc.Title)
	assert.Equal(t, []string{"ops"}, doc.Tags)
	assert.Equal(t, []string{"checkout latency increased", "const duration = 42;"}, doc.Fields[notebookContentField])

	elements := notebook["spec"].(map[string]any)["elements"].(map[string]any)
	markdown := elements["markdown"].(map[string]any)
	markdown["spec"].(map[string]any)["content"].(map[string]any)["spec"].(map[string]any)["text"] = "updated observation"
	assert.Equal(t, []string{"updated observation", "const duration = 42;"}, build().Fields[notebookContentField])

	delete(elements, "markdown")
	delete(elements, "code")
	assert.NotContains(t, build().Fields, notebookContentField)
}

type notebookBlobStub struct {
	value []byte
	read  bool
}

func (blob *notebookBlobStub) SupportsSignedURLs() bool { return false }

func (blob *notebookBlobStub) PutResourceBlob(context.Context, *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
	return nil, nil
}

func (blob *notebookBlobStub) GetResourceBlob(_ context.Context, _ *resourcepb.ResourceKey, _ *utils.BlobInfo, mustProxy bool) (*resourcepb.GetBlobResponse, error) {
	blob.read = mustProxy
	return &resourcepb.GetBlobResponse{Value: blob.value}, nil
}

func TestNotebookDocumentBuilderReadsBlob(t *testing.T) {
	key := &resourcepb.ResourceKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "notebooks", Name: "large-notebook"}
	metadata := map[string]any{
		"apiVersion": "dashboard.grafana.app/v2beta1",
		"kind":       "Notebook",
		"metadata": map[string]any{
			"name":              key.Name,
			"labels":            map[string]any{"status": "current"},
			"creationTimestamp": "2026-01-01T00:00:00Z",
			"annotations": map[string]any{
				utils.AnnoKeyBlob:             "blob-uid",
				utils.AnnoKeyFolder:           "current-folder",
				utils.AnnoKeyCreatedBy:        "user:current-creator",
				utils.AnnoKeyUpdatedBy:        "user:current-updater",
				utils.AnnoKeyUpdatedTimestamp: "2026-02-01T00:00:00Z",
			},
		},
	}
	full := map[string]any{
		"apiVersion": metadata["apiVersion"],
		"kind":       metadata["kind"],
		"metadata": map[string]any{
			"name":              key.Name,
			"labels":            map[string]any{"status": "stale"},
			"creationTimestamp": "2025-01-01T00:00:00Z",
			"annotations": map[string]any{
				utils.AnnoKeyFolder:           "stale-folder",
				utils.AnnoKeyCreatedBy:        "user:stale-creator",
				utils.AnnoKeyUpdatedBy:        "user:stale-updater",
				utils.AnnoKeyUpdatedTimestamp: "2025-02-01T00:00:00Z",
			},
		},
		"spec": map[string]any{
			"title":       "Large notebook",
			"description": "Notebook description",
			"tags":        []string{"ops"},
			"elements": map[string]any{
				"note": map[string]any{"kind": "Cell", "spec": map[string]any{"content": map[string]any{"kind": "Markdown", "spec": map[string]any{"text": "content in blob"}}}},
			},
			"layout": map[string]any{"kind": "NotebookLayout", "spec": map[string]any{"cells": []any{
				map[string]any{"kind": "NotebookLayoutItem", "spec": map[string]any{"element": map[string]any{"kind": "ElementReference", "name": "note"}}},
			}}},
		},
	}
	metadataValue, err := json.Marshal(metadata)
	require.NoError(t, err)
	fullValue, err := json.Marshal(full)
	require.NoError(t, err)

	storage := &notebookBlobStub{value: fullValue}
	info := NotebookBuilder(nil)
	builder, err := info.Namespaced(context.Background(), key.Namespace, storage)
	require.NoError(t, err)
	doc, err := builder.BuildDocument(context.Background(), key, 1, metadataValue)
	require.NoError(t, err)
	assert.True(t, storage.read)
	assert.Equal(t, []string{"content in blob"}, doc.Fields[notebookContentField])
	assert.Equal(t, "Large notebook", doc.Title)
	assert.Equal(t, "Notebook description", doc.Description)
	assert.Equal(t, []string{"ops"}, doc.Tags)
	assert.Equal(t, map[string]string{"status": "current"}, doc.Labels)
	assert.Equal(t, "current-folder", doc.Folder)
	assert.Equal(t, "user:current-creator", doc.CreatedBy)
	assert.Equal(t, "user:current-updater", doc.UpdatedBy)
	assert.Equal(t, time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC).UnixMilli(), doc.Created)
	assert.Equal(t, time.Date(2026, time.February, 1, 0, 0, 0, 0, time.UTC).UnixMilli(), doc.Updated)

	builder, err = info.Namespaced(context.Background(), key.Namespace, nil)
	require.NoError(t, err)
	_, err = builder.BuildDocument(context.Background(), key, 1, metadataValue)
	require.ErrorContains(t, err, "notebook blob storage is unavailable")
}
