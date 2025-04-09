package integration

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"

	dashboardv1alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	folderv0alpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards" // TODO: Check if we can remove this import
	"github.com/grafana/grafana/pkg/services/quota"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// TestContext holds common test resources
type TestContext struct {
	Helper                    *apis.K8sTestHelper
	DualWriterMode            rest.DualWriterMode
	AdminUser                 apis.User
	EditorUser                apis.User
	ViewerUser                apis.User
	TestFolder                *folder.Folder
	AdminServiceAccountToken  string
	EditorServiceAccountToken string
	ViewerServiceAccountToken string
	OrgID                     int64
}

// TestIntegrationValidation tests the dashboard K8s API
func TestIntegrationValidation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test2")
	}

	// TODO: Skip mode3 - borken due to race conditions while setting default permissions across storage backends
	dualWriterModes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode4, rest.Mode5}
	for _, dualWriterMode := range dualWriterModes {
		t.Run(fmt.Sprintf("DualWriterMode %d", dualWriterMode), func(t *testing.T) {
			// Create a K8sTestHelper which will set up a real API server
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableAnonymous: true,
				EnableFeatureToggles: []string{
					featuremgmt.FlagKubernetesClientDashboardsFolders, // Enable dashboard feature
					featuremgmt.FlagUnifiedStorageSearch,
				},
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"dashboards.dashboard.grafana.app": {
						DualWriterMode: dualWriterMode,
					},
				}})

			testIntegrationValidationForServer(t, helper, dualWriterMode)
		})
	}
}

func testIntegrationValidationForServer(t *testing.T, helper *apis.K8sTestHelper, dualWriterMode rest.DualWriterMode) {
	t.Cleanup(func() {
		helper.Shutdown()
	})

	// Create test contexts organization
	org1Ctx := createTestContext(t, helper, helper.Org1, dualWriterMode)

	t.Run("Organization 1 tests", func(t *testing.T) {
		t.Run("Dashboard validation tests", func(t *testing.T) {
			runDashboardValidationTests(t, org1Ctx)
		})

		t.Run("Dashboard quota tests", func(t *testing.T) {
			runQuotaTests(t, org1Ctx)
		})
	})
}

// Auth identity types (user or token) with resource client
type Identity struct {
	Name            string
	DashboardClient *apis.K8sResourceClient
	FolderClient    *apis.K8sResourceClient
	Type            string // "user" or "token"
}

// TODO: Test plugin dashboard updates with and without overwrite flag

// Run tests for dashboard validations
func runDashboardValidationTests(t *testing.T, ctx TestContext) {
	t.Helper()

	adminClient := getResourceClient(t, ctx.Helper, ctx.AdminUser, getDashboardGVR())
	editorClient := getResourceClient(t, ctx.Helper, ctx.EditorUser, getDashboardGVR())

	t.Run("Dashboard UID validations", func(t *testing.T) {
		// Test creating dashboard with existing UID
		t.Run("reject dashboard with existing UID", func(t *testing.T) {
			// Create a dashboard with a specific UID
			specificUID := "existing-uid-dash"
			createdDash, err := createDashboard(t, adminClient, "Dashboard with Specific UID", nil, &specificUID)
			require.NoError(t, err)

			// Try to create another dashboard with the same UID
			_, err = createDashboard(t, adminClient, "Another Dashboard with Same UID", nil, &specificUID)
			require.Error(t, err)

			// Clean up
			err = adminClient.Resource.Delete(context.Background(), createdDash.GetName(), v1.DeleteOptions{})
			require.NoError(t, err)
		})

		// Test creating dashboard with too long UID
		t.Run("reject dashboard with too long UID", func(t *testing.T) {
			// Create a dashboard with a long UID (over 40 chars)
			longUID := "this-uid-is-way-too-long-for-a-dashboard-uid-12345678901234567890"
			_, err := createDashboard(t, adminClient, "Dashboard with Long UID", nil, &longUID)
			require.Error(t, err)
		})

		// Test creating dashboard with invalid UID characters
		t.Run("reject dashboard with invalid UID characters", func(t *testing.T) {
			invalidUID := "invalid/uid/with/slashes"
			_, err := createDashboard(t, adminClient, "Dashboard with Invalid UID", nil, &invalidUID)
			require.Error(t, err)
		})
	})

	// TODO: Validate both at creation and update
	t.Run("Dashboard title validations", func(t *testing.T) {
		// Test empty title
		t.Run("reject dashboard with empty title", func(t *testing.T) {
			_, err := createDashboard(t, adminClient, "", nil, nil)
			require.Error(t, err)
		})

		// Test long title
		t.Run("reject dashboard with excessively long title", func(t *testing.T) {
			veryLongTitle := strings.Repeat("a", 10000)
			_, err := createDashboard(t, adminClient, veryLongTitle, nil, nil)
			require.Error(t, err)
		})

		// Test updating dashboard with empty title
		t.Run("reject dashboard update with empty title", func(t *testing.T) {
			// First create a valid dashboard
			dash, err := createDashboard(t, adminClient, "Valid Dashboard Title", nil, nil)
			require.NoError(t, err)
			require.NotNil(t, dash)

			// Try to update with empty title
			_, err = updateDashboard(t, adminClient, dash, "", nil)
			require.Error(t, err)

			// Clean up
			err = adminClient.Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
			require.NoError(t, err)
		})

		// Test updating dashboard with excessively long title
		t.Run("reject dashboard update with excessively long title", func(t *testing.T) {
			// First create a valid dashboard
			dash, err := createDashboard(t, adminClient, "Valid Dashboard Title", nil, nil)
			require.NoError(t, err)
			require.NotNil(t, dash)

			// Try to update with excessively long title
			veryLongTitle := strings.Repeat("a", 10000)
			_, err = updateDashboard(t, adminClient, dash, veryLongTitle, nil)
			require.Error(t, err)

			// Clean up
			err = adminClient.Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
			require.NoError(t, err)
		})
	})

	t.Run("Dashboard message validations", func(t *testing.T) {
		// Test long message
		t.Run("reject dashboard with excessively long update message", func(t *testing.T) {
			dash, err := createDashboard(t, adminClient, "Regular dashboard", nil, nil)
			require.NoError(t, err)

			veryLongMessage := strings.Repeat("a", 600)
			_, err = updateDashboard(t, adminClient, dash, "Dashboard updated with a long message", &veryLongMessage)
			require.Error(t, err)

			// Clean up
			err = adminClient.Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
			require.NoError(t, err)
		})
	})

	t.Run("Dashboard folder validations", func(t *testing.T) {
		// Test non-existent folder UID
		t.Run("reject dashboard with non-existent folder UID", func(t *testing.T) {
			nonExistentFolderUID := "non-existent-folder-uid"
			_, err := createDashboard(t, adminClient, "Dashboard in Non-existent Folder", &nonExistentFolderUID, nil)
			ctx.Helper.EnsureStatusError(err, http.StatusNotFound, "folder not found")
		})
	})

	t.Run("Dashboard schema validations", func(t *testing.T) {
		// Test invalid dashboard schema
		t.Run("reject dashboard with invalid schema", func(t *testing.T) {
			dashObj := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": dashboardv1alpha1.DashboardResourceInfo.GroupVersion().String(),
					"kind":       dashboardv1alpha1.DashboardResourceInfo.GroupVersionKind().Kind,
					"metadata": map[string]interface{}{
						"generateName": "test-",
					},
					// Missing spec
				},
			}

			_, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.Error(t, err)
		})
	})

	t.Run("Dashboard version handling", func(t *testing.T) {
		// Test version increment on update
		t.Run("version increments on dashboard update", func(t *testing.T) {
			// Create a dashboard with admin
			dash, err := createDashboard(t, adminClient, "Dashboard for Version Test", nil, nil)
			require.NoError(t, err, "Failed to create dashboard for version test")
			dashUID := dash.GetName()

			// Get the initial version
			meta, _ := utils.MetaAccessor(dash)
			initialGeneration := meta.GetGeneration()
			initialRV := meta.GetResourceVersion()

			// Update the dashboard
			updatedDash, err := updateDashboard(t, adminClient, dash, "Updated Dashboard for Version Test", nil)
			require.NoError(t, err)
			require.NotNil(t, updatedDash)

			// Check that version was incremented
			meta, _ = utils.MetaAccessor(updatedDash)
			require.Greater(t, meta.GetGeneration(), initialGeneration, "Generation should be incremented after update")
			require.NotEqual(t, meta.GetResourceVersion(), initialRV, "Resource version should be changed after update")

			// Clean up
			err = adminClient.Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
			require.NoError(t, err)
		})

		// Test generation conflict when updating concurrently
		t.Run("reject update with version conflict", func(t *testing.T) {
			// Create a dashboard with admin
			dash, err := createDashboard(t, adminClient, "Dashboard for Version Conflict Test", nil, nil)
			require.NoError(t, err, "Failed to create dashboard for version conflict test")
			dashUID := dash.GetName()

			// Get the dashboard twice (simulating two users getting it)
			dash1, err := adminClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
			require.NoError(t, err)
			dash2, err := editorClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
			require.NoError(t, err)

			// Update with the first copy
			updatedDash1, err := updateDashboard(t, adminClient, dash1, "Updated by first user", nil)
			require.NoError(t, err)
			require.NotNil(t, updatedDash1)

			// Try to update with the second copy (should fail with version conflict for mode 0, 4 and 5, but not for mode 1, 2 and 3)
			updatedDash2, err := updateDashboard(t, editorClient, dash2, "Updated by second user", nil)
			if ctx.DualWriterMode == rest.Mode1 || ctx.DualWriterMode == rest.Mode2 || ctx.DualWriterMode == rest.Mode3 {
				require.NoError(t, err)
				require.NotNil(t, updatedDash2)
				meta, _ := utils.MetaAccessor(updatedDash2)
				require.Equal(t, "Updated by second user", meta.FindTitle(""), "Dashboard title should be updated")
			} else {
				require.Error(t, err)
				require.Contains(t, err.Error(), "the object has been modified", "Should fail with version conflict error")
			}

			// Clean up
			err = adminClient.Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
			require.NoError(t, err)
		})

		// Test setting an explicit generation
		t.Run("explicit generation setting is validated", func(t *testing.T) {
			t.Skip("Double check expected behavior")
			// Create a dashboard with a specific generation
			dashObj := createDashboardObject(t, "Dashboard with Explicit Generation", "", 0)
			meta, _ := utils.MetaAccessor(dashObj)
			meta.SetGeneration(5)

			// Create the dashboard
			createdDash, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.NoError(t, err)
			dashUID := createdDash.GetName()

			// Fetch the created dashboard
			fetchedDash, err := adminClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
			require.NoError(t, err)

			// Verify the generation was handled properly
			meta, _ = utils.MetaAccessor(fetchedDash)
			require.Equal(t, 5, meta.GetGeneration(), "Generation should be 5")

			// Clean up
			err = adminClient.Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
			require.NoError(t, err)
		})
	})

	t.Run("Dashboard provisioning validations", func(t *testing.T) {
		t.Skip("TODO: We need to create provisioned dashboards in two different ways to test this")
		// Test updating provisioned dashboard
		testCases := []struct {
			name          string
			allowsEdits   bool
			shouldSucceed bool
		}{
			{
				name:          "reject updating provisioned dashboard when allowsEdits is false",
				allowsEdits:   false,
				shouldSucceed: false,
			},
			{
				name:          "allow updating provisioned dashboard when allowsEdits is true",
				allowsEdits:   true,
				shouldSucceed: true,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				// Create a dashboard with admin
				dash, err := createDashboard(t, adminClient, "Dashboard for Provisioning Test", nil, nil)
				require.NoError(t, err, "Failed to create dashboard for provisioning test")
				dashUID := dash.GetName()

				// Fetch the created dashboard
				fetchedDash, err := adminClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
				require.NoError(t, err)
				require.NotNil(t, fetchedDash)

				// Mark the dashboard as provisioned with allowsEdits parameter
				provisionedDash := markDashboardObjectAsProvisioned(t, fetchedDash, "test-provider", "test-external-id", "test-checksum", tc.allowsEdits)

				// Update the dashboard to apply the provisioning annotations
				updatedDash, err := adminClient.Resource.Update(context.Background(), provisionedDash, v1.UpdateOptions{})
				require.NoError(t, err)
				require.NotNil(t, updatedDash)

				// Re-fetch the dashboard after it's marked as provisioned
				provisionedFetchedDash, err := editorClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
				require.NoError(t, err)
				require.NotNil(t, provisionedFetchedDash)

				// Try to update the dashboard using editor (not admin)
				dashThatShouldFail, err := updateDashboard(t, editorClient, provisionedFetchedDash, "Updated Provisioned Dashboard", nil)
				_ = dashThatShouldFail

				if tc.shouldSucceed {
					require.NoError(t, err, "Editor should be able to update provisioned dashboard when allowsEdits is true")

					// Verify the update succeeded by fetching the dashboard again
					updatedDash, err := editorClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
					require.NoError(t, err)
					meta, _ := utils.MetaAccessor(updatedDash)
					require.Equal(t, "Updated Provisioned Dashboard", meta.FindTitle(""), "Dashboard title should be updated")
				} else {
					require.Error(t, err, "Editor should not be able to update provisioned dashboard when allowsEdits is false")
					require.Contains(t, err.Error(), "provisioned")
				}

				// Clean up
				err = adminClient.Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
				require.NoError(t, err)
			})
		}
	})

	t.Run("Dashboard refresh interval validations", func(t *testing.T) {
		// Create test client
		adminClient := getResourceClient(t, ctx.Helper, ctx.AdminUser, getDashboardGVR())

		// Store original settings to restore after test
		origCfg := ctx.Helper.GetEnv().Cfg
		origMinRefreshInterval := origCfg.MinRefreshInterval

		// Set a fixed min_refresh_interval for all tests to make them predictable
		ctx.Helper.GetEnv().Cfg.MinRefreshInterval = "10s"

		testCases := []struct {
			name          string
			refreshValue  string
			shouldSucceed bool
		}{
			{
				name:          "reject dashboard with refresh interval below minimum",
				refreshValue:  "5s",
				shouldSucceed: false,
			},
			{
				name:          "accept dashboard with refresh interval equal to minimum",
				refreshValue:  "10s",
				shouldSucceed: true,
			},
			{
				name:          "accept dashboard with refresh interval above minimum",
				refreshValue:  "30s",
				shouldSucceed: true,
			},
			{
				name:          "accept dashboard with auto refresh",
				refreshValue:  "auto",
				shouldSucceed: true,
			},
			{
				name:          "accept dashboard with empty refresh",
				refreshValue:  "",
				shouldSucceed: true,
			},
			{
				name:          "reject dashboard with invalid refresh format",
				refreshValue:  "invalid",
				shouldSucceed: false,
			},
		}

		for _, tc := range testCases {
			tc := tc // Capture for parallel execution
			t.Run(tc.name, func(t *testing.T) {
				// Create the dashboard with the specified refresh value
				dashObj := createDashboardObject(t, "Dashboard with Refresh: "+tc.refreshValue, "", 0)

				// Add refresh configuration using MetaAccessor
				meta, _ := utils.MetaAccessor(dashObj)
				spec, _ := meta.GetSpec()
				specMap := spec.(map[string]interface{})

				specMap["refresh"] = tc.refreshValue

				_ = meta.SetSpec(specMap)

				dash, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})

				if tc.shouldSucceed {
					require.NoError(t, err)
					require.NotNil(t, dash)

					// Clean up
					err = adminClient.Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
					require.NoError(t, err)
				} else {
					require.Error(t, err)
				}
			})
		}

		// Restore original settings
		ctx.Helper.GetEnv().Cfg.MinRefreshInterval = origMinRefreshInterval
	})

	t.Run("Dashboard size limit validations", func(t *testing.T) {
		t.Run("reject dashboard exceeding size limit", func(t *testing.T) {
			t.Skip("Skipping size limit test for now") // TODO: Revisit this.

			// Create a dashboard with a specific UID to make it easier to manage
			specificUID := "size-limit-test-dash"
			dash, err := createDashboard(t, adminClient, "Dashboard Exceeding Size Limit", nil, &specificUID)
			require.NoError(t, err)

			meta, _ := utils.MetaAccessor(dash)
			spec, _ := meta.GetSpec()
			specMap := spec.(map[string]interface{})

			// Create a large number of panels
			var largePanelArray []map[string]interface{}

			// Create 500000 simple panels with unique IDs (to exceed max allowed request size)
			for i := 0; i < 500000; i++ {
				// Create a simple panel with minimal properties
				panel := map[string]interface{}{
					"id":          i,
					"type":        "graph",
					"title":       fmt.Sprintf("Panel %d", i),
					"description": fmt.Sprintf("Panel description %d", i),
					"gridPos": map[string]interface{}{
						"h": 8,
						"w": 12,
						"x": i % 24,
						"y": (i / 24) * 8,
					},
					"targets": []map[string]interface{}{
						{
							"refId": "A",
							"expr":  fmt.Sprintf("metric%d", i),
						},
					},
				}
				largePanelArray = append(largePanelArray, panel)
			}

			specMap["panels"] = largePanelArray

			err = meta.SetSpec(specMap)
			require.NoError(t, err, "Failed to set spec")

			// Try to update with too many panels
			_, err = adminClient.Resource.Update(context.Background(), dash, v1.UpdateOptions{})
			require.Error(t, err)
			require.Contains(t, err.Error(), "exceeds", "Error should mention size or limit exceeded")

			// Clean up
			err = adminClient.Resource.Delete(context.Background(), specificUID, v1.DeleteOptions{})
			require.NoError(t, err)
		})
	})
}

// skipIfMode skips the current test if running in any of the specified modes
// Usage: skipIfMode(t, rest.Mode1, rest.Mode4)
// or with a message: skipIfMode(t, "Known issue with conflict detection", rest.Mode1, rest.Mode4)
// nolint:unused
func (c *TestContext) skipIfMode(t *testing.T, args ...interface{}) {
	t.Helper()

	message := "Test not supported in this dual writer mode"
	modes := []rest.DualWriterMode{}

	// Parse args - first string is considered a message, all rest.DualWriterMode values are modes to skip
	for _, arg := range args {
		if msg, ok := arg.(string); ok {
			message = msg
		} else if mode, ok := arg.(rest.DualWriterMode); ok {
			modes = append(modes, mode)
		}
	}

	// Check if current mode is in the list of modes to skip
	for _, mode := range modes {
		if c.DualWriterMode == mode {
			t.Skipf("%s (mode %d)", message, c.DualWriterMode)
		}
	}
}

// Run tests for quota validation
func runQuotaTests(t *testing.T, ctx TestContext) {
	t.Helper()
	t.Skip("Skipping quota tests for now")
	// TODO: Check why we return quota.disabled and also make sure we are able to handle it.

	// Get access to services - use the helper environment's HTTP server
	quotaService := ctx.Helper.GetEnv().Server.HTTPServer.QuotaService
	require.NotNil(t, quotaService, "Quota service should be available")

	adminClient := getResourceClient(t, ctx.Helper, ctx.AdminUser, getDashboardGVR())
	adminUserId, err := identity.UserIdentifier(ctx.AdminUser.Identity.GetID())
	require.NoError(t, err)

	// Define quota test cases
	testCases := []struct {
		name       string
		scope      quota.Scope
		id         int64
		scopeParam func(cmd *quota.UpdateQuotaCmd)
	}{
		{
			name:  "Organization quota",
			scope: quota.OrgScope,
			id:    ctx.OrgID,
			scopeParam: func(cmd *quota.UpdateQuotaCmd) {
				cmd.OrgID = ctx.OrgID
			},
		},
		{
			name:  "User quota",
			scope: quota.UserScope,
			id:    adminUserId,
			scopeParam: func(cmd *quota.UpdateQuotaCmd) {
				cmd.UserID = adminUserId
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Get current quotas
			quotas, err := quotaService.GetQuotasByScope(context.Background(), tc.scope, tc.id)
			require.NoError(t, err, "Failed to get quotas")

			// Find the dashboard quota and save original value
			var originalQuota int64 = -1 // Default if not found
			var quotaFound bool
			for _, q := range quotas {
				if q.Target == string(dashboards.QuotaTarget) {
					originalQuota = q.Limit
					quotaFound = true
					break
				}
			}

			// Set quota to 1 dashboard
			updateCmd := &quota.UpdateQuotaCmd{
				Target: string(dashboards.QuotaTarget),
				Limit:  1,
			}
			tc.scopeParam(updateCmd)

			err = quotaService.Update(context.Background(), updateCmd)
			require.NoError(t, err, "Failed to update quota")

			// Create first dashboard - should succeed
			dash1, err := createDashboard(t, adminClient, fmt.Sprintf("Quota Test Dashboard 1 (%s)", tc.name), nil, nil)
			require.NoError(t, err, "Failed to create first dashboard")

			// Create second dashboard - should fail due to quota
			_, err = createDashboard(t, adminClient, fmt.Sprintf("Quota Test Dashboard 2 (%s)", tc.name), nil, nil)
			require.Error(t, err, "Creating second dashboard should fail due to quota")
			require.Contains(t, err.Error(), "quota", "Error should mention quota")

			// Clean up the dashboard to reset the quota usage
			err = adminClient.Resource.Delete(context.Background(), dash1.GetName(), v1.DeleteOptions{})
			require.NoError(t, err, "Failed to delete test dashboard")

			// Restore the original quota state
			if quotaFound {
				// If quota existed originally, restore its value
				resetCmd := &quota.UpdateQuotaCmd{
					Target: string(dashboards.QuotaTarget),
					Limit:  originalQuota,
				}
				tc.scopeParam(resetCmd)

				err = quotaService.Update(context.Background(), resetCmd)
				require.NoError(t, err, "Failed to reset quota")
			} else if tc.scope == quota.UserScope {
				// If user quota didn't exist originally, delete it
				err = quotaService.DeleteQuotaForUser(context.Background(), tc.id)
				require.NoError(t, err, "Failed to delete user quota")
			}
		})
	}
}

// Helper function to create test context for an organization
func createTestContext(t *testing.T, helper *apis.K8sTestHelper, orgUsers apis.OrgUsers, dualWriterMode rest.DualWriterMode) TestContext {
	// Create test folder
	folderTitle := "Test Folder " + orgUsers.Admin.Identity.GetLogin()
	testFolder, err := createFolder(t, helper, orgUsers.Admin, folderTitle)
	require.NoError(t, err, "Failed to create test folder")

	// Create test context
	return TestContext{
		Helper:                    helper,
		DualWriterMode:            dualWriterMode,
		AdminUser:                 orgUsers.Admin,
		EditorUser:                orgUsers.Editor,
		ViewerUser:                orgUsers.Viewer,
		TestFolder:                testFolder,
		AdminServiceAccountToken:  orgUsers.AdminServiceAccountToken,
		EditorServiceAccountToken: orgUsers.EditorServiceAccountToken,
		ViewerServiceAccountToken: orgUsers.ViewerServiceAccountToken,
		OrgID:                     orgUsers.Admin.Identity.GetOrgID(),
	}
}

// getDashboardGVR returns the dashboard GroupVersionResource
func getDashboardGVR() schema.GroupVersionResource {
	return schema.GroupVersionResource{
		Group:    dashboardv1alpha1.DashboardResourceInfo.GroupVersion().Group,
		Version:  dashboardv1alpha1.DashboardResourceInfo.GroupVersion().Version,
		Resource: dashboardv1alpha1.DashboardResourceInfo.GetName(),
	}
}

// getFolderGVR returns the folder GroupVersionResource
func getFolderGVR() schema.GroupVersionResource {
	return schema.GroupVersionResource{
		Group:    folderv0alpha1.FolderResourceInfo.GroupVersion().Group,
		Version:  folderv0alpha1.FolderResourceInfo.GroupVersion().Version,
		Resource: folderv0alpha1.FolderResourceInfo.GetName(),
	}
}

// Get a resource client for the specified user
func getResourceClient(t *testing.T, helper *apis.K8sTestHelper, user apis.User, gvr schema.GroupVersionResource) *apis.K8sResourceClient {
	t.Helper()

	return helper.GetResourceClient(apis.ResourceClientArgs{
		User:      user,
		Namespace: helper.Namespacer(user.Identity.GetOrgID()),
		GVR:       gvr,
	})
}

// Get a resource client for the specified service token
// nolint:unused
func getServiceAccountResourceClient(t *testing.T, helper *apis.K8sTestHelper, token string, orgID int64, gvr schema.GroupVersionResource) *apis.K8sResourceClient {
	t.Helper()

	return helper.GetResourceClient(apis.ResourceClientArgs{
		ServiceAccountToken: token,
		Namespace:           helper.Namespacer(orgID),
		GVR:                 gvr,
	})
}

// Create a folder object for testing
func createFolderObject(t *testing.T, title string, namespace string, parentFolderUID string) *unstructured.Unstructured {
	t.Helper()

	folderObj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": folderv0alpha1.FolderResourceInfo.GroupVersion().String(),
			"kind":       folderv0alpha1.FolderResourceInfo.GroupVersionKind().Kind,
			"metadata": map[string]interface{}{
				"generateName": "test-folder-",
				"namespace":    namespace,
			},
			"spec": map[string]interface{}{
				"title": title,
			},
		},
	}

	if parentFolderUID != "" {
		meta, _ := utils.MetaAccessor(folderObj)
		meta.SetFolder(parentFolderUID)
	}

	return folderObj
}

// Create a folder using Kubernetes API
func createFolder(t *testing.T, helper *apis.K8sTestHelper, user apis.User, title string) (*folder.Folder, error) {
	t.Helper()

	// Get a client for the folder resource
	folderClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      user,
		Namespace: helper.Namespacer(user.Identity.GetOrgID()),
		GVR:       getFolderGVR(),
	})

	// Create a folder resource
	folderObj := createFolderObject(t, title, helper.Namespacer(user.Identity.GetOrgID()), "")

	// Create the folder using the K8s client
	ctx := context.Background()
	createdFolder, err := folderClient.Resource.Create(ctx, folderObj, v1.CreateOptions{})
	if err != nil {
		return nil, err
	}

	meta, _ := utils.MetaAccessor(createdFolder)

	// Create a folder struct to return (for compatibility with existing code)
	return &folder.Folder{
		UID:   createdFolder.GetName(),
		Title: meta.FindTitle(""),
	}, nil
}

// Create a dashboard object for testing
func createDashboardObject(t *testing.T, title string, folderUID string, generation int64) *unstructured.Unstructured {
	t.Helper()

	dashObj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": dashboardv1alpha1.DashboardResourceInfo.GroupVersion().String(),
			"kind":       dashboardv1alpha1.DashboardResourceInfo.GroupVersionKind().Kind,
			"metadata": map[string]interface{}{
				"generateName": "test-",
				"annotations": map[string]interface{}{
					"grafana.app/grant-permissions": "default",
				},
			},
			"spec": map[string]interface{}{
				"title": title,
			},
		},
	}

	// Get the metadata accessor
	meta, err := utils.MetaAccessor(dashObj)
	require.NoError(t, err, "Failed to get metadata accessor")

	// Get the dashboard's spec
	spec, err := meta.GetSpec()
	require.NoError(t, err, "Failed to get spec")
	specMap := spec.(map[string]interface{})

	if folderUID != "" {
		meta.SetFolder(folderUID)
	}

	if generation > 0 {
		meta.SetGeneration(generation)
	}

	// Update the spec
	err = meta.SetSpec(specMap)
	require.NoError(t, err, "Failed to set spec")

	return dashObj
}

// Mark dashboard object as provisioned by setting appropriate annotations
func markDashboardObjectAsProvisioned(t *testing.T, dashboard *unstructured.Unstructured, providerName string, externalID string, checksum string, allowsEdits bool) *unstructured.Unstructured {
	meta, err := utils.MetaAccessor(dashboard)
	require.NoError(t, err)

	m := utils.ManagerProperties{}
	s := utils.SourceProperties{}
	m.Kind = utils.ManagerKindKubectl
	m.Identity = providerName
	m.AllowsEdits = allowsEdits
	s.Path = externalID
	s.Checksum = checksum
	s.TimestampMillis = 1633046400000
	meta.SetManagerProperties(m)
	meta.SetSourceProperties(s)

	return dashboard
}

// Create a dashboard
func createDashboard(t *testing.T, client *apis.K8sResourceClient, title string, folderUID *string, uid *string) (*unstructured.Unstructured, error) {
	t.Helper()

	var folderUIDStr string
	if folderUID != nil && *folderUID != "" {
		folderUIDStr = *folderUID
	}

	dashObj := createDashboardObject(t, title, folderUIDStr, 0)

	// Set the name (UID) if provided
	if uid != nil && *uid != "" {
		meta, _ := utils.MetaAccessor(dashObj)
		meta.SetName(*uid)
		// Remove generateName if we're explicitly setting a name
		delete(dashObj.Object["metadata"].(map[string]interface{}), "generateName")
	}

	// Create the dashboard
	createdDash, err := client.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
	if err != nil {
		return nil, err
	}

	// Fetch the generated object to ensure we're not running into any caching or UID mismatch issues
	databaseDash, err := client.Resource.Get(context.Background(), createdDash.GetName(), v1.GetOptions{})
	if err != nil {
		t.Errorf("Potential caching issue: Unable to retrieve newly created dashboard: %v", err)
	}

	createdMeta, _ := utils.MetaAccessor(createdDash)
	databaseMeta, _ := utils.MetaAccessor(databaseDash)

	require.Equal(t, createdDash.GetUID(), databaseDash.GetUID(), "Created and retrieved UID mismatch")
	require.Equal(t, createdDash.GetName(), databaseDash.GetName(), "Created and retrieved name mismatch")
	require.Equal(t, createdDash.GetResourceVersion(), databaseDash.GetResourceVersion(), "Created and retrieved resource version mismatch")
	require.Equal(t, createdMeta.FindTitle("A"), databaseMeta.FindTitle("B"), "Created and retrieved title mismatch")

	return createdDash, nil
}

// Update a dashboard
func updateDashboard(t *testing.T, client *apis.K8sResourceClient, dashboard *unstructured.Unstructured, newTitle string, updateMessage *string) (*unstructured.Unstructured, error) {
	t.Helper()

	meta, _ := utils.MetaAccessor(dashboard)

	// Get the spec using MetaAccessor
	dashSpec, _ := meta.GetSpec()
	specMap := dashSpec.(map[string]interface{})

	// Update the title
	specMap["title"] = newTitle

	// Set the updated spec
	_ = meta.SetSpec(specMap)

	// Set message if provided
	if updateMessage != nil {
		meta.SetMessage(*updateMessage)
	}

	// Update the dashboard
	return client.Resource.Update(context.Background(), dashboard, v1.UpdateOptions{})
}
