package resourcekinds

import (
	"context"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_ResourceKinds_FilesEndpoint exercises the full repository files
// subresource round-trip: create (POST), update (PUT), move (POST with originalPath), and
// delete (DELETE). Update and move re-provision the resource as an update; the parser carries
// the existing object's resourceVersion into the update so these operations round-trip cleanly
// (git-ui-sync-project#1199).
//
// This test keeps its writes at the repository root to isolate the resourceVersion round-trip.
// Subdirectory writes — where folder scoping matters, since org-scoped kinds (e.g. playlists)
// must not derive a grafana.app/folder annotation their apiserver forbids — are covered by
// TestIntegrationProvisioning_ResourceKinds_SubdirectoryFolderScope.
func TestIntegrationProvisioning_ResourceKinds_FilesEndpoint(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	for _, rk := range resourceKinds {
		rk := rk
		t.Run(rk.name, func(t *testing.T) {
			client := rk.client(t, helper)

			repo := rk.name + "-files-repo"
			filePath := rk.name + "-files.json"
			name := rk.name + "-files"
			helper.CreateLocalRepo(t, common.TestRepo{
				Name:                   repo,
				SyncTarget:             "folder",
				Workflows:              []string{"write"},
				SkipResourceAssertions: true,
			})
			t.Cleanup(func() { _ = client.Resource.Delete(ctx, name, metav1.DeleteOptions{}) })

			// Create: stores the file and provisions the resource.
			postResourceFile(t, ctx, helper, rk, repo, filePath, name, "Files "+rk.kind)
			require.Contains(t, repositoryFilePaths(t, ctx, helper, repo), filePath, "the file should exist in the repository")
			got := common.RequireResource(t, ctx, client.Resource, name)
			title, _, _ := unstructured.NestedString(got.Object, "spec", "title")
			require.Equal(t, "Files "+rk.kind, title)

			// Update: re-provisions the resource as an update.
			updateErr := helper.AdminREST.Put().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", filePath).
				Body(common.ResourceToJSON(t, rk.newResource(t, name, "Files "+rk.kind+" Updated"))).
				SetHeader("Content-Type", "application/json").
				Do(ctx).Error()
			require.NoError(t, updateErr, "%s update via files PUT should succeed", rk.name)
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				got, err := client.Resource.Get(ctx, name, metav1.GetOptions{})
				if !assert.NoError(collect, err) {
					return
				}
				title, _, _ := unstructured.NestedString(got.Object, "spec", "title")
				assert.Equal(collect, "Files "+rk.kind+" Updated", title, "the updated title should be reflected in Grafana")
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "title should be updated after a files PUT")

			// Move (same directory level): re-provisions the resource at the new path and
			// refreshes its source-path annotation.
			movedPath := rk.name + "-files-moved.json"
			moveResp := helper.PostFilesRequest(t, repo, common.FilesPostOptions{
				TargetPath:   movedPath,
				OriginalPath: filePath,
				Message:      "move " + rk.name,
			})
			moveBody, _ := io.ReadAll(moveResp.Body)
			require.NoError(t, moveResp.Body.Close())
			require.Equalf(t, 200, moveResp.StatusCode, "%s move via files endpoint should succeed; body: %s", rk.name, moveBody)

			repoFiles := repositoryFilePaths(t, ctx, helper, repo)
			require.NotContains(t, repoFiles, filePath, "the file should no longer be at its original path")
			require.Contains(t, repoFiles, movedPath, "the file should be at the moved path")
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				got, err := client.Resource.Get(ctx, name, metav1.GetOptions{})
				if !assert.NoError(collect, err) {
					return
				}
				assert.Equal(collect, movedPath, got.GetAnnotations()[utils.AnnoKeySourcePath],
					"the source-path annotation should be refreshed to the moved path")
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "source path should be refreshed after a files move")

			// Delete: removes the (moved) file and deprovisions the resource.
			delResp := helper.NewFilesClient(repo).Delete(t, movedPath)
			require.Equal(t, 200, delResp.StatusCode, "deleting a %s file should succeed", rk.name)

			require.NotContains(t, repositoryFilePaths(t, ctx, helper, repo), movedPath, "the file should be removed from the repository")
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				_, err := client.Resource.Get(ctx, name, metav1.GetOptions{})
				assert.True(collect, apierrors.IsNotFound(err), "%s should be removed from Grafana after a files DELETE, got: %v", rk.name, err)
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "%s should be deleted after a files DELETE", rk.name)
		})
	}
}
