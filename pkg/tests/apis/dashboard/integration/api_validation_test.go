package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashboardV2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardV2alpha2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha2"
	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards" // TODO: Check if we can remove this import
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/util"
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
	AdminServiceAccount       serviceaccounts.ServiceAccountDTO
	AdminServiceAccountToken  string
	EditorServiceAccount      serviceaccounts.ServiceAccountDTO
	EditorServiceAccountToken string
	ViewerServiceAccount      serviceaccounts.ServiceAccountDTO
	ViewerServiceAccountToken string
	OrgID                     int64
}

// TestIntegrationDashboardAPIValidation tests the dashboard K8s API with validation checks
func TestIntegrationDashboardAPIValidation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dualWriterModes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, dualWriterMode := range dualWriterModes {
		t.Run(fmt.Sprintf("DualWriterMode %d", dualWriterMode), func(t *testing.T) {
			// Create a K8sTestHelper which will set up a real API server
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableAnonymous: true,
				EnableFeatureToggles: []string{
					featuremgmt.FlagKubernetesClientDashboardsFolders, // Enable dashboard feature
					featuremgmt.FlagUnifiedStorageSearch,
					featuremgmt.FlagKubernetesDashboards, // Enable FE-only dashboard feature flag
				},
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"dashboards.dashboard.grafana.app": {
						DualWriterMode: dualWriterMode,
					},
				},
			})

			t.Cleanup(func() {
				helper.Shutdown()
			})

			org1Ctx := createTestContext(t, helper, helper.Org1, dualWriterMode)

			t.Run("Dashboard validation tests", func(t *testing.T) {
				runDashboardValidationTests(t, org1Ctx)
			})

			t.Run("Dashboard quota tests", func(t *testing.T) {
				runQuotaTests(t, org1Ctx)
			})
		})
	}

	for _, dualWriterMode := range dualWriterModes {
		t.Run(fmt.Sprintf("DualWriterMode %d - kubernetesDashboards disabled", dualWriterMode), func(t *testing.T) {
			// Create a K8sTestHelper which will set up a real API server
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableAnonymous: true,
				EnableFeatureToggles: []string{
					featuremgmt.FlagKubernetesClientDashboardsFolders, // Enable dashboard feature
					featuremgmt.FlagUnifiedStorageSearch,
				},
				DisableFeatureToggles: []string{
					featuremgmt.FlagKubernetesDashboards,
				},
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"dashboards.dashboard.grafana.app": {
						DualWriterMode: dualWriterMode,
					},
				},
			})

			t.Cleanup(func() {
				helper.Shutdown()
			})

			org1Ctx := createTestContext(t, helper, helper.Org1, dualWriterMode)

			t.Run("Dashboard permission tests", func(t *testing.T) {
				runDashboardPermissionTests(t, org1Ctx, false)
			})
		})
	}
}

// TestIntegrationDashboardAPIAuthorization tests the dashboard K8s API with authorization checks
func TestIntegrationDashboardAPIAuthorization(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dualWriterModes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, dualWriterMode := range dualWriterModes {
		t.Run(fmt.Sprintf("DualWriterMode %d", dualWriterMode), func(t *testing.T) {
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
					"folders.folder.grafana.app": {
						DualWriterMode: dualWriterMode,
					},
				},
			})

			t.Cleanup(func() {
				helper.Shutdown()
			})

			org1Ctx := createTestContext(t, helper, helper.Org1, dualWriterMode)
			org2Ctx := createTestContext(t, helper, helper.OrgB, dualWriterMode)

			t.Run("Authorization tests for all identity types", func(t *testing.T) {
				runAuthorizationTests(t, org1Ctx)
			})

			t.Run("Dashboard permission tests", func(t *testing.T) {
				runDashboardPermissionTests(t, org1Ctx, false)
			})

			t.Run("Cross-organization tests", func(t *testing.T) {
				runCrossOrgTests(t, org1Ctx, org2Ctx)
			})

			t.Run("Dashboard HTTP API test", func(t *testing.T) {
				runDashboardHttpTest(t, org1Ctx, org2Ctx)
			})
		})
	}
}

// TestIntegrationDashboardAPI tests the dashboard K8s API
func TestIntegrationDashboardAPI(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dualWriterModes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, dualWriterMode := range dualWriterModes {
		t.Run(fmt.Sprintf("DualWriterMode %d", dualWriterMode), func(t *testing.T) {
			// Create a K8sTestHelper which will set up a real API server
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableAnonymous: true,
				EnableFeatureToggles: []string{
					featuremgmt.FlagKubernetesClientDashboardsFolders, // Enable dashboard feature
					featuremgmt.FlagUnifiedStorageSearch,
					featuremgmt.FlagKubernetesDashboards,
				},
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"dashboards.dashboard.grafana.app": {
						DualWriterMode: dualWriterMode,
					},
					"folders.folder.grafana.app": {
						DualWriterMode: dualWriterMode,
					},
				},
			})

			t.Cleanup(func() {
				helper.Shutdown()
			})

			org1Ctx := createTestContext(t, helper, helper.Org1, dualWriterMode)
			org2Ctx := createTestContext(t, helper, helper.OrgB, dualWriterMode)

			t.Run("Dashboard LIST API test", func(t *testing.T) {
				runDashboardListTests(t, org1Ctx)
			})

			t.Run("Authorization tests for all identity types", func(t *testing.T) {
				runAuthorizationTests(t, org1Ctx)
			})

			t.Run("Dashboard permission tests", func(t *testing.T) {
				runDashboardPermissionTests(t, org1Ctx, true)
			})

			t.Run("Dashboard HTTP API test", func(t *testing.T) {
				runDashboardHttpTest(t, org1Ctx, org2Ctx)
			})

			t.Run("Cross-organization tests", func(t *testing.T) {
				runCrossOrgTests(t, org1Ctx, org2Ctx)
			})
		})
	}
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

	// Get a new resource client for admin user
	// TODO: we need to figure out why reusing the same client results in slower tests
	adminClient := func() *apis.K8sResourceClient {
		return getResourceClient(t, ctx.Helper, ctx.AdminUser, getDashboardGVR())
	}
	editorClient := getResourceClient(t, ctx.Helper, ctx.EditorUser, getDashboardGVR())

	t.Run("Dashboard UID validations", func(t *testing.T) {
		// Test creating dashboard with existing UID
		t.Run("reject dashboard with existing UID", func(t *testing.T) {
			// Create a dashboard with a specific UID
			specificUID := "existing-uid-dash"
			createdDash, err := createDashboard(t, adminClient(), "Dashboard with Specific UID", nil, &specificUID)
			require.NoError(t, err)

			// Try to create another dashboard with the same UID
			_, err = createDashboard(t, adminClient(), "Another Dashboard with Same UID", nil, &specificUID)
			require.Error(t, err)

			// Clean up
			err = adminClient().Resource.Delete(context.Background(), createdDash.GetName(), v1.DeleteOptions{})
			require.NoError(t, err)
		})

		// Test creating dashboard with too long UID
		t.Run("reject dashboard with too long UID", func(t *testing.T) {
			// Create a dashboard with a long UID (over 40 chars)
			longUID := "this-uid-is-way-too-long-for-a-dashboard-uid-12345678901234567890"
			_, err := createDashboard(t, adminClient(), "Dashboard with Long UID", nil, &longUID)
			require.Error(t, err)
		})

		// Test creating dashboard with invalid UID characters
		t.Run("reject dashboard with invalid UID characters", func(t *testing.T) {
			invalidUID := "invalid/uid/with/slashes"
			_, err := createDashboard(t, adminClient(), "Dashboard with Invalid UID", nil, &invalidUID)
			require.Error(t, err)
		})
	})

	// TODO: Validate both at creation and update
	t.Run("Dashboard title validations", func(t *testing.T) {
		// Test empty title
		t.Run("reject dashboard with empty title", func(t *testing.T) {
			_, err := createDashboard(t, adminClient(), "", nil, nil)
			require.Error(t, err)
		})

		// Test long title
		t.Run("reject dashboard with excessively long title", func(t *testing.T) {
			veryLongTitle := strings.Repeat("a", 10000)
			_, err := createDashboard(t, adminClient(), veryLongTitle, nil, nil)
			require.Error(t, err)
		})

		// Test updating dashboard with empty title
		t.Run("reject dashboard update with empty title", func(t *testing.T) {
			// First create a valid dashboard
			dash, err := createDashboard(t, adminClient(), "Valid Dashboard Title", nil, nil)
			require.NoError(t, err)
			require.NotNil(t, dash)

			// Try to update with empty title
			_, err = updateDashboard(t, adminClient(), dash, "", nil)
			require.Error(t, err)

			// Clean up
			err = adminClient().Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
			require.NoError(t, err)
		})

		// Test updating dashboard with excessively long title
		t.Run("reject dashboard update with excessively long title", func(t *testing.T) {
			// First create a valid dashboard
			dash, err := createDashboard(t, adminClient(), "Valid Dashboard Title", nil, nil)
			require.NoError(t, err)
			require.NotNil(t, dash)

			// Try to update with excessively long title
			veryLongTitle := strings.Repeat("a", 10000)
			_, err = updateDashboard(t, adminClient(), dash, veryLongTitle, nil)
			require.Error(t, err)

			// Clean up
			err = adminClient().Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
			require.NoError(t, err)
		})
	})

	t.Run("Dashboard message validations", func(t *testing.T) {
		// Test long message
		t.Run("reject dashboard with excessively long update message", func(t *testing.T) {
			dash, err := createDashboard(t, adminClient(), "Regular dashboard", nil, nil)
			require.NoError(t, err)

			veryLongMessage := strings.Repeat("a", 600)
			_, err = updateDashboard(t, adminClient(), dash, "Dashboard updated with a long message", &veryLongMessage)
			require.Error(t, err)

			// Clean up
			err = adminClient().Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
			require.NoError(t, err)
		})
	})

	t.Run("Dashboard folder validations", func(t *testing.T) {
		// Test non-existent folder UID
		t.Run("reject dashboard with non-existent folder UID", func(t *testing.T) {
			nonExistentFolderUID := "non-existent-folder-uid"
			_, err := createDashboard(t, adminClient(), "Dashboard in Non-existent Folder", &nonExistentFolderUID, nil)
			ctx.Helper.EnsureStatusError(err, http.StatusNotFound, "folders.folder.grafana.app \"non-existent-folder-uid\" not found")
		})

		t.Run("allow moving folder to general folder", func(t *testing.T) {
			folder1 := createFolderObject(t, "folder1", "default", "")
			folder1UID := folder1.GetName()
			dash, err := createDashboard(t, adminClient(), "Dashboard in a Folder", &folder1UID, nil)
			require.NoError(t, err)

			generalFolderUID := ""
			_, err = updateDashboard(t, adminClient(), dash, "Move dashboard into the General Folder", &generalFolderUID)
			require.NoError(t, err)

			err = adminClient().Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
			require.NoError(t, err)
		})
	})

	t.Run("Dashboard schema validations", func(t *testing.T) {
		// Test invalid dashboard schema
		t.Run("reject dashboard with invalid schema", func(t *testing.T) {
			testCases := []struct {
				name          string
				resourceInfo  utils.ResourceInfo
				expectSpecErr bool
				testObject    *unstructured.Unstructured
			}{
				{
					name:          "v0alpha1 dashboard with wrong spec should not throw on v0",
					resourceInfo:  dashboardV0.DashboardResourceInfo,
					expectSpecErr: false,
					testObject: &unstructured.Unstructured{
						Object: map[string]interface{}{
							"apiVersion": dashboardV0.DashboardResourceInfo.TypeMeta().APIVersion,
							"kind":       "Dashboard",
							"metadata": map[string]interface{}{
								"generateName": "test-",
							},
							"spec": map[string]interface{}{
								"title":         "Dashboard Title",
								"schemaVersion": 41,
								"editable":      "elephant",
								"time":          9000,
								"uid":           strings.Repeat("a", 100),
							},
						},
					},
				},
				{
					name:          "v1 dashboard with wrong spec should throw on v1",
					resourceInfo:  dashboardV1.DashboardResourceInfo,
					expectSpecErr: true,
					testObject: &unstructured.Unstructured{
						Object: map[string]interface{}{
							"apiVersion": dashboardV1.DashboardResourceInfo.TypeMeta().APIVersion,
							"kind":       "Dashboard",
							"metadata": map[string]interface{}{
								"generateName": "test-",
							},
							"spec": map[string]interface{}{
								"title":         "Dashboard Title",
								"schemaVersion": 41,
								"editable":      "elephant",
								"time":          9000,
								"uid":           strings.Repeat("a", 100),
							},
						},
					},
				},
				{
					name:          "v2alpha1 dashboard with correct spec should not throw on v2",
					resourceInfo:  dashboardV2alpha1.DashboardResourceInfo,
					expectSpecErr: false,
					testObject: &unstructured.Unstructured{
						Object: map[string]interface{}{
							"apiVersion": dashboardV2alpha1.DashboardResourceInfo.TypeMeta().APIVersion,
							"kind":       "Dashboard",
							"metadata": map[string]interface{}{
								"generateName": "test-",
							},
							"spec": map[string]interface{}{
								"title":       "Dashboard Title",
								"description": "valid description",
							},
						},
					},
				},
				{
					name:          "v2alpha2 dashboard with correct spec should not throw on v2",
					resourceInfo:  dashboardV2alpha2.DashboardResourceInfo,
					expectSpecErr: false,
					testObject: &unstructured.Unstructured{
						Object: map[string]interface{}{
							"apiVersion": dashboardV2alpha2.DashboardResourceInfo.TypeMeta().APIVersion,
							"kind":       "Dashboard",
							"metadata": map[string]interface{}{
								"generateName": "test-",
							},
							"spec": map[string]interface{}{
								"title":       "Dashboard Title",
								"description": "valid description",
							},
						},
					},
				},
			}

			for _, tc := range testCases {
				t.Run(tc.name, func(t *testing.T) {
					resourceClient := getResourceClient(t, ctx.Helper, ctx.AdminUser, tc.resourceInfo.GroupVersionResource())
					createdDashboard, err := resourceClient.Resource.Create(context.Background(), tc.testObject, v1.CreateOptions{})
					if tc.expectSpecErr {
						ctx.Helper.RequireApiErrorStatus(err, v1.StatusReasonInvalid, http.StatusUnprocessableEntity)
					} else {
						require.NoError(t, err)
						require.NotNil(t, createdDashboard)
						err = resourceClient.Resource.Delete(context.Background(), createdDashboard.GetName(), v1.DeleteOptions{})
						require.NoError(t, err)
					}
				})
			}
		})
	})

	t.Run("Dashboard version handling", func(t *testing.T) {
		// Test version increment on update
		t.Run("version increments on dashboard update", func(t *testing.T) {
			// Create a dashboard with admin
			dash, err := createDashboard(t, adminClient(), "Dashboard for Version Test", nil, nil)
			require.NoError(t, err, "Failed to create dashboard for version test")
			dashUID := dash.GetName()

			// Get the initial version
			meta, _ := utils.MetaAccessor(dash)
			initialGeneration := meta.GetGeneration()
			initialRV := meta.GetResourceVersion()

			// Update the dashboard
			updatedDash, err := updateDashboard(t, adminClient(), dash, "Updated Dashboard for Version Test", nil)
			require.NoError(t, err)
			require.NotNil(t, updatedDash)

			// Check that version was incremented
			meta, _ = utils.MetaAccessor(updatedDash)
			require.Greater(t, meta.GetGeneration(), initialGeneration, "Generation should be incremented after update")
			require.NotEqual(t, meta.GetResourceVersion(), initialRV, "Resource version should be changed after update")

			// Clean up
			err = adminClient().Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
			require.NoError(t, err)
		})

		// Test generation conflict when updating concurrently
		t.Run("reject update with version conflict", func(t *testing.T) {
			// Create a dashboard with admin
			dash, err := createDashboard(t, adminClient(), "Dashboard for Version Conflict Test", nil, nil)
			require.NoError(t, err, "Failed to create dashboard for version conflict test")
			dashUID := dash.GetName()

			// Get the dashboard twice (simulating two users getting it)
			dash1, err := adminClient().Resource.Get(context.Background(), dashUID, v1.GetOptions{})
			require.NoError(t, err)
			dash2, err := editorClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
			require.NoError(t, err)

			// Update with the first copy
			updatedDash1, err := updateDashboard(t, adminClient(), dash1, "Updated by first user", nil)
			require.NoError(t, err)
			require.NotNil(t, updatedDash1)

			// Try to update with the second copy. Should fail with version conflict.
			_, err = updateDashboard(t, editorClient, dash2, "Updated by second user", nil)
			require.Error(t, err)
			require.Contains(t, err.Error(), "the object has been modified", "Should fail with version conflict error")

			// Clean up
			err = adminClient().Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
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
			createdDash, err := adminClient().Resource.Create(context.Background(), dashObj, v1.CreateOptions{})
			require.NoError(t, err)
			dashUID := createdDash.GetName()

			// Fetch the created dashboard
			fetchedDash, err := adminClient().Resource.Get(context.Background(), dashUID, v1.GetOptions{})
			require.NoError(t, err)

			// Verify the generation was handled properly
			meta, _ = utils.MetaAccessor(fetchedDash)
			require.Equal(t, 5, meta.GetGeneration(), "Generation should be 5")

			// Clean up
			err = adminClient().Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
			require.NoError(t, err)
		})

		t.Run("dashboard version history available, even for UIDs ending in hyphen", func(t *testing.T) {
			dashboardUID := "test-dashboard-"
			dash, err := createDashboard(t, adminClient(), "Dashboard with uid ending in hyphen", nil, &dashboardUID)
			require.NoError(t, err)

			updatedDash, err := updateDashboard(t, adminClient(), dash, "Updated dashboard with uid ending in hyphen", nil)
			require.NoError(t, err)
			require.NotNil(t, updatedDash)

			labelSelector := utils.LabelKeyGetHistory + "=true"
			fieldSelector := "metadata.name=" + dashboardUID
			versions, err := adminClient().Resource.List(context.Background(), v1.ListOptions{
				LabelSelector: labelSelector,
				FieldSelector: fieldSelector,
				Limit:         10,
			})
			require.NoError(t, err)
			require.NotNil(t, versions)
			// one from initial save, one from update
			require.Equal(t, len(versions.Items), 2)

			err = adminClient().Resource.Delete(context.Background(), dashboardUID, v1.DeleteOptions{})
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
				dash, err := createDashboard(t, adminClient(), "Dashboard for Provisioning Test", nil, nil)
				require.NoError(t, err, "Failed to create dashboard for provisioning test")
				dashUID := dash.GetName()

				// Fetch the created dashboard
				fetchedDash, err := adminClient().Resource.Get(context.Background(), dashUID, v1.GetOptions{})
				require.NoError(t, err)
				require.NotNil(t, fetchedDash)

				// Mark the dashboard as provisioned with allowsEdits parameter
				provisionedDash := markDashboardObjectAsProvisioned(t, fetchedDash, "test-provider", "test-external-id", "test-checksum", tc.allowsEdits)

				// Update the dashboard to apply the provisioning annotations
				updatedDash, err := adminClient().Resource.Update(context.Background(), provisionedDash, v1.UpdateOptions{})
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
				err = adminClient().Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
				require.NoError(t, err)
			})
		}
	})

	t.Run("Dashboard refresh interval validations", func(t *testing.T) {
		// Store original settings to restore after test
		origCfg := ctx.Helper.GetEnv().SettingsProvider.Get()
		origMinRefreshInterval := origCfg.MinRefreshInterval

		// Set a fixed min_refresh_interval for all tests to make them predictable
		cfg := ctx.Helper.GetEnv().SettingsProvider.Get()
		cfg.MinRefreshInterval = "10s"

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

				dash, err := adminClient().Resource.Create(context.Background(), dashObj, v1.CreateOptions{})

				if tc.shouldSucceed {
					require.NoError(t, err)
					require.NotNil(t, dash)

					// Clean up
					err = adminClient().Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
					require.NoError(t, err)
				} else {
					require.Error(t, err)
				}
			})
		}

		// Restore original settings
		cfg.MinRefreshInterval = origMinRefreshInterval
	})

	t.Run("Dashboard size limit validations", func(t *testing.T) {
		t.Run("reject dashboard exceeding size limit", func(t *testing.T) {
			t.Skip("Skipping size limit test for now") // TODO: Revisit this.

			// Create a dashboard with a specific UID to make it easier to manage
			specificUID := "size-limit-test-dash"
			dash, err := createDashboard(t, adminClient(), "Dashboard Exceeding Size Limit", nil, &specificUID)
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
			_, err = adminClient().Resource.Update(context.Background(), dash, v1.UpdateOptions{})
			require.Error(t, err)
			require.Contains(t, err.Error(), "exceeds", "Error should mention size or limit exceeded")

			// Clean up
			err = adminClient().Resource.Delete(context.Background(), specificUID, v1.DeleteOptions{})
			require.NoError(t, err)
		})
	})
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
	folderTitle := "Test Folder Org " + strconv.FormatInt(orgUsers.Admin.Identity.GetOrgID(), 10)
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
		AdminServiceAccount:       orgUsers.AdminServiceAccount,
		AdminServiceAccountToken:  orgUsers.AdminServiceAccountToken,
		EditorServiceAccount:      orgUsers.EditorServiceAccount,
		EditorServiceAccountToken: orgUsers.EditorServiceAccountToken,
		ViewerServiceAccount:      orgUsers.ViewerServiceAccount,
		ViewerServiceAccountToken: orgUsers.ViewerServiceAccountToken,
		OrgID:                     orgUsers.Admin.Identity.GetOrgID(),
	}
}

// getDashboardGVR returns the dashboard GroupVersionResource
func getDashboardGVR() schema.GroupVersionResource {
	return dashboardV1.DashboardResourceInfo.GroupVersionResource()
}

// getFolderGVR returns the folder GroupVersionResource
func getFolderGVR() schema.GroupVersionResource {
	return foldersV1.FolderResourceInfo.GroupVersionResource()
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
func createFolderObject(t *testing.T, title string, namespace string, parentFolderUID string) *unstructured.Unstructured {
	t.Helper()

	folderObj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
			"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
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
			"apiVersion": dashboardV1.DashboardResourceInfo.GroupVersion().String(),
			"kind":       dashboardV1.DashboardResourceInfo.GroupVersionKind().Kind,
			"metadata": map[string]interface{}{
				"generateName": "test-",
				"annotations": map[string]interface{}{
					"grafana.app/grant-permissions": "default",
				},
			},
			"spec": map[string]interface{}{
				"title":         title,
				"schemaVersion": 41,
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
	if folderUID != nil {
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
		return nil, err
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

// Run unified tests for different identity types (users and service tokens)
func runAuthorizationTests(t *testing.T, ctx TestContext) {
	t.Helper()

	// Get a new resource client for admin user
	// TODO: we need to figure out why reusing the same client results in slower tests
	adminClient := func() *apis.K8sResourceClient {
		// admin token
		return getServiceAccountResourceClient(t, ctx.Helper, ctx.AdminServiceAccountToken, ctx.OrgID, getDashboardGVR())
	}

	// Get clients for each identity type and role
	adminUserClient := getResourceClient(t, ctx.Helper, ctx.AdminUser, getDashboardGVR())
	editorUserClient := getResourceClient(t, ctx.Helper, ctx.EditorUser, getDashboardGVR())
	viewerUserClient := getResourceClient(t, ctx.Helper, ctx.ViewerUser, getDashboardGVR())

	adminTokenClient := getServiceAccountResourceClient(t, ctx.Helper, ctx.AdminServiceAccountToken, ctx.OrgID, getDashboardGVR())
	editorTokenClient := getServiceAccountResourceClient(t, ctx.Helper, ctx.EditorServiceAccountToken, ctx.OrgID, getDashboardGVR())
	viewerTokenClient := getServiceAccountResourceClient(t, ctx.Helper, ctx.ViewerServiceAccountToken, ctx.OrgID, getDashboardGVR())

	// Define all identities to test
	identities := []Identity{
		// User identities
		{Name: "Admin user", DashboardClient: adminUserClient, Type: "user"},
		{Name: "Editor user", DashboardClient: editorUserClient, Type: "user"},
		{Name: "Viewer user", DashboardClient: viewerUserClient, Type: "user"},

		// Token identities
		{Name: "Admin token", DashboardClient: adminTokenClient, Type: "token"},
		{Name: "Editor token", DashboardClient: editorTokenClient, Type: "token"},
		{Name: "Viewer token", DashboardClient: viewerTokenClient, Type: "token"},
	}

	// TODO: re-enable admin cleanup clients when we have figured out why reusing the same client results in slower tests
	// TODO: This is currently disabled to avoid issues with reusing the same client in tests.
	// Get admin clients for cleanup based on identity type
	// adminCleanupClients := map[string]*apis.K8sResourceClient{
	//		"user":  adminUserClient,
	//		"token": adminTokenClient,
	//	}

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
				authTests[identity.DashboardClient] = role
				break
			}
		}
	}

	// Run tests for each identity type
	for _, identity := range identities {
		identity := identity // Capture range variable
		t.Run(identity.Name, func(t *testing.T) {
			// TODO: This is currently disabled to avoid issues with reusing the same client in tests.
			// Get admin client for cleanup based on identity type
			// adminClient := adminCleanupClients[identity.Type]

			// Get role capabilities for this identity
			roleCapabilities := authTests[identity.DashboardClient]

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
							dash, err := createDashboard(t, identity.DashboardClient, identity.Name+" Dashboard "+loc.name, &loc.folderUID, nil)
							require.NoError(t, err)
							require.NotNil(t, dash)

							// Verify if dashboard was created in the correct folder
							if loc.folderUID != "" {
								meta, _ := utils.MetaAccessor(dash)
								folderUID := meta.GetFolder()
								require.Equal(t, loc.folderUID, folderUID, "Dashboard should be in the expected folder")
							}

							// Clean up
							err = adminClient().Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
							require.NoError(t, err)
						} else {
							// Test cannot create dashboard
							_, err := createDashboard(t, identity.DashboardClient, identity.Name+" Dashboard "+loc.name, nil, nil)
							require.Error(t, err)
						}
					})
				}
			})

			// Test dashboard updates
			t.Run("dashboard update", func(t *testing.T) {
				// Create a dashboard with admin
				dash, err := createDashboard(t, adminClient(), "Dashboard to Update by "+identity.Name, nil, nil)
				require.NoError(t, err)
				require.NotNil(t, dash)

				if roleCapabilities.canUpdate {
					// Test can update dashboard
					updatedDash, err := updateDashboard(t, identity.DashboardClient, dash, "Updated by "+identity.Name, nil)
					require.NoError(t, err)
					require.NotNil(t, updatedDash)

					// Verify the update
					meta, _ := utils.MetaAccessor(updatedDash)
					require.Equal(t, "Updated by "+identity.Name, meta.FindTitle(""))
				} else {
					// Test cannot update dashboard
					_, err := updateDashboard(t, identity.DashboardClient, dash, "Updated by "+identity.Name, nil)
					require.Error(t, err)
				}

				// Clean up
				err = adminClient().Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
				require.NoError(t, err)
			})

			// Test dashboard deletion permissions
			t.Run("dashboard deletion", func(t *testing.T) {
				// Create a dashboard with admin
				dash, err := createDashboard(t, adminClient(), "Dashboard for deletion test by "+identity.Name, nil, nil)
				require.NoError(t, err)
				require.NotNil(t, dash)

				// Attempt to delete
				err = identity.DashboardClient.Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
				if roleCapabilities.canDelete {
					require.NoError(t, err, "Should be able to delete dashboard")
				} else {
					require.Error(t, err, "Should not be able to delete dashboard")
					// Clean up with admin if the test identity couldn't delete
					err = adminClient().Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
					require.NoError(t, err)
				}
			})

			// TODO: Check if vieweing permission can be revoked as well.
			// Test dashboard viewing for all roles
			t.Run("dashboard viewing", func(t *testing.T) {
				// Create a dashboard with admin
				dash, err := createDashboard(t, adminClient(), "Dashboard for "+identity.Name+" to view", nil, nil)
				require.NoError(t, err)
				require.NotNil(t, dash)

				// Get the dashboard with the test identity
				viewedDash, err := identity.DashboardClient.Resource.Get(context.Background(), dash.GetName(), v1.GetOptions{})
				require.NoError(t, err, "All identities should be able to view dashboards")
				require.NotNil(t, viewedDash)

				// Clean up
				err = adminClient().Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
				require.NoError(t, err)
			})
		})
	}
}

// Run tests for dashboard permissions
func runDashboardPermissionTests(t *testing.T, ctx TestContext, kubernetesDashboardsEnabled bool) {
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
		setResourceUserPermission(t, ctx, ctx.AdminUser, true, dashUID, addUserPermission(t, nil, ctx.ViewerUser, ResourcePermissionLevelEdit))

		// Now the viewer should be able to update the dashboard
		viewedDash, err := viewerClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
		require.NoError(t, err)

		// Update the dashboard with viewer (should succeed because of custom permissions)
		updatedDash, err := updateDashboard(t, viewerClient, viewedDash, "Updated by Viewer with Permission", nil)
		require.NoError(t, err)
		require.NotNil(t, updatedDash)

		// Verify the update
		meta, _ := utils.MetaAccessor(updatedDash)
		require.Equal(t, "Updated by Viewer with Permission", meta.FindTitle(""))

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
		setResourceUserPermission(t, ctx, ctx.AdminUser, true, dash2UID, addUserPermission(t, nil, ctx.ViewerUser, ResourcePermissionLevelEdit))

		// Verify viewer cannot edit dashboard1 (no custom permissions)
		_, err = updateDashboard(t, viewerClient, dash1, "This should fail - no permissions", nil)
		require.Error(t, err, "Viewer should not be able to update dashboard without permissions")

		// Verify viewer can edit dashboard2 (with custom permissions)
		viewedDash2, err := viewerClient.Resource.Get(context.Background(), dash2UID, v1.GetOptions{})
		require.NoError(t, err)

		updatedDash2, err := updateDashboard(t, viewerClient, viewedDash2, "Updated by Viewer with Dashboard-Specific Permission", nil)
		require.NoError(t, err)
		require.NotNil(t, updatedDash2)

		// Verify the update
		meta, _ := utils.MetaAccessor(updatedDash2)
		require.Equal(t, "Updated by Viewer with Dashboard-Specific Permission", meta.FindTitle(""))

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
		setResourceUserPermission(t, ctx, ctx.AdminUser, false, folderUID, addUserPermission(t, nil, ctx.ViewerUser, ResourcePermissionLevelEdit))

		// Create a dashboard in the folder with admin
		dash, err := createDashboard(t, adminClient, "Dashboard in Custom Permission Folder", &folderUID, nil)
		require.NoError(t, err)
		require.NotNil(t, dash)

		// Get the dashboard with viewer
		viewedDash, err := viewerClient.Resource.Get(context.Background(), dash.GetName(), v1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, viewedDash)

		// Update the dashboard with viewer (should succeed because of folder permissions)
		updatedDash, err := updateDashboard(t, viewerClient, viewedDash, "Updated by Viewer with Folder Permission", nil)
		require.NoError(t, err)
		require.NotNil(t, updatedDash)

		// Verify the update
		meta, _ := utils.MetaAccessor(updatedDash)
		require.Equal(t, "Updated by Viewer with Folder Permission", meta.FindTitle(""))

		// User should be able to create a dashboard in the folder
		dashViewer, err := createDashboard(t, viewerClient, "Dashboard created by Viewer in Custom Permission Folder", &folderUID, nil)
		require.NoError(t, err)
		require.NotNil(t, dashViewer)

		// Revert granted permissions
		setResourceUserPermission(t, ctx, ctx.AdminUser, false, folderUID, generateDefaultResourcePermissions(t))

		// Clean up dashboard
		err = adminClient.Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
		require.NoError(t, err)

		if kubernetesDashboardsEnabled {
			// In case kubernetesDashboards feature flag is set to true,
			// we don't grant admin permission to dashboard creator on nested folders.
			// This means that the viewer will not be able to delete the dashboard.
			err = viewerClient.Resource.Delete(context.Background(), dashViewer.GetName(), v1.DeleteOptions{})
			require.Error(t, err)
			err = adminClient.Resource.Delete(context.Background(), dashViewer.GetName(), v1.DeleteOptions{})
			require.NoError(t, err)
		} else {
			// In case kubernetesDashboards feature flag is set to false,
			// we grant admin permission to dashboard creator on nested folders.
			// This means that the viewer will be able to delete the dashboard.
			err = viewerClient.Resource.Delete(context.Background(), dashViewer.GetName(), v1.DeleteOptions{})
			require.NoError(t, err)
		}

		// Clean up the folder
		err = adminFolderClient.Resource.Delete(context.Background(), folderUID, v1.DeleteOptions{})
		require.NoError(t, err)
	})

	// Test moving dashboard to folder without permission
	t.Run("Cannot move dashboard to folder without permission", func(t *testing.T) {
		// Create two folders with the admin
		folder1, err := createFolder(t, ctx.Helper, ctx.AdminUser, "Default Permission Folder")
		require.NoError(t, err, "Failed to create default permission folder")
		folder1UID := folder1.UID

		folder2, err := createFolder(t, ctx.Helper, ctx.AdminUser, "Viewer Edit Permission Folder")
		require.NoError(t, err, "Failed to create folder with viewer edit permissions")
		folder2UID := folder2.UID

		// Set permissions for folder2 - give viewer edit access
		setResourceUserPermission(t, ctx, ctx.AdminUser, false, folder2UID, addUserPermission(t, nil, ctx.ViewerUser, ResourcePermissionLevelEdit))

		// Have the viewer create a dashboard in folder2
		viewerDash, err := createDashboard(t, viewerClient, "Dashboard created by Viewer in Edit Permission Folder", &folder2UID, nil)
		require.NoError(t, err, "Viewer should be able to create dashboard in folder with edit permissions")
		require.NotNil(t, viewerDash)
		dashUID := viewerDash.GetName()

		// Verify the dashboard has folder2UID set
		meta, _ := utils.MetaAccessor(viewerDash)
		folderUID := meta.GetFolder()
		require.Equal(t, folder2UID, folderUID, "Dashboard should be in folder2")

		// Try to update the dashboard to move it to folder1 (where viewer has no edit permission)
		meta.SetFolder(folder1UID)

		// This update should fail because viewer doesn't have edit permission in folder1
		_, err = viewerClient.Resource.Update(context.Background(), viewerDash, v1.UpdateOptions{})
		require.Error(t, err, "Viewer should not be able to move dashboard to folder without edit permission")

		// We're piggybacking onto this test to test if moving to a non existent folder also fails:
		meta.SetFolder("non-existent-folder-uid")
		_, err = viewerClient.Resource.Update(context.Background(), viewerDash, v1.UpdateOptions{})
		require.Error(t, err, "Viewer should not be able to move dashboard to non-existent folder")
		_, err = adminClient.Resource.Update(context.Background(), viewerDash, v1.UpdateOptions{})
		require.Error(t, err, "Admin should not be able to move dashboard to non-existent folder")

		err = adminClient.Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
		require.NoError(t, err, "Failed to delete dashboard")
		err = adminFolderClient.Resource.Delete(context.Background(), folder1UID, v1.DeleteOptions{})
		require.NoError(t, err, "Failed to delete folder1")
		err = adminFolderClient.Resource.Delete(context.Background(), folder2UID, v1.DeleteOptions{})
		require.NoError(t, err, "Failed to delete folder2")
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
		// Use the editor to set permissions (should succeed because creator has Admin permission)
		setResourceUserPermission(t, ctx, ctx.EditorUser, true, dashUID, addUserPermission(t, nil, ctx.ViewerUser, ResourcePermissionLevelEdit))

		// Now verify the viewer can edit the dashboard
		viewedDash, err := viewerClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
		require.NoError(t, err)

		updatedDash, err := updateDashboard(t, viewerClient, viewedDash, "Updated by Viewer with Permission from Editor", nil)
		require.NoError(t, err)
		require.NotNil(t, updatedDash)

		// Verify the update
		meta, _ := utils.MetaAccessor(updatedDash)
		require.Equal(t, "Updated by Viewer with Permission from Editor", meta.FindTitle(""))

		// Clean up
		err = editorClient.Resource.Delete(context.Background(), dashUID, v1.DeleteOptions{})
		require.NoError(t, err, "Editor should be able to delete dashboard they created")
	})

	// Test scenario where admin restricts editor's access to dashboard they created
	t.Run("Admin can override creator permissions", func(t *testing.T) {
		t.Skip("Have to double check if that's actually the case")
		// Create a dashboard as an editor user (not admin)
		editorCreatedDash, err := createDashboard(t, editorClient, "Dashboard Created by Editor for Permission Test", nil, nil)
		require.NoError(t, err)
		require.NotNil(t, editorCreatedDash)
		dashUID := editorCreatedDash.GetName()

		// Verify editor can initially edit their dashboard (they have Admin permission as creator)
		initialViewedDash, err := editorClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
		require.NoError(t, err)

		initialUpdatedDash, err := updateDashboard(t, editorClient, initialViewedDash, "Initial Update by Creator", nil)
		require.NoError(t, err)
		require.NotNil(t, initialUpdatedDash)

		// Admin restricts editor to view-only on their own dashboard
		setResourceUserPermission(t, ctx, ctx.AdminUser, true, dashUID, addUserPermission(t, nil, ctx.EditorUser, ResourcePermissionLevelView))

		// Now editor should NOT be able to edit the dashboard (admin override should succeed)
		viewedDash, err := editorClient.Resource.Get(context.Background(), dashUID, v1.GetOptions{})
		require.NoError(t, err)

		// Update attempt should fail
		_, err = updateDashboard(t, editorClient, viewedDash, "This update should fail", nil)
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
		org1DashUID := dash.GetName()

		// Set the highest permissions for the viewer in the current org
		setResourceUserPermission(t, ctx, ctx.AdminUser, true, org1DashUID, addUserPermission(t, nil, ctx.ViewerUser, ResourcePermissionLevelAdmin))

		// Verify the viewer in the current org can now view and update the dashboard
		viewerDash, err := viewerClient.Resource.Get(context.Background(), org1DashUID, v1.GetOptions{})
		require.NoError(t, err, "Viewer with custom permissions should be able to view the dashboard")

		_, err = updateDashboard(t, viewerClient, viewerDash, "Updated by Viewer with Admin Permissions", nil)
		require.NoError(t, err, "Viewer with admin permissions should be able to update the dashboard")

		// Try to access the dashboard from a viewer in the other org
		_, err = otherOrgClient.Resource.Get(context.Background(), org1DashUID, v1.GetOptions{})
		require.Error(t, err, "User from other org should not be able to view dashboard even with custom permissions")
		// statusErr := ctx.Helper.AsStatusError(err)
		// require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code), "Should get 404 Not Found")
		// TODO: Find out why this throws a 500 instead of a 404 with this message:
		// an error on the server (\"Internal Server Error: \\\"/apis/dashboard.grafana.app/v1beta1/namespaces/org-3/dashboards/test-cs6xk\\\": Dashboard not found\") has prevented the request from succeeding"

		// Clean up
		err = adminClient.Resource.Delete(context.Background(), org1DashUID, v1.DeleteOptions{})
		require.NoError(t, err)
	})
}

// Run tests specifically checking cross-org behavior
func runCrossOrgTests(t *testing.T, org1Ctx, org2Ctx TestContext) {
	// Get clients for both organizations
	org1SuperAdminClient := getResourceClient(t, org1Ctx.Helper, org1Ctx.AdminUser, getDashboardGVR())
	org1FolderClient := getResourceClient(t, org1Ctx.Helper, org1Ctx.AdminUser, getFolderGVR())

	org2SuperAdminClient := getResourceClient(t, org2Ctx.Helper, org2Ctx.AdminUser, getDashboardGVR())
	org2FolderClient := getResourceClient(t, org2Ctx.Helper, org2Ctx.AdminUser, getFolderGVR())

	// Org 1 users trying to access org2
	org1CrossEditorClient := org2Ctx.Helper.GetResourceClient(apis.ResourceClientArgs{
		User:      org1Ctx.EditorUser,
		Namespace: org2Ctx.Helper.Namespacer(org2Ctx.OrgID),
		GVR:       getDashboardGVR(),
	})
	org1CrossViewerClient := org2Ctx.Helper.GetResourceClient(apis.ResourceClientArgs{
		User:      org1Ctx.ViewerUser,
		Namespace: org2Ctx.Helper.Namespacer(org2Ctx.OrgID),
		GVR:       getDashboardGVR(),
	})
	org1CrossEditorTokenClient := org2Ctx.Helper.GetResourceClient(apis.ResourceClientArgs{
		ServiceAccountToken: org1Ctx.EditorServiceAccountToken,
		Namespace:           org2Ctx.Helper.Namespacer(org2Ctx.OrgID),
		GVR:                 getDashboardGVR(),
	})
	org1CrossViewerTokenClient := org2Ctx.Helper.GetResourceClient(apis.ResourceClientArgs{
		ServiceAccountToken: org1Ctx.ViewerServiceAccountToken,
		Namespace:           org2Ctx.Helper.Namespacer(org2Ctx.OrgID),
		GVR:                 getDashboardGVR(),
	})

	// Org 2 users trying to access org1
	org2CrossEditorClient := org1Ctx.Helper.GetResourceClient(apis.ResourceClientArgs{
		User:      org2Ctx.EditorUser,
		Namespace: org1Ctx.Helper.Namespacer(org1Ctx.OrgID),
		GVR:       getDashboardGVR(),
	})
	org2CrossViewerClient := org1Ctx.Helper.GetResourceClient(apis.ResourceClientArgs{
		User:      org2Ctx.ViewerUser,
		Namespace: org1Ctx.Helper.Namespacer(org1Ctx.OrgID),
		GVR:       getDashboardGVR(),
	})
	org2CrossEditorTokenClient := org1Ctx.Helper.GetResourceClient(apis.ResourceClientArgs{
		ServiceAccountToken: org2Ctx.EditorServiceAccountToken,
		Namespace:           org1Ctx.Helper.Namespacer(org1Ctx.OrgID),
		GVR:                 getDashboardGVR(),
	})
	org2CrossViewerTokenClient := org1Ctx.Helper.GetResourceClient(apis.ResourceClientArgs{
		ServiceAccountToken: org2Ctx.ViewerServiceAccountToken,
		Namespace:           org1Ctx.Helper.Namespacer(org1Ctx.OrgID),
		GVR:                 getDashboardGVR(),
	})

	// Test dashboard and folder name/UID uniqueness across orgs
	t.Run("Dashboard and folder names/UIDs are unique per organization", func(t *testing.T) {
		// Create dashboard with same UID in both orgs - should succeed
		uid := "cross-org-dash-uid"
		dashTitle := "Cross-Org Dashboard"

		// Create in org1
		dash1, err := createDashboard(t, org1SuperAdminClient, dashTitle, nil, &uid)
		require.NoError(t, err, "Failed to create dashboard in org1")

		// Create in org2 with same UID - should succeed (UIDs only need to be unique within an org)
		dash2, err := createDashboard(t, org2SuperAdminClient, dashTitle, nil, &uid)
		require.NoError(t, err, "Failed to create dashboard with same UID in org2")

		// Verify both dashboards were created
		require.Equal(t, uid, dash1.GetName(), "Dashboard UID in org1 should match")
		require.Equal(t, uid, dash2.GetName(), "Dashboard UID in org2 should match")

		_, err = updateDashboard(t, org1SuperAdminClient, dash1, "Updated in org1", nil)
		require.NoError(t, err, "Failed to update dashboard in org1")

		_, err = updateDashboard(t, org2SuperAdminClient, dash2, "Updated in org2", nil)
		require.NoError(t, err, "Failed to update dashboard in org2")

		dash1updated, err := org1SuperAdminClient.Resource.Get(context.Background(), uid, v1.GetOptions{})
		require.NoError(t, err, "Failed to get updated dashboard in org1")
		meta1, _ := utils.MetaAccessor(dash1updated)
		require.Equal(t, "Updated in org1", meta1.FindTitle(""), "Dashboard title in org1 should be updated")

		dash2updated, err := org2SuperAdminClient.Resource.Get(context.Background(), uid, v1.GetOptions{})
		require.NoError(t, err, "Failed to get updated dashboard in org2")
		meta2, _ := utils.MetaAccessor(dash2updated)
		require.Equal(t, "Updated in org2", meta2.FindTitle(""), "Dashboard title in org2 should be updated")

		// Clean up
		err = org1SuperAdminClient.Resource.Delete(context.Background(), uid, v1.DeleteOptions{})
		require.NoError(t, err, "Failed to delete dashboard in org1")

		err = org2SuperAdminClient.Resource.Delete(context.Background(), uid, v1.DeleteOptions{})
		require.NoError(t, err, "Failed to delete dashboard in org2")

		// Repeat test with folders
		folderUID := "cross-org-folder-uid"
		folderTitle := "Cross-Org Folder"

		// Create folder objects directly with fixed UIDs
		folder1 := createFolderObject(t, folderTitle, org1Ctx.Helper.Namespacer(org1Ctx.OrgID), "")
		meta1, err = utils.MetaAccessor(folder1)
		require.NoError(t, err)
		meta1.SetName(folderUID)
		meta1.SetGenerateName("")

		folder2 := createFolderObject(t, folderTitle, org2Ctx.Helper.Namespacer(org2Ctx.OrgID), "")
		meta2, err = utils.MetaAccessor(folder2)
		require.NoError(t, err)
		meta2.SetName(folderUID)
		meta2.SetGenerateName("")

		// Create folders in both orgs
		createdFolder1, err := org1FolderClient.Resource.Create(context.Background(), folder1, v1.CreateOptions{})
		require.NoError(t, err, "Failed to create folder in org1")

		createdFolder2, err := org2FolderClient.Resource.Create(context.Background(), folder2, v1.CreateOptions{})
		require.NoError(t, err, "Failed to create folder with same UID in org2")

		// Verify both folders were created with the same UID
		require.Equal(t, folderUID, createdFolder1.GetName(), "Folder UID in org1 should match")
		require.Equal(t, folderUID, createdFolder2.GetName(), "Folder UID in org2 should match")

		// Rename folders
		_, err = updateDashboard(t, org1FolderClient, createdFolder1, "Updated folder in org1", nil)
		require.NoError(t, err, "Failed to update folder in org1")

		_, err = updateDashboard(t, org2FolderClient, createdFolder2, "Updated folderin org2", nil)
		require.NoError(t, err, "Failed to update folder in org2")

		folder1updated, err := org1FolderClient.Resource.Get(context.Background(), folderUID, v1.GetOptions{})
		require.NoError(t, err, "Failed to get updated folder in org1")
		meta1, _ = utils.MetaAccessor(folder1updated)
		require.Equal(t, "Updated folder in org1", meta1.FindTitle(""), "Folder title in org1 should be updated")

		folder2updated, err := org2FolderClient.Resource.Get(context.Background(), folderUID, v1.GetOptions{})
		require.NoError(t, err, "Failed to get updated folder in org2")
		meta2, _ = utils.MetaAccessor(folder2updated)
		require.Equal(t, "Updated folderin org2", meta2.FindTitle(""), "Folder title in org2 should be updated")

		// Clean up
		err = org1FolderClient.Resource.Delete(context.Background(), folderUID, v1.DeleteOptions{})
		require.NoError(t, err, "Failed to delete folder in org1")

		err = org2FolderClient.Resource.Delete(context.Background(), folderUID, v1.DeleteOptions{})
		require.NoError(t, err, "Failed to delete folder in org2")
	})

	// Test cross-organization access
	t.Run("Cross-organization access", func(t *testing.T) {
		// Create dashboards in both orgs
		org1Dashboard, err := createDashboard(t, org1SuperAdminClient, "Org1 Dashboard", nil, nil)
		require.NoError(t, err)
		require.NotNil(t, org1Dashboard)
		org1DashUID := org1Dashboard.GetName()

		org2Dashboard, err := createDashboard(t, org2SuperAdminClient, "Org2 Dashboard", nil, nil)
		require.NoError(t, err)
		require.NotNil(t, org2Dashboard)
		org2DashUID := org2Dashboard.GetName()

		// Clean up at the end
		defer func() {
			err = org1SuperAdminClient.Resource.Delete(context.Background(), org1DashUID, v1.DeleteOptions{})
			require.NoError(t, err)

			err = org2SuperAdminClient.Resource.Delete(context.Background(), org2DashUID, v1.DeleteOptions{})
			require.NoError(t, err)
		}()

		// Test org1 users trying to access org2 dashboard
		testCrossOrgAccess := func(client *apis.K8sResourceClient, adminClient *apis.K8sResourceClient, targetDashUID string, description string) {
			t.Run(description, func(t *testing.T) {
				// Try to get the dashboard
				_, err := client.Resource.Get(context.Background(), targetDashUID, v1.GetOptions{})
				require.Error(t, err, "Should not be able to access dashboard from another org")
				// statusErr := org1Ctx.Helper.AsStatusError(err)
				// TODO: Find out why this throws a 500 instead of a 404 with this message:
				// "an error on the server (\"Internal Server Error: \\\"/apis/dashboard.grafana.app/v1beta1/namespaces/default/dashboards/test-rbm2q\\\": Dashboard not found\") has prevented the request from succeeding"
				// require.Equal(t, http.StatusNotFound, int(statusErr.Status().Code), "Should get 404 Not Found")

				// Get a dashboard as admin from the target org to then send an update request
				dash, err := adminClient.Resource.Get(context.Background(), targetDashUID, v1.GetOptions{})
				require.NoError(t, err)

				// Try to update the dashboard
				_, err = updateDashboard(t, client, dash, "Renamed dashboard", nil)
				require.Error(t, err, "Should not be able to update dashboard from another org")

				// Try to delete the dashboard
				err = client.Resource.Delete(context.Background(), targetDashUID, v1.DeleteOptions{})
				require.Error(t, err, "Should not be able to delete dashboard from another org")

				// Verify that the rename and delete were not successful
				dash, err = adminClient.Resource.Get(context.Background(), targetDashUID, v1.GetOptions{})
				require.NoError(t, err)
				meta, _ := utils.MetaAccessor(dash)
				require.NotEqual(t, "Renamed dashboard", meta.FindTitle(""), "Dashboard title should not be changed")
			})
		}

		// Test real users from org1 trying to access org2 dashboard
		testCrossOrgAccess(org1CrossEditorClient, org2SuperAdminClient, org2DashUID, "Org1 editor cannot access Org2 dashboard")
		testCrossOrgAccess(org1CrossViewerClient, org2SuperAdminClient, org2DashUID, "Org1 viewer cannot access Org2 dashboard")

		// Test real users from org2 trying to access org1 dashboard
		testCrossOrgAccess(org2CrossEditorClient, org1SuperAdminClient, org1DashUID, "Org2 editor cannot access Org1 dashboard")
		testCrossOrgAccess(org2CrossViewerClient, org1SuperAdminClient, org1DashUID, "Org2 viewer cannot access Org1 dashboard")

		// Test service accounts from org1 trying to access org2 dashboard
		testCrossOrgAccess(org1CrossEditorTokenClient, org2SuperAdminClient, org2DashUID, "Org1 editor token cannot access Org2 dashboard")
		testCrossOrgAccess(org1CrossViewerTokenClient, org2SuperAdminClient, org2DashUID, "Org1 viewer token cannot access Org2 dashboard")

		// Test service accounts from org2 trying to access org1 dashboard
		testCrossOrgAccess(org2CrossEditorTokenClient, org1SuperAdminClient, org1DashUID, "Org2 editor token cannot access Org1 dashboard")
		testCrossOrgAccess(org2CrossViewerTokenClient, org1SuperAdminClient, org1DashUID, "Org2 viewer token cannot access Org1 dashboard")
	})
}

type ResourcePermissionSetting struct {
	Level ResourcePermissionLevel `json:"permission"`

	// Only set one of these!
	Role   *ResourcePermissionRole `json:"role,omitempty"`
	UserID *int64                  `json:"userId,omitempty"`
	TeamID *int64                  `json:"teamId,omitempty"`
}

type ResourcePermissionLevel int

const (
	ResourcePermissionLevelView  ResourcePermissionLevel = 1
	ResourcePermissionLevelEdit  ResourcePermissionLevel = 2
	ResourcePermissionLevelAdmin ResourcePermissionLevel = 4
)

type ResourcePermissionRole string

const (
	ResourcePermissionRoleViewer ResourcePermissionRole = "Viewer"
	ResourcePermissionRoleEditor ResourcePermissionRole = "Editor"
)

func generateDefaultResourcePermissions(t *testing.T) []ResourcePermissionSetting {
	t.Helper()

	viewerRole := ResourcePermissionRoleViewer
	editorRole := ResourcePermissionRoleEditor

	return []ResourcePermissionSetting{
		{
			Level: ResourcePermissionLevelView,
			Role:  &viewerRole,
		},
		{
			Level: ResourcePermissionLevelEdit,
			Role:  &editorRole,
		},
	}
}

func addUserPermission(t *testing.T, basePermissions *[]ResourcePermissionSetting, targetUser apis.User, level ResourcePermissionLevel) []ResourcePermissionSetting {
	t.Helper()

	var permissions []ResourcePermissionSetting
	if basePermissions == nil {
		permissions = generateDefaultResourcePermissions(t)
	} else {
		permissions = *basePermissions
	}

	userIdInt64, err := identity.UserIdentifier(targetUser.Identity.GetID())
	require.NoError(t, err)

	return append(permissions, ResourcePermissionSetting{
		Level:  level,
		UserID: &userIdInt64,
	})
}

// Helper function to set permissions for a user via the HTTP API
func setResourceUserPermission(t *testing.T, ctx TestContext, actingUser apis.User, isDashboard bool, resourceUID string, permissions []ResourcePermissionSetting) {
	t.Helper()

	// TODO: Use /apis once available

	type permissionRequest struct {
		Items []ResourcePermissionSetting `json:"items"`
	}

	reqBody := permissionRequest{
		Items: permissions,
	}

	jsonBody, err := json.Marshal(reqBody)
	require.NoError(t, err, "Failed to marshal permissions to JSON")

	// TODO: Use /apis once available
	var path string
	if isDashboard {
		path = fmt.Sprintf("/api/dashboards/uid/%s/permissions", resourceUID)
	} else {
		path = fmt.Sprintf("/api/folders/%s/permissions", resourceUID)
	}

	resp := apis.DoRequest(ctx.Helper, apis.RequestParams{
		User:        actingUser,
		Method:      http.MethodPost,
		Path:        path,
		Body:        jsonBody,
		ContentType: "application/json",
	}, &struct{}{})

	// Check response status code
	require.Equal(t, http.StatusOK, resp.Response.StatusCode, "Failed to set permissions for %s", resourceUID)
}

// Test creating a dashboard via HTTP and deleting it
func runDashboardHttpTest(t *testing.T, ctx TestContext, foreignOrgCtx TestContext) {
	t.Helper()
	// Define test cases for locations and users
	locationTestCases := []struct {
		name      string
		folderUID string
	}{
		{
			name:      "Root dashboard",
			folderUID: "",
		},
		{
			name:      "Folder dashboard",
			folderUID: ctx.TestFolder.UID,
		},
	}

	userTestCases := []struct {
		name      string
		user      apis.User
		canCreate bool
		canUpdate bool
		canView   bool
	}{
		{
			name:      "Admin",
			user:      ctx.AdminUser,
			canCreate: true,
			canUpdate: true,
			canView:   true,
		},
		{
			name:      "Editor",
			user:      ctx.EditorUser,
			canCreate: true,
			canUpdate: true,
			canView:   true,
		},
		{
			name:      "Viewer",
			user:      ctx.ViewerUser,
			canCreate: false,
			canUpdate: false,
			canView:   true,
		},
		{
			name:      "Foreign Org Admin",
			user:      foreignOrgCtx.AdminUser,
			canCreate: false,
			canUpdate: false,
			canView:   false,
		},
		{
			name:      "Foreign Org Editor",
			user:      foreignOrgCtx.EditorUser,
			canCreate: false,
			canUpdate: false,
			canView:   false,
		},
		{
			name:      "Foreign Org Viewer",
			user:      foreignOrgCtx.ViewerUser,
			canCreate: false,
			canUpdate: false,
			canView:   false,
		},
	}

	// Test all combinations
	for _, locTC := range locationTestCases {
		for _, userTC := range userTestCases {
			testName := fmt.Sprintf("%s by %s", locTC.name, userTC.name)
			t.Run(testName, func(t *testing.T) {
				// Create a unique dashboard UID - ensure it's 40 chars max
				dashboardUID := fmt.Sprintf("test-%s-%s-%s",
					"POST",
					userTC.name[:3],             // Use only first 3 chars of user role
					util.GenerateShortUID()[:8]) // Use only first 8 chars of UID
				dashboardTitle := fmt.Sprintf("Dashboard Created via %s - %s by %s",
					"POST", locTC.name, userTC.name)

				// Construct the dashboard URL
				dashboardPath := fmt.Sprintf("/apis/dashboard.grafana.app/v1beta1/namespaces/%s/dashboards", ctx.Helper.Namespacer(ctx.OrgID))

				// Create dashboard JSON with a single template
				var metadata string
				if locTC.folderUID != "" {
					metadata = fmt.Sprintf(`"name": "%s", "annotations": {"grafana.app/folder": "%s", "grafana.app/grant-permissions": "default"}`,
						dashboardUID, locTC.folderUID)
				} else {
					metadata = fmt.Sprintf(`"name": "%s", "annotations": {"grafana.app/grant-permissions": "default"}`, dashboardUID)
				}

				dashboardJSON := fmt.Sprintf(`{
							"kind": "Dashboard",
							"apiVersion": "dashboard.grafana.app/v1beta1",
							"metadata": {
								%s
							},
							"spec": {
								"title": "%s",
								"schemaVersion": 41,
								"layout": {
									"kind": "GridLayout",
									"items": []
								}
							}
						}`, metadata, dashboardTitle)

				// Make the request to create the dashboard
				createResp := apis.DoRequest(ctx.Helper, apis.RequestParams{
					User:        userTC.user,
					Method:      http.MethodPost,
					Path:        dashboardPath,
					Body:        []byte(dashboardJSON),
					ContentType: "application/json",
				}, &struct{}{})

				// Check if the creation was successful or failed as expected
				adminClient := getResourceClient(t, ctx.Helper, ctx.AdminUser, getDashboardGVR())

				if userTC.canCreate {
					require.Equal(t, http.StatusCreated, createResp.Response.StatusCode,
						"Failed to %s dashboard as %s: %s", "POST", userTC.user.Identity.GetLogin(), createResp.Response.Status)

					// Construct the dashboard path with the actual UID for GET/DELETE
					dashboardPath = fmt.Sprintf("/apis/dashboard.grafana.app/v1beta1/namespaces/%s/dashboards/%s",
						ctx.Helper.Namespacer(ctx.OrgID), dashboardUID)

					// Verify the dashboard was created by getting it via the admin client
					dash, err := adminClient.Resource.Get(context.Background(), dashboardUID, v1.GetOptions{})
					require.NoError(t, err, "Failed to get dashboard after POST")

					// Verify the dashboard properties
					meta, err := utils.MetaAccessor(dash)
					require.NoError(t, err)
					require.Equal(t, dashboardTitle, meta.FindTitle(""), "Dashboard title does not match")

					// Verify folder reference if applicable
					if locTC.folderUID != "" {
						require.Equal(t, locTC.folderUID, meta.GetFolder(), "Dashboard folder reference does not match")
					}

					// Try to GET the dashboard with the test user
					getResp := apis.DoRequest(ctx.Helper, apis.RequestParams{
						User:   userTC.user,
						Method: http.MethodGet,
						Path:   dashboardPath,
					}, &struct{}{})

					require.Equal(t, http.StatusOK, getResp.Response.StatusCode,
						"User %s should be able to GET dashboard: %s", userTC.name, getResp.Response.Status)

					// Extract the dashboard object from the GET response
					var dashObj map[string]interface{}
					err = json.Unmarshal(getResp.Body, &dashObj)
					require.NoError(t, err, "Failed to unmarshal dashboard JSON from GET")

					// Test both update methods for each user role
					for _, updateUser := range userTestCases {
						testDashboardHttpUpdateMethods(t, ctx, dashboardPath, dashboardTitle, updateUser.user, updateUser.canUpdate)
					}

					// Verify whether every role can GET the dashboard that was created
					for _, viewUser := range userTestCases {
						roleGetResp := apis.DoRequest(ctx.Helper, apis.RequestParams{
							User:   viewUser.user,
							Method: http.MethodGet,
							Path:   dashboardPath,
						}, &struct{}{})

						if viewUser.canView {
							require.Equal(t, http.StatusOK, roleGetResp.Response.StatusCode,
								"User %s should be able to GET dashboard: %s", viewUser.name, roleGetResp.Response.Status)
						} else {
							require.NotEqual(t, http.StatusOK, roleGetResp.Response.StatusCode,
								"User %s should not be able to GET dashboard: %s", viewUser.name, roleGetResp.Response.Status)
						}
					}

					// Delete the dashboard with DELETE request
					deleteResp := apis.DoRequest(ctx.Helper, apis.RequestParams{
						User:   userTC.user,
						Method: http.MethodDelete,
						Path:   dashboardPath,
					}, &struct{}{})

					// Check response status code
					require.Equal(t, http.StatusOK, deleteResp.Response.StatusCode,
						"Failed to DELETE dashboard: %s", deleteResp.Response.Status)

					// Verify the dashboard was deleted
					_, err = adminClient.Resource.Get(context.Background(), dashboardUID, v1.GetOptions{})
					// require.ErrorIs(t, err, dashboards.ErrDashboardNotFound, "Dashboard should be deleted")
					require.Error(t, err, "Dashboard should be deleted")
				} else {
					require.NotEqual(t, http.StatusCreated, createResp.Response.StatusCode,
						"%s should not be able to create dashboard via %s", userTC.name, "POST")

					// Always verify the dashboard wasn't created by checking for its UID
					// Verify the dashboard was not created
					_, err := adminClient.Resource.Get(context.Background(), dashboardUID, v1.GetOptions{})
					// require.ErrorIs(t, err, dashboards.ErrDashboardNotFound, "Dashboard should never have been created")
					require.Error(t, err, "Dashboard should never have been created")
				}
			})
		}
	}
}

// Helper function to retrieve a dashboard via HTTP
func getDashboardViaHTTP(t *testing.T, ctx *TestContext, dashboardPath string, user apis.User) (map[string]interface{}, error) {
	t.Helper()

	getResp := apis.DoRequest(ctx.Helper, apis.RequestParams{
		User:   user,
		Method: http.MethodGet,
		Path:   dashboardPath,
	}, &struct{}{})

	if getResp.Response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get dashboard: %s", getResp.Response.Status)
	}

	var dashObj map[string]interface{}
	err := json.Unmarshal(getResp.Body, &dashObj)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal dashboard JSON: %v", err)
	}

	return dashObj, nil
}

// Helper function to test dashboard updates via different http methods
func testDashboardHttpUpdateMethods(t *testing.T, ctx TestContext, dashboardPath string, originalTitle string,
	updateUser apis.User, canUpdate bool,
) {
	// Helper to verify update results based on permissions
	verifyUpdateResults := func(updateMethod string, updateTitle string, updateResp apis.K8sResponse[struct{}]) {
		if canUpdate {
			require.Equal(t, http.StatusOK, updateResp.Response.StatusCode,
				"Failed to update dashboard with %s as %s: %s",
				updateMethod, updateUser.Identity.GetLogin(), updateResp.Response.Status)

			// Verify update by getting fresh dashboard state
			updatedDashObj, err := getDashboardViaHTTP(t, &ctx, dashboardPath, ctx.AdminUser)
			require.NoError(t, err, "Failed to get dashboard after update")

			// Extract title from the updated dashboard
			updatedTitle := updatedDashObj["spec"].(map[string]interface{})["title"].(string)
			require.Equal(t, updateTitle, updatedTitle,
				"Dashboard title not updated via %s", updateMethod)
		} else {
			require.NotEqual(t, http.StatusOK, updateResp.Response.StatusCode,
				"%s should not be able to update dashboard via %s",
				updateUser.Identity.GetLogin(), updateMethod)
		}
	}

	// Test PUT update
	t.Run(fmt.Sprintf("Update via %s by %s", "PUT", updateUser.Identity.GetLogin()), func(t *testing.T) {
		updateTitle := fmt.Sprintf("%s - Updated via PUT by %s", originalTitle, updateUser.Identity.GetLogin())

		// Always get fresh dashboard state via HTTP
		// Use admin to ensure we can always retrieve it
		freshDashObj, err := getDashboardViaHTTP(t, &ctx, dashboardPath, ctx.AdminUser)
		require.NoError(t, err, "Failed to get fresh dashboard for update")

		// Modify title for PUT using fresh dashboard object
		specMap := freshDashObj["spec"].(map[string]interface{})
		specMap["title"] = updateTitle
		freshDashObj["spec"] = specMap

		// Convert to JSON
		updatedJSON, err := json.Marshal(freshDashObj)
		require.NoError(t, err, "Failed to marshal dashboard JSON")

		// Make PUT request
		updateResp := apis.DoRequest(ctx.Helper, apis.RequestParams{
			User:        updateUser,
			Method:      http.MethodPut,
			Path:        dashboardPath,
			Body:        updatedJSON,
			ContentType: "application/json",
		}, &struct{}{})

		verifyUpdateResults("PUT", updateTitle, updateResp)
	})

	// Test PATCH update
	t.Run(fmt.Sprintf("Update via %s by %s", "PATCH", updateUser.Identity.GetLogin()), func(t *testing.T) {
		updateTitle := fmt.Sprintf("%s - Updated via PATCH by %s", originalTitle, updateUser.Identity.GetLogin())

		// Create a JSON patch document
		patchJSON := fmt.Sprintf(`[
            {"op": "replace", "path": "/spec/title", "value": "%s"}
        ]`, updateTitle)

		// Make PATCH request
		updateResp := apis.DoRequest(ctx.Helper, apis.RequestParams{
			User:        updateUser,
			Method:      http.MethodPatch,
			Path:        dashboardPath,
			Body:        []byte(patchJSON),
			ContentType: "application/json-patch+json",
		}, &struct{}{})

		verifyUpdateResults("PATCH", updateTitle, updateResp)
	})
}

// Test dashboard list API with complex permission scenarios
func runDashboardListTests(t *testing.T, ctx TestContext) {
	t.Helper()

	// Make sure no dashboards exist before we start
	adminClient := getResourceClient(t, ctx.Helper, ctx.AdminUser, getDashboardGVR())
	dashList, err := adminClient.Resource.List(context.Background(), v1.ListOptions{})
	require.NoError(t, err)
	if len(dashList.Items) > 0 {
		for _, dash := range dashList.Items {
			t.Logf("Found dashboard: %s", dash.GetName())
		}
		t.Fatalf("Expected no dashboards to exist, but found %d", len(dashList.Items))
	}
	require.Equal(t, 0, len(dashList.Items), "Expected no dashboards to exist")

	// Also check that no folders exist
	adminFolderClient := getResourceClient(t, ctx.Helper, ctx.AdminUser, getFolderGVR())
	folderList, err := adminFolderClient.Resource.List(context.Background(), v1.ListOptions{})
	require.NoError(t, err)
	if len(folderList.Items) != 1 {
		for _, folder := range folderList.Items {
			t.Logf("Found folder: %s", folder.GetName())
		}
		t.Fatalf("Expected 1 folder to exist, but found %d", len(folderList.Items))
	}

	// Define a map of user types to their clients
	clients := map[string]struct {
		userClient   *apis.K8sResourceClient
		folderClient *apis.K8sResourceClient
		tokenClient  *apis.K8sResourceClient
	}{
		"Admin": {
			userClient:   getResourceClient(t, ctx.Helper, ctx.AdminUser, getDashboardGVR()),
			folderClient: getResourceClient(t, ctx.Helper, ctx.AdminUser, getFolderGVR()),
			tokenClient:  getServiceAccountResourceClient(t, ctx.Helper, ctx.AdminServiceAccountToken, ctx.OrgID, getDashboardGVR()),
		},
		"Editor": {
			userClient:   getResourceClient(t, ctx.Helper, ctx.EditorUser, getDashboardGVR()),
			folderClient: getResourceClient(t, ctx.Helper, ctx.EditorUser, getFolderGVR()),
			tokenClient:  getServiceAccountResourceClient(t, ctx.Helper, ctx.EditorServiceAccountToken, ctx.OrgID, getDashboardGVR()),
		},
		"Viewer": {
			userClient:   getResourceClient(t, ctx.Helper, ctx.ViewerUser, getDashboardGVR()),
			folderClient: getResourceClient(t, ctx.Helper, ctx.ViewerUser, getFolderGVR()),
			tokenClient:  getServiceAccountResourceClient(t, ctx.Helper, ctx.ViewerServiceAccountToken, ctx.OrgID, getDashboardGVR()),
		},
	}

	// Define identities for testing LIST operation
	identities := make([]Identity, 0, len(clients)*2+1)
	for role, c := range clients {
		identities = append(identities,
			Identity{Name: role + " user", DashboardClient: c.userClient, FolderClient: c.folderClient, Type: "user"},
			Identity{Name: role + " token", DashboardClient: c.tokenClient, FolderClient: c.folderClient, Type: "token"})
	}

	// Define permission schemes with role/user access mapping
	type accessConfig struct {
		admin  bool
		editor bool
		viewer bool
	}

	// Create 5 folders with different permission schemes
	folderConfigs := []struct {
		name        string
		permissions func(t *testing.T, ctx TestContext, resourceUID string, isDashboard bool)
		access      accessConfig
	}{
		{
			name: "Admin only",
			permissions: func(t *testing.T, ctx TestContext, resourceUID string, isDashboard bool) {
				permissions := []ResourcePermissionSetting{}
				setResourceUserPermission(t, ctx, ctx.AdminUser, isDashboard, resourceUID, permissions)
			},
			access: accessConfig{admin: true},
		},
		{
			name: "Admin and Editor",
			permissions: func(t *testing.T, ctx TestContext, resourceUID string, isDashboard bool) {
				editorRole := ResourcePermissionRoleEditor
				permissions := []ResourcePermissionSetting{
					{Level: ResourcePermissionLevelEdit, Role: &editorRole},
				}
				setResourceUserPermission(t, ctx, ctx.AdminUser, isDashboard, resourceUID, permissions)
			},
			access: accessConfig{admin: true, editor: true},
		},
		{
			name: "Default permissions",
			permissions: func(t *testing.T, ctx TestContext, resourceUID string, isDashboard bool) {
				// Default permissions - no need to modify
			},
			access: accessConfig{admin: true, editor: true, viewer: true},
		},
		{
			name: "Viewer user specific",
			permissions: func(t *testing.T, ctx TestContext, resourceUID string, isDashboard bool) {
				viewerUserId, _ := identity.UserIdentifier(ctx.ViewerUser.Identity.GetID())
				viewerServiceUserId := ctx.ViewerServiceAccount.Id
				permissions := []ResourcePermissionSetting{
					{Level: ResourcePermissionLevelEdit, UserID: &viewerUserId},
					{Level: ResourcePermissionLevelEdit, UserID: &viewerServiceUserId},
				}
				setResourceUserPermission(t, ctx, ctx.AdminUser, isDashboard, resourceUID, permissions)
			},
			access: accessConfig{admin: true, viewer: true},
		},
		{
			name: "Editor user specific",
			permissions: func(t *testing.T, ctx TestContext, resourceUID string, isDashboard bool) {
				editorUserId, _ := identity.UserIdentifier(ctx.EditorUser.Identity.GetID())
				editorServiceUserId := ctx.EditorServiceAccount.Id
				permissions := []ResourcePermissionSetting{
					{Level: ResourcePermissionLevelView, UserID: &editorUserId},
					{Level: ResourcePermissionLevelView, UserID: &editorServiceUserId},
				}
				setResourceUserPermission(t, ctx, ctx.AdminUser, isDashboard, resourceUID, permissions)
			},
			access: accessConfig{admin: true, editor: true},
		},
	}

	// Create dashboards and folders with permissions
	rootDashboards := make([]*unstructured.Unstructured, len(folderConfigs))
	folders := make([]*folder.Folder, len(folderConfigs))
	folderDashboards := make([]*unstructured.Unstructured, len(folderConfigs))

	// Clean up
	t.Cleanup(func() {
		// Delete all root dashboards
		for _, dash := range rootDashboards {
			err := adminClient.Resource.Delete(context.Background(), dash.GetName(), v1.DeleteOptions{})
			require.NoError(t, err)
		}

		// Delete all folder dashboards and folders
		for i, folder := range folders {
			err := adminClient.Resource.Delete(context.Background(), folderDashboards[i].GetName(), v1.DeleteOptions{})
			require.NoError(t, err)

			err = adminFolderClient.Resource.Delete(context.Background(), folder.UID, v1.DeleteOptions{})
			require.NoError(t, err)
		}
	})

	// Create all test resources (folders, dashboards) in one loop
	for i, fc := range folderConfigs {
		// Create root dashboard
		rootDash, err := createDashboard(t, adminClient, fmt.Sprintf("Root Dashboard - %s", fc.name), nil, nil)
		require.NoError(t, err)
		rootDashboards[i] = rootDash
		fc.permissions(t, ctx, rootDash.GetName(), true)

		// Create folder
		folder, err := createFolder(t, ctx.Helper, ctx.AdminUser, fc.name+" folder")
		require.NoError(t, err)
		folders[i] = folder
		fc.permissions(t, ctx, folder.UID, false)

		// Create dashboard in folder
		folderDash, err := createDashboard(t, adminClient, fmt.Sprintf("Dashboard in %s folder", fc.name), &folder.UID, nil)
		require.NoError(t, err)
		folderDashboards[i] = folderDash
	}

	folderPermissions := map[string][]string{
		"Admin user": {
			"Default permissions folder",
			"Editor user specific folder",
			"Admin and Editor folder",
			"Viewer user specific folder",
			"Admin only folder",
			"Test Folder Org 1",
		},
		"Admin token": {
			"Default permissions folder",
			"Editor user specific folder",
			"Admin and Editor folder",
			"Viewer user specific folder",
			"Admin only folder",
			"Test Folder Org 1",
		},
		"Editor user": {
			"Default permissions folder",
			"Editor user specific folder",
			"Admin and Editor folder",
			"Test Folder Org 1",
		},
		"Editor token": {
			"Default permissions folder",
			"Editor user specific folder",
			"Admin and Editor folder",
			"Test Folder Org 1",
		},
		"Viewer user": {
			"Default permissions folder",
			"Viewer user specific folder",
			"Test Folder Org 1",
		},
		"Viewer token": {
			"Default permissions folder",
			"Viewer user specific folder",
			"Test Folder Org 1",
		},
	}

	// Generate expectations based on folderConfigs access rules
	expectations := make(map[string][]string)
	for _, ident := range identities {
		var expectedDashboards []string

		for _, fc := range folderConfigs {
			// Check if this identity has access based on its role
			hasAccess := false
			roleName := strings.Split(ident.Name, " ")[0] // Extract "Admin", "Editor", or "Viewer"

			switch roleName {
			case "Admin":
				hasAccess = fc.access.admin
			case "Editor":
				hasAccess = fc.access.editor
			case "Viewer":
				hasAccess = fc.access.viewer
			}

			if hasAccess {
				// Add both root dashboard and folder dashboard to expectations
				expectedDashboards = append(expectedDashboards,
					fmt.Sprintf("Root Dashboard - %s", fc.name),
					fmt.Sprintf("Dashboard in %s folder", fc.name))
			}
		}
		expectations[ident.Name] = expectedDashboards
	}

	// Test LIST operation for each identity
	for _, identity := range identities {
		// Get dashboards visible to this identity
		clients := []apis.K8sResourceClient{
			*identity.DashboardClient,
			*identity.FolderClient,
		}
		for _, client := range clients {
			t.Run(fmt.Sprintf("LIST operation for %s and %s", identity.Name, client.Args.GVR), func(t *testing.T) {
				// Use the client to list all resources
				dashList, err := client.Resource.List(context.Background(), v1.ListOptions{})
				require.NoError(t, err)

				if len(dashList.Items) == 0 {
					t.Logf("WARNING: Got empty dashboard list for %s", identity.Name)
				}

				require.NotEmpty(t, dashList.Items)

				// Extract dashboard titles
				dashTitles := make([]string, 0, len(dashList.Items))
				for _, dash := range dashList.Items {
					meta, err := utils.MetaAccessor(&dash)
					require.NoError(t, err)

					dashTitles = append(dashTitles, meta.FindTitle(""))
				}

				// Verify expectations
				var expectedTitles []string
				if client.Args.GVR == getDashboardGVR() {
					expectedTitles = expectations[identity.Name]
				} else {
					expectedTitles = folderPermissions[identity.Name]
				}
				require.ElementsMatch(t, expectedTitles, dashTitles)

				// Verify all expected items are found
				for _, expected := range expectedTitles {
					found := false
					for _, title := range dashTitles {
						if title == expected {
							found = true
							break
						}
					}
					require.True(t, found, "%s should see dashboard '%s' but didn't", identity.Name, expected)
				}
			})
		}
	}
}

func postHelper(t *testing.T, ctx *TestContext, path string, body interface{}, user apis.User) (map[string]interface{}, error) {
	bodyJSON, err := json.Marshal(body)
	require.NoError(t, err)

	resp := apis.DoRequest(ctx.Helper, apis.RequestParams{
		User:        user,
		Method:      http.MethodPost,
		Path:        path,
		Body:        bodyJSON,
		ContentType: "application/json",
	}, &struct{}{})

	if resp.Response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to post: %s", resp.Response.Status)
	}

	var result map[string]interface{}
	err = json.Unmarshal(resp.Body, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal response JSON: %v", err)
	}

	return result, nil
}
