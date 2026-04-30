package sync

import (
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/require"
)

func TestManagedResourceIndex(t *testing.T) {
	index := newManagedResourceIndex(&provisioning.ResourceList{
		Items: []provisioning.ResourceListItem{
			{
				Name:     "parent-uid",
				Group:    resources.FolderResource.Group,
				Resource: resources.FolderResource.Resource,
				Path:     "parent",
			},
			{
				Name:     "child-folder-uid",
				Group:    resources.FolderResource.Group,
				Resource: resources.FolderResource.Resource,
				Path:     "parent/child",
			},
			{
				Name:     "parent-dash-uid",
				Group:    "dashboards",
				Resource: "dashboards",
				Path:     "parent/dashboard.json",
			},
			{
				Name:     "grandchild-dash-uid",
				Group:    "dashboards",
				Resource: "dashboards",
				Path:     "parent/child/dashboard.json",
			},
		},
	})

	require.Len(t, index.ExistingAt("parent/"), 1)
	require.Empty(t, index.ExistingAt("parent"))
	require.Equal(t, []string{
		"parent/child/",
		"parent/dashboard.json",
	}, index.DirectChildrenOf("parent/"))
}

func TestManagedResourceIndex_DuplicatePaths(t *testing.T) {
	t.Run("ExistingAt returns all items when multiple items share a path", func(t *testing.T) {
		index := newManagedResourceIndex(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Name: "dash-first", Group: "dashboards", Resource: "dashboards", Path: "folder/dashboard.json"},
				{Name: "dash-second", Group: "dashboards", Resource: "dashboards", Path: "folder/dashboard.json"},
			},
		})

		items := index.ExistingAt("folder/dashboard.json")
		require.Len(t, items, 2)
		require.Equal(t, "dash-first", items[0].Name)
		require.Equal(t, "dash-second", items[1].Name)
	})

	t.Run("DirectChildrenOf lists path once even with duplicates", func(t *testing.T) {
		index := newManagedResourceIndex(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Name: "parent-uid", Group: resources.FolderResource.Group, Resource: resources.FolderResource.Resource, Path: "parent"},
				{Name: "dash-a", Group: "dashboards", Resource: "dashboards", Path: "parent/dashboard.json"},
				{Name: "dash-b", Group: "dashboards", Resource: "dashboards", Path: "parent/dashboard.json"},
				{Name: "other", Group: "dashboards", Resource: "dashboards", Path: "parent/other.json"},
			},
		})

		children := index.DirectChildrenOf("parent/")
		require.Equal(t, []string{
			"parent/dashboard.json",
			"parent/other.json",
		}, children, "each path should appear once regardless of duplicates")
	})

	t.Run("nil target produces empty index", func(t *testing.T) {
		index := newManagedResourceIndex(nil)
		require.Empty(t, index.ExistingAt("anything"))
		require.Empty(t, index.DirectChildrenOf("anything/"))
	})
}

func TestManagedResourceIndex_ExistingByName(t *testing.T) {
	index := newManagedResourceIndex(&provisioning.ResourceList{
		Items: []provisioning.ResourceListItem{
			{Name: "folder-a", Group: resources.FolderResource.Group, Resource: resources.FolderResource.Resource, Path: "path-a"},
			{Name: "folder-b", Group: resources.FolderResource.Group, Resource: resources.FolderResource.Resource, Path: "path-b"},
			{Name: "shared-name", Group: resources.FolderResource.Group, Resource: resources.FolderResource.Resource, Path: "path-c"},
			{Name: "shared-name", Group: "dashboards", Resource: "dashboards", Path: "path-c/dash.json"},
		},
	})

	t.Run("returns items matching the name", func(t *testing.T) {
		items := index.ExistingByName("folder-a")
		require.Len(t, items, 1)
		require.Equal(t, "path-a", items[0].Path)
	})

	t.Run("returns multiple items when different kinds share the same name", func(t *testing.T) {
		items := index.ExistingByName("shared-name")
		require.Len(t, items, 2)
	})

	t.Run("returns nil for unknown name", func(t *testing.T) {
		require.Empty(t, index.ExistingByName("unknown"))
	})

	t.Run("returns nil on nil target", func(t *testing.T) {
		empty := newManagedResourceIndex(nil)
		require.Empty(t, empty.ExistingByName("folder-a"))
	})
}
