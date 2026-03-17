package foldermetadata

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_FullSync_FolderMoveWithMetadata(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
	const repo = "folder-move-metadata"

	writeToProvisioningPath(t, helper, "teamA/_folder.json", folderMetadataJSON("team-a-uid", "Team A Display"))
	writeToProvisioningPath(t, helper, "teamB/_folder.json", folderMetadataJSON("team-b-uid", "Team B Display"))
	writeToProvisioningPath(t, helper, "teamC/teamD/.keep", []byte{})

	helper.CreateRepo(t, common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json":    "teamA/dashboard.json",
			"../testdata/text-options.json":  "teamB/dashboard.json",
			"../testdata/timeline-demo.json": "teamC/dashboard.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "team-a-uid", "Team A Display", "teamA", repo)
	requireFolderState(t, helper, "team-b-uid", "Team B Display", "teamB", repo)

	teamCUID := findFolderUIDBySourcePath(t, helper, repo, "teamC")
	teamDUID := findFolderUIDBySourcePath(t, helper, repo, "teamC/teamD")
	require.NotEmpty(t, teamCUID)
	require.NotEmpty(t, teamDUID)

	requireFolderState(t, helper, teamCUID, "teamC", "teamC", repo)
	requireFolderState(t, helper, teamDUID, "teamD", "teamC/teamD", teamCUID)

	requireDashboardParents(t, helper, repo, map[string]string{
		"teamA/dashboard.json": "team-a-uid",
		"teamB/dashboard.json": "team-b-uid",
		"teamC/dashboard.json": teamCUID,
	})

	moveInProvisioningPath(t, helper, "teamB", "teamC/teamB")
	moveInProvisioningPath(t, helper, "teamC", "teamA/teamC")
	moveInProvisioningPath(t, helper, "teamA/teamC/teamD", "teamA/teamD")

	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "team-a-uid", "Team A Display", "teamA", repo)

	newTeamCUID := findFolderUIDBySourcePath(t, helper, repo, "teamA/teamC")
	require.NotEmpty(t, newTeamCUID)
	requireFolderState(t, helper, "team-b-uid", "Team B Display", "teamA/teamC/teamB", newTeamCUID)
	requireFolderState(t, helper, newTeamCUID, "teamC", "teamA/teamC", "team-a-uid")

	newTeamDUID := findFolderUIDBySourcePath(t, helper, repo, "teamA/teamD")
	require.NotEmpty(t, newTeamDUID)
	requireFolderState(t, helper, newTeamDUID, "teamD", "teamA/teamD", "team-a-uid")

	requireDashboardParents(t, helper, repo, map[string]string{
		"teamA/dashboard.json":             "team-a-uid",
		"teamA/teamC/teamB/dashboard.json": "team-b-uid",
		"teamA/teamC/dashboard.json":       newTeamCUID,
	})
}

func folderMetadataJSON(uid, title string) []byte {
	folder := map[string]any{
		"apiVersion": "folder.grafana.app/v1beta1",
		"kind":       "Folder",
		"metadata": map[string]any{
			"name": uid,
		},
		"spec": map[string]any{
			"title": title,
		},
	}
	data, _ := json.MarshalIndent(folder, "", "\t")
	return data
}

func writeToProvisioningPath(t *testing.T, helper *common.ProvisioningTestHelper, relativePath string, data []byte) {
	t.Helper()
	fullPath := filepath.Join(helper.ProvisioningPath, relativePath)
	require.NoError(t, os.MkdirAll(filepath.Dir(fullPath), 0o750))
	require.NoError(t, os.WriteFile(fullPath, data, 0o600))
}

func moveInProvisioningPath(t *testing.T, helper *common.ProvisioningTestHelper, from, to string) {
	t.Helper()
	fromPath := filepath.Join(helper.ProvisioningPath, from)
	toPath := filepath.Join(helper.ProvisioningPath, to)
	require.NoError(t, os.MkdirAll(filepath.Dir(toPath), 0o750), "create parent for move destination")
	require.NoError(t, os.Rename(fromPath, toPath), "move %s to %s", from, to)
}

func requireFolderState(t *testing.T, helper *common.ProvisioningTestHelper, folderUID, expectedTitle, expectedSourcePath, expectedParent string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		obj, err := helper.Folders.Resource.Get(t.Context(), folderUID, metav1.GetOptions{})
		if !assert.NoError(c, err, "failed to get folder %s", folderUID) {
			return
		}

		title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
		assert.Equal(c, expectedTitle, title, "folder title")

		annotations := obj.GetAnnotations()
		assert.Equal(c, expectedSourcePath, annotations["grafana.app/sourcePath"], "source path")
		assert.Equal(c, expectedParent, annotations["grafana.app/folder"], "parent folder")
	}, 30*time.Second, 100*time.Millisecond,
		"expected folder %q with title=%q sourcePath=%q parent=%q", folderUID, expectedTitle, expectedSourcePath, expectedParent)
}

func findFolderUIDBySourcePath(t *testing.T, helper *common.ProvisioningTestHelper, repoName, sourcePath string) string {
	t.Helper()
	var uid string
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list folders") {
			return
		}
		for _, f := range list.Items {
			annotations := f.GetAnnotations()
			if annotations["grafana.app/managerId"] != repoName {
				continue
			}
			if annotations["grafana.app/sourcePath"] == sourcePath {
				uid = f.GetName()
				return
			}
		}
		c.Errorf("no folder managed by %q with sourcePath %q found", repoName, sourcePath)
	}, 30*time.Second, 100*time.Millisecond,
		"expected folder with sourcePath %q for repo %q", sourcePath, repoName)
	return uid
}

func requireDashboardParents(t *testing.T, helper *common.ProvisioningTestHelper, repoName string, expected map[string]string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list dashboards") {
			return
		}
		found := make(map[string]string)
		for _, d := range list.Items {
			annotations := d.GetAnnotations()
			if annotations["grafana.app/managerId"] != repoName {
				continue
			}
			sourcePath := annotations["grafana.app/sourcePath"]
			if _, ok := expected[sourcePath]; ok {
				found[sourcePath] = annotations["grafana.app/folder"]
			}
		}
		for sourcePath, expectedParent := range expected {
			actualParent, ok := found[sourcePath]
			if !assert.True(c, ok, "dashboard with sourcePath %q not found", sourcePath) {
				continue
			}
			assert.Equal(c, expectedParent, actualParent, "dashboard %q parent folder", sourcePath)
		}
	}, 30*time.Second, 100*time.Millisecond,
		"expected dashboards with correct parents for repo %q", repoName)
}
