package sync

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCanUseIncrementalSync(t *testing.T) {
	tests := []struct {
		name                  string
		deletedPaths          []string
		folderMetadataEnabled bool
		want                  bool
	}{
		{
			name:         "no deleted paths",
			deletedPaths: []string{},
			want:         true,
		},
		{
			name:         "no keep file deletions",
			deletedPaths: []string{"test.json"},
			want:         true,
		},
		{
			name:         "keep file deletion at root without other deletions",
			deletedPaths: []string{".keep"},
			want:         false,
		},
		{
			name:         "keep file deletion with other deletions in same folder",
			deletedPaths: []string{"test/.keep", "test/test.json"},
			want:         true,
		},
		{
			name:         "multiple keep files in different folders without other deletions",
			deletedPaths: []string{"folder1/.keep", "folder2/.keep"},
			want:         false,
		},
		{
			name:         "nested folder with only keep file deleted",
			deletedPaths: []string{"parent/child/.keep"},
			want:         false,
		},
		{
			name:         "some folders with only keep, some with other files",
			deletedPaths: []string{"folder1/.keep", "folder2/.keep", "folder2/dashboard.json"},
			want:         false,
		},
		{
			name:         "only regular files deleted from multiple folders",
			deletedPaths: []string{"folder1/file1.json", "folder2/file2.json", "folder3/file3.json"},
			want:         true,
		},
		{
			name:                  "folder metadata file deleted alone - flag on",
			deletedPaths:          []string{"folder1/_folder.json"},
			folderMetadataEnabled: true,
			want:                  false,
		},
		{
			name:                  "folder metadata file deleted alone - flag off",
			deletedPaths:          []string{"folder1/_folder.json"},
			folderMetadataEnabled: false,
			want:                  true,
		},
		{
			name:                  "folder metadata file deleted with other files in same folder - flag on",
			deletedPaths:          []string{"folder1/_folder.json", "folder1/dashboard.json"},
			folderMetadataEnabled: true,
			want:                  true,
		},
		{
			name:                  "folder metadata and keep file deleted together without other files - flag on",
			deletedPaths:          []string{"folder1/.keep", "folder1/_folder.json"},
			folderMetadataEnabled: true,
			want:                  false,
		},
		{
			name:                  "folder metadata at root deleted alone - flag on",
			deletedPaths:          []string{"_folder.json"},
			folderMetadataEnabled: true,
			want:                  false,
		},
		{
			name:                  "nested folder metadata deleted alone - flag on",
			deletedPaths:          []string{"parent/child/_folder.json"},
			folderMetadataEnabled: true,
			want:                  false,
		},
		{
			name:                  "mixed: folder metadata alone in one dir, other files in another - flag on",
			deletedPaths:          []string{"folder1/_folder.json", "folder2/dashboard.json"},
			folderMetadataEnabled: true,
			want:                  false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CanUseIncrementalSync(tt.deletedPaths, tt.folderMetadataEnabled)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestNewCanUseIncrementalSyncFn(t *testing.T) {
	t.Run("flag off ignores _folder.json", func(t *testing.T) {
		fn := NewCanUseIncrementalSyncFn(false)
		require.True(t, fn([]string{"folder1/_folder.json"}))
	})

	t.Run("flag on treats _folder.json as metadata", func(t *testing.T) {
		fn := NewCanUseIncrementalSyncFn(true)
		require.False(t, fn([]string{"folder1/_folder.json"}))
	})

	t.Run("flag on allows incremental when other files present", func(t *testing.T) {
		fn := NewCanUseIncrementalSyncFn(true)
		require.True(t, fn([]string{"folder1/_folder.json", "folder1/dashboard.json"}))
	})
}
