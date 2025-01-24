package resources

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIDMapper(t *testing.T) {
	dashName, folderName := NamesFromHashedRepoPath("xyz", "path/to/folder/dashboard.json")
	require.Equal(t, "dashboard-B60LqDCLR6FC", dashName)
	require.Equal(t, "folder-aObw9Q2jRwTI", folderName)

	name1, f1 := NamesFromHashedRepoPath("xyz", "path/to/folder.json")
	name2, f2 := NamesFromHashedRepoPath("xyz", "path/to/folder")
	require.Equal(t, folderName, name1)
	require.Equal(t, folderName, name2)
	require.Equal(t, f1, f2)
}
