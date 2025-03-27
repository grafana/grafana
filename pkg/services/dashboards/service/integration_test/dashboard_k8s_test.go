package integration_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardv1alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	folderv0alpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// TestContext holds common test resources
type TestContext struct {
	Helper                    *apis.K8sTestHelper
	AdminUser                 apis.User
	EditorUser                apis.User
	ViewerUser                apis.User
	TestFolder                *folder.Folder
	AdminServiceAccountToken  string
	EditorServiceAccountToken string
	ViewerServiceAccountToken string
	OrgID                     int64
}

// TestK8sDashboardIntegration tests the dashboard K8s API integration
// These tests cover various scenarios including user types, permissions,
// and validation for dashboard operations through the k8s API
func TestK8sDashboardIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// Create a K8sTestHelper which will set up a real API server
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagKubernetesClientDashboardsFolders, // Enable dashboard feature
		},
	})

	t.Cleanup(func() {
		helper.Shutdown()
	})

	// Create test contexts for both organizations
	org1Ctx := createTestContext(t, helper, helper.Org1)
	org2Ctx := createTestContext(t, helper, helper.OrgB)

	t.Run("Organization 1 tests", func(t *testing.T) {
		t.Run("Authorization tests for all identity types", func(t *testing.T) {
			runAuthorizationTests(t, org1Ctx)
		})

		t.Run("Dashboard permission tests", func(t *testing.T) {
			runDashboardPermissionTests(t, org1Ctx)
		})

		t.Run("Dashboard validation tests", func(t *testing.T) {
			runDashboardValidationTests(t, org1Ctx)
		})
	})

	t.Run("Cross-organization tests", func(t *testing.T) {
		runCrossOrgTests(t, org1Ctx, org2Ctx)
	})
}

// Auth identity types (user or token) with resource client
type Identity struct {
	Name   string
	Client *apis.K8sResourceClient
	Type   string // "user" or "token"
}

// Run unified tests for different identity types (users and service tokens)
func runAuthorizationTests(t *testing.T, ctx TestContext) {
	t.Helper()

	// Get clients for each identity type and role
	adminUserClient := getResourceClient(t, ctx.Helper, ctx.AdminUser, getDashboardGVR())
	editorUserClient := getResourceClient(t, ctx.Helper, ctx.EditorUser, getDashboardGVR())
	viewerUserClient := getResourceClient(t, ctx.Helper, ctx.ViewerUser, getDashboardGVR())

	adminTokenClient := getServiceAccountResourceClient(t, ctx.Helper, ctx.AdminServiceAccountToken, ctx.OrgID, getDashboardGVR())
	editorTokenClient := getServiceAccountResourceClient(t, ctx.Helper, ctx.EditorServiceAccountToken, ctx.OrgID, getDashboardGVR())
	viewerTokenClient := getServiceAccountResourceClient(t, ctx.Helper, ctx.ViewerServiceAccountToken, ctx.OrgID, getDashboardGVR())

	// Get folder clients
	adminUserFolderClient := getResourceClient(t, ctx.Helper, ctx.AdminUser, getFolderGVR())
	adminTokenFolderClient := getServiceAccountResourceClient(t, ctx.Helper, ctx.AdminServiceAccountToken, ctx.OrgID, getFolderGVR())

	// Define all identities to test
	identities := []Identity{
		// User identities
		{Name: "Admin user", Client: adminUserClient, Type: "user"},
		{Name: "Editor user", Client: editorUserClient, Type: "user"},
		{Name: "Viewer user", Client: viewerUserClient, Type: "user"},

		// Token identities
		{Name: "Admin token", Client: adminTokenClient, Type: "token"},
		{Name: "Editor token", Client: editorTokenClient, Type: "token"},
		{Name: "Viewer token", Client: viewerTokenClient, Type: "token"},
	}

	// Get admin clients for cleanup based on identity type
	adminCleanupClients := map[string]*apis.K8sResourceClient{
		"user":  adminUserClient,
		"token": adminTokenClient,
	}

	// Define test cases for different roles
	type roleTest struct {
		roleName  string
		canCreate bool
		canUpdate bool
		canDelete bool
	}

	roleTests := []roleTest{
		{
			roleName:  "Admin",
			canCreate: true,
			canUpdate: true,
			canDelete: true,
		},
		{
			roleName:  "Editor",
			canCreate: true,
			canUpdate: true,
			canDelete: true,
		},
		{
			roleName:  "Viewer",
			canCreate: false,
			canUpdate: false,
			canDelete: false,
		},
	}

	// Create a map of identity client to role capabilities
	authTests := make(map[*apis.K8sResourceClient]roleTest)
	for _, identity := range identities {
		for _, role := range roleTests {
			if identity.Name == role.roleName+" "+identity.Type {
				authTests[identity.Client] = role
				break
			}
		}
	}

	// Run tests for each identity type
	for _, identity := range identities {
		identity := identity // Capture range variable
		t.Run(identity.Name, func(t *testing.T) {
			// Get admin client for cleanup based on identity type
			adminClient := adminCleanupClients[identity.Type]

			// Get role capabilities for this identity
			roleCapabilities := authTests[identity.Client]

			// Test dashboard creation (both at root and in folder)
			t.Run("dashboard creation", func(t *testing.T) {
				// Test locations for dashboard creation
				locations := []struct {
					name      string
					folderUID string
				}{
					{name: "at root", folderUID: ""},
					{name: "in folder", folderUID: ctx.TestFolder.UID},
				}

				for _, loc := range locations {
					t.Run(loc.name, func(t *testing.T) {
						if roleCapabilities.canCreate {
							// Test can create dashboard
							dash, err := createDashboard(t, identity.Client, identity.Name+" Dashboard "+loc.name, &loc.folderUID, nil)
							require.NoError(t, err)
							require.NotNil(t, dash)

							// Verify if dashboard was created in the correct folder
							if loc.folderUID != "" {
								spec := dash.Object["spec"].(map[string]interface{})
								require.Equal(t, loc.folderUID, spec["folderUID"])
							}

							// Clean up
							err = adminClient.Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
							require.NoError(t, err)
						} else {
							// Test cannot create dashboard
							_, err := createDashboard(t, identity.Client, identity.Name+" Dashboard "+loc.name, nil, nil)
							require.Error(t, err)
						}
					})
				}
			})

			// Test dashboard updates
			t.Run("dashboard update", func(t *testing.T) {
				// Create a dashboard with admin
				dash, err := createDashboard(t, adminClient, "Dashboard to Update by "+identity.Name, nil, nil)
				require.NoError(t, err)
				require.NotNil(t, dash)

				if roleCapabilities.canUpdate {
					// Test can update dashboard
					updatedDash, err := updateDashboard(t, identity.Client, dash, "Updated by "+identity.Name)
					require.NoError(t, err)
					require.NotNil(t, updatedDash)

					// Verify the update
					updatedSpec := updatedDash.Object["spec"].(map[string]interface{})
					require.Equal(t, "Updated by "+identity.Name, updatedSpec["title"])
				} else {
					// Test cannot update dashboard
					_, err := updateDashboard(t, identity.Client, dash, "Updated by "+identity.Name)
					require.Error(t, err)
				}

				// Clean up
				err = adminClient.Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
				require.NoError(t, err)
			})

			// Test dashboard deletion permissions
			t.Run("dashboard deletion", func(t *testing.T) {
				// Create a dashboard with admin
				dash, err := createDashboard(t, adminClient, "Dashboard for deletion test by "+identity.Name, nil, nil)
				require.NoError(t, err)
				require.NotNil(t, dash)

				// Attempt to delete
				err = identity.Client.Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
				if roleCapabilities.canDelete {
					require.NoError(t, err, "Should be able to delete dashboard")
				} else {
					require.Error(t, err, "Should not be able to delete dashboard")
					// Clean up with admin if the test identity couldn't delete
					err = adminClient.Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
					require.NoError(t, err)
				}
			})

			// TODO: Check if vieweing permission can be revoked as well.
			// Test dashboard viewing for all roles
			t.Run("dashboard viewing", func(t *testing.T) {
				// Create a dashboard with admin
				dash, err := createDashboard(t, adminClient, "Dashboard for "+identity.Name+" to view", nil, nil)
				require.NoError(t, err)
				require.NotNil(t, dash)

				// Get the dashboard with the test identity
				viewedDash, err := identity.Client.Resource.Get(context.Background(), dash.GetName(), v1.GetOptions{})
				require.NoError(t, err, "All identities should be able to view dashboards")
				require.NotNil(t, viewedDash)

				// Clean up
				err = adminClient.Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
				require.NoError(t, err)
			})
		})
	}

	// Test permissions in restricted folders
	// Test for both user and token identities
	folderClients := map[string]*apis.K8sResourceClient{
		"user":  adminUserFolderClient,
		"token": adminTokenFolderClient,
	}

	for _, identityType := range []string{"user", "token"} {
		t.Run("Folder permission restrictions ("+identityType+")", func(t *testing.T) {
			// Get clients for the current identity type
			var folderClient, adminClient, editorClient *apis.K8sResourceClient

			folderClient = folderClients[identityType]
			adminClient = adminCleanupClients[identityType]

			if identityType == "user" {
				editorClient = editorUserClient
			} else {
				editorClient = editorTokenClient
			}

			// Create a new folder with admin
			restrictedFolder, err := createFolder(t, ctx.Helper, ctx.AdminUser, "Restricted "+identityType+" Folder")
			require.NoError(t, err, "Failed to create restricted folder")
			folderUID := restrictedFolder.UID

			// Set VIEW-only permissions for the editor on this folder
			// This overrides the default organization permissions
			editorUserID := ctx.EditorUser.Identity.GetUID()
			setResourceUserPermission(t, ctx, ctx.AdminUser, "folders", folderUID, editorUserID, dashboardaccess.PERMISSION_VIEW)

			// Test that editor can view dashboards in the folder (should succeed)
			t.Run("Editor can view dashboards in restricted folder", func(t *testing.T) {
				// Create a dashboard in the folder with admin
				dash, err := createDashboard(t, adminClient, "Admin Dashboard in Restricted Folder", &folderUID, nil)
				require.NoError(t, err)
				require.NotNil(t, dash)

				// Editor should be able to view the dashboard (view permission)
				viewedDash, err := editorClient.Resource.Get(context.Background(), dash.GetName(), v1.GetOptions{})
				require.NoError(t, err)
				require.NotNil(t, viewedDash)

				// Clean up
				err = adminClient.Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
				require.NoError(t, err)
			})

			// Test that editor cannot create a dashboard in the folder (should fail)
			t.Run("Editor cannot create dashboard in restricted folder", func(t *testing.T) {
				// Try to create a dashboard in the folder with editor
				_, err = createDashboard(t, editorClient, "Editor Dashboard in Restricted Folder", &folderUID, nil)
				require.Error(t, err, "Should not be able to create dashboard with only VIEW permission")
			})

			// Test that editor cannot update a dashboard in the folder (should fail)
			t.Run("Editor cannot update dashboard in restricted folder", func(t *testing.T) {
				// Create a dashboard in the folder with admin
				dash, err := createDashboard(t, adminClient, "Dashboard to Update in Restricted Folder", &folderUID, nil)
				require.NoError(t, err)
				require.NotNil(t, dash)

				// Editor should not be able to update the dashboard (only has view permission)
				_, err = updateDashboard(t, editorClient, dash, "Updated by Editor in Restricted Folder")
				require.Error(t, err, "Should not be able to update dashboard with only VIEW permission")

				// Clean up
				err = adminClient.Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
				require.NoError(t, err)
			})

			// Now change to EDIT permissions and verify behavior changes
			t.Run("Change to EDIT permissions", func(t *testing.T) {
				// Change permissions for the editor to EDIT
				setResourceUserPermission(t, ctx, ctx.AdminUser, "folders", folderUID, editorUserID, dashboardaccess.PERMISSION_EDIT)

				// Test that editor can now create a dashboard in the folder (should succeed)
				t.Run("Editor can now create dashboard in folder", func(t *testing.T) {
					// Create a dashboard in the folder with editor
					dash, err := createDashboard(t, editorClient, "Editor Dashboard with EDIT Permission", &folderUID, nil)
					require.NoError(t, err)
					require.NotNil(t, dash)

					// Verify it was created in the correct folder
					spec := dash.Object["spec"].(map[string]interface{})
					require.Equal(t, folderUID, spec["folderUID"])

					// Clean up
					err = adminClient.Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
					require.NoError(t, err)
				})

				// Test that editor can now update a dashboard in the folder (should succeed)
				t.Run("Editor can now update dashboard in folder", func(t *testing.T) {
					// Create a dashboard in the folder with admin
					dash, err := createDashboard(t, adminClient, "Dashboard to Update with EDIT Permission", &folderUID, nil)
					require.NoError(t, err)
					require.NotNil(t, dash)

					// Editor should now be able to update the dashboard (has EDIT permission)
					updatedDash, err := updateDashboard(t, editorClient, dash, "Updated by Editor with EDIT Permission")
					require.NoError(t, err)
					require.NotNil(t, updatedDash)

					// Verify the update
					updatedSpec := updatedDash.Object["spec"].(map[string]interface{})
					require.Equal(t, "Updated by Editor with EDIT Permission", updatedSpec["title"])

					// Clean up
					err = adminClient.Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
					require.NoError(t, err)
				})
			})

			// Clean up the folder
			// TODO: CHeck if this should be forced to admin.
			err = folderClient.Resource.Delete(context.Background(), folderUID, v1.DeleteOptions{})
			require.NoError(t, err)
		})
	}
}

// Run tests for dashboard permissions
func runDashboardPermissionTests(t *testing.T, ctx TestContext) {
	t.Helper()

	// Get clients for each user
	adminClient := getResourceClient(t, ctx.Helper, ctx.AdminUser, getDashboardGVR())
	editorClient := getResourceClient(t, ctx.Helper, ctx.EditorUser, getDashboardGVR())
	viewerClient := getResourceClient(t, ctx.Helper, ctx.ViewerUser, getDashboardGVR())

	// Get folder clients
	adminFolderClient := getResourceClient(t, ctx.Helper, ctx.AdminUser, getFolderGVR())

	// Test custom dashboard permissions
	t.Run("Dashboard with custom permissions", func(t *testing.T) {
		// Create a dashboard with admin
		dash, err := createDashboard(t, adminClient, "Dashboard with Custom Permissions", nil, nil)
		require.NoError(t, err)
		require.NotNil(t, dash)

		// Get the dashboard ID
		dashUID := dash.GetName()

		// Set permissions for the viewer to edit using HTTP API
		viewerUserID := ctx.ViewerUser.Identity.GetUID()
		setResourceUserPermission(t, ctx, ctx.AdminUser, "dashboards", dashUID, viewerUserID, dashboardaccess.PERMISSION_EDIT)

		// Now the viewer should be able to update the dashboard
		viewedDash, err := viewerClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
		require.NoError(t, err)

		// Update the dashboard with viewer (should succeed because of custom permissions)
		updatedDash, err := updateDashboard(t, viewerClient, viewedDash, "Updated by Viewer with Permission")
		require.NoError(t, err)
		require.NotNil(t, updatedDash)

		// Verify the update
		updatedSpec := updatedDash.Object["spec"].(map[string]interface{})
		require.Equal(t, "Updated by Viewer with Permission", updatedSpec["title"])

		// Clean up
		err = adminClient.Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
		require.NoError(t, err)
	})

	// Test dashboard-specific permission overrides (new test case)
	t.Run("Dashboard-specific permission overrides", func(t *testing.T) {
		// Create multiple dashboards with admin
		dash1, err := createDashboard(t, adminClient, "Dashboard with No Custom Permissions", nil, nil)
		require.NoError(t, err)
		require.NotNil(t, dash1)
		dash1UID := dash1.GetName()

		dash2, err := createDashboard(t, adminClient, "Dashboard with Viewer Edit Permission", nil, nil)
		require.NoError(t, err)
		require.NotNil(t, dash2)
		dash2UID := dash2.GetName()

		// Set EDIT permissions for the viewer on dash2 only
		viewerUserID := ctx.ViewerUser.Identity.GetUID()
		setResourceUserPermission(t, ctx, ctx.AdminUser, "dashboards", dash2UID, viewerUserID, dashboardaccess.PERMISSION_EDIT)

		// Verify viewer cannot edit dashboard1 (no custom permissions)
		_, err = updateDashboard(t, viewerClient, dash1, "This should fail - no permissions")
		require.Error(t, err, "Viewer should not be able to update dashboard without permissions")

		// Verify viewer can edit dashboard2 (with custom permissions)
		viewedDash2, err := viewerClient.Resource.Get(context.Background(), dash2UID, v1.GetOptions{})
		require.NoError(t, err)

		updatedDash2, err := updateDashboard(t, viewerClient, viewedDash2, "Updated by Viewer with Dashboard-Specific Permission")
		require.NoError(t, err)
		require.NotNil(t, updatedDash2)

		// Verify the update
		updatedSpec := updatedDash2.Object["spec"].(map[string]interface{})
		require.Equal(t, "Updated by Viewer with Dashboard-Specific Permission", updatedSpec["title"])

		// Also check viewer can delete the dashboard they have EDIT permission on
		err = viewerClient.Resource.Delete(context.Background(), dash2UID, v1.DeleteOptions{})
		require.NoError(t, err, "Viewer should be able to delete dashboard with EDIT permission")

		// Clean up the other dashboard
		err = adminClient.Resource.Delete(context.Background(), dash1UID, v1.DeleteOptions{})
		require.NoError(t, err)
	})

	// Test folder permissions inheritance
	t.Run("Dashboard in folder with custom permissions", func(t *testing.T) {
		// Create a new folder with the admin
		customFolder, err := createFolder(t, ctx.Helper, ctx.AdminUser, "Custom Permission Folder")
		require.NoError(t, err, "Failed to create custom permission folder")
		folderUID := customFolder.UID

		// Set permissions for the folder - give viewer edit access using HTTP API
		viewerUserID := ctx.ViewerUser.Identity.GetUID()
		setResourceUserPermission(t, ctx, ctx.AdminUser, "folders", folderUID, viewerUserID, dashboardaccess.PERMISSION_EDIT)

		// Create a dashboard in the folder with admin
		dash, err := createDashboard(t, adminClient, "Dashboard in Custom Permission Folder", &folderUID, nil)
		require.NoError(t, err)
		require.NotNil(t, dash)

		// Get the dashboard with viewer
		viewedDash, err := viewerClient.Resource.Get(context.Background(), dash.GetName(), v1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, viewedDash)

		// Update the dashboard with viewer (should succeed because of folder permissions)
		updatedDash, err := updateDashboard(t, viewerClient, viewedDash, "Updated by Viewer with Folder Permission")
		require.NoError(t, err)
		require.NotNil(t, updatedDash)

		// Verify the update
		updatedSpec := updatedDash.Object["spec"].(map[string]interface{})
		require.Equal(t, "Updated by Viewer with Folder Permission", updatedSpec["title"])

		// Revert granted permissions
		setResourceUserPermission(t, ctx, ctx.AdminUser, "folders", folderUID, viewerUserID, dashboardaccess.PERMISSION_VIEW)

		// Clean up dashboard
		err = adminClient.Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
		require.NoError(t, err)

		// Clean up the folder
		err = adminFolderClient.Resource.Delete(context.Background(), folderUID, v1.DeleteOptions{})
		require.NoError(t, err)
	})

	// Test creator permissions (new test case)
	t.Run("Creator of dashboard gets admin permission", func(t *testing.T) {
		// Create a dashboard as an editor user (not admin)
		editorCreatedDash, err := createDashboard(t, editorClient, "Dashboard Created by Editor", nil, nil)
		require.NoError(t, err)
		require.NotNil(t, editorCreatedDash)
		dashUID := editorCreatedDash.GetName()

		// Editor should be able to change permissions on their own dashboard (they get Admin permission as creator)
		// Give viewer edit access to the dashboard
		viewerUserID := ctx.ViewerUser.Identity.GetUID()

		// Use the editor to set permissions (should succeed because creator has Admin permission)
		setResourceUserPermission(t, ctx, ctx.EditorUser, "dashboards", dashUID, viewerUserID, dashboardaccess.PERMISSION_EDIT)

		// Now verify the viewer can edit the dashboard
		viewedDash, err := viewerClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
		require.NoError(t, err)

		updatedDash, err := updateDashboard(t, viewerClient, viewedDash, "Updated by Viewer with Permission from Editor")
		require.NoError(t, err)
		require.NotNil(t, updatedDash)

		// Verify the update
		updatedSpec := updatedDash.Object["spec"].(map[string]interface{})
		require.Equal(t, "Updated by Viewer with Permission from Editor", updatedSpec["title"])

		// Clean up
		err = editorClient.Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
		require.NoError(t, err, "Editor should be able to delete dashboard they created")
	})

	// Test scenario where admin restricts editor's access to dashboard they created
	t.Run("Admin can override creator permissions", func(t *testing.T) {
		// Create a dashboard as an editor user (not admin)
		editorCreatedDash, err := createDashboard(t, editorClient, "Dashboard Created by Editor for Permission Test", nil, nil)
		require.NoError(t, err)
		require.NotNil(t, editorCreatedDash)
		dashUID := editorCreatedDash.GetName()

		// Verify editor can initially edit their dashboard (they have Admin permission as creator)
		initialViewedDash, err := editorClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
		require.NoError(t, err)

		initialUpdatedDash, err := updateDashboard(t, editorClient, initialViewedDash, "Initial Update by Creator")
		require.NoError(t, err)
		require.NotNil(t, initialUpdatedDash)

		// Admin restricts editor to view-only on their own dashboard
		editorUserID := ctx.EditorUser.Identity.GetUID()
		setResourceUserPermission(t, ctx, ctx.AdminUser, "dashboards", dashUID, editorUserID, dashboardaccess.PERMISSION_VIEW)

		// Now editor should NOT be able to edit the dashboard (admin override should succeed)
		viewedDash, err := editorClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
		require.NoError(t, err)

		// Update attempt should fail
		_, err = updateDashboard(t, editorClient, viewedDash, "This update should fail")
		require.Error(t, err, "Editor should not be able to update dashboard after admin restricts permissions")

		// Editor should also not be able to delete the dashboard
		err = editorClient.Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
		require.Error(t, err, "Editor should not be able to delete dashboard after admin restricts permissions")

		// Admin should be able to delete it
		err = adminClient.Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
		require.NoError(t, err, "Admin should always be able to delete dashboards")
	})

	// Test cross-org permissions
	t.Run("Custom permissions don't extend across organizations", func(t *testing.T) {
		// Get client for other org
		otherOrgClient := getResourceClient(t, ctx.Helper, ctx.Helper.OrgB.Viewer, getDashboardGVR())

		// Create a dashboard with admin in the current org
		dash, err := createDashboard(t, adminClient, "Dashboard for Cross-Org Permissions Test", nil, nil)
		require.NoError(t, err)
		require.NotNil(t, dash)
		dashUID := dash.GetName()

		// Set the highest permissions for the viewer in the current org
		viewerUserID := ctx.ViewerUser.Identity.GetUID()
		setResourceUserPermission(t, ctx, ctx.AdminUser, "dashboards", dashUID, viewerUserID, dashboardaccess.PERMISSION_ADMIN)

		// Verify the viewer in the current org can now view and update the dashboard
		viewerDash, err := viewerClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
		require.NoError(t, err, "Viewer with custom permissions should be able to view the dashboard")

		_, err = updateDashboard(t, viewerClient, viewerDash, "Updated by Viewer with Admin Permissions")
		require.NoError(t, err, "Viewer with admin permissions should be able to update the dashboard")

		// Try to access the dashboard from a viewer in the other org
		_, err = otherOrgClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
		require.Error(t, err, "User from other org should not be able to view dashboard even with custom permissions")
		statusErr := ctx.Helper.AsStatusError(err)
		require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code), "Should get 404 Not Found")

		// Clean up
		err = adminClient.Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
		require.NoError(t, err)
	})
}

// Run tests for dashboard validations
func runDashboardValidationTests(t *testing.T, ctx TestContext) {
	t.Helper()

	adminClient := getResourceClient(t, ctx.Helper, ctx.AdminUser, getDashboardGVR())
	adminFolderClient := getResourceClient(t, ctx.Helper, ctx.AdminUser, getFolderGVR())
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

	t.Run("Dashboard title validations", func(t *testing.T) {
		// Test empty title
		t.Run("reject dashboard with empty title", func(t *testing.T) {
			_, err := createDashboard(t, adminClient, "", nil, nil)
			require.Error(t, err)
		})

		// Test long title
		t.Run("reject dashboard with excessively long title", func(t *testing.T) {
			veryLongTitle := "This is an extremely long dashboard title that should exceed the maximum allowed length for dashboard titles in Grafana and therefore should be rejected by the validation system as too long"
			_, err := createDashboard(t, adminClient, veryLongTitle, nil, nil)
			require.Error(t, err)
		})
	})

	t.Run("Dashboard folder validations", func(t *testing.T) {
		// Test non-existent folder UID
		t.Run("reject dashboard with non-existent folder UID", func(t *testing.T) {
			nonExistentFolderUID := "non-existent-folder-uid"
			_, err := createDashboard(t, adminClient, "Dashboard in Non-existent Folder", &nonExistentFolderUID, nil)
			require.Error(t, err)
		})
	})

	t.Run("Dashboard type mismatch validations", func(t *testing.T) {
		// Test updating folder to dashboard
		t.Run("reject updating folder to dashboard", func(t *testing.T) {
			// Create a folder through the K8s API
			typeTestFolder, err := createFolder(t, ctx.Helper, ctx.AdminUser, "Folder for Type Test")
			require.NoError(t, err, "Failed to create folder for type test")
			folderUID := typeTestFolder.UID

			// Try to get the folder
			k8sFolder, err := adminFolderClient.Resource.Get(context.Background(), folderUID, v1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, k8sFolder)

			// Try to change it to a dashboard (not a folder)
			if spec, ok := k8sFolder.Object["spec"].(map[string]interface{}); ok {
				spec["isFolder"] = false
				_, err = adminFolderClient.Resource.Update(context.Background(), k8sFolder, v1.UpdateOptions{})
				require.Error(t, err)
			}

			// Clean up
			err = adminFolderClient.Resource.Delete(context.Background(), k8sFolder.GetName(), v1.DeleteOptions{})
			require.NoError(t, err)
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
					"spec": map[string]interface{}{
						"title":   "Dashboard with Invalid Schema",
						"invalid": true, // Invalid field
					},
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
			spec := dash.Object["spec"].(map[string]interface{})
			initialVersion := int64(0)
			if v, ok := spec["version"]; ok {
				initialVersion, _ = v.(int64)
			}

			// Update the dashboard
			updatedDash, err := updateDashboard(t, adminClient, dash, "Updated Dashboard for Version Test")
			require.NoError(t, err)
			require.NotNil(t, updatedDash)

			// Check that version was incremented
			updatedSpec := updatedDash.Object["spec"].(map[string]interface{})
			updatedVersion, ok := updatedSpec["version"].(int64)
			require.True(t, ok, "Version should be a number")
			require.Greater(t, updatedVersion, initialVersion, "Version should be incremented after update")

			// Clean up
			err = adminClient.Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
			require.NoError(t, err)
		})

		// Test version conflict when updating concurrently
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
			updatedDash1, err := updateDashboard(t, adminClient, dash1, "Updated by first user")
			require.NoError(t, err)
			require.NotNil(t, updatedDash1)

			// Try to update with the second copy (should fail with version conflict)
			_, err = updateDashboard(t, editorClient, dash2, "Updated by second user")
			require.Error(t, err)
			require.Contains(t, err.Error(), "the object has been modified", "Should fail with version conflict error")

			// Clean up
			err = adminClient.Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
			require.NoError(t, err)
		})

		// Test setting an explicit version
		t.Run("explicit version setting is validated", func(t *testing.T) {
			// Create a dashboard with a specific version
			dashObj := createDashboardObject("Dashboard with Explicit Version", "", 0)

			// Set an explicit version in the spec
			if spec, ok := dashObj.Object["spec"].(map[string]interface{}); ok {
				spec["version"] = 5 // Set explicit version
			}

			// Create the dashboard
			createdDash, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.NoError(t, err)
			dashUID := createdDash.GetName()

			// Fetch the created dashboard
			fetchedDash, err := adminClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
			require.NoError(t, err)

			// Verify the version was handled properly
			spec := fetchedDash.Object["spec"].(map[string]interface{})
			version := spec["version"]
			require.Equal(t, 5, version, "Version should be 5")

			// Clean up
			err = adminClient.Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
			require.NoError(t, err)
		})
	})

	t.Run("Dashboard annotation validations", func(t *testing.T) {
		// Test invalid annotation query format
		t.Run("reject dashboard with invalid annotation query", func(t *testing.T) {
			dashObj := createDashboardObject("Dashboard with Invalid Annotation Query", "", 0)

			// Add invalid annotation configuration
			if spec, ok := dashObj.Object["spec"].(map[string]interface{}); ok {
				spec["annotations"] = map[string]interface{}{
					"list": []map[string]interface{}{
						{
							"name": "Invalid Annotation",
							"datasource": map[string]interface{}{
								"type": "prometheus",
								"uid":  "invalid-uid", // Non-existent datasource UID
							},
							"iconColor": "rgba(255, 96, 96, 1)",
							"enable":    true,
							"query":     "{{", // Invalid query syntax
						},
					},
				}
			}

			_, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.Error(t, err)
		})

		// Test annotation without required fields
		t.Run("reject dashboard with incomplete annotation configuration", func(t *testing.T) {
			dashObj := createDashboardObject("Dashboard with Incomplete Annotation Config", "", 0)

			// Add annotation configuration missing required fields
			if spec, ok := dashObj.Object["spec"].(map[string]interface{}); ok {
				spec["annotations"] = map[string]interface{}{
					"list": []map[string]interface{}{
						{
							// Missing required name field
							"enable": true,
							"query":  "test query",
						},
					},
				}
			}

			_, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.Error(t, err)
		})

		// Test annotation with invalid color format
		t.Run("reject dashboard with invalid annotation color format", func(t *testing.T) {
			dashObj := createDashboardObject("Dashboard with Invalid Annotation Color", "", 0)

			// Add annotation with invalid color format
			if spec, ok := dashObj.Object["spec"].(map[string]interface{}); ok {
				spec["annotations"] = map[string]interface{}{
					"list": []map[string]interface{}{
						{
							"name":      "Invalid Color Annotation",
							"enable":    true,
							"iconColor": "not-a-color", // Invalid color format
						},
					},
				}
			}

			_, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.Error(t, err)
		})
	})

	t.Run("Dashboard provisioning validations", func(t *testing.T) {
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
				_, err = updateDashboard(t, editorClient, provisionedFetchedDash, "Updated Provisioned Dashboard")

				if tc.shouldSucceed {
					require.NoError(t, err, "Editor should be able to update provisioned dashboard when allowsEdits is true")

					// Verify the update succeeded by fetching the dashboard again
					updatedDash, err := editorClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
					require.NoError(t, err)
					updatedSpec := updatedDash.Object["spec"].(map[string]interface{})
					require.Equal(t, "Updated Provisioned Dashboard", updatedSpec["title"], "Dashboard title should be updated")
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
		t.Run("reject dashboard with refresh interval below minimum", func(t *testing.T) {
			dashObj := createDashboardObject("Dashboard with Short Refresh", "", 0)

			// Add refresh configuration that should be too frequent
			if spec, ok := dashObj.Object["spec"].(map[string]interface{}); ok {
				spec["refresh"] = "1s" // Too frequent, below typical minimum
			}

			_, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.Error(t, err)
		})
	})

	t.Run("Dashboard tag validations", func(t *testing.T) {
		t.Run("reject dashboard with excessive number of tags", func(t *testing.T) {
			// Create a dashboard with too many tags
			dashObj := createDashboardObject("Dashboard with Too Many Tags", "", 0)

			// Add excessive number of tags
			tooManyTags := []string{}
			for i := 0; i < 100; i++ { // Assuming 100 is more than the max limit
				tooManyTags = append(tooManyTags, fmt.Sprintf("tag%d", i))
			}

			if spec, ok := dashObj.Object["spec"].(map[string]interface{}); ok {
				spec["tags"] = tooManyTags
			}

			_, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.Error(t, err)
		})

		t.Run("reject dashboard with invalid tag characters", func(t *testing.T) {
			dashObj := createDashboardObject("Dashboard with Invalid Tags", "", 0)

			// Add tags with invalid characters
			invalidTags := []string{"tag with spaces", "tag/with/slashes", "tag,with,commas"}

			if spec, ok := dashObj.Object["spec"].(map[string]interface{}); ok {
				spec["tags"] = invalidTags
			}

			_, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.Error(t, err)
		})
	})

	t.Run("Dashboard panels validations", func(t *testing.T) {
		t.Run("reject dashboard with invalid panel config", func(t *testing.T) {
			dashObj := createDashboardObject("Dashboard with Invalid Panel", "", 0)

			// Add invalid panel configuration
			if spec, ok := dashObj.Object["spec"].(map[string]interface{}); ok {
				spec["panels"] = []map[string]interface{}{
					{
						"id":    "not-a-number", // Panel ID should be numeric
						"type":  "graph",
						"title": "Invalid Panel",
					},
				}
			}

			_, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.Error(t, err)
		})

		t.Run("reject dashboard with duplicate panel IDs", func(t *testing.T) {
			dashObj := createDashboardObject("Dashboard with Duplicate Panel IDs", "", 0)

			// Add panels with duplicate IDs
			if spec, ok := dashObj.Object["spec"].(map[string]interface{}); ok {
				spec["panels"] = []map[string]interface{}{
					{
						"id":    1,
						"type":  "graph",
						"title": "Panel One",
					},
					{
						"id":    1, // Duplicate ID
						"type":  "graph",
						"title": "Panel Two",
					},
				}
			}

			_, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.Error(t, err)
		})
	})

	// TODO: Double check these templating tests.
	t.Run("Dashboard variables validations", func(t *testing.T) {
		t.Run("reject dashboard with invalid variable name", func(t *testing.T) {
			dashObj := createDashboardObject("Dashboard with Invalid Variable Name", "", 0)

			// Add invalid variable configuration
			if spec, ok := dashObj.Object["spec"].(map[string]interface{}); ok {
				spec["templating"] = map[string]interface{}{
					"list": []map[string]interface{}{
						{
							"name":  "invalid-name-with-spaces !", // Invalid variable name
							"type":  "query",
							"query": "test",
						},
						{
							"name":  "invalid-name-with-spaces!", // Invalid variable name
							"type":  "query",
							"query": "test",
						},
					},
				}
			}

			_, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.Error(t, err)
		})

		t.Run("reject dashboard with duplicate variable names", func(t *testing.T) {
			dashObj := createDashboardObject("Dashboard with Duplicate Variable Names", "", 0)

			// Add variables with duplicate names
			if spec, ok := dashObj.Object["spec"].(map[string]interface{}); ok {
				spec["templating"] = map[string]interface{}{
					"list": []map[string]interface{}{
						{
							"name":  "var1",
							"type":  "query",
							"query": "test",
						},
						{
							"name":  "var1", // Duplicate name
							"type":  "custom",
							"query": "test2",
						},
					},
				}
			}

			_, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.Error(t, err)
		})
	})

	t.Run("Dashboard links validations", func(t *testing.T) {
		t.Run("reject dashboard with invalid link URL", func(t *testing.T) {
			dashObj := createDashboardObject("Dashboard with Invalid Link URL", "", 0)

			// Add invalid link configuration
			if spec, ok := dashObj.Object["spec"].(map[string]interface{}); ok {
				spec["links"] = []map[string]interface{}{
					{
						"title": "Bad Link",
						"url":   "not-a-valid-url", // Invalid URL format
						"type":  "link",
					},
				}
			}

			_, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.Error(t, err)
		})

		t.Run("reject dashboard with invalid dashboard link uid", func(t *testing.T) {
			dashObj := createDashboardObject("Dashboard with Invalid Dashboard Link", "", 0)

			// Add invalid dashboard link configuration
			if spec, ok := dashObj.Object["spec"].(map[string]interface{}); ok {
				spec["links"] = []map[string]interface{}{
					{
						"title":        "Bad Dashboard Link",
						"type":         "dashboard",
						"dashboardUID": "non-existent-uid",
					},
				}
			}

			_, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.Error(t, err)
		})
	})

	t.Run("Dashboard size limit validations", func(t *testing.T) {
		t.Run("reject dashboard exceeding size limit", func(t *testing.T) {
			// Create a dashboard with a specific UID to make it easier to manage
			specificUID := "size-limit-test-dash"
			dash, err := createDashboard(t, adminClient, "Dashboard Exceeding Size Limit", nil, &specificUID)
			require.NoError(t, err)

			// Now update the dashboard with too many panels
			if spec, ok := dash.Object["spec"].(map[string]interface{}); ok {
				// Create a large number of panels
				var largePanelArray []map[string]interface{}

				// Create 5000 simple panels with unique IDs (to exceed max allowed size)
				for i := 0; i < 5000; i++ {
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

				spec["panels"] = largePanelArray
			}

			// Try to update with too many panels
			_, err = adminClient.Resource.Update(context.Background(), dash, v1.UpdateOptions{})
			require.Error(t, err)
			require.Contains(t, err.Error(), "exceeds", "Error should mention size or limit exceeded")

			// Clean up
			err = adminClient.Resource.Delete(context.Background(), specificUID, v1.DeleteOptions{})
			require.NoError(t, err)
		})

		t.Run("reject dashboard with extremely long panel description", func(t *testing.T) {
			// Create a dashboard with a specific UID to make it easier to manage
			specificUID := "long-description-test-dash"
			dash, err := createDashboard(t, adminClient, "Dashboard with Extremely Long Panel Description", nil, &specificUID)
			require.NoError(t, err)

			// Update dashboard with a panel that has an extremely long description
			if spec, ok := dash.Object["spec"].(map[string]interface{}); ok {
				// Generate a very long description string
				longDescription := strings.Repeat("This is a very long dashboard panel description. ", 1000)

				spec["panels"] = []map[string]interface{}{
					{
						"id":          1,
						"type":        "graph",
						"title":       "Panel with Long Description",
						"description": longDescription, // Extremely long description
					},
				}
			}

			// Try to update with the extremely long panel description
			_, err = adminClient.Resource.Update(context.Background(), dash, v1.UpdateOptions{})
			require.Error(t, err)
			require.Contains(t, err.Error(), "exceeds", "Error should mention size or limit exceeded")

			// Clean up
			err = adminClient.Resource.Delete(context.Background(), specificUID, v1.DeleteOptions{})
			require.NoError(t, err)
		})
	})

	t.Run("Time range validations", func(t *testing.T) {
		t.Run("reject dashboard with invalid time range", func(t *testing.T) {
			dashObj := createDashboardObject("Dashboard with Invalid Time Range", "", 0)

			// Add invalid time range configuration
			if spec, ok := dashObj.Object["spec"].(map[string]interface{}); ok {
				spec["time"] = map[string]interface{}{
					"from": "invalid-time-format",
					"to":   "now",
				}
			}

			_, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.Error(t, err)
		})

		t.Run("reject dashboard with from time after to time", func(t *testing.T) {
			dashObj := createDashboardObject("Dashboard with Invalid Time Range Order", "", 0)

			// Add invalid time range order
			if spec, ok := dashObj.Object["spec"].(map[string]interface{}); ok {
				spec["time"] = map[string]interface{}{
					"from": "now",
					"to":   "now-6h", // This is before "from", which is invalid
				}
			}

			_, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.Error(t, err)
		})
	})

	t.Run("Schema version validations", func(t *testing.T) {
		t.Run("reject dashboard with unsupported schema version", func(t *testing.T) {
			dashObj := createDashboardObject("Dashboard with Unsupported Schema Version", "", 0)

			// Set an unsupported schema version
			if spec, ok := dashObj.Object["spec"].(map[string]interface{}); ok {
				spec["schemaVersion"] = 1 // Very old schema version
			}

			_, err := adminClient.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.Error(t, err)
		})
	})
}

// Helper function to create test context for an organization
func createTestContext(t *testing.T, helper *apis.K8sTestHelper, orgUsers apis.OrgUsers) TestContext {
	// Create test folder
	folderTitle := "Test Folder " + orgUsers.Admin.Identity.GetLogin()
	testFolder, err := createFolder(t, helper, orgUsers.Admin, folderTitle)
	require.NoError(t, err, "Failed to create test folder")

	// Create test context
	return TestContext{
		Helper:                    helper,
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

// Run tests specifically checking cross-org behavior
func runCrossOrgTests(t *testing.T, org1Ctx, org2Ctx TestContext) {
	// Get clients for both organizations
	org1AdminClient := getResourceClient(t, org1Ctx.Helper, org1Ctx.AdminUser, getDashboardGVR())
	org1EditorClient := getResourceClient(t, org1Ctx.Helper, org1Ctx.EditorUser, getDashboardGVR())
	org1ViewerClient := getResourceClient(t, org1Ctx.Helper, org1Ctx.ViewerUser, getDashboardGVR())

	// Service account clients for org1
	org1AdminTokenClient := getServiceAccountResourceClient(t, org1Ctx.Helper, org1Ctx.AdminServiceAccountToken, org1Ctx.OrgID, getDashboardGVR())
	org1EditorTokenClient := getServiceAccountResourceClient(t, org1Ctx.Helper, org1Ctx.EditorServiceAccountToken, org1Ctx.OrgID, getDashboardGVR())
	org1ViewerTokenClient := getServiceAccountResourceClient(t, org1Ctx.Helper, org1Ctx.ViewerServiceAccountToken, org1Ctx.OrgID, getDashboardGVR())

	org1FolderClient := getResourceClient(t, org1Ctx.Helper, org1Ctx.AdminUser, getFolderGVR())

	org2AdminClient := getResourceClient(t, org2Ctx.Helper, org2Ctx.AdminUser, getDashboardGVR())
	org2EditorClient := getResourceClient(t, org2Ctx.Helper, org2Ctx.EditorUser, getDashboardGVR())
	org2ViewerClient := getResourceClient(t, org2Ctx.Helper, org2Ctx.ViewerUser, getDashboardGVR())

	// Service account clients for org2
	org2AdminTokenClient := getServiceAccountResourceClient(t, org2Ctx.Helper, org2Ctx.AdminServiceAccountToken, org2Ctx.OrgID, getDashboardGVR())
	org2EditorTokenClient := getServiceAccountResourceClient(t, org2Ctx.Helper, org2Ctx.EditorServiceAccountToken, org2Ctx.OrgID, getDashboardGVR())
	org2ViewerTokenClient := getServiceAccountResourceClient(t, org2Ctx.Helper, org2Ctx.ViewerServiceAccountToken, org2Ctx.OrgID, getDashboardGVR())

	org2FolderClient := getResourceClient(t, org2Ctx.Helper, org2Ctx.AdminUser, getFolderGVR())

	// Test dashboard and folder name/UID uniqueness across orgs
	t.Run("Dashboard and folder names/UIDs are unique per organization", func(t *testing.T) {
		// Create dashboard with same UID in both orgs - should succeed
		uid := "cross-org-dash-uid"
		dashTitle := "Cross-Org Dashboard"

		// Create in org1
		dash1, err := createDashboard(t, org1AdminClient, dashTitle, nil, &uid)
		require.NoError(t, err, "Failed to create dashboard in org1")

		// Create in org2 with same UID - should succeed (UIDs only need to be unique within an org)
		dash2, err := createDashboard(t, org2AdminClient, dashTitle, nil, &uid)
		require.NoError(t, err, "Failed to create dashboard with same UID in org2")

		// Verify both dashboards were created
		require.Equal(t, uid, dash1.GetName(), "Dashboard UID in org1 should match")
		require.Equal(t, uid, dash2.GetName(), "Dashboard UID in org2 should match")

		// Clean up
		err = org1AdminClient.Resource.Delete(context.Background(), uid, v1.DeleteOptions{})
		require.NoError(t, err, "Failed to delete dashboard in org1")

		err = org2AdminClient.Resource.Delete(context.Background(), uid, v1.DeleteOptions{})
		require.NoError(t, err, "Failed to delete dashboard in org2")

		// Repeat test with folders
		folderUID := "cross-org-folder-uid"
		folderTitle := "Cross-Org Folder"

		// Create folder objects directly with fixed UIDs
		folder1 := createFolderObject(folderTitle, org1Ctx.Helper.Namespacer(org1Ctx.OrgID), "")
		folder1.Object["metadata"].(map[string]interface{})["name"] = folderUID
		delete(folder1.Object["metadata"].(map[string]interface{}), "generateName")

		folder2 := createFolderObject(folderTitle, org2Ctx.Helper.Namespacer(org2Ctx.OrgID), "")
		folder2.Object["metadata"].(map[string]interface{})["name"] = folderUID
		delete(folder2.Object["metadata"].(map[string]interface{}), "generateName")

		// Create folders in both orgs
		createdFolder1, err := org1FolderClient.Resource.Create(context.Background(), folder1, v1.CreateOptions{})
		require.NoError(t, err, "Failed to create folder in org1")

		createdFolder2, err := org2FolderClient.Resource.Create(context.Background(), folder2, v1.CreateOptions{})
		require.NoError(t, err, "Failed to create folder with same UID in org2")

		// Verify both folders were created with the same UID
		require.Equal(t, folderUID, createdFolder1.GetName(), "Folder UID in org1 should match")
		require.Equal(t, folderUID, createdFolder2.GetName(), "Folder UID in org2 should match")

		// Clean up
		err = org1FolderClient.Resource.Delete(context.Background(), folderUID, v1.DeleteOptions{})
		require.NoError(t, err, "Failed to delete folder in org1")

		err = org2FolderClient.Resource.Delete(context.Background(), folderUID, v1.DeleteOptions{})
		require.NoError(t, err, "Failed to delete folder in org2")
	})

	// Test cross-organization access
	t.Run("Cross-organization access", func(t *testing.T) {
		// Create dashboards in both orgs
		org1Dashboard, err := createDashboard(t, org1AdminClient, "Org1 Dashboard", nil, nil)
		require.NoError(t, err)
		require.NotNil(t, org1Dashboard)
		org1DashUID := org1Dashboard.GetName()

		org2Dashboard, err := createDashboard(t, org2AdminClient, "Org2 Dashboard", nil, nil)
		require.NoError(t, err)
		require.NotNil(t, org2Dashboard)
		org2DashUID := org2Dashboard.GetName()

		// Clean up at the end
		defer func() {
			err = org1AdminClient.Resource.Delete(context.Background(), org1DashUID, v1.DeleteOptions{})
			require.NoError(t, err)

			err = org2AdminClient.Resource.Delete(context.Background(), org2DashUID, v1.DeleteOptions{})
			require.NoError(t, err)
		}()

		// Test org1 users trying to access org2 dashboard
		testCrossOrgAccess := func(client *apis.K8sResourceClient, targetDashUID string, description string) {
			t.Run(description, func(t *testing.T) {
				// Try to get the dashboard
				_, err := client.Resource.Get(context.Background(), targetDashUID, v1.GetOptions{})
				require.Error(t, err, "Should not be able to access dashboard from another org")
				statusErr := org1Ctx.Helper.AsStatusError(err)
				require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code), "Should get 404 Not Found")

				// Try to update the dashboard
				dashObj := createDashboardObject("Attempt cross-org update", "", 0)
				dashObj.Object["metadata"].(map[string]interface{})["name"] = targetDashUID
				_, err = client.Resource.Update(context.Background(), dashObj, v1.UpdateOptions{})
				require.Error(t, err, "Should not be able to update dashboard from another org")

				// Try to delete the dashboard
				err = client.Resource.Delete(context.Background(), targetDashUID, v1.DeleteOptions{})
				require.Error(t, err, "Should not be able to delete dashboard from another org")
			})
		}

		// Test real users from org1 trying to access org2 dashboard
		testCrossOrgAccess(org1AdminClient, org2DashUID, "Org1 admin cannot access Org2 dashboard")
		testCrossOrgAccess(org1EditorClient, org2DashUID, "Org1 editor cannot access Org2 dashboard")
		testCrossOrgAccess(org1ViewerClient, org2DashUID, "Org1 viewer cannot access Org2 dashboard")

		// Test real users from org2 trying to access org1 dashboard
		testCrossOrgAccess(org2AdminClient, org1DashUID, "Org2 admin cannot access Org1 dashboard")
		testCrossOrgAccess(org2EditorClient, org1DashUID, "Org2 editor cannot access Org1 dashboard")
		testCrossOrgAccess(org2ViewerClient, org1DashUID, "Org2 viewer cannot access Org1 dashboard")

		// Test service accounts from org1 trying to access org2 dashboard
		testCrossOrgAccess(org1AdminTokenClient, org2DashUID, "Org1 admin token cannot access Org2 dashboard")
		testCrossOrgAccess(org1EditorTokenClient, org2DashUID, "Org1 editor token cannot access Org2 dashboard")
		testCrossOrgAccess(org1ViewerTokenClient, org2DashUID, "Org1 viewer token cannot access Org2 dashboard")

		// Test service accounts from org2 trying to access org1 dashboard
		testCrossOrgAccess(org2AdminTokenClient, org1DashUID, "Org2 admin token cannot access Org1 dashboard")
		testCrossOrgAccess(org2EditorTokenClient, org1DashUID, "Org2 editor token cannot access Org1 dashboard")
		testCrossOrgAccess(org2ViewerTokenClient, org1DashUID, "Org2 viewer token cannot access Org1 dashboard")
	})

}

// Helper function to set permissions for a user via the HTTP API
func setResourceUserPermission(t *testing.T, ctx TestContext, actingUser apis.User, resourceType string, resourceUID string, targetUserID string, permission dashboardaccess.PermissionType) {
	t.Helper()

	// Create request body
	reqBody := map[string]string{
		"permission": permission.String(),
	}
	jsonBody, err := json.Marshal(reqBody)
	require.NoError(t, err)

	// TODO: Use /apis once available
	path := fmt.Sprintf("/api/access-control/%s/%s/users/%s", resourceType, resourceUID, targetUserID)

	resp := apis.DoRequest(ctx.Helper, apis.RequestParams{
		User:        actingUser,
		Method:      http.MethodPost,
		Path:        path,
		Body:        jsonBody,
		ContentType: "application/json",
	}, &struct{}{})

	// Check response status code
	require.Equal(t, http.StatusOK, resp.Response.StatusCode, "Failed to set %s permissions for %s", resourceType, resourceUID)
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
func getServiceAccountResourceClient(t *testing.T, helper *apis.K8sTestHelper, token string, orgID int64, gvr schema.GroupVersionResource) *apis.K8sResourceClient {
	t.Helper()

	return helper.GetResourceClient(apis.ResourceClientArgs{
		ServiceAccountToken: token,
		Namespace:           helper.Namespacer(orgID),
		GVR:                 gvr,
	})
}

// Create a folder object for testing
func createFolderObject(title string, namespace string, parentFolderUID string) *unstructured.Unstructured {
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
		folderObj.Object["metadata"].(map[string]interface{})["annotations"] = map[string]interface{}{
			"grafana.app/folder": parentFolderUID,
		}
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
	folderObj := createFolderObject(title, helper.Namespacer(user.Identity.GetOrgID()), "")

	// Create the folder using the K8s client
	ctx := context.Background()
	createdFolder, err := folderClient.Resource.Create(ctx, folderObj, v1.CreateOptions{})
	if err != nil {
		return nil, err
	}

	// Get the UID (in K8s API, name is the UID)
	folderUID := createdFolder.GetName()

	// Extract folder properties for compatibility with the existing test code
	spec, ok := createdFolder.Object["spec"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("folder spec is not a map")
	}

	folderTitle, ok := spec["title"].(string)
	if !ok {
		return nil, fmt.Errorf("folder title is not a string")
	}

	// Create a folder struct to return (for compatibility with existing code)
	return &folder.Folder{
		UID:   folderUID,
		Title: folderTitle,
	}, nil
}

// Create a dashboard object for testing
func createDashboardObject(title string, folderUID string, version int) *unstructured.Unstructured {
	dashObj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": dashboardv1alpha1.DashboardResourceInfo.GroupVersion().String(),
			"kind":       dashboardv1alpha1.DashboardResourceInfo.GroupVersionKind().Kind,
			"metadata": map[string]interface{}{
				"generateName": "test-",
			},
			"spec": map[string]interface{}{
				"title": title,
			},
		},
	}

	if folderUID != "" {
		dashObj.Object["spec"].(map[string]interface{})["folderUID"] = folderUID
	}

	if version > 0 {
		dashObj.Object["spec"].(map[string]interface{})["version"] = version
	}

	return dashObj
}

// Mark dashboard object as provisioned by setting appropriate annotations
func markDashboardObjectAsProvisioned(t *testing.T, dashboard *unstructured.Unstructured, providerName string, externalID string, checksum string, allowsEdits bool) *unstructured.Unstructured {
	meta, err := utils.MetaAccessor(dashboard)
	require.NoError(t, err)

	m := utils.ManagerProperties{}
	s := utils.SourceProperties{}
	m.Kind = utils.ManagerKindUnknown
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

	dashObj := createDashboardObject(title, folderUIDStr, 0)

	// Set the name (UID) if provided
	if uid != nil && *uid != "" {
		dashObj.Object["metadata"].(map[string]interface{})["name"] = *uid
		// Remove generateName if we're explicitly setting a name
		delete(dashObj.Object["metadata"].(map[string]interface{}), "generateName")
	}

	// Create the dashboard
	createdDash, err := client.Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
	if err != nil {
		return nil, err
	}

	// TODO: Remove once the underlying issue is fixed:
	// https://raintank-corp.slack.com/archives/C05FYAPEPKP/p1743111830777889
	databaseDash, err := client.Resource.Get(context.Background(), createdDash.GetName(), v1.GetOptions{})
	if err != nil {
		return nil, err
	}
	require.NotEqual(t, createdDash.GetUID(), databaseDash.GetUID(), "The underlying UID mismatch bug has been fixed, please remove the redundant read!")

	return databaseDash, nil
}

// Update a dashboard
func updateDashboard(t *testing.T, client *apis.K8sResourceClient, dashboard *unstructured.Unstructured, newTitle string) (*unstructured.Unstructured, error) {
	t.Helper()

	// Get the current spec
	spec := dashboard.Object["spec"].(map[string]interface{})

	// Update the spec
	spec["title"] = newTitle

	// Update the dashboard
	return client.Resource.Update(context.Background(), dashboard, v1.UpdateOptions{})
}
