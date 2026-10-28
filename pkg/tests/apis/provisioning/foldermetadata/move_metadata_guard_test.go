package foldermetadata

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// A valid replacement dashboard body must not bypass protection of its _folder.json
// source. Rejecting the move must leave repository files and live resources unchanged.
func TestIntegrationProvisioning_MoveFolderMetadataWithReplacementIsForbidden(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "metadata-move-protection"
	const dashboardUID = "protected-team-dashboard"
	const replacementUID = "replacement-dashboard"
	const sourcePath = "team/_folder.json"
	const existingDashboardPath = "team/existing.json"
	const destinationPath = "team/dashboard.json"

	metadata := common.FolderBody(t, "protected-team", "Protected Team")
	dashboard := common.DashboardJSON(dashboardUID, "Existing Dashboard", 1)
	writeToProvisioningPath(t, helper, sourcePath, metadata)
	writeToProvisioningPath(t, helper, existingDashboardPath, dashboard)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name: repo, SyncTarget: "instance", Workflows: []string{"write"},
	})

	folderUID := findFolderUIDBySourcePath(t, helper, repo, "team")
	requireDashboardParents(t, helper, repo, map[string]string{existingDashboardPath: folderUID})
	folderBefore, err := helper.Folders.Resource.Get(t.Context(), folderUID, metav1.GetOptions{})
	require.NoError(t, err)
	dashboardBefore, err := helper.DashboardsV1.Resource.Get(t.Context(), dashboardUID, metav1.GetOptions{})
	require.NoError(t, err)

	resp := helper.PostFilesRequest(t, repo, common.FilesPostOptions{
		TargetPath:   destinationPath,
		OriginalPath: sourcePath,
		Body:         string(common.DashboardJSON(replacementUID, "Replacement Dashboard", 1)),
	})
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.NoError(t, resp.Body.Close())
	require.Equal(t, http.StatusForbidden, resp.StatusCode, "%s", body)

	metadataAfter, err := os.ReadFile(filepath.Join(helper.ProvisioningPath, sourcePath))
	require.NoError(t, err)
	require.Equal(t, metadata, metadataAfter, "the folder manifest must not be removed or changed")
	dashboardAfter, err := os.ReadFile(filepath.Join(helper.ProvisioningPath, existingDashboardPath))
	require.NoError(t, err)
	require.Equal(t, dashboard, dashboardAfter)
	require.NoFileExists(t, filepath.Join(helper.ProvisioningPath, destinationPath))

	folderAfter, err := helper.Folders.Resource.Get(t.Context(), folderUID, metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, folderBefore.Object, folderAfter.Object, "the live folder must not change")
	liveDashboardAfter, err := helper.DashboardsV1.Resource.Get(t.Context(), dashboardUID, metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, dashboardBefore.Object, liveDashboardAfter.Object, "the existing live dashboard must not change")
	_, err = helper.DashboardsV1.Resource.Get(t.Context(), replacementUID, metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "the replacement dashboard must not be created: %v", err)
}
