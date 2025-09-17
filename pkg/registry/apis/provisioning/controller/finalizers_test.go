package controller

import (
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/stretchr/testify/assert"
)

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
					{Group: "folder.grafana.app", Path: "folder2", Folder: "folder1"}, // if a repo is created with a folder in grafana (here folder1), the path will not have /, but the folder will be set
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
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			sortResourceListForDeletion(&tc.input)
			assert.Equal(t, tc.expected, tc.input)
		})
	}
}
