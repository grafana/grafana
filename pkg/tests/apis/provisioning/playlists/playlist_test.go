package playlists

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"sigs.k8s.io/yaml"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

const playlistGroupPrefix = "playlist.grafana.app/"

// TestIntegrationProvisioning_ExportPlaylist verifies that a full instance export (push)
// succeeds with Playlist enabled as an active resource and writes the playlist to the
// repository. Before the provisioning identity was authorized for playlists, enumerating
// the active kinds during export denied the playlist list and failed the entire job — so a
// successful export here is the regression guard for that.
func TestIntegrationProvisioning_ExportPlaylist(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	playlists := playlistClient(t, helper)

	created, err := playlists.Resource.Create(ctx, common.NewPlaylist("export-playlist", "Export Playlist"), metav1.CreateOptions{})
	require.NoError(t, err, "provisioning identity context should allow creating a playlist")
	t.Cleanup(func() { _ = playlists.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}) })

	const repo = "playlist-export-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "instance", // export is only supported for instance sync
		Workflows:              []string{"write"},
		SkipResourceAssertions: true,
	})

	helper.DebugState(t, repo, "BEFORE EXPORT")

	// Push the whole instance. This enumerates every active kind, which is where the
	// playlist list used to be denied.
	helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push:   &provisioning.ExportJobOptions{},
	})

	helper.DebugState(t, repo, "AFTER EXPORT")
	common.PrintFileTree(t, helper.ProvisioningPath)

	playlistFiles := helper.ExportedResourceFiles(t, playlistGroupPrefix)
	require.NotEmpty(t, playlistFiles, "the playlist should be exported to the repository")

	obj := helper.LoadYAMLOrJSONFile(playlistFiles[0])
	title, _, err := unstructured.NestedString(obj.Object, "spec", "title")
	require.NoError(t, err)
	require.Equal(t, "Export Playlist", title)
	require.Nil(t, obj.Object["status"], "exported file should not carry a status")
}

// TestIntegrationProvisioning_SyncPlaylist verifies the import (pull) direction: a playlist
// file in the repository is provisioned into Grafana when the repo syncs.
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

	body, err := yaml.Marshal(common.NewPlaylist("synced-playlist", "Synced Playlist").Object)
	require.NoError(t, err)
	helper.WriteToProvisioningPath(t, "synced-playlist.yaml", body)
	t.Cleanup(func() { _ = playlists.Resource.Delete(ctx, "synced-playlist", metav1.DeleteOptions{}) })

	helper.SyncAndWait(t, repo, nil)
	helper.DebugState(t, repo, "AFTER PLAYLIST SYNC")

	got := common.RequireResource(t, ctx, playlists.Resource, "synced-playlist")
	title, _, err := unstructured.NestedString(got.Object, "spec", "title")
	require.NoError(t, err)
	require.Equal(t, "Synced Playlist", title)
}

// TestIntegrationProvisioning_PlaylistFilesEndpoint exercises the repository files
// subresource for playlists. A write to the configured branch of a sync-enabled repo both
// stores the file and provisions the resource into Grafana (the dual writer "behaves the
// same as running sync after writing"), so the test asserts the playlist state in Grafana
// and the repository file listing after a create and a delete.
//
// Note: read-back and update via the files GET/PUT are intentionally not exercised here.
// Both run a dry-run against the existing resource, and the playlist apiserver rejects an
// update without metadata.resourceVersion (which a repository file does not carry). That is
// a playlist round-trip limitation tracked separately under #1166, not part of the authz
// wiring this change is about.
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

	// Create the playlist via the files endpoint (POST).
	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("files", path).
		Body(common.ResourceToJSON(t, common.NewPlaylist(name, "Files Playlist"))).
		SetHeader("Content-Type", "application/json").
		Do(ctx)
	require.NoError(t, result.Error(), "creating a playlist via the files endpoint should succeed")

	// The write both stores the file in the repo and provisions the playlist into Grafana.
	require.Contains(t, repositoryFilePaths(t, ctx, helper, repo), path, "the playlist file should exist in the repository")

	got := common.RequireResource(t, ctx, playlists.Resource, name)
	title, _, err := unstructured.NestedString(got.Object, "spec", "title")
	require.NoError(t, err)
	require.Equal(t, "Files Playlist", title)

	// Delete the playlist via the files endpoint (DELETE).
	result = helper.AdminREST.Delete().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("files", path).
		Do(ctx)
	require.NoError(t, result.Error(), "deleting a playlist file should succeed")

	require.NotContains(t, repositoryFilePaths(t, ctx, helper, repo), path, "the playlist file should be removed from the repository")
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		_, err := playlists.Resource.Get(ctx, name, metav1.GetOptions{})
		assert.True(collect, apierrors.IsNotFound(err), "playlist should be removed from Grafana after a files DELETE, got: %v", err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "playlist should be deleted after a files DELETE")
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
