package provisioning

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/tests/apis"
)

func TestIntegrationFolderManagerConsistency(t *testing.T) {
	const repoName = "folder-manager-repo"
	dashboardAPIVersion := dashboardV1.DashboardResourceInfo.GroupVersion().String()
	helper := sharedHelper(t)

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:            repoName,
		SyncTarget:      "folder",
		ExpectedFolders: 1,
	})

	ctx := t.Context()

	// Find the managed folder created by the repo sync.
	var managedFolderName string
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		folders, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(collect, err) {
			return
		}
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
				"apiVersion": dashboardAPIVersion,
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
				"apiVersion": dashboardAPIVersion,
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
				"apiVersion": dashboardAPIVersion,
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
				"apiVersion": dashboardAPIVersion,
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

	// --- Move (update) cases ---

	t.Run("reject moving unmanaged dashboard to managed folder", func(t *testing.T) {
		unmanagedFolder := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "src-folder-",
				},
				"spec": map[string]interface{}{
					"title": "Source Unmanaged Folder",
				},
			},
		}
		createdFolder, err := helper.Folders.Resource.Create(ctx, unmanagedFolder, metav1.CreateOptions{})
		require.NoError(t, err)

		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": dashboardAPIVersion,
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"generateName": "move-to-managed-",
					"annotations": map[string]interface{}{
						"grafana.app/folder": createdFolder.GetName(),
					},
				},
				"spec": map[string]interface{}{
					"title":         "Dashboard to Move to Managed Folder",
					"schemaVersion": 41,
				},
			},
		}
		created, err := helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err)

		fresh, err := helper.DashboardsV1.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)

		annotations := fresh.GetAnnotations()
		annotations["grafana.app/folder"] = managedFolderName
		fresh.SetAnnotations(annotations)

		_, err = helper.DashboardsV1.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.Error(t, err, "should reject moving unmanaged dashboard to managed folder")
		require.True(t, apierrors.IsForbidden(err), "error should be Forbidden, got: %v", err)
		require.Contains(t, err.Error(), "folder is managed by repo:"+repoName)
		require.Contains(t, err.Error(), "resource is not managed")
	})

	t.Run("allow moving dashboard to unmanaged folder", func(t *testing.T) {
		folderA := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "folder-a-",
				},
				"spec": map[string]interface{}{
					"title": "Folder A",
				},
			},
		}
		createdA, err := helper.Folders.Resource.Create(ctx, folderA, metav1.CreateOptions{})
		require.NoError(t, err)

		folderB := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "folder-b-",
				},
				"spec": map[string]interface{}{
					"title": "Folder B",
				},
			},
		}
		createdB, err := helper.Folders.Resource.Create(ctx, folderB, metav1.CreateOptions{})
		require.NoError(t, err)

		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": dashboardAPIVersion,
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"generateName": "movable-dash-",
					"annotations": map[string]interface{}{
						"grafana.app/folder": createdA.GetName(),
					},
				},
				"spec": map[string]interface{}{
					"title":         "Dashboard to Move Between Unmanaged Folders",
					"schemaVersion": 41,
				},
			},
		}
		created, err := helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err)

		fresh, err := helper.DashboardsV1.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)

		annotations := fresh.GetAnnotations()
		annotations["grafana.app/folder"] = createdB.GetName()
		fresh.SetAnnotations(annotations)

		updated, err := helper.DashboardsV1.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.NoError(t, err, "should allow moving dashboard to unmanaged folder")
		require.Equal(t, createdB.GetName(), updated.GetAnnotations()["grafana.app/folder"])
	})

	// --- Manager change in same folder cases ---
	// These exercise the code path in prepareObjectForUpdate that re-validates
	// folder-manager consistency when manager annotations change without a folder move.

	t.Run("allow removing manager from dashboard in unmanaged folder", func(t *testing.T) {
		unmanagedFolder := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "mgr-change-folder-",
				},
				"spec": map[string]interface{}{
					"title": "Folder for Manager Change Test",
				},
			},
		}
		createdFolder, err := helper.Folders.Resource.Create(ctx, unmanagedFolder, metav1.CreateOptions{})
		require.NoError(t, err)

		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": dashboardAPIVersion,
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"generateName": "kubectl-dash-",
					"annotations": map[string]interface{}{
						"grafana.app/folder":         createdFolder.GetName(),
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindKubectl),
						utils.AnnoKeyManagerIdentity: "my-kubectl",
					},
				},
				"spec": map[string]interface{}{
					"title":         "Kubectl Dashboard for Manager Removal",
					"schemaVersion": 41,
				},
			},
		}
		created, err := helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err)

		fresh, err := helper.DashboardsV1.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)

		annotations := fresh.GetAnnotations()
		delete(annotations, utils.AnnoKeyManagerKind)
		delete(annotations, utils.AnnoKeyManagerIdentity)
		fresh.SetAnnotations(annotations)

		updated, err := helper.DashboardsV1.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.NoError(t, err, "removing manager in unmanaged folder should be allowed")
		require.Empty(t, updated.GetAnnotations()[utils.AnnoKeyManagerKind])
	})

	t.Run("allow changing manager identity on dashboard in unmanaged folder", func(t *testing.T) {
		unmanagedFolder := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "mgr-id-change-folder-",
				},
				"spec": map[string]interface{}{
					"title": "Folder for Manager Identity Change Test",
				},
			},
		}
		createdFolder, err := helper.Folders.Resource.Create(ctx, unmanagedFolder, metav1.CreateOptions{})
		require.NoError(t, err)

		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": dashboardAPIVersion,
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"generateName": "tf-dash-",
					"annotations": map[string]interface{}{
						"grafana.app/folder":         createdFolder.GetName(),
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindTerraform),
						utils.AnnoKeyManagerIdentity: "tf-workspace-1",
					},
				},
				"spec": map[string]interface{}{
					"title":         "Terraform Dashboard for Identity Change",
					"schemaVersion": 41,
				},
			},
		}
		created, err := helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err)

		fresh, err := helper.DashboardsV1.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)

		// Remove manager first (required — cannot change manager directly)
		annotations := fresh.GetAnnotations()
		delete(annotations, utils.AnnoKeyManagerKind)
		delete(annotations, utils.AnnoKeyManagerIdentity)
		fresh.SetAnnotations(annotations)

		updated, err := helper.DashboardsV1.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.NoError(t, err, "removing terraform manager in unmanaged folder should be allowed")

		// Now re-add with different identity
		fresh2, err := helper.DashboardsV1.Resource.Get(ctx, updated.GetName(), metav1.GetOptions{})
		require.NoError(t, err)

		annotations2 := fresh2.GetAnnotations()
		annotations2[utils.AnnoKeyManagerKind] = string(utils.ManagerKindTerraform)
		annotations2[utils.AnnoKeyManagerIdentity] = "tf-workspace-2"
		fresh2.SetAnnotations(annotations2)

		updated2, err := helper.DashboardsV1.Resource.Update(ctx, fresh2, metav1.UpdateOptions{})
		require.NoError(t, err, "adding new terraform manager in unmanaged folder should be allowed")
		require.Equal(t, "tf-workspace-2", updated2.GetAnnotations()[utils.AnnoKeyManagerIdentity])
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
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "managed-change-test"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
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

	t.Run("removing manager from repo-managed dashboard is blocked", func(t *testing.T) {
		fresh, err := helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		require.NoError(t, err)

		annotations := fresh.GetAnnotations()
		delete(annotations, utils.AnnoKeyManagerKind)
		delete(annotations, utils.AnnoKeyManagerIdentity)
		fresh.SetAnnotations(annotations)

		_, err = helper.DashboardsV1.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.Error(t, err, "should not be able to remove manager from repo-managed dashboard")
		require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got: %v", err)

		unchanged, err := helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, string(utils.ManagerKindRepo), unchanged.GetAnnotations()[utils.AnnoKeyManagerKind])
		require.Equal(t, repo, unchanged.GetAnnotations()[utils.AnnoKeyManagerIdentity])
	})
}

func TestIntegrationProvisioning_AdminCanReleaseManagedResource(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "admin-release-test"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies: map[string]string{
			"testdata/all-panels.json": "all-panels.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    1,
	})

	const dashboardUID = "n1jR8vnnz"

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		dashboard, err := helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		if err != nil {
			collect.Errorf("dashboard not found yet: %s", err.Error())
			return
		}
		annotations := dashboard.GetAnnotations()
		assert.Equal(collect, string(utils.ManagerKindRepo), annotations[utils.AnnoKeyManagerKind])
		assert.Equal(collect, repo, annotations[utils.AnnoKeyManagerIdentity])
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "dashboard should be provisioned with repo manager")

	t.Run("editor cannot release repo-managed dashboard", func(t *testing.T) {
		editorDashboards := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Editor,
			Namespace: "default",
			GVR:       dashboardV1.DashboardResourceInfo.GroupVersionResource(),
		})

		fresh, err := editorDashboards.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		require.NoError(t, err)

		annotations := fresh.GetAnnotations()
		delete(annotations, utils.AnnoKeyManagerKind)
		delete(annotations, utils.AnnoKeyManagerIdentity)
		delete(annotations, utils.AnnoKeySourcePath)
		delete(annotations, utils.AnnoKeySourceChecksum)
		fresh.SetAnnotations(annotations)

		_, err = editorDashboards.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.Error(t, err, "editor should not be able to release managed dashboard")
		require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got: %v", err)
	})

	t.Run("admin can release repo-managed dashboard via update", func(t *testing.T) {
		// Release top-down: the folder must be released before the dashboard,
		// otherwise the folder-manager consistency check rejects an unmanaged
		// resource inside a managed folder.
		folder, err := helper.Folders.Resource.Get(ctx, repo, metav1.GetOptions{})
		require.NoError(t, err)

		fa := folder.GetAnnotations()
		delete(fa, utils.AnnoKeyManagerKind)
		delete(fa, utils.AnnoKeyManagerIdentity)
		delete(fa, utils.AnnoKeySourcePath)
		delete(fa, utils.AnnoKeySourceChecksum)
		folder.SetAnnotations(fa)

		_, err = helper.Folders.Resource.Update(ctx, folder, metav1.UpdateOptions{})
		require.NoError(t, err, "admin should be able to release the folder first")

		fresh, err := helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		require.NoError(t, err)

		annotations := fresh.GetAnnotations()
		delete(annotations, utils.AnnoKeyManagerKind)
		delete(annotations, utils.AnnoKeyManagerIdentity)
		delete(annotations, utils.AnnoKeySourcePath)
		delete(annotations, utils.AnnoKeySourceChecksum)
		fresh.SetAnnotations(annotations)

		updated, err := helper.DashboardsV1.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.NoError(t, err, "admin should be able to release managed dashboard")

		releasedAnnotations := updated.GetAnnotations()
		require.NotContains(t, releasedAnnotations, utils.AnnoKeyManagerKind, "managedBy should be removed")
		require.NotContains(t, releasedAnnotations, utils.AnnoKeyManagerIdentity, "managerId should be removed")
	})
}

func TestIntegrationProvisioning_TerraformManagerIDTransitions(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()
	dashboardAPIVersion := dashboardV1.DashboardResourceInfo.GroupVersion().String()

	// Create an unmanaged folder for testing
	unmanagedFolder := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
			"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
			"metadata": map[string]interface{}{
				"generateName": "terraform-test-folder-",
			},
			"spec": map[string]interface{}{
				"title": "Terraform Test Folder",
			},
		},
	}
	createdFolder, err := helper.Folders.Resource.Create(ctx, unmanagedFolder, metav1.CreateOptions{})
	require.NoError(t, err)
	folderName := createdFolder.GetName()

	t.Run("User-Agent to User-Agent allowed (version updates)", func(t *testing.T) {
		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": dashboardAPIVersion,
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"generateName": "tf-ua-to-ua-",
					"annotations": map[string]interface{}{
						"grafana.app/folder":         folderName,
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindTerraform),
						utils.AnnoKeyManagerIdentity: "Terraform/1.5.0 (+https://www.terraform.io) terraform-provider-grafana/v3.0.0",
					},
				},
				"spec": map[string]interface{}{
					"title":         "Terraform Dashboard UA to UA",
					"schemaVersion": 41,
				},
			},
		}
		created, err := helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err)

		fresh, err := helper.DashboardsV1.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)

		annotations := fresh.GetAnnotations()
		annotations[utils.AnnoKeyManagerIdentity] = "Terraform/1.6.0 (+https://www.terraform.io) terraform-provider-grafana/v4.0.0"
		fresh.SetAnnotations(annotations)

		updated, err := helper.DashboardsV1.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.NoError(t, err, "should allow User-Agent to User-Agent transition")
		require.Equal(t, "Terraform/1.6.0 (+https://www.terraform.io) terraform-provider-grafana/v4.0.0",
			updated.GetAnnotations()[utils.AnnoKeyManagerIdentity])
	})

	t.Run("User-Agent to simple ID allowed (migration)", func(t *testing.T) {
		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": dashboardAPIVersion,
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"generateName": "tf-ua-to-simple-",
					"annotations": map[string]interface{}{
						"grafana.app/folder":         folderName,
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindTerraform),
						utils.AnnoKeyManagerIdentity: "Terraform/1.5.0 (+https://www.terraform.io) terraform-provider-grafana/v3.0.0",
					},
				},
				"spec": map[string]interface{}{
					"title":         "Terraform Dashboard UA to Simple",
					"schemaVersion": 41,
				},
			},
		}
		created, err := helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err)

		fresh, err := helper.DashboardsV1.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)

		annotations := fresh.GetAnnotations()
		annotations[utils.AnnoKeyManagerIdentity] = "my-terraform-provider"
		fresh.SetAnnotations(annotations)

		updated, err := helper.DashboardsV1.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.NoError(t, err, "should allow User-Agent to simple ID transition (migration)")
		require.Equal(t, "my-terraform-provider", updated.GetAnnotations()[utils.AnnoKeyManagerIdentity])
	})

	t.Run("simple ID to simple ID blocked (immutable)", func(t *testing.T) {
		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": dashboardAPIVersion,
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"generateName": "tf-simple-to-simple-",
					"annotations": map[string]interface{}{
						"grafana.app/folder":         folderName,
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindTerraform),
						utils.AnnoKeyManagerIdentity: "my-terraform-provider",
					},
				},
				"spec": map[string]interface{}{
					"title":         "Terraform Dashboard Simple to Simple",
					"schemaVersion": 41,
				},
			},
		}
		created, err := helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err)

		fresh, err := helper.DashboardsV1.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)

		annotations := fresh.GetAnnotations()
		annotations[utils.AnnoKeyManagerIdentity] = "my-terraform-provider-v2"
		fresh.SetAnnotations(annotations)

		_, err = helper.DashboardsV1.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.Error(t, err, "should block simple ID to simple ID transition")
		require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got: %v", err)
		require.Contains(t, err.Error(), "Cannot change Terraform manager ID")
		require.Contains(t, err.Error(), "stable custom IDs are immutable")
	})

	t.Run("simple ID to User-Agent blocked (no reverting)", func(t *testing.T) {
		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": dashboardAPIVersion,
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"generateName": "tf-simple-to-ua-",
					"annotations": map[string]interface{}{
						"grafana.app/folder":         folderName,
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindTerraform),
						utils.AnnoKeyManagerIdentity: "my-terraform-provider",
					},
				},
				"spec": map[string]interface{}{
					"title":         "Terraform Dashboard Simple to UA",
					"schemaVersion": 41,
				},
			},
		}
		created, err := helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err)

		fresh, err := helper.DashboardsV1.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)

		annotations := fresh.GetAnnotations()
		annotations[utils.AnnoKeyManagerIdentity] = "Terraform/1.6.0 (+https://www.terraform.io) terraform-provider-grafana/v4.0.0"
		fresh.SetAnnotations(annotations)

		_, err = helper.DashboardsV1.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.Error(t, err, "should block simple ID to User-Agent transition")
		require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got: %v", err)
		require.Contains(t, err.Error(), "Cannot change Terraform manager ID back to User-Agent format")
	})
}

func TestIntegrationProvisioning_AdminCanReleaseManagedResourceViaPatch(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "admin-release-patch-test"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies: map[string]string{
			"testdata/all-panels.json": "all-panels.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    1,
	})

	const dashboardUID = "n1jR8vnnz"

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		dashboard, err := helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		if err != nil {
			collect.Errorf("dashboard not found yet: %s", err.Error())
			return
		}
		annotations := dashboard.GetAnnotations()
		assert.Equal(collect, string(utils.ManagerKindRepo), annotations[utils.AnnoKeyManagerKind])
		assert.Equal(collect, repo, annotations[utils.AnnoKeyManagerIdentity])
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "dashboard should be provisioned with repo manager")

	mergePatch, err := json.Marshal(map[string]interface{}{
		"metadata": map[string]interface{}{
			"annotations": map[string]interface{}{
				utils.AnnoKeyManagerKind:     nil,
				utils.AnnoKeyManagerIdentity: nil,
				utils.AnnoKeySourcePath:      nil,
				utils.AnnoKeySourceChecksum:  nil,
			},
		},
	})
	require.NoError(t, err)

	escapeJSONPointer := func(s string) string {
		s = strings.ReplaceAll(s, "~", "~0")
		s = strings.ReplaceAll(s, "/", "~1")
		return s
	}
	jsonPatch, err := json.Marshal([]map[string]string{
		{"op": "remove", "path": "/metadata/annotations/" + escapeJSONPointer(utils.AnnoKeyManagerKind)},
		{"op": "remove", "path": "/metadata/annotations/" + escapeJSONPointer(utils.AnnoKeyManagerIdentity)},
		{"op": "remove", "path": "/metadata/annotations/" + escapeJSONPointer(utils.AnnoKeySourcePath)},
		{"op": "remove", "path": "/metadata/annotations/" + escapeJSONPointer(utils.AnnoKeySourceChecksum)},
	})
	require.NoError(t, err)

	t.Run("editor cannot release via merge patch", func(t *testing.T) {
		editorDashboards := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Editor,
			Namespace: "default",
			GVR:       dashboardV1.DashboardResourceInfo.GroupVersionResource(),
		})

		_, err := editorDashboards.Resource.Patch(ctx, dashboardUID, types.MergePatchType, mergePatch, metav1.PatchOptions{})
		require.Error(t, err, "editor should not be able to release via merge patch")
		require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got: %v", err)
	})

	t.Run("editor cannot release via JSON patch", func(t *testing.T) {
		editorDashboards := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Editor,
			Namespace: "default",
			GVR:       dashboardV1.DashboardResourceInfo.GroupVersionResource(),
		})

		_, err := editorDashboards.Resource.Patch(ctx, dashboardUID, types.JSONPatchType, jsonPatch, metav1.PatchOptions{})
		require.Error(t, err, "editor should not be able to release via JSON patch")
		require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got: %v", err)
	})

	t.Run("admin can release via merge patch", func(t *testing.T) {
		// Release the folder first (top-down) so the dashboard can become
		// unmanaged without violating folder-manager consistency.
		_, err := helper.Folders.Resource.Patch(ctx, repo, types.MergePatchType, mergePatch, metav1.PatchOptions{})
		require.NoError(t, err, "admin should be able to release the folder first")

		updated, err := helper.DashboardsV1.Resource.Patch(ctx, dashboardUID, types.MergePatchType, mergePatch, metav1.PatchOptions{})
		require.NoError(t, err, "admin should be able to release via merge patch")

		releasedAnnotations := updated.GetAnnotations()
		require.NotContains(t, releasedAnnotations, utils.AnnoKeyManagerKind, "managedBy should be removed")
		require.NotContains(t, releasedAnnotations, utils.AnnoKeyManagerIdentity, "managerId should be removed")
		require.NotContains(t, releasedAnnotations, utils.AnnoKeySourcePath, "sourcePath should be removed")
		require.NotContains(t, releasedAnnotations, utils.AnnoKeySourceChecksum, "sourceChecksum should be removed")
	})
}
