package orgs

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestCrossNamespaceIsolation_FolderSync verifies that repositories in different
// namespaces (organizations) are completely isolated from each other when using folder sync.
//
// This test:
// 1. Creates repositories with folder sync in TWO different organizations (orgA and orgB)
// 2. Syncs folders and dashboards to both repositories
// 3. Verifies that each organization can only see its own resources
// 4. Confirms cross-namespace isolation works correctly
func TestCrossNamespaceIsolation_FolderSync(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)

	// Create scoped helpers for each organization
	orgAHelper := helper.WithNamespace(helper.Namespacer(helper.Org1.OrgID), helper.Org1.Admin)
	orgBHelper := helper.WithNamespace(helper.Namespacer(helper.OrgB.OrgID), helper.OrgB.Admin)

	// Clean up resources after test
	defer orgAHelper.Cleanup(t)
	defer orgBHelper.Cleanup(t)

	const (
		orgARepoName = "orga-folder-repo"
		orgBRepoName = "orgb-folder-repo"
	)

	// Step 1: Create repositories in both organizations with folder sync
	t.Run("create repositories in different namespaces", func(t *testing.T) {
		// Create orgA repository with folder sync
		orgARepoPath := t.TempDir()
		orgAHelper.CreateLocalRepo(t, common.TestRepo{
			Name:       orgARepoName,
			SyncTarget: "folder",
			Path:       orgARepoPath,
			Copies: map[string]string{
				"simple-dashboard.json": "team-alpha/dashboard1.json",
			},
			SkipSync: true, // We'll sync manually to verify success
		})
		t.Logf("✓ Created repository '%s' in orgA (namespace: %s)", orgARepoName, orgAHelper.Namespace)

		// Create orgB repository with folder sync
		orgBRepoPath := t.TempDir()
		orgBHelper.CreateLocalRepo(t, common.TestRepo{
			Name:       orgBRepoName,
			SyncTarget: "folder",
			Path:       orgBRepoPath,
			Copies: map[string]string{
				"simple-dashboard.json": "team-beta/dashboard2.json",
			},
			SkipSync: true, // We'll sync manually to verify success
		})
		t.Logf("✓ Created repository '%s' in orgB (namespace: %s)", orgBRepoName, orgBHelper.Namespace)
	})

	// Step 2: Sync both repositories and verify success
	t.Run("sync repositories and verify success", func(t *testing.T) {
		// Sync orgA repository
		common.SyncAndWait(t, orgAHelper, common.Repo(orgARepoName), common.Succeeded())
		t.Logf("✓ orgA repository synced successfully")

		// Verify orgA has folders
		orgAFolders, err := orgAHelper.Folders.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		require.NotEmpty(t, orgAFolders.Items, "orgA should have folders after sync")
		t.Logf("✓ orgA has %d folder(s) after sync", len(orgAFolders.Items))

		// Sync orgB repository
		common.SyncAndWait(t, orgBHelper, common.Repo(orgBRepoName), common.Succeeded())
		t.Logf("✓ orgB repository synced successfully")

		// Verify orgB has folders
		orgBFolders, err := orgBHelper.Folders.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		require.NotEmpty(t, orgBFolders.Items, "orgB should have folders after sync")
		t.Logf("✓ orgB has %d folder(s) after sync", len(orgBFolders.Items))
	})

	// Step 3: Verify namespace isolation - each org can only see its own resources
	t.Run("verify cross-namespace isolation", func(t *testing.T) {
		// Verify orgA resources
		orgAFolders, err := orgAHelper.Folders.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, orgAFolders.Items, 1, "orgA should have exactly 1 folder")

		orgAFolder := &orgAFolders.Items[0]
		assert.Equal(t, orgAHelper.Namespace, orgAFolder.GetNamespace(), "orgA folder should be in orgA namespace")

		// Check folder is managed by orgA repo
		meta, err := utils.MetaAccessor(orgAFolder)
		require.NoError(t, err)
		manager, hasManager := meta.GetManagerProperties()
		require.True(t, hasManager, "orgA folder should have manager")
		assert.Equal(t, orgARepoName, manager.Identity, "orgA folder should be managed by orgA repository")

		t.Logf("✓ orgA has 1 folder in namespace '%s' managed by '%s'", orgAFolder.GetNamespace(), manager.Identity)

		// Verify orgB resources
		orgBFolders, err := orgBHelper.Folders.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, orgBFolders.Items, 1, "orgB should have exactly 1 folder")

		orgBFolder := &orgBFolders.Items[0]
		assert.Equal(t, orgBHelper.Namespace, orgBFolder.GetNamespace(), "orgB folder should be in orgB namespace")

		// Check folder is managed by orgB repo
		meta, err = utils.MetaAccessor(orgBFolder)
		require.NoError(t, err)
		manager, hasManager = meta.GetManagerProperties()
		require.True(t, hasManager, "orgB folder should have manager")
		assert.Equal(t, orgBRepoName, manager.Identity, "orgB folder should be managed by orgB repository")

		t.Logf("✓ orgB has 1 folder in namespace '%s' managed by '%s'", orgBFolder.GetNamespace(), manager.Identity)

		// Verify namespaces are different
		assert.NotEqual(t, orgAFolder.GetNamespace(), orgBFolder.GetNamespace(),
			"orgA and orgB folders should be in different namespaces")
	})

	// Step 4: Verify cross-namespace access is blocked
	t.Run("verify no cross-namespace visibility", func(t *testing.T) {
		ctx := context.Background()

		// Try to access orgB repository from orgA context - should fail
		orgAViewOfOrgBRepos := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: orgBHelper.Namespace, // Try to access orgB namespace
			GVR:       schema.GroupVersionResource{Group: "provisioning.grafana.app", Resource: "repositories", Version: "v0alpha1"},
		})

		_, err := orgAViewOfOrgBRepos.Resource.Get(ctx, orgBRepoName, metav1.GetOptions{})
		assert.Error(t, err, "orgA user should not be able to access orgB repository")
		t.Logf("✓ orgA correctly denied access to orgB namespace (error: %v)", err)

		// Try to access orgA repository from orgB context - should fail
		orgBViewOfOrgARepos := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.OrgB.Admin,
			Namespace: orgAHelper.Namespace, // Try to access orgA namespace
			GVR:       schema.GroupVersionResource{Group: "provisioning.grafana.app", Resource: "repositories", Version: "v0alpha1"},
		})

		_, err = orgBViewOfOrgARepos.Resource.Get(ctx, orgARepoName, metav1.GetOptions{})
		assert.Error(t, err, "orgB user should not be able to access orgA repository")
		t.Logf("✓ orgB correctly denied access to orgA namespace (error: %v)", err)
	})

	// Step 5: Verify dashboards are also isolated
	// NOTE: simple-dashboard.json has metadata.namespace: "wrong-namespace"
	// This test verifies that namespace is ignored and dashboards are created in repo namespace
	t.Run("verify dashboard isolation", func(t *testing.T) {
		orgADashboards, err := orgAHelper.DashboardsV2alpha1.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		orgBDashboards, err := orgBHelper.DashboardsV2alpha1.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)

		// Both orgs should have dashboards from their syncs
		assert.NotEmpty(t, orgADashboards.Items, "orgA should have dashboards")
		assert.NotEmpty(t, orgBDashboards.Items, "orgB should have dashboards")

		// Verify all orgA dashboards are in orgA namespace (not "wrong-namespace" from file)
		for i := range orgADashboards.Items {
			dash := &orgADashboards.Items[i]
			assert.Equal(t, orgAHelper.Namespace, dash.GetNamespace(),
				fmt.Sprintf("orgA dashboard %s should be in orgA namespace, not 'wrong-namespace' from file", dash.GetName()))
			assert.NotEqual(t, "wrong-namespace", dash.GetNamespace(),
				"Dashboard namespace from file should be ignored")
		}

		// Verify all orgB dashboards are in orgB namespace (not "wrong-namespace" from file)
		for i := range orgBDashboards.Items {
			dash := &orgBDashboards.Items[i]
			assert.Equal(t, orgBHelper.Namespace, dash.GetNamespace(),
				fmt.Sprintf("orgB dashboard %s should be in orgB namespace, not 'wrong-namespace' from file", dash.GetName()))
			assert.NotEqual(t, "wrong-namespace", dash.GetNamespace(),
				"Dashboard namespace from file should be ignored")
		}

		t.Logf("✓ orgA has %d dashboard(s) in namespace '%s' (namespace 'wrong-namespace' from file was ignored)",
			len(orgADashboards.Items), orgAHelper.Namespace)
		t.Logf("✓ orgB has %d dashboard(s) in namespace '%s' (namespace 'wrong-namespace' from file was ignored)",
			len(orgBDashboards.Items), orgBHelper.Namespace)
	})

	// Step 6: Verify re-sync maintains isolation
	t.Run("verify re-sync maintains isolation", func(t *testing.T) {
		// Re-sync both repositories
		common.SyncAndWait(t, orgAHelper, common.Repo(orgARepoName), common.Succeeded())
		common.SyncAndWait(t, orgBHelper, common.Repo(orgBRepoName), common.Succeeded())

		// Verify folder counts remain correct
		orgAFolders, err := orgAHelper.Folders.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		orgBFolders, err := orgBHelper.Folders.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)

		assert.Len(t, orgAFolders.Items, 1, "orgA should still have 1 folder after re-sync")
		assert.Len(t, orgBFolders.Items, 1, "orgB should still have 1 folder after re-sync")

		t.Log("✓ Re-sync completed successfully without cross-namespace conflicts")
	})

	// Step 7: Verify namespace in files is ignored (security boundary)
	t.Run("verify namespace in files is ignored", func(t *testing.T) {
		// Create a repository with a dashboard that explicitly specifies a different namespace
		repoPath := t.TempDir()

		// Create a dashboard YAML with wrong namespace
		dashboardYAML := fmt.Sprintf(`apiVersion: dashboard.grafana.app/v2beta1
kind: Dashboard
metadata:
  name: namespace-test-dashboard
  namespace: %s
spec:
  title: Dashboard with wrong namespace
  layout:
    kind: GridLayout
    spec:
      items: []
`, orgBHelper.Namespace) // Try to put it in orgB's namespace

		err := os.WriteFile(filepath.Join(repoPath, "test-folder", "dashboard.yaml"), []byte(dashboardYAML), 0644)
		require.NoError(t, err)

		// Create repo in orgA that syncs this dashboard
		const repoName = "namespace-override-test"
		orgAHelper.CreateLocalRepo(t, common.TestRepo{
			Name:       repoName,
			SyncTarget: "folder",
			Path:       repoPath,
			SkipSync:   true,
		})

		// Sync the repository
		common.SyncAndWait(t, orgAHelper, common.Repo(repoName), common.Succeeded())

		// Verify the dashboard was created in orgA's namespace, NOT orgB's
		dashboards, err := orgAHelper.DashboardsV2beta1.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)

		// Find our dashboard
		var testDashboard *unstructured.Unstructured
		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			if dash.GetName() == "namespace-test-dashboard" {
				testDashboard = dash
				break
			}
		}

		require.NotNil(t, testDashboard, "Dashboard should have been created")

		// CRITICAL: Dashboard should be in orgA's namespace, not orgB's
		assert.Equal(t, orgAHelper.Namespace, testDashboard.GetNamespace(),
			"Dashboard namespace should match repository namespace (orgA), not the namespace in the file (orgB)")
		assert.NotEqual(t, orgBHelper.Namespace, testDashboard.GetNamespace(),
			"Dashboard should NOT be in orgB namespace despite file specifying it")

		// Verify orgB cannot see this dashboard
		orgBDashboards, err := orgBHelper.DashboardsV2beta1.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		for i := range orgBDashboards.Items {
			dash := &orgBDashboards.Items[i]
			assert.NotEqual(t, "namespace-test-dashboard", dash.GetName(),
				"orgB should not have access to dashboard created in orgA")
		}

		t.Logf("✓ Namespace specified in file (%s) was correctly ignored, dashboard created in repo namespace (%s)",
			orgBHelper.Namespace, orgAHelper.Namespace)
	})

	// Step 8: Verify namespace in files endpoint is also ignored
	t.Run("verify namespace in files endpoint is ignored", func(t *testing.T) {
		// Create a repository for files endpoint testing
		repoPath := t.TempDir()
		const repoName = "files-endpoint-test"

		orgAHelper.CreateLocalRepo(t, common.TestRepo{
			Name:       repoName,
			SyncTarget: "folder",
			Workflows:  []string{"write"},
			Path:       repoPath,
			SkipSync:   true,
		})

		// Create a dashboard JSON that specifies orgB's namespace
		dashboardJSON := fmt.Sprintf(`{
  "apiVersion": "dashboard.grafana.app/v2beta1",
  "kind": "Dashboard",
  "metadata": {
    "name": "files-endpoint-dashboard",
    "namespace": "%s"
  },
  "spec": {
    "title": "Dashboard via files endpoint with wrong namespace",
    "layout": {
      "kind": "GridLayout",
      "spec": {
        "items": []
      }
    }
  }
}`, orgBHelper.Namespace)

		// Use the files endpoint to create the dashboard
		result := orgAHelper.AdminREST.Post().
			Namespace(orgAHelper.Namespace).
			Resource("repositories").
			Name(repoName).
			SubResource("files", "test-folder", "dashboard.json").
			Body([]byte(dashboardJSON)).
			SetHeader("Content-Type", "application/json").
			Do(context.Background())

		require.NoError(t, result.Error(), "files endpoint should accept the dashboard")

		// Trigger sync to persist the changes
		common.SyncAndWait(t, orgAHelper, common.Repo(repoName), common.Succeeded())

		// Verify the dashboard was created in orgA's namespace
		dashboards, err := orgAHelper.DashboardsV2beta1.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)

		var filesDashboard *unstructured.Unstructured
		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			if dash.GetName() == "files-endpoint-dashboard" {
				filesDashboard = dash
				break
			}
		}

		require.NotNil(t, filesDashboard, "Dashboard created via files endpoint should exist")

		// CRITICAL: Dashboard should be in orgA's namespace, not orgB's
		assert.Equal(t, orgAHelper.Namespace, filesDashboard.GetNamespace(),
			"Files endpoint should ignore namespace in JSON and use repository namespace (orgA)")
		assert.NotEqual(t, orgBHelper.Namespace, filesDashboard.GetNamespace(),
			"Dashboard should NOT be in orgB namespace despite JSON specifying it")

		// Verify orgB cannot see this dashboard
		orgBDashboards, err := orgBHelper.DashboardsV2beta1.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		for i := range orgBDashboards.Items {
			dash := &orgBDashboards.Items[i]
			assert.NotEqual(t, "files-endpoint-dashboard", dash.GetName(),
				"orgB should not have access to dashboard created via files endpoint in orgA")
		}

		t.Logf("✓ Files endpoint correctly ignored namespace (%s) in JSON, dashboard created in repo namespace (%s)",
			orgBHelper.Namespace, orgAHelper.Namespace)
	})
}
