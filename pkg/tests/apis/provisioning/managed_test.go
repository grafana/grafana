package provisioning

import (
	"context"
	"testing"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestIntegrationFolderManagerConsistency(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const repoName = "folder-manager-repo"
	helper := common.RunGrafana(t)

	helper.CreateRepo(t, common.TestRepo{
		Name:            repoName,
		Target:          "folder",
		ExpectedFolders: 1,
	})

	ctx := t.Context()

	// Find the managed folder created by the repo sync.
	var managedFolderName string
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		folders, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(collect, err)
		for i := range folders.Items {
			annotations := folders.Items[i].GetAnnotations()
			if annotations[utils.AnnoKeyManagerIdentity] == repoName {
				managedFolderName = folders.Items[i].GetName()
				return
			}
		}
		assert.Fail(collect, "managed folder not found")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "should find a folder managed by the repo")

	require.NotEmpty(t, managedFolderName, "managed folder name should be set")
	t.Logf("Managed folder: %s (managed by repo %s)", managedFolderName, repoName)

	t.Run("reject unmanaged dashboard in managed folder", func(t *testing.T) {
		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "dashboard.grafana.app/v1beta1",
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"generateName": "unmanaged-in-managed-",
					"annotations": map[string]interface{}{
						"grafana.app/folder": managedFolderName,
					},
				},
				"spec": map[string]interface{}{
					"title":         "Unmanaged Dashboard in Managed Folder",
					"schemaVersion": 41,
				},
			},
		}

		_, err := helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.Error(t, err, "should reject unmanaged dashboard in a managed folder")
		require.True(t, apierrors.IsForbidden(err), "error should be Forbidden, got: %v", err)
		require.Contains(t, err.Error(), "folder is managed by repo:"+repoName)
		require.Contains(t, err.Error(), "resource is not managed")
	})

	t.Run("reject dashboard managed by different repo in managed folder", func(t *testing.T) {
		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "dashboard.grafana.app/v1beta1",
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"generateName": "wrong-manager-",
					"annotations": map[string]interface{}{
						"grafana.app/folder":         managedFolderName,
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindKubectl),
						utils.AnnoKeyManagerIdentity: "some-other-manager",
					},
				},
				"spec": map[string]interface{}{
					"title":         "Dashboard Managed by Different Manager",
					"schemaVersion": 41,
				},
			},
		}

		_, err := helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.Error(t, err, "should reject dashboard managed by a different manager")
		require.True(t, apierrors.IsForbidden(err), "error should be Forbidden, got: %v", err)
		require.Contains(t, err.Error(), "resource manager (kubectl:some-other-manager) does not match folder manager (repo:"+repoName+")")
	})

	t.Run("allow managed dashboard in unmanaged folder", func(t *testing.T) {
		unmanagedFolder := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "unmanaged-folder-",
				},
				"spec": map[string]interface{}{
					"title": "Unmanaged Folder",
				},
			},
		}
		createdFolder, err := helper.Folders.Resource.Create(ctx, unmanagedFolder, metav1.CreateOptions{})
		require.NoError(t, err, "should create unmanaged folder")
		unmanagedFolderName := createdFolder.GetName()

		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "dashboard.grafana.app/v1beta1",
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"generateName": "managed-in-unmanaged-",
					"annotations": map[string]interface{}{
						"grafana.app/folder":         unmanagedFolderName,
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindKubectl),
						utils.AnnoKeyManagerIdentity: "my-kubectl",
					},
				},
				"spec": map[string]interface{}{
					"title":         "Kubectl-Managed Dashboard in Unmanaged Folder",
					"schemaVersion": 41,
				},
			},
		}

		created, err := helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err, "should allow managed dashboard in unmanaged folder")
		require.NotNil(t, created)
	})

	t.Run("allow unmanaged dashboard in unmanaged folder", func(t *testing.T) {
		unmanagedFolder := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "plain-folder-",
				},
				"spec": map[string]interface{}{
					"title": "Plain Folder",
				},
			},
		}
		createdFolder, err := helper.Folders.Resource.Create(ctx, unmanagedFolder, metav1.CreateOptions{})
		require.NoError(t, err, "should create plain folder")

		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "dashboard.grafana.app/v1beta1",
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"generateName": "plain-dash-",
					"annotations": map[string]interface{}{
						"grafana.app/folder": createdFolder.GetName(),
					},
				},
				"spec": map[string]interface{}{
					"title":         "Plain Dashboard",
					"schemaVersion": 41,
				},
			},
		}

		created, err := helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err, "should allow unmanaged dashboard in unmanaged folder")
		require.NotNil(t, created)
	})

	// --- Folder-in-folder (nested folder) cases ---

	t.Run("reject unmanaged sub-folder in managed folder", func(t *testing.T) {
		folder := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "unmanaged-subfolder-",
					"annotations": map[string]interface{}{
						"grafana.app/folder": managedFolderName,
					},
				},
				"spec": map[string]interface{}{
					"title": "Unmanaged Sub-Folder in Managed Folder",
				},
			},
		}

		_, err := helper.Folders.Resource.Create(ctx, folder, metav1.CreateOptions{})
		require.Error(t, err, "should reject unmanaged sub-folder in a managed folder")
		require.True(t, apierrors.IsForbidden(err), "error should be Forbidden, got: %v", err)
		require.Contains(t, err.Error(), "folder is managed by repo:"+repoName)
		require.Contains(t, err.Error(), "resource is not managed")
	})

	t.Run("reject sub-folder managed by different manager in managed folder", func(t *testing.T) {
		folder := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "wrong-mgr-subfolder-",
					"annotations": map[string]interface{}{
						"grafana.app/folder":         managedFolderName,
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindKubectl),
						utils.AnnoKeyManagerIdentity: "some-other-manager",
					},
				},
				"spec": map[string]interface{}{
					"title": "Sub-Folder Managed by Different Manager",
				},
			},
		}

		_, err := helper.Folders.Resource.Create(ctx, folder, metav1.CreateOptions{})
		require.Error(t, err, "should reject sub-folder managed by a different manager")
		require.True(t, apierrors.IsForbidden(err), "error should be Forbidden, got: %v", err)
		require.Contains(t, err.Error(), "resource manager (kubectl:some-other-manager) does not match folder manager (repo:"+repoName+")")
	})

	t.Run("allow managed sub-folder in unmanaged folder", func(t *testing.T) {
		parent := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "unmanaged-parent-",
				},
				"spec": map[string]interface{}{
					"title": "Unmanaged Parent Folder",
				},
			},
		}
		createdParent, err := helper.Folders.Resource.Create(ctx, parent, metav1.CreateOptions{})
		require.NoError(t, err, "should create unmanaged parent folder")

		child := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "managed-child-",
					"annotations": map[string]interface{}{
						"grafana.app/folder":         createdParent.GetName(),
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindKubectl),
						utils.AnnoKeyManagerIdentity: "my-kubectl",
					},
				},
				"spec": map[string]interface{}{
					"title": "Managed Child Folder in Unmanaged Parent",
				},
			},
		}

		created, err := helper.Folders.Resource.Create(ctx, child, metav1.CreateOptions{})
		require.NoError(t, err, "should allow managed sub-folder in unmanaged folder")
		require.NotNil(t, created)
	})

	t.Run("allow unmanaged sub-folder in unmanaged folder", func(t *testing.T) {
		parent := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "plain-parent-",
				},
				"spec": map[string]interface{}{
					"title": "Plain Parent Folder",
				},
			},
		}
		createdParent, err := helper.Folders.Resource.Create(ctx, parent, metav1.CreateOptions{})
		require.NoError(t, err, "should create plain parent folder")

		child := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "plain-child-",
					"annotations": map[string]interface{}{
						"grafana.app/folder": createdParent.GetName(),
					},
				},
				"spec": map[string]interface{}{
					"title": "Plain Child Folder",
				},
			},
		}

		created, err := helper.Folders.Resource.Create(ctx, child, metav1.CreateOptions{})
		require.NoError(t, err, "should allow unmanaged sub-folder in unmanaged folder")
		require.NotNil(t, created)
	})
}

func TestIntegrationProvisioning_BlockManagerChange(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t)
	ctx := context.Background()

	const repo = "managed-change-test"
	helper.CreateRepo(t, common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"testdata/all-panels.json": "all-panels.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    1,
	})

	const dashboardUID = "n1jR8vnnz"
	var dashboard *unstructured.Unstructured
	var err error

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		dashboard, err = helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		if err != nil {
			collect.Errorf("dashboard not found yet: %s", err.Error())
			return
		}
		annotations := dashboard.GetAnnotations()
		assert.Equal(collect, string(utils.ManagerKindRepo), annotations[utils.AnnoKeyManagerKind])
		assert.Equal(collect, repo, annotations[utils.AnnoKeyManagerIdentity])
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "dashboard should be provisioned with repo manager")

	t.Run("changing manager from repo to kubectl is blocked", func(t *testing.T) {
		fresh, err := helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		require.NoError(t, err)

		annotations := fresh.GetAnnotations()
		annotations[utils.AnnoKeyManagerKind] = string(utils.ManagerKindKubectl)
		annotations[utils.AnnoKeyManagerIdentity] = "some-kubectl-manager"
		fresh.SetAnnotations(annotations)

		_, err = helper.DashboardsV1.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.Error(t, err, "should not be able to change manager from repo to kubectl")
		require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got: %v", err)

		unchanged, err := helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, string(utils.ManagerKindRepo), unchanged.GetAnnotations()[utils.AnnoKeyManagerKind])
		require.Equal(t, repo, unchanged.GetAnnotations()[utils.AnnoKeyManagerIdentity])
	})

	t.Run("changing manager from repo to terraform is blocked", func(t *testing.T) {
		fresh, err := helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		require.NoError(t, err)

		annotations := fresh.GetAnnotations()
		annotations[utils.AnnoKeyManagerKind] = string(utils.ManagerKindTerraform)
		annotations[utils.AnnoKeyManagerIdentity] = "some-terraform-manager"
		fresh.SetAnnotations(annotations)

		_, err = helper.DashboardsV1.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.Error(t, err, "should not be able to change manager from repo to terraform")
		require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got: %v", err)

		unchanged, err := helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, string(utils.ManagerKindRepo), unchanged.GetAnnotations()[utils.AnnoKeyManagerKind])
		require.Equal(t, repo, unchanged.GetAnnotations()[utils.AnnoKeyManagerIdentity])
	})
}
