package search

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	dashboardapp "github.com/grafana/grafana/apps/dashboard/pkg/apis"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

// TestBleveNotebookContentSearch covers the path from a notebook's Markdown cells to a text
// query on the declared content field, using the manifest's own field declaration.
func TestBleveNotebookContentSearch(t *testing.T) {
	const group, kindResource = "dashboard.grafana.app", "notebooks"

	sel, hashes, providers, err := resource.SearchFieldsForManifests(dashboardapp.LocalManifest().ManifestData)
	require.NoError(t, err)
	registry := resource.NewSearchFieldsRegistry(sel, hashes, providers)

	// A notebook index built before the content field existed recorded the hash of the standard
	// fields alone; a different expected hash is what makes the rebuild scan replace it.
	_, hash, _ := registry.ForKey(resource.NamespacedResource{Namespace: "ns", Group: group, Resource: kindResource})
	assert.NotEmpty(t, hash)
	assert.NotEqual(t, resource.StandardSearchFieldsHash(), hash)

	backend, err := NewBleveBackend(BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: 5, // stay in memory
		SearchFields:  registry,
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	info, err := builders.GetNotebookSearchBuilder(registry)
	require.NoError(t, err)

	key := &resourcepb.ResourceKey{Namespace: "ns", Group: group, Resource: kindResource}
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})

	notebook := func(name, title, markdown string) *resource.BulkIndexItem {
		itemKey := &resourcepb.ResourceKey{Namespace: "ns", Group: group, Resource: kindResource, Name: name}
		value := `{
			"apiVersion": "dashboard.grafana.app/v2beta1",
			"kind": "Notebook",
			"metadata": {"name": "` + name + `"},
			"spec": {
				"title": "` + title + `",
				"elements": {"a": {"kind": "Cell", "spec": {"content": {"kind": "Markdown", "spec": {"text": "` + markdown + `"}}}}},
				"layout": {"kind": "NotebookLayout", "spec": {"cells": [
					{"kind": "NotebookLayoutItem", "spec": {"element": {"kind": "ElementReference", "name": "a"}, "source": "user"}}
				]}}
			}
		}`
		doc, err := info.Builder.BuildDocument(ctx, itemKey, 1, []byte(value))
		require.NoError(t, err)
		return &resource.BulkIndexItem{Action: resource.ActionIndex, Doc: doc}
	}

	index, err := backend.BuildIndex(ctx, resource.NamespacedResource{
		Namespace: key.Namespace, Group: key.Group, Resource: key.Resource,
	}, 2, "test", func(index resource.ResourceIndex) (int64, error) {
		return 1, index.BulkIndex(&resource.BulkIndexRequest{
			Items: []*resource.BulkIndexItem{
				notebook("one", "Weekly review", "Checked p99 latency after the rollout"),
				notebook("two", "Latency notes", "Nothing to report"),
				notebook("three", "Capacity", "Disk usage is stable"),
			},
		})
	}, nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err)

	search := func(query string, fields ...string) []string {
		queryFields := make([]*resourcepb.ResourceSearchRequest_QueryField, 0, len(fields))
		for _, f := range fields {
			queryFields = append(queryFields, &resourcepb.ResourceSearchRequest_QueryField{Name: f})
		}
		rsp, err := index.Search(ctx, NewStubAccessClient(map[string]bool{kindResource: true}), &resourcepb.ResourceSearchRequest{
			Options:     &resourcepb.ListOptions{Key: key},
			Query:       query,
			QueryFields: queryFields,
			Limit:       100,
		}, nil, nil)
		require.NoError(t, err)
		out := make([]string, 0, len(rsp.Rows))
		for _, row := range rsp.Rows {
			out = append(out, row.Key.Name)
		}
		return out
	}

	// The bare name is what the search API sends; the index adds the fields. prefix itself.
	assert.Equal(t, []string{"one"}, search("latency", "content"))
	assert.Empty(t, search("capacity", "content"), "a title word is not content")
	assert.ElementsMatch(t, []string{"one", "two"}, search("latency", resource.SEARCH_FIELD_TITLE, "content"))
}
