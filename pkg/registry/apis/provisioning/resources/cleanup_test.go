package resources

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestEscapePatchString(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"no special characters", "metadata", "metadata"},
		{"tilde is escaped first", "a~b", "a~0b"},
		{"slash is escaped", "grafana.app/managedBy", "grafana.app~1managedBy"},
		{"both tilde and slash", "a~/b", "a~0~1b"},
		{"multiple slashes", "a/b/c", "a~1b~1c"},
		{"empty string", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, EscapePatchString(tt.input))
		})
	}
}

func TestGetReleasePatch(t *testing.T) {
	tests := []struct {
		name        string
		item        *provisioning.ResourceListItem
		expectedOps int
		expectPath  bool
		expectHash  bool
		expectErr   bool
	}{
		{
			name:        "minimal item — only manager annotations removed",
			item:        &provisioning.ResourceListItem{Name: "dash-1"},
			expectedOps: 2,
		},
		{
			name:        "item with path — source path annotation also removed",
			item:        &provisioning.ResourceListItem{Name: "dash-1", Path: "dashboards/dash-1.json"},
			expectedOps: 3,
			expectPath:  true,
		},
		{
			name:        "item with hash — source checksum annotation also removed",
			item:        &provisioning.ResourceListItem{Name: "dash-1", Hash: "abc123"},
			expectedOps: 3,
			expectHash:  true,
		},
		{
			name:        "item with both path and hash",
			item:        &provisioning.ResourceListItem{Name: "dash-1", Path: "d.json", Hash: "abc"},
			expectedOps: 4,
			expectPath:  true,
			expectHash:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := GetReleasePatch(tt.item)
			if tt.expectErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			var ops []JSONPatchOperation
			require.NoError(t, json.Unmarshal(data, &ops))
			assert.Len(t, ops, tt.expectedOps)

			for _, op := range ops {
				assert.Equal(t, "remove", op.Op, "all operations should be 'remove'")
			}

			paths := make(map[string]bool)
			for _, op := range ops {
				paths[op.Path] = true
			}

			assert.True(t, paths["/metadata/annotations/"+EscapePatchString("grafana.app/managedBy")],
				"should remove managedBy annotation")
			assert.True(t, paths["/metadata/annotations/"+EscapePatchString("grafana.app/managerId")],
				"should remove managerId annotation")

			if tt.expectPath {
				assert.True(t, paths["/metadata/annotations/"+EscapePatchString("grafana.app/sourcePath")])
			}
			if tt.expectHash {
				assert.True(t, paths["/metadata/annotations/"+EscapePatchString("grafana.app/sourceChecksum")])
			}
		})
	}
}

func TestSortResourceListForRelease(t *testing.T) {
	testCases := []struct {
		name     string
		input    provisioning.ResourceList
		expected provisioning.ResourceList
	}{
		{
			name: "Top-down by depth, folders before resources at same depth",
			input: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "dashboard.grafana.app", Path: "dashboard1.json"},
					{Group: "folder.grafana.app", Path: "folder1"},
					{Group: "folder.grafana.app", Path: "folder1/subfolder1/subfolder2", Folder: "subfolder1"},
					{Group: "dashboard.grafana.app", Path: "folder1/dashboard2.json"},
					{Group: "folder.grafana.app", Path: "folder2"},
					{Group: "folder.grafana.app", Path: "folder1/subfolder1", Folder: "folder1"},
				},
			},
			expected: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "folder.grafana.app", Path: "folder1"},
					{Group: "folder.grafana.app", Path: "folder2"},
					{Group: "dashboard.grafana.app", Path: "dashboard1.json"},
					{Group: "folder.grafana.app", Path: "folder1/subfolder1", Folder: "folder1"},
					{Group: "dashboard.grafana.app", Path: "folder1/dashboard2.json"},
					{Group: "folder.grafana.app", Path: "folder1/subfolder1/subfolder2", Folder: "subfolder1"},
				},
			},
		},
		{
			name: "Root folders come before nested folders",
			input: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "folder.grafana.app", Path: "folder2/subfolder1", Folder: "folder2"},
					{Group: "folder.grafana.app", Path: "folder1"},
					{Group: "folder.grafana.app", Path: "folder2", Folder: "folder1"},
					{Group: "folder.grafana.app", Path: "folder3", Folder: "folder1"},
				},
			},
			expected: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "folder.grafana.app", Path: "folder1"},
					{Group: "folder.grafana.app", Path: "folder2", Folder: "folder1"},
					{Group: "folder.grafana.app", Path: "folder3", Folder: "folder1"},
					{Group: "folder.grafana.app", Path: "folder2/subfolder1", Folder: "folder2"},
				},
			},
		},
		{
			name: "Only non-folder items preserves relative order",
			input: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "dashboard.grafana.app", Path: "b.json"},
					{Group: "dashboard.grafana.app", Path: "a.json"},
				},
			},
			expected: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "dashboard.grafana.app", Path: "b.json"},
					{Group: "dashboard.grafana.app", Path: "a.json"},
				},
			},
		},
		{
			name:     "Empty list",
			input:    provisioning.ResourceList{Items: []provisioning.ResourceListItem{}},
			expected: provisioning.ResourceList{Items: []provisioning.ResourceListItem{}},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			SortResourceListForRelease(&tc.input)
			assert.Equal(t, tc.expected, tc.input)
		})
	}
}

func TestSortResourceListForDeletion(t *testing.T) {
	testCases := []struct {
		name     string
		input    provisioning.ResourceList
		expected provisioning.ResourceList
	}{
		{
			name: "Non-folder items first, folders sorted by depth",
			input: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "dashboard.grafana.app", Path: "dashboard1.json"},
					{Group: "folder.grafana.app", Path: "folder1"},
					{Group: "folder.grafana.app", Path: "folder1/subfolder1/subfolder2", Folder: "subfolder1"},
					{Group: "dashboard.grafana.app", Path: "dashboard2.json"},
					{Group: "folder.grafana.app", Path: "folder2"},
					{Group: "folder.grafana.app", Path: "folder1/subfolder1", Folder: "folder1"},
				},
			},
			expected: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "dashboard.grafana.app", Path: "dashboard1.json"},
					{Group: "dashboard.grafana.app", Path: "dashboard2.json"},
					{Group: "folder.grafana.app", Path: "folder1/subfolder1/subfolder2", Folder: "subfolder1"},
					{Group: "folder.grafana.app", Path: "folder1/subfolder1", Folder: "folder1"},
					{Group: "folder.grafana.app", Path: "folder1"},
					{Group: "folder.grafana.app", Path: "folder2"},
				},
			},
		},
		{
			name: "Folders without parent should be last",
			input: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "folder.grafana.app", Path: "folder1"},
					{Group: "folder.grafana.app", Path: "folder2", Folder: "folder1"},
					{Group: "folder.grafana.app", Path: "folder2/subfolder1", Folder: "folder2"},
					{Group: "folder.grafana.app", Path: "folder3", Folder: "folder1"},
				},
			},
			expected: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "folder.grafana.app", Path: "folder2/subfolder1", Folder: "folder2"},
					{Group: "folder.grafana.app", Path: "folder2", Folder: "folder1"},
					{Group: "folder.grafana.app", Path: "folder3", Folder: "folder1"},
					{Group: "folder.grafana.app", Path: "folder1"},
				},
			},
		},
		{
			name: "Empty list",
			input: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{},
			},
			expected: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{},
			},
		},
		{
			name: "Single item unchanged",
			input: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "dashboard.grafana.app", Path: "d.json"},
				},
			},
			expected: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "dashboard.grafana.app", Path: "d.json"},
				},
			},
		},
		{
			name: "Only non-folder items remain in original order",
			input: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "dashboard.grafana.app", Path: "b.json"},
					{Group: "alerting.grafana.app", Path: "alert1.json"},
					{Group: "dashboard.grafana.app", Path: "a.json"},
				},
			},
			expected: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "dashboard.grafana.app", Path: "b.json"},
					{Group: "alerting.grafana.app", Path: "alert1.json"},
					{Group: "dashboard.grafana.app", Path: "a.json"},
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			SortResourceListForDeletion(&tc.input)
			assert.Equal(t, tc.expected, tc.input)
		})
	}
}

func TestSplitItems(t *testing.T) {
	items := &provisioning.ResourceList{
		Items: []provisioning.ResourceListItem{
			{Name: "dash-1", Group: "dashboard.grafana.app", Resource: "dashboards"},
			{Name: "folder-1", Group: "folder.grafana.app", Resource: "folders"},
			{Name: "dash-2", Group: "dashboard.grafana.app", Resource: "dashboards"},
			{Name: "folder-2", Group: "folder.grafana.app", Resource: "folders"},
			{Name: "alert-1", Group: "alerting.grafana.app", Resource: "rules"},
		},
	}

	folderItems, resourceItems := SplitItems(items)

	require.Len(t, folderItems, 2)
	assert.Equal(t, "folder-1", folderItems[0].Name)
	assert.Equal(t, "folder-2", folderItems[1].Name)

	require.Len(t, resourceItems, 3)
	assert.Equal(t, "dash-1", resourceItems[0].Name)
	assert.Equal(t, "dash-2", resourceItems[1].Name)
	assert.Equal(t, "alert-1", resourceItems[2].Name)
}

func TestSplitItems_Empty(t *testing.T) {
	items := &provisioning.ResourceList{}
	folderItems, resourceItems := SplitItems(items)
	assert.Empty(t, folderItems)
	assert.Empty(t, resourceItems)
}

func TestSplitItems_AllFolders(t *testing.T) {
	items := &provisioning.ResourceList{
		Items: []provisioning.ResourceListItem{
			{Name: "folder-1", Group: "folder.grafana.app", Resource: "folders"},
			{Name: "folder-2", Group: "folder.grafana.app", Resource: "folders"},
		},
	}
	folderItems, resourceItems := SplitItems(items)
	require.Len(t, folderItems, 2)
	assert.Empty(t, resourceItems)
}

func TestSplitItems_NoFolders(t *testing.T) {
	items := &provisioning.ResourceList{
		Items: []provisioning.ResourceListItem{
			{Name: "dash-1", Group: "dashboard.grafana.app", Resource: "dashboards"},
		},
	}
	folderItems, resourceItems := SplitItems(items)
	assert.Empty(t, folderItems)
	require.Len(t, resourceItems, 1)
}
