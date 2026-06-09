package playlists

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"sigs.k8s.io/yaml"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

const playlistGroupPrefix = "playlist.grafana.app/"

// playlistName returns a deterministic name/title pair for the i-th playlist in a test.
func playlistName(i int) (name, title string) {
	return fmt.Sprintf("playlist-%d", i), fmt.Sprintf("Playlist %d", i)
}

// postPlaylistFile creates a playlist at path via the files endpoint, which both stores the
// file in the repo and provisions the playlist into Grafana.
func postPlaylistFile(t *testing.T, ctx context.Context, helper *common.ProvisioningTestHelper, repo, path, name, title string) {
	t.Helper()
	res := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("files", path).
		Body(common.ResourceToJSON(t, common.NewPlaylist(name, title))).
		SetHeader("Content-Type", "application/json").
		Do(ctx)
	require.NoError(t, res.Error(), "creating %s via the files endpoint should succeed", path)
}

// TestIntegrationProvisioning_ExportPlaylist verifies that a full instance export (push)
// succeeds with Playlist active and writes every playlist to the repository. Before the
// provisioning identity was authorized for playlists, enumerating the active kinds during
// export denied the playlist list and failed the whole job — so a successful multi-playlist
// export is the regression guard for that.
func TestIntegrationProvisioning_ExportPlaylist(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	playlists := playlistClient(t, helper)

	const count = 3
	wantTitles := map[string]bool{}
	for i := 0; i < count; i++ {
		name, title := playlistName(i)
		_, err := playlists.Resource.Create(ctx, common.NewPlaylist(name, title), metav1.CreateOptions{})
		require.NoError(t, err, "should create playlist %s", name)
		wantTitles[title] = true
		t.Cleanup(func() { _ = playlists.Resource.Delete(ctx, name, metav1.DeleteOptions{}) })
	}

	const repo = "playlist-export-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "instance", // export is only supported for instance sync
		Workflows:              []string{"write"},
		SkipResourceAssertions: true,
	})

	helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push:   &provisioning.ExportJobOptions{},
	})
	common.PrintFileTree(t, helper.ProvisioningPath)

	files := helper.ExportedResourceFiles(t, playlistGroupPrefix)
	require.Len(t, files, count, "every playlist should be exported")
	gotTitles := map[string]bool{}
	for _, f := range files {
		obj := helper.LoadYAMLOrJSONFile(f)
		require.Nil(t, obj.Object["status"], "exported file should not carry a status")
		title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
		gotTitles[title] = true
	}
	require.Equal(t, wantTitles, gotTitles, "exported titles should match the created playlists")
}

// TestIntegrationProvisioning_SyncPlaylist verifies the import (pull) direction for a batch
// of playlists: every file in the repository is provisioned into Grafana on sync, the
// provisioned objects carry the manager annotations but no folder annotation (playlists are
// not folder-scoped), and deleting the repository removes all of them.
func TestIntegrationProvisioning_SyncPlaylist(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	playlists := playlistClient(t, helper)

	const repo = "playlist-sync-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "instance",
		SkipResourceAssertions: true,
	})

	const count = 3
	var names []string
	for i := 0; i < count; i++ {
		name, title := playlistName(i)
		names = append(names, name)
		body, err := yaml.Marshal(common.NewPlaylist(name, title).Object)
		require.NoError(t, err)
		helper.WriteToProvisioningPath(t, name+".yaml", body)
		t.Cleanup(func() { _ = playlists.Resource.Delete(ctx, name, metav1.DeleteOptions{}) })
	}

	helper.SyncAndWait(t, repo, nil)
	helper.DebugState(t, repo, "AFTER PLAYLIST SYNC")

	for i, name := range names {
		_, wantTitle := playlistName(i)
		got := common.RequireResource(t, ctx, playlists.Resource, name)

		title, _, _ := unstructured.NestedString(got.Object, "spec", "title")
		require.Equal(t, wantTitle, title)

		annotations := got.GetAnnotations()
		require.Equal(t, repo, annotations[utils.AnnoKeyManagerIdentity], "%s should be managed by the repo", name)
		require.NotEmpty(t, annotations[utils.AnnoKeySourcePath], "%s should record its source path", name)
		// Playlists are org-scoped (no :folder capability), so the sync must not stamp a
		// folder annotation onto them.
		require.Empty(t, annotations[utils.AnnoKeyFolder], "%s must not carry a folder annotation", name)
	}

	// Deleting the repository must sweep away every playlist it provisioned.
	require.NoError(t, helper.Repositories.Resource.Delete(ctx, repo, metav1.DeleteOptions{}))
	helper.WaitForRepositoryDeleted(t, ctx, repo)
	for _, name := range names {
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			_, err := playlists.Resource.Get(ctx, name, metav1.GetOptions{})
			assert.True(collect, apierrors.IsNotFound(err), "%s should be removed after repo delete, got: %v", name, err)
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "playlist %s should be deleted with the repository", name)
	}
}

// TestIntegrationProvisioning_PlaylistFilesEndpoint exercises the repository files
// subresource for playlists. Create (POST) and delete (DELETE) both store/remove the file
// and provision/deprovision the resource into Grafana.
//
// Update (PUT) and move (POST with originalPath) are also exercised, but they currently fail
// for playlists: both re-provision the resource as an update, and the playlist apiserver
// rejects an update without metadata.resourceVersion (which a repository file does not
// carry). This is a playlist round-trip limitation tracked under #1166; the assertions below
// pin the current behavior so this test will flag it if the limitation is ever lifted.
func TestIntegrationProvisioning_PlaylistFilesEndpoint(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	playlists := playlistClient(t, helper)

	const repo = "playlist-files-repo"
	const path = "files-playlist.json"
	const name = "files-playlist"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "instance",
		Workflows:              []string{"write"},
		SkipResourceAssertions: true,
	})
	t.Cleanup(func() { _ = playlists.Resource.Delete(ctx, name, metav1.DeleteOptions{}) })

	// Create: stores the file and provisions the playlist.
	postPlaylistFile(t, ctx, helper, repo, path, name, "Files Playlist")
	require.Contains(t, repositoryFilePaths(t, ctx, helper, repo), path, "the playlist file should exist in the repository")
	got := common.RequireResource(t, ctx, playlists.Resource, name)
	title, _, _ := unstructured.NestedString(got.Object, "spec", "title")
	require.Equal(t, "Files Playlist", title)

	// Update (known limitation): rejected because the dry-run update lacks resourceVersion.
	updateErr := helper.AdminREST.Put().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("files", path).
		Body(common.ResourceToJSON(t, common.NewPlaylist(name, "Files Playlist Updated"))).
		SetHeader("Content-Type", "application/json").
		Do(ctx).Error()
	require.ErrorContains(t, updateErr, "resourceVersion", "playlist update via files PUT is a known #1166 limitation")

	// Move (known limitation): the move re-provisions as an update and is rejected (HTTP 422).
	moveResp := helper.PostFilesRequest(t, repo, common.FilesPostOptions{
		TargetPath:   "moved/" + path,
		OriginalPath: path,
		Message:      "move playlist",
	})
	require.Equal(t, 422, moveResp.StatusCode, "playlist move via files endpoint is a known #1166 limitation")
	require.NoError(t, moveResp.Body.Close())

	// Delete: removes the file and deprovisions the playlist.
	delResult := helper.AdminREST.Delete().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("files", path).
		Do(ctx)
	require.NoError(t, delResult.Error(), "deleting a playlist file should succeed")

	require.NotContains(t, repositoryFilePaths(t, ctx, helper, repo), path, "the playlist file should be removed from the repository")
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		_, err := playlists.Resource.Get(ctx, name, metav1.GetOptions{})
		assert.True(collect, apierrors.IsNotFound(err), "playlist should be removed from Grafana after a files DELETE, got: %v", err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "playlist should be deleted after a files DELETE")
}

// TestIntegrationProvisioning_PlaylistDeleteJob verifies that a bulk delete job removes the
// targeted playlist files from the repository and deprovisions the playlists from Grafana.
func TestIntegrationProvisioning_PlaylistDeleteJob(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	playlists := playlistClient(t, helper)

	const repo = "playlist-delete-job-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "instance",
		Workflows:              []string{"write"},
		SkipResourceAssertions: true,
	})

	paths := []string{"del-a.json", "del-b.json"}
	names := []string{"del-a", "del-b"}
	for i := range paths {
		postPlaylistFile(t, ctx, helper, repo, paths[i], names[i], "Delete "+names[i])
		_ = common.RequireResource(t, ctx, playlists.Resource, names[i])
		t.Cleanup(func() { _ = playlists.Resource.Delete(ctx, names[i], metav1.DeleteOptions{}) })
	}

	// Bulk delete both playlist files in a single job.
	helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionDelete,
		Delete: &provisioning.DeleteJobOptions{Paths: paths},
	})

	repoFiles := repositoryFilePaths(t, ctx, helper, repo)
	for i := range paths {
		require.NotContains(t, repoFiles, paths[i], "%s should be deleted from the repository", paths[i])
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			_, err := playlists.Resource.Get(ctx, names[i], metav1.GetOptions{})
			assert.True(collect, apierrors.IsNotFound(err), "%s should be deprovisioned, got: %v", names[i], err)
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "playlist %s should be deleted by the delete job", names[i])
	}
}

// TestIntegrationProvisioning_PlaylistMoveJob verifies that a bulk move job relocates the
// playlist files within the repository and the playlists remain in Grafana.
//
// Note: the move job moves the files and then runs a full sync to reconcile. Updating the
// moved playlist's source path is a no-op for now (the apiserver rejects the RV-less update,
// reported as a job warning) — the playlist round-trip limitation tracked under #1166. The
// assertions therefore cover the repository file moves and the continued existence of the
// playlists, not the refreshed source-path annotation.
func TestIntegrationProvisioning_PlaylistMoveJob(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	playlists := playlistClient(t, helper)

	const repo = "playlist-move-job-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "instance",
		Workflows:              []string{"write"},
		SkipResourceAssertions: true,
	})

	paths := []string{"mv-a.json", "mv-b.json"}
	names := []string{"mv-a", "mv-b"}
	for i := range paths {
		postPlaylistFile(t, ctx, helper, repo, paths[i], names[i], "Move "+names[i])
		_ = common.RequireResource(t, ctx, playlists.Resource, names[i])
		t.Cleanup(func() { _ = playlists.Resource.Delete(ctx, names[i], metav1.DeleteOptions{}) })
	}

	// Bulk move both playlist files into a subdirectory in a single job.
	helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionMove,
		Move:   &provisioning.MoveJobOptions{Paths: paths, TargetPath: "archived/"},
	})

	repoFiles := repositoryFilePaths(t, ctx, helper, repo)
	for i := range paths {
		require.NotContains(t, repoFiles, paths[i], "%s should no longer be at its original path", paths[i])
		require.Contains(t, repoFiles, "archived/"+paths[i], "%s should be moved under archived/", paths[i])
		// The playlist resource survives the move (its source path is not refreshed; see #1166).
		_, err := playlists.Resource.Get(ctx, names[i], metav1.GetOptions{})
		require.NoError(t, err, "%s should still exist in Grafana after the move job", names[i])
	}
}

// repositoryFilePaths returns the set of file paths currently in the repository.
func repositoryFilePaths(t *testing.T, ctx context.Context, helper *common.ProvisioningTestHelper, repo string) []string {
	t.Helper()
	items := helper.ListRepositoryFiles(t, ctx, repo)
	paths := make([]string, 0, len(items))
	for _, item := range items {
		paths = append(paths, item.Path)
	}
	return paths
}
