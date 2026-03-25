package foldermetadata

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_CreateFolder_FolderMetadataFlag(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
	ctx := context.Background()

	const repo = "folder-metadata-test-repo"
	helper.CreateRepo(t, common.TestRepo{Name: repo, Target: "instance", SkipResourceAssertions: true})

	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()

	postFolder := func(t *testing.T, path string) *http.Response {
		t.Helper()
		u := fmt.Sprintf("http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/%s", addr, repo, path)
		req, err := http.NewRequest(http.MethodPost, u, nil)
		require.NoError(t, err)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		return resp
	}

	t.Run("simple folder creation writes _folder.json with stable UID", func(t *testing.T) {
		resp := postFolder(t, "meta-test-folder/")
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating folder should succeed")

		wrapObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "meta-test-folder/_folder.json")
		require.NoError(t, err, "_folder.json should be readable via the files endpoint")

		apiVersion, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "apiVersion")
		require.Equal(t, "folder.grafana.app/v1beta1", apiVersion)
		kind, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "kind")
		require.Equal(t, "Folder", kind)
		folderUID, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "metadata", "name")
		require.NotEmpty(t, folderUID, "_folder.json should contain a non-empty stable UID")
		title, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "spec", "title")
		require.Equal(t, "meta-test-folder", title)

		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "meta-test-folder/.keep")
		require.Error(t, err, ".keep should not exist when flag is enabled")

		_, err = helper.Folders.Resource.Get(ctx, folderUID, metav1.GetOptions{})
		require.NoError(t, err, "Grafana folder should exist with the stable UID from _folder.json")
	})

	t.Run("nested creation writes _folder.json for every folder in the path", func(t *testing.T) {
		resp := postFolder(t, "parent-folder/child-folder/")
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating nested folder should succeed")

		// Parent must have _folder.json
		parentWrap, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "parent-folder/_folder.json")
		require.NoError(t, err, "parent _folder.json should exist")
		parentUID, _, _ := unstructured.NestedString(parentWrap.Object, "resource", "file", "metadata", "name")
		require.NotEmpty(t, parentUID)

		// Child must have _folder.json
		childWrap, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "parent-folder/child-folder/_folder.json")
		require.NoError(t, err, "child _folder.json should exist")
		childUID, _, _ := unstructured.NestedString(childWrap.Object, "resource", "file", "metadata", "name")
		require.NotEmpty(t, childUID)
		require.NotEqual(t, parentUID, childUID, "each folder gets a distinct UID")

		childAPIVersion, _, _ := unstructured.NestedString(childWrap.Object, "resource", "file", "apiVersion")
		require.Equal(t, "folder.grafana.app/v1beta1", childAPIVersion)
		childTitle, _, _ := unstructured.NestedString(childWrap.Object, "resource", "file", "spec", "title")
		require.Equal(t, "child-folder", childTitle)

		_, err = helper.Folders.Resource.Get(ctx, childUID, metav1.GetOptions{})
		require.NoError(t, err, "child Grafana folder should exist with the stable UID")
	})

	t.Run("duplicate folder creation returns 409 Conflict", func(t *testing.T) {
		resp := postFolder(t, "duplicate-folder/")
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "first creation should succeed")

		resp2 := postFolder(t, "duplicate-folder/")
		// nolint:errcheck
		defer resp2.Body.Close()
		require.Equal(t, http.StatusConflict, resp2.StatusCode, "second creation should return 409 Conflict")
	})

	t.Run("child created inside existing managed folder gets its own _folder.json", func(t *testing.T) {
		resp := postFolder(t, "managed-parent/")
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating parent folder should succeed")

		parentWrap, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "managed-parent/_folder.json")
		require.NoError(t, err, "parent _folder.json should exist")
		parentUID, _, _ := unstructured.NestedString(parentWrap.Object, "resource", "file", "metadata", "name")
		require.NotEmpty(t, parentUID, "parent should have a non-empty stable UID")

		resp2 := postFolder(t, "managed-parent/child-folder/")
		// nolint:errcheck
		defer resp2.Body.Close()
		require.Equal(t, http.StatusOK, resp2.StatusCode, "creating child folder should succeed")

		childWrap, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "managed-parent/child-folder/_folder.json")
		require.NoError(t, err, "child _folder.json should exist")
		childUID, _, _ := unstructured.NestedString(childWrap.Object, "resource", "file", "metadata", "name")
		require.NotEmpty(t, childUID, "child should have a non-empty stable UID")
		require.NotEqual(t, parentUID, childUID, "child and parent UIDs must differ")

		// Parent _folder.json must be unchanged.
		parentWrap2, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "managed-parent/_folder.json")
		require.NoError(t, err, "parent _folder.json should still exist after child creation")
		parentUID2, _, _ := unstructured.NestedString(parentWrap2.Object, "resource", "file", "metadata", "name")
		require.Equal(t, parentUID, parentUID2, "parent UID must be unchanged after child creation")

		_, err = helper.Folders.Resource.Get(ctx, parentUID, metav1.GetOptions{})
		require.NoError(t, err, "parent Grafana folder should exist")
		_, err = helper.Folders.Resource.Get(ctx, childUID, metav1.GetOptions{})
		require.NoError(t, err, "child Grafana folder should exist")
	})
}
