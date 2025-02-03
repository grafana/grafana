package folderimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/stretchr/testify/require"
)

func TestComputeFullPath(t *testing.T) {
	testCases := []struct {
		name         string
		parents      []*folder.Folder
		wantPath     string
		wantPathUIDs string
	}{
		{
			name:         "empty slice should return empty paths",
			parents:      []*folder.Folder{},
			wantPath:     "",
			wantPathUIDs: "",
		},
		{
			name: "single element should return single path",
			parents: []*folder.Folder{
				{
					Title: "Element",
					UID:   "Element-uid",
				},
			},
			wantPath:     "Element",
			wantPathUIDs: "Element-uid",
		},
		{
			name: "multiple parents should return hierarchical path",
			parents: []*folder.Folder{
				{
					Title: "Grandparent",
					UID:   "grandparent-uid",
				},
				{
					Title: "Parent",
					UID:   "parent-uid",
				},
				{
					Title: "Element",
					UID:   "Element-uid",
				},
			},
			wantPath:     "Grandparent/Parent/Element",
			wantPathUIDs: "grandparent-uid/parent-uid/Element-uid",
		},
		{
			name: "should handle special characters in titles",
			parents: []*folder.Folder{
				{
					Title: "Parent/With/Slashes",
					UID:   "parent-uid",
				},
				{
					Title: "Element With Spaces",
					UID:   "Element-uid",
				},
			},
			wantPath:     "Parent/With/Slashes/Element With Spaces",
			wantPathUIDs: "parent-uid/Element-uid",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			gotPath, gotPathUIDs := computeFullPath(tc.parents)
			require.Equal(t, tc.wantPath, gotPath)
			require.Equal(t, tc.wantPathUIDs, gotPathUIDs)
		})
	}
}
