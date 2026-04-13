package orgs

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestCrossNamespaceIsolation_FolderSync verifies that repositories in different
// namespaces (organizations) are completely isolated from each other when using folder sync.
//
// This test:
// 1. Creates repositories with folder sync in TWO different organizations (Org1 and OrgB)
// 2. Syncs folders and dashboards to both repositories
// 3. Verifies that each organization can only see its own resources
// 4. Confirms cross-namespace isolation works correctly
func TestCrossNamespaceIsolation_FolderSync(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)

	// Create org-specific helpers
	org1Helper := GetOrgHelper(helper, helper.Org1)
	orgBHelper := GetOrgHelper(helper, helper.OrgB)

	const (
		org1RepoName = "org1-folder-repo"
		orgBRepoName = "orgb-folder-repo"
	)

	// Step 1: Create repositories in both organizations with folder sync
	t.Run("create repositories in different namespaces", func(t *testing.T) {
		// Create Org1 repository with folder sync
		org1RepoPath := t.TempDir()
		org1Helper.CreateRepo(t, common.TestRepo{
			Name:   org1RepoName,
			Target: "folder", // Folder sync
			Path:   org1RepoPath,
			Copies: map[string]string{
				"simple-dashboard.json": "team-alpha/dashboard1.json",
			},
			SkipSync: true, // We'll sync manually to verify success
		})
		t.Logf("✓ Created repository '%s' in Org1 (namespace: %s)", org1RepoName, org1Helper.namespace)

		// Create OrgB repository with folder sync
		orgBRepoPath := t.TempDir()
		orgBHelper.CreateRepo(t, common.TestRepo{
			Name:   orgBRepoName,
			Target: "folder", // Folder sync
			Path:   orgBRepoPath,
			Copies: map[string]string{
				"simple-dashboard.json": "team-beta/dashboard2.json",
			},
			SkipSync: true, // We'll sync manually to verify success
		})
		t.Logf("✓ Created repository '%s' in OrgB (namespace: %s)", orgBRepoName, orgBHelper.namespace)
	})

	// Step 2: Sync both repositories and verify success
	t.Run("sync repositories and verify success", func(t *testing.T) {
		// Sync Org1 repository
		org1Helper.SyncAndWait(t, org1RepoName, nil)
		t.Logf("✓ Org1 repository synced successfully")

		// Verify Org1 has folders
		org1Folders := org1Helper.GetFolders(t)
		require.NotEmpty(t, org1Folders.Items, "Org1 should have folders after sync")
		t.Logf("✓ Org1 has %d folder(s) after sync", len(org1Folders.Items))

		// Sync OrgB repository
		orgBHelper.SyncAndWait(t, orgBRepoName, nil)
		t.Logf("✓ OrgB repository synced successfully")

		// Verify OrgB has folders
		orgBFolders := orgBHelper.GetFolders(t)
		require.NotEmpty(t, orgBFolders.Items, "OrgB should have folders after sync")
		t.Logf("✓ OrgB has %d folder(s) after sync", len(orgBFolders.Items))
	})

	// Step 3: Verify namespace isolation - each org can only see its own resources
	t.Run("verify cross-namespace isolation", func(t *testing.T) {
		// Verify Org1 resources
		org1Folders := org1Helper.GetFolders(t)
		require.Len(t, org1Folders.Items, 1, "Org1 should have exactly 1 folder")

		org1Folder := &org1Folders.Items[0]
		assert.Equal(t, org1Helper.namespace, org1Folder.GetNamespace(), "Org1 folder should be in Org1 namespace")

		// Check folder is managed by org1 repo
		meta, err := utils.MetaAccessor(org1Folder)
		require.NoError(t, err)
		manager, hasManager := meta.GetManagerProperties()
		require.True(t, hasManager, "Org1 folder should have manager")
		assert.Equal(t, org1RepoName, manager.Identity, "Org1 folder should be managed by org1 repository")

		t.Logf("✓ Org1 has 1 folder in namespace '%s' managed by '%s'", org1Folder.GetNamespace(), manager.Identity)

		// Verify OrgB resources
		orgBFolders := orgBHelper.GetFolders(t)
		require.Len(t, orgBFolders.Items, 1, "OrgB should have exactly 1 folder")

		orgBFolder := &orgBFolders.Items[0]
		assert.Equal(t, orgBHelper.namespace, orgBFolder.GetNamespace(), "OrgB folder should be in OrgB namespace")

		// Check folder is managed by orgB repo
		meta, err = utils.MetaAccessor(orgBFolder)
		require.NoError(t, err)
		manager, hasManager = meta.GetManagerProperties()
		require.True(t, hasManager, "OrgB folder should have manager")
		assert.Equal(t, orgBRepoName, manager.Identity, "OrgB folder should be managed by orgB repository")

		t.Logf("✓ OrgB has 1 folder in namespace '%s' managed by '%s'", orgBFolder.GetNamespace(), manager.Identity)

		// Verify namespaces are different
		assert.NotEqual(t, org1Folder.GetNamespace(), orgBFolder.GetNamespace(),
			"Org1 and OrgB folders should be in different namespaces")
	})

	// Step 4: Verify cross-namespace access is blocked
	t.Run("verify no cross-namespace visibility", func(t *testing.T) {
		ctx := context.Background()

		// Try to access OrgB repository from Org1 context - should fail
		org1ViewOfOrgBRepos := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: orgBHelper.namespace, // Try to access OrgB namespace
			GVR:       schema.GroupVersionResource{Group: "provisioning.grafana.app", Resource: "repositories", Version: "v0alpha1"},
		})

		_, err := org1ViewOfOrgBRepos.Resource.Get(ctx, orgBRepoName, metav1.GetOptions{})
		assert.Error(t, err, "Org1 user should not be able to access OrgB repository")
		t.Logf("✓ Org1 correctly denied access to OrgB namespace (error: %v)", err)

		// Try to access Org1 repository from OrgB context - should fail
		orgBViewOfOrg1Repos := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.OrgB.Admin,
			Namespace: org1Helper.namespace, // Try to access Org1 namespace
			GVR:       schema.GroupVersionResource{Group: "provisioning.grafana.app", Resource: "repositories", Version: "v0alpha1"},
		})

		_, err = orgBViewOfOrg1Repos.Resource.Get(ctx, org1RepoName, metav1.GetOptions{})
		assert.Error(t, err, "OrgB user should not be able to access Org1 repository")
		t.Logf("✓ OrgB correctly denied access to Org1 namespace (error: %v)", err)
	})

	// Step 5: Verify dashboards are also isolated
	t.Run("verify dashboard isolation", func(t *testing.T) {
		org1Dashboards := org1Helper.GetDashboards(t)
		orgBDashboards := orgBHelper.GetDashboards(t)

		// Both orgs should have dashboards from their syncs
		assert.NotEmpty(t, org1Dashboards.Items, "Org1 should have dashboards")
		assert.NotEmpty(t, orgBDashboards.Items, "OrgB should have dashboards")

		// Verify all Org1 dashboards are in Org1 namespace
		for i := range org1Dashboards.Items {
			dash := &org1Dashboards.Items[i]
			assert.Equal(t, org1Helper.namespace, dash.GetNamespace(),
				fmt.Sprintf("Org1 dashboard %s should be in Org1 namespace", dash.GetName()))
		}

		// Verify all OrgB dashboards are in OrgB namespace
		for i := range orgBDashboards.Items {
			dash := &orgBDashboards.Items[i]
			assert.Equal(t, orgBHelper.namespace, dash.GetNamespace(),
				fmt.Sprintf("OrgB dashboard %s should be in OrgB namespace", dash.GetName()))
		}

		t.Logf("✓ Org1 has %d dashboard(s) in namespace '%s'", len(org1Dashboards.Items), org1Helper.namespace)
		t.Logf("✓ OrgB has %d dashboard(s) in namespace '%s'", len(orgBDashboards.Items), orgBHelper.namespace)
	})

	// Step 6: Verify re-sync maintains isolation
	t.Run("verify re-sync maintains isolation", func(t *testing.T) {
		// Re-sync both repositories
		org1Helper.SyncAndWait(t, org1RepoName, nil)
		orgBHelper.SyncAndWait(t, orgBRepoName, nil)

		// Verify folder counts remain correct
		org1Folders := org1Helper.GetFolders(t)
		orgBFolders := orgBHelper.GetFolders(t)

		assert.Len(t, org1Folders.Items, 1, "Org1 should still have 1 folder after re-sync")
		assert.Len(t, orgBFolders.Items, 1, "OrgB should still have 1 folder after re-sync")

		t.Log("✓ Re-sync completed successfully without cross-namespace conflicts")
	})
}
