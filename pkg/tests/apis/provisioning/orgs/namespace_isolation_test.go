package orgs

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	folder "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestCrossNamespaceIsolation_FolderSync verifies that repositories in different
// namespaces (organizations) are completely isolated from each other.
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
	ctx := context.Background()

	// Create resource clients for both organizations
	org1Repos := helper.K8sTestHelper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: helper.Namespacer(helper.Org1.OrgID),
		GVR:       provisioning.RepositoryResourceInfo.GroupVersionResource(),
	})

	orgBRepos := helper.K8sTestHelper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.OrgB.Admin,
		Namespace: helper.Namespacer(helper.OrgB.OrgID),
		GVR:       provisioning.RepositoryResourceInfo.GroupVersionResource(),
	})

	org1Folders := helper.K8sTestHelper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: helper.Namespacer(helper.Org1.OrgID),
		GVR:       folder.FolderResourceInfo.GroupVersionResource(),
	})

	orgBFolders := helper.K8sTestHelper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.OrgB.Admin,
		Namespace: helper.Namespacer(helper.OrgB.OrgID),
		GVR:       folder.FolderResourceInfo.GroupVersionResource(),
	})

	org1Dashboards := helper.K8sTestHelper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: helper.Namespacer(helper.Org1.OrgID),
		GVR:       schema.GroupVersionResource{Group: "dashboard.grafana.app", Resource: "dashboards", Version: "v1"},
	})

	orgBDashboards := helper.K8sTestHelper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.OrgB.Admin,
		Namespace: helper.Namespacer(helper.OrgB.OrgID),
		GVR:       schema.GroupVersionResource{Group: "dashboard.grafana.app", Resource: "dashboards", Version: "v1"},
	})

	const (
		org1RepoName = "org1-folder-repo"
		orgBRepoName = "orgb-folder-repo"
	)

	// Step 1: Create repositories in both organizations with folder sync
	t.Run("create repositories in different namespaces", func(t *testing.T) {
		// Create Org1 repository with folder sync
		org1RepoPath := t.TempDir()
		org1Repo := common.TestRepo{
			Name:            org1RepoName,
			Target:          "folder", // Folder sync
			Path:            org1RepoPath,
			SkipSync:        true,
			ExpectedFolders: 1, // Will have 1 folder after sync
		}

		templateVars := map[string]any{
			"Name":        org1Repo.Name,
			"SyncEnabled": false,
			"SyncTarget":  org1Repo.Target,
			"Path":        org1RepoPath,
		}
		org1RepoObj := helper.RenderObject(t, "../testdata/local-write.json.tmpl", templateVars)

		_, err := org1Repos.Resource.Create(ctx, org1RepoObj, metav1.CreateOptions{})
		require.NoError(t, err, "should create repository in Org1")
		t.Logf("✓ Created repository '%s' in Org1 (namespace: %s)", org1RepoName, helper.Namespacer(helper.Org1.OrgID))

		// Create OrgB repository with folder sync
		orgBRepoPath := t.TempDir()
		orgBRepo := common.TestRepo{
			Name:            orgBRepoName,
			Target:          "folder", // Folder sync
			Path:            orgBRepoPath,
			SkipSync:        true,
			ExpectedFolders: 1, // Will have 1 folder after sync
		}

		templateVars = map[string]any{
			"Name":        orgBRepo.Name,
			"SyncEnabled": false,
			"SyncTarget":  orgBRepo.Target,
			"Path":        orgBRepoPath,
		}
		orgBRepoObj := helper.RenderObject(t, "../testdata/local-write.json.tmpl", templateVars)

		_, err = orgBRepos.Resource.Create(ctx, orgBRepoObj, metav1.CreateOptions{})
		require.NoError(t, err, "should create repository in OrgB")
		t.Logf("✓ Created repository '%s' in OrgB (namespace: %s)", orgBRepoName, helper.Namespacer(helper.OrgB.OrgID))

		// Copy test files to both repositories
		copyToPath(t, helper, "simple-dashboard.json", org1RepoPath, "team-alpha/dashboard1.json")
		copyToPath(t, helper, "simple-dashboard.json", orgBRepoPath, "team-beta/dashboard2.json")

		t.Log("✓ Copied dashboard files to both repository paths")
	})

	// Step 2: Sync both repositories and verify success
	t.Run("sync repositories and verify success", func(t *testing.T) {
		// Sync Org1 repository
		org1RESTClient := helper.Org1.Admin.RESTClient(t, &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"})
		jobSpec := &provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		}

		result := org1RESTClient.Post().
			Namespace(helper.Namespacer(helper.Org1.OrgID)).
			Resource("repositories").
			Name(org1RepoName).
			SubResource("jobs").
			Body(common.AsJSON(jobSpec)).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "should trigger sync for Org1 repository")

		// Wait for Org1 sync to complete
		require.Eventually(t, func() bool {
			folders, err := org1Folders.Resource.List(ctx, metav1.ListOptions{})
			if err != nil {
				return false
			}
			return len(folders.Items) == 1
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "Org1 should have 1 folder after sync")

		t.Logf("✓ Org1 repository synced successfully (1 folder created)")

		// Sync OrgB repository
		orgBRESTClient := helper.OrgB.Admin.RESTClient(t, &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"})

		result = orgBRESTClient.Post().
			Namespace(helper.Namespacer(helper.OrgB.OrgID)).
			Resource("repositories").
			Name(orgBRepoName).
			SubResource("jobs").
			Body(common.AsJSON(jobSpec)).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "should trigger sync for OrgB repository")

		// Wait for OrgB sync to complete
		require.Eventually(t, func() bool {
			folders, err := orgBFolders.Resource.List(ctx, metav1.ListOptions{})
			if err != nil {
				return false
			}
			return len(folders.Items) == 1
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "OrgB should have 1 folder after sync")

		t.Logf("✓ OrgB repository synced successfully (1 folder created)")
	})

	// Step 3: Verify namespace isolation - each org can only see its own resources
	t.Run("verify cross-namespace isolation", func(t *testing.T) {
		// Verify Org1 resources
		org1FolderList, err := org1Folders.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "should list Org1 folders")
		require.Len(t, org1FolderList.Items, 1, "Org1 should have exactly 1 folder")

		org1Folder := &org1FolderList.Items[0]
		assert.Equal(t, helper.Namespacer(helper.Org1.OrgID), org1Folder.GetNamespace(), "Org1 folder should be in Org1 namespace")

		// Check folder is managed by org1 repo
		meta, err := utils.MetaAccessor(org1Folder)
		require.NoError(t, err)
		manager, hasManager := meta.GetManagerProperties()
		require.True(t, hasManager, "Org1 folder should have manager")
		assert.Equal(t, org1RepoName, manager.Identity, "Org1 folder should be managed by org1 repository")

		t.Logf("✓ Org1 has 1 folder in namespace '%s' managed by '%s'", org1Folder.GetNamespace(), manager.Identity)

		// Verify OrgB resources
		orgBFolderList, err := orgBFolders.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "should list OrgB folders")
		require.Len(t, orgBFolderList.Items, 1, "OrgB should have exactly 1 folder")

		orgBFolder := &orgBFolderList.Items[0]
		assert.Equal(t, helper.Namespacer(helper.OrgB.OrgID), orgBFolder.GetNamespace(), "OrgB folder should be in OrgB namespace")

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
		// Try to access OrgB repository from Org1 context - should fail or return empty
		org1ViewOfOrgBRepos := helper.K8sTestHelper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.OrgB.OrgID), // Try to access OrgB namespace
			GVR:       provisioning.RepositoryResourceInfo.GroupVersionResource(),
		})

		_, err := org1ViewOfOrgBRepos.Resource.Get(ctx, orgBRepoName, metav1.GetOptions{})
		assert.Error(t, err, "Org1 user should not be able to access OrgB repository")
		t.Logf("✓ Org1 correctly denied access to OrgB namespace (error: %v)", err)

		// Try to access Org1 repository from OrgB context - should fail or return empty
		orgBViewOfOrg1Repos := helper.K8sTestHelper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.OrgB.Admin,
			Namespace: helper.Namespacer(helper.Org1.OrgID), // Try to access Org1 namespace
			GVR:       provisioning.RepositoryResourceInfo.GroupVersionResource(),
		})

		_, err = orgBViewOfOrg1Repos.Resource.Get(ctx, org1RepoName, metav1.GetOptions{})
		assert.Error(t, err, "OrgB user should not be able to access Org1 repository")
		t.Logf("✓ OrgB correctly denied access to Org1 namespace (error: %v)", err)
	})

	// Step 5: Verify dashboards are also isolated
	t.Run("verify dashboard isolation", func(t *testing.T) {
		org1DashList, err := org1Dashboards.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "should list Org1 dashboards")
		org1DashItems := org1DashList.Items

		orgBDashList, err := orgBDashboards.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "should list OrgB dashboards")
		orgBDashItems := orgBDashList.Items

		// Both orgs should have dashboards from their syncs
		assert.NotEmpty(t, org1DashItems, "Org1 should have dashboards")
		assert.NotEmpty(t, orgBDashItems, "OrgB should have dashboards")

		// Verify all Org1 dashboards are in Org1 namespace
		for i := range org1DashItems {
			dash := &org1DashItems[i]
			assert.Equal(t, helper.Namespacer(helper.Org1.OrgID), dash.GetNamespace(),
				fmt.Sprintf("Org1 dashboard %s should be in Org1 namespace", dash.GetName()))
		}

		// Verify all OrgB dashboards are in OrgB namespace
		for i := range orgBDashItems {
			dash := &orgBDashItems[i]
			assert.Equal(t, helper.Namespacer(helper.OrgB.OrgID), dash.GetNamespace(),
				fmt.Sprintf("OrgB dashboard %s should be in OrgB namespace", dash.GetName()))
		}

		t.Logf("✓ Org1 has %d dashboard(s) in namespace '%s'", len(org1DashItems), helper.Namespacer(helper.Org1.OrgID))
		t.Logf("✓ OrgB has %d dashboard(s) in namespace '%s'", len(orgBDashItems), helper.Namespacer(helper.OrgB.OrgID))
	})

	// Step 6: Verify re-sync maintains isolation
	t.Run("verify re-sync maintains isolation", func(t *testing.T) {
		// Re-sync both repositories
		org1RESTClient := helper.Org1.Admin.RESTClient(t, &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"})
		jobSpec := &provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		}

		result := org1RESTClient.Post().
			Namespace(helper.Namespacer(helper.Org1.OrgID)).
			Resource("repositories").
			Name(org1RepoName).
			SubResource("jobs").
			Body(common.AsJSON(jobSpec)).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "should re-sync Org1 repository")

		orgBRESTClient := helper.OrgB.Admin.RESTClient(t, &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"})
		result = orgBRESTClient.Post().
			Namespace(helper.Namespacer(helper.OrgB.OrgID)).
			Resource("repositories").
			Name(orgBRepoName).
			SubResource("jobs").
			Body(common.AsJSON(jobSpec)).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "should re-sync OrgB repository")

		// Wait briefly for re-sync
		require.Eventually(t, func() bool {
			list1, err1 := org1Folders.Resource.List(ctx, metav1.ListOptions{})
			listB, err2 := orgBFolders.Resource.List(ctx, metav1.ListOptions{})
			if err1 != nil || err2 != nil {
				return false
			}
			return len(list1.Items) == 1 && len(listB.Items) == 1
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "both orgs should maintain their folder count")

		t.Log("✓ Re-sync completed successfully without cross-namespace conflicts")
	})
}
