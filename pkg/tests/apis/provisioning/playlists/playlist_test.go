package playlists

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"sigs.k8s.io/yaml"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func newPlaylist(name, title string) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": playlistGVR.Group + "/" + playlistGVR.Version,
			"kind":       "Playlist",
			"metadata": map[string]any{
				"name": name,
			},
			"spec": map[string]any{
				"title":    title,
				"interval": "5m",
				"items": []any{
					map[string]any{"type": "dashboard_by_tag", "value": "provisioning"},
				},
			},
		},
	}
}

// TestIntegrationProvisioning_ExportPlaylist verifies that a full instance export (push)
// succeeds with Playlist enabled as an active resource, and that the playlist is written
// to the repository alongside other kinds. Before the provisioning identity was authorized
// for playlists, enumerating the active kinds during export denied the playlist list and
// failed the entire job — so a successful export here is the regression guard for that.
func TestIntegrationProvisioning_ExportPlaylist(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	playlists := playlistClient(t, helper)

	// A dashboard so the export covers more than just playlists (proves other kinds
	// still export once playlists are active).
	dashboard := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	_, err := helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v1 dashboard")

	created, err := playlists.Resource.Create(ctx, newPlaylist("export-playlist", "Export Playlist"), metav1.CreateOptions{})
	require.NoError(t, err, "provisioning identity context should allow creating a playlist")
	t.Cleanup(func() { _ = playlists.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}) })

	const repo = "playlist-export-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:               repo,
		SyncTarget:         "instance", // export is only supported for instance sync
		Workflows:          []string{"write"},
		ExpectedDashboards: 1,
		ExpectedFolders:    0,
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

	dashboardFiles, playlistFiles := exportedFilesByGroup(t, helper.ProvisioningPath)
	require.NotEmpty(t, dashboardFiles, "dashboards should still be exported when playlist is active")
	require.NotEmpty(t, playlistFiles, "the playlist should be exported to the repository")

	obj := readResourceFile(t, playlistFiles[0])
	title, _, err := unstructured.NestedString(obj, "spec", "title")
	require.NoError(t, err)
	require.Equal(t, "Export Playlist", title)
	require.Nil(t, obj["status"], "exported file should not carry a status")
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

	body, err := yaml.Marshal(newPlaylist("synced-playlist", "Synced Playlist").Object)
	require.NoError(t, err)
	helper.WriteToProvisioningPath(t, "synced-playlist.yaml", body)
	t.Cleanup(func() { _ = playlists.Resource.Delete(ctx, "synced-playlist", metav1.DeleteOptions{}) })

	helper.SyncAndWait(t, repo, nil)
	helper.DebugState(t, repo, "AFTER PLAYLIST SYNC")

	var got *unstructured.Unstructured
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		got, err = playlists.Resource.Get(ctx, "synced-playlist", metav1.GetOptions{})
		if err != nil {
			collect.Errorf("playlist not provisioned yet: %s", err.Error())
			return
		}
		assert.NotNil(collect, got)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "playlist should be provisioned from the repository")

	title, _, err := unstructured.NestedString(got.Object, "spec", "title")
	require.NoError(t, err)
	require.Equal(t, "Synced Playlist", title)
}

// exportedFilesByGroup walks the repository directory and partitions resource files by
// API group so tests can assert on what was exported without hard-coding generated names.
func exportedFilesByGroup(t *testing.T, root string) (dashboards, playlists []string) {
	t.Helper()
	err := filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(p))
		if ext != ".json" && ext != ".yaml" && ext != ".yml" {
			return nil
		}
		obj := readResourceFile(t, p)
		apiVersion, _, _ := unstructured.NestedString(obj, "apiVersion")
		switch {
		case strings.HasPrefix(apiVersion, "dashboard.grafana.app/"):
			dashboards = append(dashboards, p)
		case strings.HasPrefix(apiVersion, "playlist.grafana.app/"):
			playlists = append(playlists, p)
		}
		return nil
	})
	require.NoError(t, err)
	return dashboards, playlists
}

func readResourceFile(t *testing.T, path string) map[string]any {
	t.Helper()
	//nolint:gosec // reading files we just exported under a test temp dir
	body, err := os.ReadFile(path)
	require.NoError(t, err)
	obj := map[string]any{}
	// sigs.k8s.io/yaml handles both JSON and YAML exports.
	require.NoError(t, yaml.Unmarshal(body, &obj), "exported file %s should be valid JSON/YAML", path)
	return obj
}
