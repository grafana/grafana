package foldermetadata

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func createWriteRepo(t *testing.T, helper *common.ProvisioningTestHelper, name string) {
	t.Helper()
	createWriteRepoWithTarget(t, helper, name, "folder")
}

func createWriteRepoWithTarget(t *testing.T, helper *common.ProvisioningTestHelper, name, target string) {
	t.Helper()
	repo := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata":   map[string]any{"name": name},
		"spec": map[string]any{
			"title":     name,
			"workflows": []any{"write"},
			"sync":      map[string]any{"enabled": true, "target": target, "intervalSeconds": int64(60)},
			"type":      "local",
			"local":     map[string]any{"path": helper.ProvisioningPath},
		},
	}}
	_, err := helper.Repositories.Resource.Create(t.Context(), repo, metav1.CreateOptions{})
	require.NoError(t, err)
	helper.WaitForHealthyRepository(t, name)
}

func TestIntegrationProvisioning_FilesAuthorizeAgainstActualFolder(t *testing.T) {
	helper := sharedHelper(t)

	const repoName = "actual-folder-authz"

	dashboard := func(name, title string) []byte {
		return []byte(`{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind": "Dashboard",
			"metadata": {"name": "` + name + `"},
			"spec": {"title": "` + title + `", "schemaVersion": 36}
		}`)
	}

	writeToProvisioningPath(t, helper, "restricted/_folder.json", folderMetadataJSON("restricted-uid", "Restricted"))
	writeToProvisioningPath(t, helper, "public/_folder.json", folderMetadataJSON("public-uid", "Public"))
	for _, name := range []string{"target", "target-skip", "target-same", "target-move", "target2", "editable", "editable-cross"} {
		writeToProvisioningPath(t, helper, "restricted/"+name+".json", dashboard("authz-"+name, "Original"))
	}

	createWriteRepo(t, helper, repoName)
	helper.SyncAndWait(t, repoName, nil)

	setEditorPermission := func(folderUID string, permission int) {
		_, code, err := common.PostHelper(t, *helper.K8sTestHelper, "/api/folders/"+folderUID+"/permissions",
			map[string]any{"items": []map[string]any{
				{"role": "Viewer", "permission": 1},
				{"role": "Editor", "permission": permission},
			}}, helper.Org1.Admin)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, code)
	}
	setEditorPermission(repoName, 1)
	setEditorPermission("restricted-uid", 1)
	setEditorPermission("public-uid", 2)

	for _, uid := range []string{"authz-editable", "authz-editable-cross"} {
		_, code, err := common.PostHelper(t, *helper.K8sTestHelper, "/api/dashboards/uid/"+uid+"/permissions",
			map[string]any{"items": []map[string]any{
				{"role": "Viewer", "permission": 1},
				{"role": "Editor", "permission": 2},
			}}, helper.Org1.Admin)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, code)
	}

	writeToProvisioningPath(t, helper, "public/target2.json", dashboard("authz-target2", "Original"))
	writeToProvisioningPath(t, helper, "public/target-move.json", dashboard("authz-target-move", "Original"))

	editorFiles := helper.NewFilesClient(repoName).WithUser("editor:editor")

	requireUnchanged := func(t *testing.T, name string) {
		t.Helper()
		obj, err := helper.DashboardsV1.Resource.Get(t.Context(), name, metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "restricted-uid", obj.GetAnnotations()["grafana.app/folder"])
		title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
		require.Equal(t, "Original", title)
	}

	t.Run("editor can create a dashboard in the folder they can edit", func(t *testing.T) {
		resp := editorFiles.Post(t, "public/new.json?message=create", dashboard("authz-new", "New"))
		require.Equal(t, http.StatusOK, resp.StatusCode, resp.BodyString())
	})

	t.Run("editor cannot update a restricted dashboard through a public path", func(t *testing.T) {
		resp := editorFiles.Post(t, "public/target.json?message=update", dashboard("authz-target", "EXPLOITED"))
		require.Equal(t, http.StatusForbidden, resp.StatusCode, resp.BodyString())
		requireUnchanged(t, "authz-target")
	})

	t.Run("editor cannot update a restricted dashboard through a public path with skipDryRun", func(t *testing.T) {
		resp := editorFiles.Post(t, "public/target-skip.json?skipDryRun=true&message=update", dashboard("authz-target-skip", "EXPLOITED"))
		require.Equal(t, http.StatusForbidden, resp.StatusCode, resp.BodyString())
		requireUnchanged(t, "authz-target-skip")
	})

	t.Run("editor cannot update a restricted dashboard through its actual path", func(t *testing.T) {
		resp := editorFiles.Put(t, "restricted/target-same.json?skipDryRun=true&message=update", dashboard("authz-target-same", "EXPLOITED"))
		require.Equal(t, http.StatusForbidden, resp.StatusCode, resp.BodyString())
		requireUnchanged(t, "authz-target-same")
	})

	t.Run("editor cannot move a restricted dashboard through a public path", func(t *testing.T) {
		resp := editorFiles.Post(t, "public/moved.json?originalPath=public/target-move.json&skipDryRun=true&message=move", nil)
		require.Equal(t, http.StatusForbidden, resp.StatusCode, resp.BodyString())
		requireUnchanged(t, "authz-target-move")
	})

	t.Run("editor can move a dashboard they can edit within a folder they cannot create in", func(t *testing.T) {
		resp := editorFiles.Post(t, "restricted/editable-moved.json?originalPath=restricted/editable.json&skipDryRun=true&message=move", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode, resp.BodyString())
	})

	t.Run("editor can move a dashboard they can edit out of a folder they cannot create in", func(t *testing.T) {
		resp := editorFiles.Post(t, "public/editable-cross.json?originalPath=restricted/editable-cross.json&skipDryRun=true&message=move", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode, resp.BodyString())
		obj, err := helper.DashboardsV1.Resource.Get(t.Context(), "authz-editable-cross", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "public-uid", obj.GetAnnotations()["grafana.app/folder"])
	})

	t.Run("editor cannot delete a restricted dashboard through a public path", func(t *testing.T) {
		resp := editorFiles.Delete(t, "public/target2.json?message=delete")
		require.Equal(t, http.StatusForbidden, resp.StatusCode, resp.BodyString())
		requireUnchanged(t, "authz-target2")
	})
}

func TestIntegrationProvisioning_FilesAuthorizeRootLevelResources(t *testing.T) {
	helper := sharedHelper(t)

	const repoName = "root-level-authz"

	dashboard := func(name, title string) []byte {
		return []byte(`{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind": "Dashboard",
			"metadata": {"name": "` + name + `"},
			"spec": {"title": "` + title + `", "schemaVersion": 36}
		}`)
	}

	writeToProvisioningPath(t, helper, "root-dash.json", dashboard("authz-root-dash", "Original"))
	writeToProvisioningPath(t, helper, "root-editable.json", dashboard("authz-root-editable", "Original"))
	writeToProvisioningPath(t, helper, "root-editable-cross.json", dashboard("authz-root-editable-cross", "Original"))
	writeToProvisioningPath(t, helper, "sub/_folder.json", folderMetadataJSON("root-sub-uid", "Sub"))

	createWriteRepoWithTarget(t, helper, repoName, "instance")
	helper.SyncAndWait(t, repoName, nil)

	_, code, err := common.PostHelper(t, *helper.K8sTestHelper, "/api/dashboards/uid/authz-root-dash/permissions",
		map[string]any{"items": []map[string]any{
			{"role": "Viewer", "permission": 1},
			{"role": "Editor", "permission": 1},
		}}, helper.Org1.Admin)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, code)

	for _, uid := range []string{"authz-root-editable", "authz-root-editable-cross"} {
		_, code, err = common.PostHelper(t, *helper.K8sTestHelper, "/api/dashboards/uid/"+uid+"/permissions",
			map[string]any{"items": []map[string]any{
				{"role": "Viewer", "permission": 1},
				{"role": "Editor", "permission": 2},
			}}, helper.Org1.Admin)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, code)
	}

	_, code, err = common.PostHelper(t, *helper.K8sTestHelper, "/api/folders/root-sub-uid/permissions",
		map[string]any{"items": []map[string]any{
			{"role": "Viewer", "permission": 1},
			{"role": "Editor", "permission": 2},
		}}, helper.Org1.Admin)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, code)

	editorFiles := helper.NewFilesClient(repoName).WithUser("editor:editor")

	t.Run("editor cannot update a view-only root dashboard", func(t *testing.T) {
		resp := editorFiles.Put(t, "root-dash.json?skipDryRun=true&message=update", dashboard("authz-root-dash", "EXPLOITED"))
		require.Equal(t, http.StatusForbidden, resp.StatusCode, resp.BodyString())
		obj, err := helper.DashboardsV1.Resource.Get(t.Context(), "authz-root-dash", metav1.GetOptions{})
		require.NoError(t, err)
		title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
		require.Equal(t, "Original", title)
	})

	t.Run("editor cannot overwrite a view-only root dashboard through a move", func(t *testing.T) {
		resp := editorFiles.Post(t, "root-moved.json?originalPath=root-editable.json&skipDryRun=true&message=move", dashboard("authz-root-dash", "EXPLOITED"))
		require.Equal(t, http.StatusForbidden, resp.StatusCode, resp.BodyString())
		obj, err := helper.DashboardsV1.Resource.Get(t.Context(), "authz-root-dash", metav1.GetOptions{})
		require.NoError(t, err)
		title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
		require.Equal(t, "Original", title)
	})

	t.Run("editor cannot overwrite a view-only root dashboard through a move into a subfolder", func(t *testing.T) {
		resp := editorFiles.Post(t, "sub/moved.json?originalPath=root-editable-cross.json&skipDryRun=true&message=move", dashboard("authz-root-dash", "EXPLOITED"))
		require.Equal(t, http.StatusForbidden, resp.StatusCode, resp.BodyString())
		obj, err := helper.DashboardsV1.Resource.Get(t.Context(), "authz-root-dash", metav1.GetOptions{})
		require.NoError(t, err)
		title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
		require.Equal(t, "Original", title)
		require.Empty(t, obj.GetAnnotations()["grafana.app/folder"])
	})

	t.Run("editor cannot delete a view-only root dashboard", func(t *testing.T) {
		resp := editorFiles.Delete(t, "root-dash.json?message=delete")
		require.Equal(t, http.StatusForbidden, resp.StatusCode, resp.BodyString())
		_, err := helper.DashboardsV1.Resource.Get(t.Context(), "authz-root-dash", metav1.GetOptions{})
		require.NoError(t, err)
	})
}

func TestIntegrationProvisioning_FilesUpdateWithDefaultFolderPermissions(t *testing.T) {
	helper := sharedHelper(t)
	const repoName = "default-folder-authz"

	writeToProvisioningPath(t, helper, "folder/_folder.json", folderMetadataJSON("default-folder-uid", "Default"))
	writeToProvisioningPath(t, helper, "folder/dashboard.json", common.DashboardJSON("authz-default", "Original", 1))
	createWriteRepo(t, helper, repoName)
	helper.SyncAndWait(t, repoName, nil)

	resp := helper.NewFilesClient(repoName).WithUser("editor:editor").Put(t,
		"folder/dashboard.json?message=update", common.DashboardJSON("authz-default", "Updated", 2))
	require.Equal(t, http.StatusOK, resp.StatusCode, resp.BodyString())

	obj, err := helper.DashboardsV1.Resource.Get(t.Context(), "authz-default", metav1.GetOptions{})
	require.NoError(t, err)
	title, _, err := unstructured.NestedString(obj.Object, "spec", "title")
	require.NoError(t, err)
	require.Equal(t, "Updated", title)
}
