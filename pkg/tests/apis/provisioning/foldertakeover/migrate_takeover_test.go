package foldertakeover

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func folderManifestUID(t *testing.T, data []byte) string {
	t.Helper()
	var manifest foldersV1.Folder
	require.NoError(t, json.Unmarshal(data, &manifest), "_folder.json should be valid JSON")
	return manifest.Name
}

// TestIntegrationProvisioning_MigrateTakesOverCleanFolders checks a migration
// that writes to the configured branch with generateNewFolderIDs on:
//   - a folder subtree with only dashboards keeps its UIDs and is taken over,
//   - a folder subtree with an alert rule gets new UIDs, and the original
//     folders keep the alert rule.
func TestIntegrationProvisioning_MigrateTakesOverCleanFolders(t *testing.T) {
	helper := sharedGitHelper(t)

	const (
		repo             = "takeover-direct-repo"
		cleanParentUID   = "takeover-clean-parent"
		cleanParentTitle = "takeover-clean-parent"
		cleanChildUID    = "takeover-clean-child"
		cleanChildTitle  = "takeover-clean-child"
		mixedParentUID   = "takeover-mixed-parent"
		mixedParentTitle = "takeover-mixed-parent"
		mixedChildUID    = "takeover-mixed-child"
		mixedChildTitle  = "takeover-mixed-child"
	)

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Workflows:  []string{"write"},
	})

	helper.CreateUnmanagedFolderWithName(t, cleanParentUID, cleanParentTitle, "")
	helper.CreateUnmanagedFolderWithName(t, cleanChildUID, cleanChildTitle, cleanParentUID)
	helper.CreateUnmanagedDashboard(t, "takeover clean dashboard", cleanChildUID)

	helper.CreateUnmanagedFolderWithName(t, mixedParentUID, mixedParentTitle, "")
	helper.CreateUnmanagedFolderWithName(t, mixedChildUID, mixedChildTitle, mixedParentUID)
	helper.CreateUnmanagedDashboard(t, "takeover mixed dashboard", mixedChildUID)
	createAlertRule(t, helper, mixedChildUID)

	helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionMigrate,
		Migrate: &provisioning.MigrateJobOptions{
			Message:              "Migrate with folder takeover",
			GenerateNewFolderIDs: true,
		},
	})

	readManifestUID := func(parts ...string) string {
		path := filepath.Join(append([]string{helper.ProvisioningPath}, append(parts, "_folder.json")...)...)
		data, err := os.ReadFile(path) //nolint:gosec
		require.NoError(t, err, "_folder.json should exist at %s", path)
		return folderManifestUID(t, data)
	}

	require.Equal(t, cleanParentUID, readManifestUID(cleanParentTitle), "the clean parent should keep its UID")
	require.Equal(t, cleanChildUID, readManifestUID(cleanParentTitle, cleanChildTitle), "the clean child should keep its UID")
	require.NotEqual(t, mixedParentUID, readManifestUID(mixedParentTitle), "the parent of a folder with an alert rule should get a new UID")
	require.NotEqual(t, mixedChildUID, readManifestUID(mixedParentTitle, mixedChildTitle), "a folder with an alert rule should get a new UID")

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		for _, uid := range []string{cleanParentUID, cleanChildUID} {
			folder, err := helper.Folders.Resource.Get(t.Context(), uid, metav1.GetOptions{})
			if assert.NoError(collect, err) {
				assert.Equal(collect, repo, folder.GetAnnotations()[utils.AnnoKeyManagerIdentity], "folder %q should be taken over", uid)
			}
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "the clean folders should be taken over")

	for _, uid := range []string{mixedParentUID, mixedChildUID} {
		folder, err := helper.Folders.Resource.Get(t.Context(), uid, metav1.GetOptions{})
		require.NoError(t, err, "the original folder %q should still exist", uid)
		require.Empty(t, folder.GetAnnotations()[utils.AnnoKeyManagerIdentity], "the original folder %q should stay unmanaged", uid)
	}
}

// TestIntegrationProvisioning_MigrateSkipsFoldersThatCannotKeepTheirUID checks
// a migration with generateNewFolderIDs off: the clean folder is taken over,
// and the folder with an alert rule is not migrated at all, with a warning.
func TestIntegrationProvisioning_MigrateSkipsFoldersThatCannotKeepTheirUID(t *testing.T) {
	helper := sharedGitHelper(t)

	const (
		repo       = "takeover-skip-repo"
		cleanUID   = "takeover-skip-clean"
		cleanTitle = "takeover-skip-clean"
		mixedUID   = "takeover-skip-mixed"
		mixedTitle = "takeover-skip-mixed"
	)

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Workflows:  []string{"write"},
	})

	helper.CreateUnmanagedFolderWithName(t, cleanUID, cleanTitle, "")
	helper.CreateUnmanagedDashboard(t, "takeover skip clean dashboard", cleanUID)
	helper.CreateUnmanagedFolderWithName(t, mixedUID, mixedTitle, "")
	mixedDashboard := helper.CreateUnmanagedDashboard(t, "takeover skip mixed dashboard", mixedUID)
	createAlertRule(t, helper, mixedUID)

	jobObj := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action:  provisioning.JobActionMigrate,
		Migrate: &provisioning.MigrateJobOptions{Message: "Migrate and skip folders that cannot keep their UID"},
	})
	job := common.MustFromUnstructured[provisioning.Job](t, jobObj)
	require.Equal(t, provisioning.JobStateWarning, job.Status.State, "the job should warn about the folder that is not migrated: %+v", job.Status)
	common.RequireJobWarningContains(t, job, "are not migrated")

	data, err := os.ReadFile(filepath.Join(helper.ProvisioningPath, cleanTitle, "_folder.json")) //nolint:gosec
	require.NoError(t, err)
	require.Equal(t, cleanUID, folderManifestUID(t, data), "the clean folder should keep its UID")
	_, err = os.Stat(filepath.Join(helper.ProvisioningPath, mixedTitle))
	require.True(t, os.IsNotExist(err), "the folder with an alert rule should not be written to the repository")

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		folder, err := helper.Folders.Resource.Get(t.Context(), cleanUID, metav1.GetOptions{})
		if assert.NoError(collect, err) {
			assert.Equal(collect, repo, folder.GetAnnotations()[utils.AnnoKeyManagerIdentity], "the clean folder should be taken over")
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	mixed, err := helper.Folders.Resource.Get(t.Context(), mixedUID, metav1.GetOptions{})
	require.NoError(t, err)
	require.Empty(t, mixed.GetAnnotations()[utils.AnnoKeyManagerIdentity], "the folder with an alert rule should stay unmanaged")
	dashboard, err := helper.DashboardsV1.Resource.Get(t.Context(), mixedDashboard, metav1.GetOptions{})
	require.NoError(t, err, "the dashboard in the folder that is not migrated should stay")
	require.Empty(t, dashboard.GetAnnotations()[utils.AnnoKeyManagerIdentity], "the dashboard in the folder that is not migrated should stay unmanaged")
}
