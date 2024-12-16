package resources

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestIDMapper(t *testing.T) {
	obj := &unstructured.Unstructured{}

	dashName, folderName := NamesFromHashedRepoPath("xyz", "path/to/folder/dashboard.json", obj)
	require.Equal(t, "dashboard-B60LqDCLR6FC", dashName)
	require.Equal(t, "folder-aObw9Q2jRwTI", folderName)

	name1, f1 := NamesFromHashedRepoPath("xyz", "path/to/folder.json", obj)
	name2, f2 := NamesFromHashedRepoPath("xyz", "path/to/folder", obj)
	require.Equal(t, folderName, name1)
	require.Equal(t, folderName, name2)
	require.Equal(t, f1, f2)
}
