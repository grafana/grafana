package foldermetadata

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_FilesRoleFallbackDoesNotBypassFolderPermissions(t *testing.T) {
	helper := sharedGitHelper(t)
	const repoName = "role-fallback-authz"

	helper.CreateFolderlessTargetGitRepo(t, repoName, map[string][]byte{
		"private/_folder.json": folderMetadataJSON("fallback-private", "Private"),
		"private/README.md":    []byte("secret"),
		"private/secret.json":  common.DashboardJSON("fallback-secret", "Original", 1),
		"public/_folder.json":  folderMetadataJSON("fallback-public", "Public"),
		"public/movable.json":  common.DashboardJSON("fallback-movable", "Original", 1),
	}, "write")
	helper.SyncAndWait(t, repoName)

	_, code, err := common.PostHelper(t, *helper.K8sTestHelper, "/api/folders/fallback-private/permissions",
		map[string]any{"items": []map[string]any{}}, helper.Org1.Admin)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, code)

	viewerFiles := helper.NewFilesClient(repoName).WithUser("viewer:viewer")
	editorFiles := helper.NewFilesClient(repoName).WithUser("editor:editor")

	requireTitle := func(t *testing.T, name, title string) {
		t.Helper()
		obj, err := helper.DashboardsV1.Resource.Get(t.Context(), name, metav1.GetOptions{})
		require.NoError(t, err)
		got, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
		require.Equal(t, title, got)
	}

	t.Run("viewer cannot read a raw file in a restricted folder", func(t *testing.T) {
		resp := viewerFiles.Do(t, http.MethodGet, "private/README.md", nil)
		require.Equal(t, http.StatusForbidden, resp.StatusCode, resp.BodyString())
	})

	t.Run("editor cannot read a restricted dashboard", func(t *testing.T) {
		resp := editorFiles.Do(t, http.MethodGet, "private/secret.json", nil)
		require.Equal(t, http.StatusForbidden, resp.StatusCode, resp.BodyString())
	})

	t.Run("editor cannot update a restricted dashboard", func(t *testing.T) {
		resp := editorFiles.Put(t, "private/secret.json?message=update", common.DashboardJSON("fallback-secret", "EXPLOITED", 2))
		require.Equal(t, http.StatusForbidden, resp.StatusCode, resp.BodyString())
		requireTitle(t, "fallback-secret", "Original")
	})

	t.Run("editor cannot create a dashboard in a restricted folder", func(t *testing.T) {
		resp := editorFiles.Post(t, "private/new.json?message=create", common.DashboardJSON("fallback-new", "EXPLOITED", 1))
		require.Equal(t, http.StatusForbidden, resp.StatusCode, resp.BodyString())
		_, err := helper.DashboardsV1.Resource.Get(t.Context(), "fallback-new", metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "dashboard should not exist: %v", err)
	})

	t.Run("editor cannot move a dashboard into a restricted folder", func(t *testing.T) {
		resp := editorFiles.Post(t, "private/movable.json?originalPath=public/movable.json&message=move", nil)
		require.Equal(t, http.StatusForbidden, resp.StatusCode, resp.BodyString())
		obj, err := helper.DashboardsV1.Resource.Get(t.Context(), "fallback-movable", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "fallback-public", obj.GetAnnotations()["grafana.app/folder"])
	})

	t.Run("editor cannot create a subfolder in a restricted folder", func(t *testing.T) {
		resp := editorFiles.Post(t, "private/sub/?message=create", nil)
		require.Equal(t, http.StatusForbidden, resp.StatusCode, resp.BodyString())
	})

	t.Run("editor cannot rename a restricted folder", func(t *testing.T) {
		resp := editorFiles.Put(t, "private/?message=rename", common.FolderBody(t, "fallback-private", "EXPLOITED"))
		require.Equal(t, http.StatusForbidden, resp.StatusCode, resp.BodyString())
		obj, err := helper.Folders.Resource.Get(t.Context(), "fallback-private", metav1.GetOptions{})
		require.NoError(t, err)
		title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
		require.Equal(t, "Private", title)
	})

	t.Run("editor can move a dashboard into a new folder under a folder they can edit", func(t *testing.T) {
		resp := editorFiles.Post(t, "public/new-move/movable.json?originalPath=public/movable.json&message=move", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode, resp.BodyString())
	})

	t.Run("editor can create a dashboard in a new folder under a folder they can edit", func(t *testing.T) {
		resp := editorFiles.Post(t, "public/new/dashboard.json?message=create", common.DashboardJSON("fallback-unsynced", "New", 1))
		require.Equal(t, http.StatusOK, resp.StatusCode, resp.BodyString())
	})
}

func TestIntegrationProvisioning_FilesRoleFallbackSyncedAncestor(t *testing.T) {
	helper := sharedGitHelper(t)
	const repoName = "role-fallback-ancestor"

	helper.CreateGitRepo(t, repoName, map[string][]byte{
		"private/_folder.json": folderMetadataJSON("ancestor-private", "Private"),
	}, "write")
	helper.SyncAndWait(t, repoName)

	_, code, err := common.PostHelper(t, *helper.K8sTestHelper, "/api/folders/ancestor-private/permissions",
		map[string]any{"items": []map[string]any{}}, helper.Org1.Admin)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, code)

	resp := helper.NewFilesClient(repoName).WithUser("editor:editor").Post(t, "private/newsub/x.json?message=x", common.DashboardJSON("ancestor-new", "EXPLOITED", 1))
	require.Equal(t, http.StatusForbidden, resp.StatusCode, resp.BodyString())
	_, err = helper.DashboardsV1.Resource.Get(t.Context(), "ancestor-new", metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "dashboard should not exist: %v", err)
}

func TestIntegrationProvisioning_FilesRoleFallbackRootPreview(t *testing.T) {
	helper := sharedGitHelper(t)
	const repoName = "role-fallback-root-preview"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"existing.json": common.DashboardJSON("root-existing", "Existing", 1),
	}, "write", "branch")
	helper.SyncAndWait(t, repoName)

	_, err := local.Git("checkout", "-b", "root-preview")
	require.NoError(t, err)
	require.NoError(t, local.CreateFile("new.json", string(common.DashboardJSON("root-new", "New", 1))))
	_, err = local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "add root dashboard")
	require.NoError(t, err)
	_, err = local.Git("push", "origin", "root-preview")
	require.NoError(t, err)

	resp := helper.NewFilesClient(repoName).WithUser("viewer:viewer").Do(t, http.MethodGet, "new.json?ref=root-preview", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode, resp.BodyString())
	require.Contains(t, resp.BodyString(), "root-new")
}
