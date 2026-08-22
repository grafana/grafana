package foldermetadata

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_FullSync_SimultaneousParentAndChildRename reproduces
// the folder-rename bug reported in git-ui-sync-project#1276: a single commit
// renames a parent folder and a folder nested under it, both keeping their stable
// _folder.json UID.
//
// Before the fix, full sync only marked the current change's own old UID as
// relocating, so ensuring the renamed child walked its ancestors, resolved the
// parent's stable UID still at its old path in the tree, and failed with
// `folder UID ... is already used by folder at path ...`. That failure was
// surfaced as a warning, which in turn skipped the old-folder cleanup and left
// the repository unable to reconcile. This test asserts that both folders
// relocate cleanly with their UIDs preserved and no stale folders remain.
func TestIntegrationProvisioning_FullSync_SimultaneousParentAndChildRename(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "folder-simultaneous-rename"
	const (
		parentUID = "alpha-folder-uid"
		childUID  = "services-folder-uid"
	)

	writeToProvisioningPath(t, helper, "alpha/_folder.json", folderMetadataJSON(parentUID, "Alpha Team"))
	writeToProvisioningPath(t, helper, "alpha/services/_folder.json", folderMetadataJSON(childUID, "Services Group"))

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json":   "alpha/dashboard.json",
			"../testdata/text-options.json": "alpha/services/dashboard.json",
		},
		SkipSync: true,
	})

	helper.SyncAndWait(t, repo, nil)

	// Initial state: both folders at their original paths under their stable UIDs.
	common.RequireFolderState(t, helper.Folders, parentUID, "Alpha Team", "alpha", repo)
	common.RequireFolderState(t, helper.Folders, childUID, "Services Group", "alpha/services", parentUID)
	requireDashboardParents(t, helper, repo, map[string]string{
		"alpha/dashboard.json":          parentUID,
		"alpha/services/dashboard.json": childUID,
	})

	// Rename the parent (alpha -> gamma) and, in the same reconcile, the nested
	// child (services -> workers). Both directories carry their _folder.json, so
	// both keep their stable UID.
	moveInProvisioningPath(t, helper, "alpha", "gamma")
	moveInProvisioningPath(t, helper, "gamma/services", "gamma/workers")

	helper.SyncAndWait(t, repo, nil)

	// Both folders relocated in place: same UID, new source paths, correct parent.
	common.RequireFolderState(t, helper.Folders, parentUID, "Alpha Team", "gamma", repo)
	common.RequireFolderState(t, helper.Folders, childUID, "Services Group", "gamma/workers", parentUID)

	// Dashboards followed their folders and kept their parents.
	requireDashboardParents(t, helper, repo, map[string]string{
		"gamma/dashboard.json":         parentUID,
		"gamma/workers/dashboard.json": childUID,
	})

	// No stale folders remain at the old paths.
	assertNoFolderAtPath(t, helper, repo, "alpha")
	assertNoFolderAtPath(t, helper, repo, "alpha/services")
	assertNoFolderAtPath(t, helper, repo, "gamma/services")

	// The UIDs are genuinely preserved (relocated, not recreated under new UIDs).
	require.Equal(t, parentUID, findFolderUIDBySourcePath(t, helper, repo, "gamma"))
	require.Equal(t, childUID, findFolderUIDBySourcePath(t, helper, repo, "gamma/workers"))
}
