package provisioning

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestUtils(t *testing.T) {
	obj, err := utils.MetaAccessor(&unstructured.Unstructured{})
	require.NoError(t, err)

	name, folder := NamesFromHashedRepoPath("xyz", "path/to/folder/dashboard.json", obj)
	require.Equal(t, "dashboard-B60LqDCLR6FC", name)
	require.Equal(t, "folder-aObw9Q2jRwTI", folder)

	name, folder = NamesFromHashedRepoPath("xyz", "no-folder.json", obj)
	require.Equal(t, "dashboard-B60LqDCLR6FC", name)
	require.Equal(t, "", folder)
}
