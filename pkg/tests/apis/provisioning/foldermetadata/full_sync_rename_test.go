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

// TestIntegrationProvisioning_FullSync_RenameNestedSubtree covers renaming the top
// folder of a tree with five levels, sibling branches, empty folders, and dashboards
// throughout. A second case also renames nested branches before the same full sync.
// Both cases must preserve folder objects and dashboard UIDs, update every source
// path and parent link, and leave no stale folders. Another full sync verifies that
// the repository continues to reconcile after the rename.
func TestIntegrationProvisioning_FullSync_RenameNestedSubtree(t *testing.T) {
	for _, tt := range []struct {
		name        string
		backendDir  string
		frontendDir string
	}{
		{name: "top folder rename", backendDir: "Grafana Backend", frontendDir: "Frontend"},
		{name: "top folder and nested branches renamed together", backendDir: "Backend", frontendDir: "UI"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			helper := sharedHelper(t)
			const repo = "folder-rename-nested"
			backendPath := "RD/Grafana/" + tt.backendDir
			frontendPath := "RD/Grafana/" + tt.frontendDir
			folders := []struct {
				uid     string
				title   string
				oldPath string
				newPath string
				parent  string
				empty   bool
			}{
				{uid: "rd-uid", title: "Research and Development", oldPath: "RnD", newPath: "RD", parent: repo},
				{uid: "grafana-uid", title: "Grafana", oldPath: "RnD/Grafana", newPath: "RD/Grafana", parent: "rd-uid"},
				{uid: "backend-uid", title: "Grafana Backend", oldPath: "RnD/Grafana/Grafana Backend", newPath: backendPath, parent: "grafana-uid"},
				{uid: "as-code-uid", title: "As Code", oldPath: "RnD/Grafana/Grafana Backend/As Code", newPath: backendPath + "/As Code", parent: "backend-uid"},
				{uid: "provisioning-uid", title: "Provisioning", oldPath: "RnD/Grafana/Grafana Backend/As Code/Provisioning", newPath: backendPath + "/As Code/Provisioning", parent: "as-code-uid"},
				{uid: "alerts-uid", title: "Alerting", oldPath: "RnD/Grafana/Grafana Backend/Alerting", newPath: backendPath + "/Alerting", parent: "backend-uid"},
				{uid: "frontend-uid", title: "Frontend", oldPath: "RnD/Grafana/Frontend", newPath: frontendPath, parent: "grafana-uid"},
				{uid: "scenes-uid", title: "Scenes", oldPath: "RnD/Grafana/Frontend/Scenes", newPath: frontendPath + "/Scenes", parent: "frontend-uid"},
				{uid: "infra-uid", title: "Infrastructure", oldPath: "RnD/Infrastructure", newPath: "RD/Infrastructure", parent: "rd-uid"},
				{uid: "clusters-uid", title: "Clusters", oldPath: "RnD/Infrastructure/Clusters", newPath: "RD/Infrastructure/Clusters", parent: "infra-uid"},
				{uid: "empty-uid", title: "Empty", oldPath: "RnD/Grafana/Grafana Backend/Empty", newPath: backendPath + "/Empty", parent: "backend-uid", empty: true},
				{uid: "ops-uid", title: "Operations", oldPath: "Operations", newPath: "Operations", parent: repo},
			}

			dashboardsBefore := make(map[string]common.ExpectedDashboard)
			dashboardsAfter := make(map[string]common.ExpectedDashboard)
			for _, folder := range folders {
				writeToProvisioningPath(t, helper, folder.oldPath+"/_folder.json", folderMetadataJSON(folder.uid, folder.title))
				if folder.empty {
					continue
				}
				dashboardUID := "dash-" + folder.uid
				dashboardTitle := folder.title + " overview"
				writeToProvisioningPath(t, helper, folder.oldPath+"/dashboard.json", common.DashboardJSON(dashboardUID, dashboardTitle, 1))
				dashboardsBefore[dashboardUID] = common.ExpectedDashboard{Title: dashboardTitle, SourcePath: folder.oldPath + "/dashboard.json", Folder: folder.uid}
				dashboardsAfter[dashboardUID] = common.ExpectedDashboard{Title: dashboardTitle, SourcePath: folder.newPath + "/dashboard.json", Folder: folder.uid}
			}

			helper.CreateLocalRepo(t, common.TestRepo{
				Name:       repo,
				SyncTarget: "folder",
				SkipSync:   true,
			})
			helper.SyncAndWait(t, repo, nil)

			for _, folder := range folders {
				common.RequireFolderState(t, helper.Folders, folder.uid, folder.title, folder.oldPath, folder.parent)
			}
			common.RequireDashboards(t, helper.DashboardsV1, dashboardsBefore)

			// The count includes the repository's target folder. Preserve object
			// identities as well as names to detect deletion followed by recreation.
			initialFolders := helper.RequireRepoFolderCount(t, repo, len(folders)+1)
			initialSnapshots := make(map[string]common.ObjectSnapshot, len(initialFolders))
			for i := range initialFolders {
				initialSnapshots[initialFolders[i].GetName()] = common.SnapshotObject(t, &initialFolders[i])
			}

			moveInProvisioningPath(t, helper, "RnD", "RD")
			if tt.backendDir != "Grafana Backend" {
				moveInProvisioningPath(t, helper, "RD/Grafana/Grafana Backend", backendPath)
			}
			if tt.frontendDir != "Frontend" {
				moveInProvisioningPath(t, helper, "RD/Grafana/Frontend", frontendPath)
			}
			helper.SyncAndWait(t, repo, nil)

			requireRenamedTree := func() {
				t.Helper()
				for _, folder := range folders {
					common.RequireFolderState(t, helper.Folders, folder.uid, folder.title, folder.newPath, folder.parent)
					if folder.oldPath != folder.newPath {
						assertNoFolderAtPath(t, helper, repo, folder.oldPath)
					}
				}
				actualFolders := helper.RequireRepoFolderCount(t, repo, len(folders)+1)
				for i := range actualFolders {
					folder := &actualFolders[i]
					before, exists := initialSnapshots[folder.GetName()]
					require.True(t, exists, "unexpected folder %q after rename", folder.GetName())
					common.RequireUpdatedInPlace(t, folder.GetName(), before, common.SnapshotObject(t, folder))
				}
				common.RequireDashboards(t, helper.DashboardsV1, dashboardsAfter)
			}
			requireRenamedTree()

			helper.SyncAndWait(t, repo, nil)
			requireRenamedTree()
		})
	}
}
