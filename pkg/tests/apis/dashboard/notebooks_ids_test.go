package dashboards

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var uuidV4 = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

// cell describes one notebook cell: the element it points at and, optionally, the id the client sends.
type cell struct {
	element string
	id      string
}

// notebookSpec is a notebook spec with a markdown element for every cell, the layout in the order given.
func notebookSpec(cells ...cell) map[string]any {
	elements := map[string]any{}
	items := make([]any, 0, len(cells))
	for _, c := range cells {
		elements[c.element] = map[string]any{
			"kind": "Cell",
			"spec": map[string]any{"content": map[string]any{"kind": "Markdown", "spec": map[string]any{"text": c.element}}},
		}
		itemSpec := map[string]any{
			"element": map[string]any{"kind": "ElementReference", "name": c.element},
			"source":  "user",
		}
		if c.id != "" {
			itemSpec["id"] = c.id
		}
		items = append(items, map[string]any{"kind": "NotebookLayoutItem", "spec": itemSpec})
	}

	return map[string]any{
		"title":    "Ids",
		"elements": elements,
		"layout": map[string]any{
			"kind": "NotebookLayout",
			"spec": map[string]any{"cells": items},
		},
	}
}

// replaceSpec writes the spec the way the notebook editor does: a JSON patch that replaces /spec.
func replaceSpec(ctx context.Context, client *apis.K8sResourceClient, name string, spec map[string]any) (*unstructured.Unstructured, error) {
	patch, err := json.Marshal([]map[string]any{{"op": "replace", "path": "/spec", "value": spec}})
	if err != nil {
		return nil, err
	}
	return client.Resource.Patch(ctx, name, types.JSONPatchType, patch, metav1.PatchOptions{})
}

// cellIDs returns the id and element name of every layout item, in layout order.
func cellIDs(t *testing.T, nb *unstructured.Unstructured) []cell {
	t.Helper()

	items, found, err := unstructured.NestedSlice(nb.Object, "spec", "layout", "spec", "cells")
	require.NoError(t, err)
	require.True(t, found, "notebook has no layout cells")

	cells := make([]cell, 0, len(items))
	for _, item := range items {
		spec, ok := item.(map[string]any)["spec"].(map[string]any)
		require.True(t, ok)
		id, _ := spec["id"].(string)
		name, _ := spec["element"].(map[string]any)["name"].(string)
		cells = append(cells, cell{element: name, id: id})
	}
	return cells
}

func TestIntegrationNotebookCellIDs(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ctx := context.Background()

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
		EnableFeatureToggles: []string{featuremgmt.FlagDashboardNotebooks},
	})
	defer helper.Shutdown()

	gvr := schema.GroupVersionResource{
		Group:    dashboardV2beta1.GROUP,
		Version:  dashboardV2beta1.VERSION,
		Resource: "notebooks",
	}
	client := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Editor, GVR: gvr})

	n := 0
	create := func(t *testing.T, cells ...cell) *unstructured.Unstructured {
		t.Helper()
		n++
		obj := &unstructured.Unstructured{Object: map[string]any{"spec": notebookSpec(cells...)}}
		obj.SetName(fmt.Sprintf("nbids-%d", n))
		obj.SetAPIVersion(gvr.GroupVersion().String())
		obj.SetKind("Notebook")

		created, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
		return created
	}

	t.Run("a created notebook gets a distinct id on every cell", func(t *testing.T) {
		created := create(t, cell{element: "a"}, cell{element: "b"})

		cells := cellIDs(t, created)
		require.Len(t, cells, 2)
		require.Regexp(t, uuidV4, cells[0].id)
		require.Regexp(t, uuidV4, cells[1].id)
		require.NotEqual(t, cells[0].id, cells[1].id)

		stored, err := client.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, cells, cellIDs(t, stored), "the ids are stored, not only returned")
	})

	// The editor saves the whole spec and, before it learns about ids, sends none.
	t.Run("a save without ids keeps the stored ids, even when the cells are reordered", func(t *testing.T) {
		created := create(t, cell{element: "a"}, cell{element: "b"})
		before := cellIDs(t, created)

		saved, err := replaceSpec(ctx, client, created.GetName(), notebookSpec(cell{element: "b"}, cell{element: "a"}))
		require.NoError(t, err)

		after := cellIDs(t, saved)
		require.Equal(t, []cell{
			{element: "b", id: before[1].id},
			{element: "a", id: before[0].id},
		}, after)
	})

	t.Run("renaming a cell's element keeps its id when the client sends it", func(t *testing.T) {
		created := create(t, cell{element: "a"})
		before := cellIDs(t, created)

		saved, err := replaceSpec(ctx, client, created.GetName(), notebookSpec(cell{element: "renamed", id: before[0].id}))
		require.NoError(t, err)

		require.Equal(t, []cell{{element: "renamed", id: before[0].id}}, cellIDs(t, saved))
	})

	// What ids are for: a cell added under the name of a deleted cell is not that cell.
	t.Run("a cell added under a deleted cell's name gets a new id", func(t *testing.T) {
		created := create(t, cell{element: "a"}, cell{element: "b"})
		deleted := cellIDs(t, created)[0].id

		_, err := replaceSpec(ctx, client, created.GetName(), notebookSpec(cell{element: "b"}))
		require.NoError(t, err)

		saved, err := replaceSpec(ctx, client, created.GetName(), notebookSpec(cell{element: "a"}, cell{element: "b"}))
		require.NoError(t, err)

		cells := cellIDs(t, saved)
		require.Regexp(t, uuidV4, cells[0].id)
		require.NotEqual(t, deleted, cells[0].id)
	})

	// The editor's counter can reissue a deleted cell's name, and the delete and the add can land in one
	// save. A client that sends ids has said which cells are which.
	t.Run("a cell without an id is new when the write carries other ids, even under a stored name", func(t *testing.T) {
		created := create(t, cell{element: "a"}, cell{element: "b"})
		before := cellIDs(t, created)

		saved, err := replaceSpec(ctx, client, created.GetName(), notebookSpec(cell{element: "a", id: before[0].id}, cell{element: "b"}))
		require.NoError(t, err)

		after := cellIDs(t, saved)
		require.Equal(t, before[0].id, after[0].id)
		require.Regexp(t, uuidV4, after[1].id)
		require.NotEqual(t, before[1].id, after[1].id)
	})

	t.Run("two cells with the same id are rejected and nothing is saved", func(t *testing.T) {
		created := create(t, cell{element: "a"}, cell{element: "b"})
		before := cellIDs(t, created)
		same := before[0].id

		_, err := replaceSpec(ctx, client, created.GetName(), notebookSpec(cell{element: "a", id: same}, cell{element: "b", id: same}))
		require.True(t, apierrors.IsInvalid(err), "expected Invalid, got %v", err)
		require.ErrorContains(t, err, "spec.layout.spec.cells[1].spec.id")

		stored, err := client.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, before, cellIDs(t, stored))
	})

	t.Run("an id that is not a UUID v4 is rejected", func(t *testing.T) {
		created := create(t, cell{element: "a"})

		_, err := replaceSpec(ctx, client, created.GetName(), notebookSpec(cell{element: "a", id: "heading-1"}))

		require.True(t, apierrors.IsInvalid(err), "expected Invalid, got %v", err)
	})

	// Restoring an older version writes back a spec with ids the stored notebook no longer has.
	t.Run("an id the stored notebook does not have is accepted when it is unique", func(t *testing.T) {
		created := create(t, cell{element: "a"})
		restored := "11111111-2222-4333-8444-555555555555"

		saved, err := replaceSpec(ctx, client, created.GetName(), notebookSpec(cell{element: "a", id: restored}))
		require.NoError(t, err)

		require.Equal(t, []cell{{element: "a", id: restored}}, cellIDs(t, saved))
	})
}
