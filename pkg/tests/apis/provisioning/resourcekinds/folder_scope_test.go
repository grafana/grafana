package resourcekinds

import (
	"context"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_ResourceKinds_SubdirectoryFolderScope asserts that writing a
// resource into a subdirectory through the files endpoint stamps a grafana.app/folder
// annotation only for folder-scoped kinds.
//
// This is the regression guard for the dual-writer folder-scope fix: an org-scoped kind such as
// a playlist must round-trip through a subdirectory (create + move) without ever receiving a
// folder annotation, because its apiserver rejects one
// ("folders are not supported for playlists.playlist.grafana.app"). Before the fix the dual
// writer re-stamped a folder onto every resource regardless of kind, so this whole flow failed
// for org-scoped kinds and the harness deliberately kept its writes at the repository root.
func TestIntegrationProvisioning_ResourceKinds_SubdirectoryFolderScope(t *testing.T) {
	helper := sharedHelper(t)

	for _, rk := range resourceKinds {
		rk := rk
		t.Run(rk.name, func(t *testing.T) {
			client := rk.client(t, helper)

			repo := rk.name + "-folderscope-repo"
			name := rk.name + "-folderscope"
			subPath := "team-a/" + rk.name + ".json"
			helper.CreateLocalRepo(t, common.TestRepo{
				Name:       repo,
				SyncTarget: "folder",
				Workflows:  []string{"write"},
			})
			cleanupCtx := context.WithoutCancel(t.Context())
			t.Cleanup(func() { _ = client.Resource.Delete(cleanupCtx, name, metav1.DeleteOptions{}) })

			// Create the resource inside a subdirectory. For org-scoped kinds this previously
			// failed because the dual writer stamped a forbidden folder annotation. The files
			// subresource REST client disallows '/' in the path segment, so this goes through the
			// raw POST helper (which also exercises the same dual-writer create path).
			createResp := helper.PostFilesRequest(t, repo, common.FilesPostOptions{
				TargetPath: subPath,
				Message:    "create " + rk.name,
				Body:       string(common.ResourceToJSON(t, rk.newResource(t, name, "Folderscope "+rk.kind))),
			})
			createBody, _ := io.ReadAll(createResp.Body)
			require.NoError(t, createResp.Body.Close())
			require.Equalf(t, 200, createResp.StatusCode, "%s create in a subdirectory should succeed; body: %s", rk.name, createBody)
			require.Contains(t, repositoryFilePaths(t, helper, repo), subPath, "the file should exist in the repository subdirectory")

			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				got, err := client.Resource.Get(t.Context(), name, metav1.GetOptions{})
				if !assert.NoError(collect, err) {
					return
				}
				folder := got.GetAnnotations()[utils.AnnoKeyFolder]
				if rk.folderScoped {
					assert.NotEmpty(collect, folder, "folder-scoped %s must be parented to its subdirectory folder", rk.kind)
				} else {
					assert.Empty(collect, folder, "org-scoped %s must not carry a folder annotation", rk.kind)
				}
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "%s should be provisioned from the subdirectory", rk.name)

			// Move within the subdirectory tree: still must not gain a folder annotation for org-scoped kinds.
			movedPath := "team-a/" + rk.name + "-moved.json"
			moveResp := helper.PostFilesRequest(t, repo, common.FilesPostOptions{
				TargetPath:   movedPath,
				OriginalPath: subPath,
				Message:      "move " + rk.name,
			})
			require.NoError(t, moveResp.Body.Close())
			require.Equalf(t, 200, moveResp.StatusCode, "%s move within a subdirectory should succeed", rk.name)

			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				got, err := client.Resource.Get(t.Context(), name, metav1.GetOptions{})
				if !assert.NoError(collect, err) {
					return
				}
				assert.Equal(collect, movedPath, got.GetAnnotations()[utils.AnnoKeySourcePath],
					"the source-path annotation should follow the move")
				folder := got.GetAnnotations()[utils.AnnoKeyFolder]
				if rk.folderScoped {
					assert.NotEmpty(collect, folder, "folder-scoped %s must stay parented after a move", rk.kind)
				} else {
					assert.Empty(collect, folder, "org-scoped %s must not gain a folder annotation on move", rk.kind)
				}
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "%s should be re-provisioned after the move", rk.name)
		})
	}
}
