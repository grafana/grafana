package foldermetadata

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_UpdateFolderMetadata(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "update-folder-metadata-repo"
	helper.CreateRepo(t, common.TestRepo{Name: repo, Target: "instance", SkipResourceAssertions: true})

	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
	filesURL := func(filePath string) string {
		return fmt.Sprintf("http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/%s",
			addr, repo, filePath)
	}

	putFolder := func(t *testing.T, folderPath string, body []byte) *http.Response {
		t.Helper()
		req, err := http.NewRequest(http.MethodPut, filesURL(folderPath), bytes.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		return resp
	}

	postFolder := func(t *testing.T, folderPath string) *http.Response {
		t.Helper()
		req, err := http.NewRequest(http.MethodPost, filesURL(folderPath), nil)
		require.NoError(t, err)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		return resp
	}

	readFolderUID := func(t *testing.T, metadataPath string) string {
		t.Helper()
		wrapObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", metadataPath)
		require.NoError(t, err)
		uid, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "metadata", "name")
		return uid
	}

	readFolderTitle := func(t *testing.T, metadataPath string) string {
		t.Helper()
		wrapObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", metadataPath)
		require.NoError(t, err)
		title, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "spec", "title")
		return title
	}

	// Create a folder to work with
	resp := postFolder(t, "update-test/")
	require.Equal(t, http.StatusOK, resp.StatusCode, "setup: creating folder should succeed")
	resp.Body.Close()

	originalUID := readFolderUID(t, "update-test/_folder.json")
	require.NotEmpty(t, originalUID, "setup: folder should have a UID")
	originalTitle := readFolderTitle(t, "update-test/_folder.json")
	require.Equal(t, "update-test", originalTitle, "setup: folder should have initial title")

	t.Run("update folder title via PUT to folder path succeeds", func(t *testing.T) {
		body := fmt.Sprintf(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"%s"},"spec":{"title":"Updated Title"}}`, originalUID)
		resp := putFolder(t, "update-test/", []byte(body))
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		require.Equal(t, http.StatusOK, resp.StatusCode, "PUT to folder path should update title: %s", string(respBody))

		newTitle := readFolderTitle(t, "update-test/_folder.json")
		require.Equal(t, "Updated Title", newTitle, "title should be updated in _folder.json")

		newUID := readFolderUID(t, "update-test/_folder.json")
		require.Equal(t, originalUID, newUID, "UID must not change after title update")
	})

	t.Run("update folder title updates Grafana folder object", func(t *testing.T) {
		body := fmt.Sprintf(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"%s"},"spec":{"title":"Grafana Updated"}}`, originalUID)
		resp := putFolder(t, "update-test/", []byte(body))
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		require.Equal(t, http.StatusOK, resp.StatusCode, "updating folder title should succeed: %s", string(respBody))

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			folderObj, err := helper.Folders.Resource.Get(ctx, originalUID, metav1.GetOptions{})
			if err != nil {
				collect.Errorf("could not get folder: %v", err)
				return
			}
			title, _, _ := unstructured.NestedString(folderObj.Object, "spec", "title")
			assert.Equal(collect, "Grafana Updated", title, "Grafana folder title should be updated")
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "Grafana folder title should eventually be updated")
	})

	t.Run("update with omitted ID succeeds (uses existing ID)", func(t *testing.T) {
		body := `{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{},"spec":{"title":"No ID Provided"}}`
		resp := putFolder(t, "update-test/", []byte(body))
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		require.Equal(t, http.StatusOK, resp.StatusCode, "update with omitted ID should succeed: %s", string(respBody))

		newTitle := readFolderTitle(t, "update-test/_folder.json")
		require.Equal(t, "No ID Provided", newTitle, "title should be updated")

		newUID := readFolderUID(t, "update-test/_folder.json")
		require.Equal(t, originalUID, newUID, "UID must not change")
	})

	t.Run("changing folder ID is rejected", func(t *testing.T) {
		body := `{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"different-uid"},"spec":{"title":"ID Changed"}}`
		resp := putFolder(t, "update-test/", []byte(body))
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode, "changing folder ID must be rejected: %s", string(respBody))
		require.Contains(t, string(respBody), "folder ID change is not allowed")

		unchangedUID := readFolderUID(t, "update-test/_folder.json")
		require.Equal(t, originalUID, unchangedUID, "UID must not have changed after rejected request")
	})

	t.Run("empty title is rejected", func(t *testing.T) {
		body := fmt.Sprintf(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"%s"},"spec":{"title":""}}`, originalUID)
		resp := putFolder(t, "update-test/", []byte(body))
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode, "empty title must be rejected: %s", string(respBody))
		require.Contains(t, string(respBody), "title must not be empty")
	})

	t.Run("missing spec title is rejected", func(t *testing.T) {
		body := fmt.Sprintf(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"%s"},"spec":{}}`, originalUID)
		resp := putFolder(t, "update-test/", []byte(body))
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode, "missing title must be rejected: %s", string(respBody))
	})

	t.Run("invalid JSON body is rejected", func(t *testing.T) {
		body := `{not valid json}`
		resp := putFolder(t, "update-test/", []byte(body))
		defer resp.Body.Close()
		require.Equal(t, http.StatusBadRequest, resp.StatusCode, "invalid JSON must be rejected")
	})

	t.Run("PUT to non-existent folder path fails", func(t *testing.T) {
		body := `{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"some-uid"},"spec":{"title":"ghost"}}`
		resp := putFolder(t, "no-such-folder/", []byte(body))
		defer resp.Body.Close()
		require.NotEqual(t, http.StatusOK, resp.StatusCode, "PUT to non-existent folder should fail")
	})

	t.Run("nested folder title update works", func(t *testing.T) {
		resp := postFolder(t, "nested-parent/nested-child/")
		require.Equal(t, http.StatusOK, resp.StatusCode, "setup: creating nested folder should succeed")
		resp.Body.Close()

		childUID := readFolderUID(t, "nested-parent/nested-child/_folder.json")
		require.NotEmpty(t, childUID)

		body := fmt.Sprintf(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"%s"},"spec":{"title":"Child Renamed"}}`, childUID)
		resp = putFolder(t, "nested-parent/nested-child/", []byte(body))
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		require.Equal(t, http.StatusOK, resp.StatusCode, "nested title update should succeed: %s", string(respBody))

		newTitle := readFolderTitle(t, "nested-parent/nested-child/_folder.json")
		require.Equal(t, "Child Renamed", newTitle)

		newUID := readFolderUID(t, "nested-parent/nested-child/_folder.json")
		require.Equal(t, childUID, newUID, "nested folder UID must not change")
	})

	t.Run("PUT to folder path without flag is method not supported", func(t *testing.T) {
		// This is covered by the existing behavior for repos without the flag,
		// but we verify that PUT to a directory on this repo (with flag) works.
		// The non-flag case is tested in the main files_test.go.
	})
}
