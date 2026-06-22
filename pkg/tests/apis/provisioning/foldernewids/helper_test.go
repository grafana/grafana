package foldernewids

import (
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// Local-only env (no git server / Docker required). The provisioningFolderMetadata
// and provisioningExport flags are enabled by default, which is required for the
// GenerateNewFolderIDs option to have an observable effect (it only changes the
// UID written into _folder.json).
var env = common.NewSharedEnv()

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	return env.GetCleanHelper(t)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

func createUnmanagedFolder(t *testing.T, helper *common.ProvisioningTestHelper, name, title string) {
	t.Helper()
	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "folder.grafana.app/v1",
			"kind":       "Folder",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": "default",
			},
			"spec": map[string]interface{}{
				"title": title,
			},
		},
	}
	_, err := helper.Folders.Resource.Create(t.Context(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
}

func createUnmanagedFolderWithParent(t *testing.T, helper *common.ProvisioningTestHelper, name, title, parentUID string) {
	t.Helper()
	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "folder.grafana.app/v1",
			"kind":       "Folder",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": "default",
				"annotations": map[string]interface{}{
					"grafana.app/folder": parentUID,
				},
			},
			"spec": map[string]interface{}{
				"title": title,
			},
		},
	}
	_, err := helper.Folders.Resource.Create(t.Context(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
}
