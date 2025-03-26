package sync

import (
	"testing"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

func TestChanges(t *testing.T) {
	t.Run("start the same", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "simplelocal/dashboard.json", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "simplelocal/dashboard.json", Hash: "xyz"},
			},
		}

		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Empty(t, changes)
	})

	t.Run("create a source file", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "muta.json", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{}

		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Len(t, changes, 1)
		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionCreated,
			Path:   "muta.json",
		}, changes[0])
	})

	t.Run("create empty folder structure for folders with unsupported file types", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "one/two/first.md", Hash: "xyz", Blob: true},
			{Path: "other/second.md", Hash: "xyz", Blob: true},
		}

		target := &provisioning.ResourceList{}
		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Len(t, changes, 2)

		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionCreated,
			Path:   "one/two/",
		}, changes[0])
		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionCreated,
			Path:   "other/",
		}, changes[1])
	})

	t.Run("keep empty folders when unsupported file types are present", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "one/two/first.md", Hash: "xyz", Blob: true},
			{Path: "other/second.md", Hash: "xyz", Blob: true},
		}

		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "one/two/", Resource: "folders"},
				{Path: "other/", Resource: "folders"},
			},
		}
		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Empty(t, changes)
	})
	t.Run("keep common path to unsupported file types", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "common/first.md", Hash: "xyz", Blob: true},
			{Path: "alsocommon/second.md", Hash: "xyz", Blob: true},
		}

		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "common/", Resource: "folders"},
				{Path: "common/not-common/", Resource: "folders", Name: "uncommon-name", Hash: "xyz"},
				{Path: "alsocommon/", Resource: "folders"},
			},
		}
		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Len(t, changes, 1)
		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionDeleted,
			Path:   "common/not-common/",
			Existing: &provisioning.ResourceListItem{
				Path:     "common/not-common/",
				Resource: "folders",
				Name:     "uncommon-name",
				Hash:     "xyz",
			},
		}, changes[0], "the uncommon path should be deleted")
	})

	t.Run("delete a source file", func(t *testing.T) {
		source := []repository.FileTreeEntry{}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "adsl62h.yaml", Hash: "xyz", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "adsl62h-hrw-f-fvlt2dghp-gufrc4lisksgmq-c"},
			},
		}

		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Len(t, changes, 1)
		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionDeleted,
			Path:   "adsl62h.yaml",
			Existing: &provisioning.ResourceListItem{
				Path:     "adsl62h.yaml",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "adsl62h-hrw-f-fvlt2dghp-gufrc4lisksgmq-c",
				Hash:     "xyz",
			},
		}, changes[0])
	})

	t.Run("folder deletion order", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "x/y/z/ignored.md"}, // ignored
			{Path: "aaa/bbb.yaml", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "a.json"},
				{Path: "x/y/file.json"},
				{Path: "aaa/", Resource: "folders"}, // Folder... no action required
				{Path: "aaa/bbb.yaml", Hash: "xyz"},
				{Path: "zzz/longest/path/here.json"},
				{Path: "short/file.yml"},
			},
		}
		changes, err := Changes(source, target)
		require.NoError(t, err)

		order := make([]string, len(changes))
		for i := range changes {
			order[i] = changes[i].Path
		}
		require.Equal(t, []string{
			"zzz/longest/path/here.json", // not sorted yet
			"x/y/z/",
			"x/y/file.json",
			"short/file.yml",
			"a.json",
		}, order)
	})

	t.Run("modify a file", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "adsl62h.yaml", Hash: "modified", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Path:     "adsl62h.yaml",
					Group:    "dashboard.grafana.app",
					Resource: "dashboards",
					Name:     "adsl62h-hrw-f-fvlt2dghp-gufrc4lisksgmq-c",
					Hash:     "original",
				},
			},
		}

		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Len(t, changes, 1)
		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionUpdated,
			Path:   "adsl62h.yaml",
			Existing: &provisioning.ResourceListItem{
				Path:     "adsl62h.yaml",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "adsl62h-hrw-f-fvlt2dghp-gufrc4lisksgmq-c",
				Hash:     "original",
			},
		}, changes[0])
	})

	t.Run("keep folder with hidden files", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "folder/.hidden.json", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "folder/", Resource: "folders"},
			},
		}
		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Empty(t, changes, "folder should be kept when it contains hidden files")
	})

	t.Run("keep folder with invalid hidden paths", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "folder/.invalid/path.json", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "folder/", Resource: "folders"},
			},
		}
		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Empty(t, changes, "folder should be kept when it contains invalid hidden paths")
	})

	t.Run("keep folder with hidden folders", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "folder/.hidden/valid.json", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "folder/", Resource: "folders"},
			},
		}
		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Empty(t, changes, "folder should be kept when it contains hidden folders")
	})

	t.Run("unhidden path from hidden file", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "folder/.hidden/dashboard.json", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "folder/", Resource: "folders"},
			},
		}
		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Empty(t, changes, "hidden file should not be unhidden")
	})
	t.Run("hidden path to file", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "one/two/.hidden/dashboard.json", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{}
		expected := []ResourceFileChange{
			{
				Action: repository.FileActionCreated,
				Path:   "one/two/",
			},
		}
		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Equal(t, expected, changes)
	})
	t.Run("hidden path to folder", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "one/two/.hidden/folder/", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{}
		expected := []ResourceFileChange{
			{
				Action: repository.FileActionCreated,
				Path:   "one/two/",
			},
		}
		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Equal(t, expected, changes)
	})
	t.Run("hidden at the root", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: ".hidden/dashboard.json", Hash: "xyz", Blob: true},
		}

		target := &provisioning.ResourceList{}
		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Empty(t, changes)
	})
}
