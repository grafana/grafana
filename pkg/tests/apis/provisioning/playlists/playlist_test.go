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

// TestIntegrationProvisioning_ExportPlaylistSelective verifies a selective export (Push with
// an explicit Resources list) writes only the named playlists and leaves the rest out. This
// exercises the generalized selective-export controller (#125993) for a non-dashboard kind.
func TestIntegrationProvisioning_ExportPlaylistSelective(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	playlists := playlistClient(t, helper)

	const count = 3
	for i := 0; i < count; i++ {
		name, title := playlistName(i)
		_, err := playlists.Resource.Create(ctx, common.NewPlaylist(name, title), metav1.CreateOptions{})
		require.NoError(t, err, "should create playlist %s", name)
		t.Cleanup(func() { _ = playlists.Resource.Delete(ctx, name, metav1.DeleteOptions{}) })
	}

	const repo = "playlist-selective-export-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "instance",
		Workflows:              []string{"write"},
		SkipResourceAssertions: true,
	})

	// Export only playlist-0 and playlist-2; playlist-1 must be left out.
	name0, title0 := playlistName(0)
	name2, title2 := playlistName(2)
	helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Resources: []provisioning.ResourceRef{
				{Name: name0, Kind: "Playlist", Group: common.PlaylistGVR.Group},
				{Name: name2, Kind: "Playlist", Group: common.PlaylistGVR.Group},
			},
		},
	})
	common.PrintFileTree(t, helper.ProvisioningPath)

	files := helper.ExportedResourceFiles(t, playlistGroupPrefix)
	require.Len(t, files, 2, "only the two requested playlists should be exported")
	gotTitles := map[string]bool{}
	for _, f := range files {
		obj := helper.LoadYAMLOrJSONFile(f)
		title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
		gotTitles[title] = true
	}
	require.Equal(t, map[string]bool{title0: true, title2: true}, gotTitles)
	_, title1 := playlistName(1)
	require.NotContains(t, gotTitles, title1, "the unselected playlist must not be exported")
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
		helper.WriteToProvisioningPath(t, name+".json", common.ResourceToJSON(t, common.NewPlaylist(name, title)))
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

// TestIntegrationProvisioning_PlaylistFilesEndpoint exercises the full repository files
// subresource round-trip for playlists: create (POST), update (PUT), move (POST with
// originalPath), and delete (DELETE).
//
// Update and move re-provision the resource as an update. The playlist apiserver rejects an
// update without metadata.resourceVersion (which a repository file does not carry); the
// parser now carries the existing object's resourceVersion into the update so these operations
// round-trip cleanly (git-ui-sync-project#1199).
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

	// Update: re-provisions the playlist as an update. The parser carries the existing
	// resourceVersion into the update so the playlist apiserver accepts it (git-ui-sync-project#1199).
	updateErr := helper.AdminREST.Put().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("files", path).
		Body(common.ResourceToJSON(t, common.NewPlaylist(name, "Files Playlist Updated"))).
		SetHeader("Content-Type", "application/json").
		Do(ctx).Error()
	require.NoError(t, updateErr, "playlist update via files PUT should succeed")
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		got, err := playlists.Resource.Get(ctx, name, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		title, _, _ := unstructured.NestedString(got.Object, "spec", "title")
		assert.Equal(collect, "Files Playlist Updated", title, "the updated title should be reflected in Grafana")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "playlist title should be updated after a files PUT")

	// Move: re-provisions the playlist at the new path. With the resourceVersion carried
	// into the update, the move succeeds and the source-path annotation is refreshed.
	const movedPath = "moved/" + path
	moveResp := helper.PostFilesRequest(t, repo, common.FilesPostOptions{
		TargetPath:   movedPath,
		OriginalPath: path,
		Message:      "move playlist",
	})
	require.Equal(t, 200, moveResp.StatusCode, "playlist move via files endpoint should succeed")
	require.NoError(t, moveResp.Body.Close())

	repoFiles := repositoryFilePaths(t, ctx, helper, repo)
	require.NotContains(t, repoFiles, path, "the playlist file should no longer be at its original path")
	require.Contains(t, repoFiles, movedPath, "the playlist file should be at the moved path")
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		got, err := playlists.Resource.Get(ctx, name, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		assert.Equal(collect, movedPath, got.GetAnnotations()[utils.AnnoKeySourcePath],
			"the source-path annotation should be refreshed to the moved path")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "playlist source path should be refreshed after a files move")

	// Delete: removes the (moved) file and deprovisions the playlist. The moved path is
	// nested, so use the files client (the typed REST builder rejects '/' in a subresource).
	delResp := helper.NewFilesClient(repo).Delete(t, movedPath)
	require.Equal(t, 200, delResp.StatusCode, "deleting a playlist file should succeed")

	require.NotContains(t, repositoryFilePaths(t, ctx, helper, repo), movedPath, "the playlist file should be removed from the repository")
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
// playlist files within the repository, the playlists remain in Grafana, and the post-move
// full sync refreshes each moved playlist's source-path annotation.
//
// The move job moves the files and then runs a full sync to reconcile, which re-upserts the
// moved playlists as updates. The parser now carries the existing resourceVersion into the
// update, so the re-upsert succeeds (the job completes without warnings) and the refreshed
// source-path annotation is observable (git-ui-sync-project#1199).
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

	// Bulk move both playlist files into a subdirectory in a single job. The move plus its
	// post-move re-upsert must complete cleanly, without warnings.
	helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionMove,
		Move:   &provisioning.MoveJobOptions{Paths: paths, TargetPath: "archived/"},
	})

	repoFiles := repositoryFilePaths(t, ctx, helper, repo)
	for i := range paths {
		movedPath := "archived/" + paths[i]
		require.NotContains(t, repoFiles, paths[i], "%s should no longer be at its original path", paths[i])
		require.Contains(t, repoFiles, movedPath, "%s should be moved under archived/", paths[i])
		// The moved playlist survives and its source path is refreshed to the new location.
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			got, err := playlists.Resource.Get(ctx, names[i], metav1.GetOptions{})
			if !assert.NoError(collect, err) {
				return
			}
			assert.Equal(collect, movedPath, got.GetAnnotations()[utils.AnnoKeySourcePath],
				"%s source path should be refreshed to the moved location", names[i])
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "%s source path should be refreshed after the move job", names[i])
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
