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
// folder of a tree with four levels, sibling branches, empty folders, and dashboards
// throughout. A second case also renames nested branches before the same full sync.
// Both cases must preserve folder objects and dashboard UIDs, update every source
// path and parent link, and leave no stale folders. Another full sync verifies that
// the repository continues to reconcile after the rename.
func TestIntegrationProvisioning_FullSync_RenameNestedSubtree(t *testing.T) {
	for _, tt := range []struct {
		name        string
		servicesDir string
		appsDir     string
	}{
		{name: "top folder rename", servicesDir: "services", appsDir: "apps"},
		{name: "top folder and nested branches renamed together", servicesDir: "workers", appsDir: "clients"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			helper := sharedHelper(t)
			const repo = "folder-rename-nested"
			servicesPath := "gamma/projects/" + tt.servicesDir
			appsPath := "gamma/projects/" + tt.appsDir
			// The repository target folder also counts toward the depth limit.
			// Keep repository paths within four levels so creation succeeds with
			// the default configuration before exercising the renames.
			folders := []struct {
				uid     string
				title   string
				oldPath string
				newPath string
				parent  string
				empty   bool
			}{
				{uid: "alpha-folder-uid", title: "Alpha Team", oldPath: "alpha", newPath: "gamma", parent: repo},
				{uid: "projects-folder-uid", title: "Projects", oldPath: "alpha/projects", newPath: "gamma/projects", parent: "alpha-folder-uid"},
				{uid: "services-folder-uid", title: "Services Group", oldPath: "alpha/projects/services", newPath: servicesPath, parent: "projects-folder-uid"},
				{uid: "api-folder-uid", title: "API", oldPath: "alpha/projects/services/api", newPath: servicesPath + "/api", parent: "services-folder-uid"},
				{uid: "jobs-folder-uid", title: "Jobs", oldPath: "alpha/projects/services/jobs", newPath: servicesPath + "/jobs", parent: "services-folder-uid"},
				{uid: "alerts-folder-uid", title: "Alerts", oldPath: "alpha/projects/services/alerts", newPath: servicesPath + "/alerts", parent: "services-folder-uid"},
				{uid: "apps-folder-uid", title: "Applications", oldPath: "alpha/projects/apps", newPath: appsPath, parent: "projects-folder-uid"},
				{uid: "web-folder-uid", title: "Web", oldPath: "alpha/projects/apps/web", newPath: appsPath + "/web", parent: "apps-folder-uid"},
				{uid: "infra-folder-uid", title: "Infrastructure", oldPath: "alpha/infrastructure", newPath: "gamma/infrastructure", parent: "alpha-folder-uid"},
				{uid: "clusters-folder-uid", title: "Clusters", oldPath: "alpha/infrastructure/clusters", newPath: "gamma/infrastructure/clusters", parent: "infra-folder-uid"},
				{uid: "empty-folder-uid", title: "Empty", oldPath: "alpha/projects/services/empty", newPath: servicesPath + "/empty", parent: "services-folder-uid", empty: true},
				{uid: "beta-folder-uid", title: "Beta Team", oldPath: "beta", newPath: "beta", parent: repo},
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
			common.RequireDashboards(t, helper.DashboardsV1, t.Context(), dashboardsBefore)

			// The count includes the repository's target folder. Preserve object
			// identities as well as names to detect deletion followed by recreation.
			initialFolders := helper.RequireRepoFolderCountAndGetManaged(t, repo, len(folders)+1)
			initialSnapshots := make(map[string]common.ObjectSnapshot, len(initialFolders))
			for i := range initialFolders {
				initialSnapshots[initialFolders[i].GetName()] = common.SnapshotObject(t, &initialFolders[i])
			}

			moveInProvisioningPath(t, helper, "alpha", "gamma")
			if tt.servicesDir != "services" {
				moveInProvisioningPath(t, helper, "gamma/projects/services", servicesPath)
			}
			if tt.appsDir != "apps" {
				moveInProvisioningPath(t, helper, "gamma/projects/apps", appsPath)
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
				actualFolders := helper.RequireRepoFolderCountAndGetManaged(t, repo, len(folders)+1)
				for i := range actualFolders {
					folder := &actualFolders[i]
					before, exists := initialSnapshots[folder.GetName()]
					require.True(t, exists, "unexpected folder %q after rename", folder.GetName())
					common.RequireUpdatedInPlace(t, folder.GetName(), before, common.SnapshotObject(t, folder))
				}
				common.RequireDashboards(t, helper.DashboardsV1, t.Context(), dashboardsAfter)
			}
			requireRenamedTree()

			helper.SyncAndWait(t, repo, nil)
			requireRenamedTree()
		})
	}
}
