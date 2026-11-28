package foldertakeover

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
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

// TestIntegrationProvisioning_BranchMigrateTakesOverFoldersAfterMerge checks a
// branch migration with generateNewFolderIDs on: the clean folder keeps its UID
// in the branch, gets a takeover marker on the instance, and the first sync
// after the merge takes it over. A folder that gets an alert rule during review
// is not taken over.
func TestIntegrationProvisioning_BranchMigrateTakesOverFoldersAfterMerge(t *testing.T) {
	helper := sharedGitHelper(t)

	const (
		repo          = "takeover-branch-repo"
		branch        = "takeover-migrate"
		cleanUID      = "takeover-branch-clean"
		cleanTitle    = "takeover-branch-clean"
		reviewedUID   = "takeover-branch-reviewed"
		reviewedTitle = "takeover-branch-reviewed"
	)

	_, local := helper.CreateFolderTargetGitRepo(t, repo, nil, "write", "branch")
	helper.SyncAndWait(t, repo)

	helper.CreateUnmanagedFolderWithName(t, cleanUID, cleanTitle, "")
	cleanDashboard := helper.CreateUnmanagedDashboard(t, "takeover branch clean dashboard", cleanUID)
	helper.CreateUnmanagedFolderWithName(t, reviewedUID, reviewedTitle, "")
	helper.CreateUnmanagedDashboard(t, "takeover branch reviewed dashboard", reviewedUID)

	helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionMigrate,
		Migrate: &provisioning.MigrateJobOptions{
			Message:              "Migrate to a branch with folder takeover",
			Branch:               branch,
			GenerateNewFolderIDs: true,
		},
	})

	// The migrated dashboard is removed, and both folders stay unmanaged with a marker.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(t.Context(), cleanDashboard, metav1.GetOptions{})
		assert.True(collect, apierrors.IsNotFound(err), "the migrated dashboard should be deleted, got err: %v", err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
	for _, uid := range []string{cleanUID, reviewedUID} {
		folder, err := helper.Folders.Resource.Get(t.Context(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		require.Empty(t, folder.GetAnnotations()[utils.AnnoKeyManagerIdentity], "folder %q should stay unmanaged until the merge", uid)
		require.Equal(t, repo, folder.GetAnnotations()[resources.AnnoKeyPendingTakeover], "folder %q should be marked for takeover", uid)
	}

	// The branch keeps the original folder UIDs.
	_, err := local.Git("fetch", "origin")
	require.NoError(t, err)
	for title, uid := range map[string]string{cleanTitle: cleanUID, reviewedTitle: reviewedUID} {
		manifest, err := local.Git("show", "origin/"+branch+":"+title+"/_folder.json")
		require.NoError(t, err, "_folder.json for %q should be on the branch", title)
		require.Equal(t, uid, folderManifestUID(t, []byte(strings.TrimSpace(manifest))))
	}

	// An alert rule added during review stops the takeover of that folder.
	createAlertRule(t, helper, reviewedUID)

	_, err = local.Git("merge", "--no-edit", "origin/"+branch)
	require.NoError(t, err)
	_, err = local.Git("push", "origin", "HEAD")
	require.NoError(t, err)
	helper.SyncAndWait(t, repo)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		folder, err := helper.Folders.Resource.Get(t.Context(), cleanUID, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		assert.Equal(collect, repo, folder.GetAnnotations()[utils.AnnoKeyManagerIdentity], "the clean folder should be taken over after the merge")
		assert.NotContains(collect, folder.GetAnnotations(), resources.AnnoKeyPendingTakeover, "the marker should be removed")

		dashboard, err := helper.DashboardsV1.Resource.Get(t.Context(), cleanDashboard, metav1.GetOptions{})
		if assert.NoError(collect, err, "the dashboard should come back after the merge") {
			assert.Equal(collect, repo, dashboard.GetAnnotations()[utils.AnnoKeyManagerIdentity])
			assert.Equal(collect, cleanUID, dashboard.GetAnnotations()[utils.AnnoKeyFolder])
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	reviewed, err := helper.Folders.Resource.Get(t.Context(), reviewedUID, metav1.GetOptions{})
	require.NoError(t, err)
	require.Empty(t, reviewed.GetAnnotations()[utils.AnnoKeyManagerIdentity], "a folder that got an alert rule during review should not be taken over")
}
