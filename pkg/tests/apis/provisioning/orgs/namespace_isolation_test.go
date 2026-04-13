package orgs

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestNamespaceIsolation verifies that resources from different repositories
// are correctly created with proper namespace/org context.
//
// This test covers the bug fix where f.Obj.GetNamespace() was incorrectly used
// instead of f.Repo.Namespace, causing resources to be created in the wrong namespace.
func TestNamespaceIsolation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)
	ctx := context.Background()

	const (
		repo1Name = "repo-namespace-test1"
		repo2Name = "repo-namespace-test2"
	)

	// Create two repositories
	t.Run("setup repositories", func(t *testing.T) {
		helper.CreateRepo(t, common.TestRepo{
			Name:     repo1Name,
			Target:   "instance",
			SkipSync: true,
			Copies: map[string]string{
				"simple-dashboard.json": "dashboard1.json",
			},
		})

		helper.CreateRepo(t, common.TestRepo{
			Name:     repo2Name,
			Target:   "instance",
			SkipSync: true,
			Copies: map[string]string{
				"simple-dashboard.json": "dashboard2.json",
			},
		})
	})

	// Sync both repositories
	t.Run("sync repositories", func(t *testing.T) {
		helper.SyncAndWait(t, repo1Name, nil)
		helper.SyncAndWait(t, repo2Name, nil)
	})

	// Verify resources have correct manager annotations and namespace
	t.Run("verify proper namespace and ownership", func(t *testing.T) {
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "should list dashboards")

		var dash1Found, dash2Found bool

		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			meta, err := utils.MetaAccessor(dash)
			require.NoError(t, err)

			manager, hasManager := meta.GetManagerProperties()
			if !hasManager {
				continue
			}

			switch manager.Identity {
			case repo1Name:
				dash1Found = true
				assert.Equal(t, string(utils.ManagerKindRepo), string(manager.Kind),
					"dashboard from repo1 should be managed by a repo")
				assert.NotEmpty(t, dash.GetNamespace(),
					"dashboard should have a namespace")
				t.Logf("✓ Dashboard from repo '%s' created in namespace '%s'",
					repo1Name, dash.GetNamespace())

			case repo2Name:
				dash2Found = true
				assert.Equal(t, string(utils.ManagerKindRepo), string(manager.Kind),
					"dashboard from repo2 should be managed by a repo")
				assert.NotEmpty(t, dash.GetNamespace(),
					"dashboard should have a namespace")
				t.Logf("✓ Dashboard from repo '%s' created in namespace '%s'",
					repo2Name, dash.GetNamespace())
			}
		}

		require.True(t, dash1Found, "should find dashboard from repo1")
		require.True(t, dash2Found, "should find dashboard from repo2")
	})

	// Verify no ownership conflicts
	t.Run("verify no ownership conflicts", func(t *testing.T) {
		// Sync again to ensure no ownership conflicts occur
		helper.SyncAndWait(t, repo1Name, nil)
		helper.SyncAndWait(t, repo2Name, nil)

		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		// Count dashboards by manager
		managerCounts := make(map[string]int)
		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			meta, err := utils.MetaAccessor(dash)
			require.NoError(t, err)

			if manager, hasManager := meta.GetManagerProperties(); hasManager {
				managerCounts[manager.Identity]++
			}
		}

		// Each repo should still have exactly one dashboard
		assert.Equal(t, 1, managerCounts[repo1Name],
			"repo1 should manage exactly one dashboard")
		assert.Equal(t, 1, managerCounts[repo2Name],
			"repo2 should manage exactly one dashboard")

		t.Log("✓ No ownership conflicts detected after re-sync")
	})
}

// TestRepositoryNamespaceMetadata verifies that ParsedResource uses f.Repo.Namespace
// instead of f.Obj.GetNamespace() when setting the identity context.
//
// This is a regression test for the bug where resources were created in the wrong namespace.
func TestRepositoryNamespaceMetadata(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)
	ctx := context.Background()

	const repoName = "repo-namespace-metadata"

	t.Run("create and sync repository", func(t *testing.T) {
		helper.CreateRepo(t, common.TestRepo{
			Name:   repoName,
			Target: "instance",
			Copies: map[string]string{
				"simple-dashboard.json": "test-dashboard.json",
			},
		})

		helper.SyncAndWait(t, repoName, nil)
	})

	t.Run("verify dashboard has correct repository metadata", func(t *testing.T) {
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		var foundDashboard bool
		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			meta, err := utils.MetaAccessor(dash)
			require.NoError(t, err)

			manager, hasManager := meta.GetManagerProperties()
			if !hasManager {
				continue
			}

			if manager.Identity == repoName {
				foundDashboard = true

				// Verify manager annotations
				assert.Equal(t, string(utils.ManagerKindRepo), string(manager.Kind),
					"should be managed by a repo")
				assert.Equal(t, repoName, manager.Identity,
					"should be managed by the correct repo")

				// Verify namespace is set
				assert.NotEmpty(t, dash.GetNamespace(),
					"dashboard should have a namespace set")

				// Log success
				t.Logf("✓ Dashboard correctly managed by repo '%s' in namespace '%s'",
					repoName, dash.GetNamespace())

				// Additional validation: the namespace should match what the test helper expects
				expectedNamespace := helper.Namespacer(helper.Org1.Viewer.Identity.GetOrgID())
				assert.Equal(t, expectedNamespace, dash.GetNamespace(),
					"dashboard namespace should match org1 namespace")

				break
			}
		}

		require.True(t, foundDashboard, "should find the synced dashboard")
	})

	t.Run("verify update preserves namespace", func(t *testing.T) {
		// Trigger another sync
		helper.SyncAndWait(t, repoName, nil)

		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		var foundDashboard bool
		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			meta, err := utils.MetaAccessor(dash)
			require.NoError(t, err)

			manager, hasManager := meta.GetManagerProperties()
			if !hasManager {
				continue
			}

			if manager.Identity == repoName {
				foundDashboard = true

				// Namespace should still be set correctly after update
				expectedNamespace := helper.Namespacer(helper.Org1.Viewer.Identity.GetOrgID())
				assert.Equal(t, expectedNamespace, dash.GetNamespace(),
					"dashboard namespace should remain consistent after update")

				t.Logf("✓ Dashboard namespace preserved after update: '%s'", dash.GetNamespace())
				break
			}
		}

		require.True(t, foundDashboard, "should still find the dashboard after re-sync")
	})
}

// TestResourceIdentityFromRepository verifies that the provisioning identity
// is derived from the repository's namespace, not the resource object's namespace.
//
// Before the fix:
// - identity.WithProvisioningIdentity(ctx, f.Obj.GetNamespace())  // WRONG - object namespace often empty
//
// After the fix:
// - identity.WithProvisioningIdentity(ctx, f.Repo.Namespace)       // CORRECT - repo namespace always set
func TestResourceIdentityFromRepository(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)
	ctx := context.Background()

	const repoName = "repo-identity-test"

	t.Run("create repository and sync resources", func(t *testing.T) {
		helper.CreateRepo(t, common.TestRepo{
			Name:   repoName,
			Target: "instance",
			Copies: map[string]string{
				"simple-dashboard.json": "identity-test.json",
			},
		})

		helper.SyncAndWait(t, repoName, nil)
	})

	t.Run("verify resource identity matches repository namespace", func(t *testing.T) {
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		var testDashboard *unstructured.Unstructured
		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			meta, err := utils.MetaAccessor(dash)
			require.NoError(t, err)

			if manager, hasManager := meta.GetManagerProperties(); hasManager {
				if manager.Identity == repoName {
					testDashboard = dash
					break
				}
			}
		}

		require.NotNil(t, testDashboard, "should find test dashboard")

		// The key assertion: the dashboard's namespace should be set
		// (proving f.Repo.Namespace was used, not f.Obj.GetNamespace())
		dashNamespace := testDashboard.GetNamespace()
		require.NotEmpty(t, dashNamespace,
			"dashboard namespace should be set (this would fail if f.Obj.GetNamespace() was used)")

		expectedNamespace := helper.Namespacer(helper.Org1.Viewer.Identity.GetOrgID())
		assert.Equal(t, expectedNamespace, dashNamespace,
			fmt.Sprintf("dashboard should be in org1 namespace (expected: %s, got: %s)",
				expectedNamespace, dashNamespace))

		t.Logf("✓ Resource identity correctly derived from repository namespace: '%s'", dashNamespace)
	})
}
