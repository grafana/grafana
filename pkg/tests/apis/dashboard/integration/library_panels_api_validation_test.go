package integration

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

// this tests the /api path still, but behind the scenes is using search to get the library connections
// as in modes 3+, the connections are found via searching dashboards for the reference of the library panel
//
// it also ensures we create the connection in modes 0-2 if a dashboard v1 is created with a reference
func TestIntegrationLibraryPanelConnections(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	dualWriterModes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, dualWriterMode := range dualWriterModes {
		t.Run(fmt.Sprintf("DualWriterMode %d", dualWriterMode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableAnonymous: true,
				EnableFeatureToggles: []string{
					"unifiedStorageSearch",
					"kubernetesClientDashboardsFolders",
					"kubernetesLibraryPanels",
				},
			})
			ctx := createTestContext(t, helper, helper.Org1, dualWriterMode)
			adminClient := getResourceClient(t, ctx.Helper, ctx.AdminUser, getDashboardGVR())

			// create the library element first
			libraryElement := map[string]interface{}{
				"kind": 1,
				"name": "Test Library Panel",
				"model": map[string]interface{}{
					"type":  "timeseries",
					"title": "Test Library Panel",
				},
			}
			libraryElementURL := "/api/library-elements"
			libraryElementData, err := postHelper(t, &ctx, libraryElementURL, libraryElement, ctx.AdminUser)
			require.NoError(t, err)
			require.NotNil(t, libraryElementData)
			data := libraryElementData["result"].(map[string]interface{})
			uid := data["uid"].(string)
			require.NotEmpty(t, uid)

			// then reference the library element in the dashboard
			dashboard := createDashboardObject(t, "Library Panel Test", "", 1)
			dashboard.Object["spec"].(map[string]interface{})["panels"] = []interface{}{
				map[string]interface{}{
					"id":    1,
					"title": "Library Panel",
					"type":  "library-panel-ref",
					"libraryPanel": map[string]interface{}{
						"uid":  uid,
						"name": "Test Library Panel",
					},
				},
			}

			createdDash, err := adminClient.Resource.Create(context.Background(), dashboard, v1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, createdDash)

			// should have created a library panel connection
			connectionsURL := fmt.Sprintf("/api/library-elements/%s/connections", uid)
			connectionsData, err := getDashboardViaHTTP(t, &ctx, connectionsURL, ctx.AdminUser)
			require.NoError(t, err)
			require.NotNil(t, connectionsData)
			connections := connectionsData["result"].([]interface{})
			require.Len(t, connections, 1)
		})
	}
}

// this tests the /apis path to ensure authorization is being enforced. /api integration tests are within the service package
// only works in modes 0-2 because the library element is created through the /api path
func TestIntegrationLibraryElementPermissions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	dualWriterModes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2}
	for _, dualWriterMode := range dualWriterModes {
		t.Run(fmt.Sprintf("DualWriterMode %d", dualWriterMode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableAnonymous: true,
				EnableFeatureToggles: []string{
					"unifiedStorageSearch",
					"kubernetesClientDashboardsFolders",
					"kubernetesLibraryPanels",
					"grafanaAPIServerWithExperimentalAPIs", // needed until we move it to v0beta1 at least (currently v0alpha1)
				},
			})
			ctx := createTestContext(t, helper, helper.Org1, dualWriterMode)

			t.Run("Library element authorization tests", func(t *testing.T) {
				runLibraryElementAuthorizationTests(t, ctx)
			})

			t.Run("Library element cross-organization tests", func(t *testing.T) {
				org2Ctx := createTestContext(t, helper, helper.OrgB, dualWriterMode)
				runLibraryElementCrossOrgTests(t, ctx, org2Ctx)
			})
		})
	}
}

func runLibraryElementAuthorizationTests(t *testing.T, ctx TestContext) {
	t.Helper()

	roles := []string{"Admin", "Editor", "Viewer"}

	for _, role := range roles {
		t.Run(role, func(t *testing.T) {
			var client *apis.K8sResourceClient
			switch role {
			case "Admin":
				client = getResourceClient(t, ctx.Helper, ctx.AdminUser, getLibraryElementGVR())
			case "Editor":
				client = getResourceClient(t, ctx.Helper, ctx.EditorUser, getLibraryElementGVR())
			case "Viewer":
				client = getResourceClient(t, ctx.Helper, ctx.ViewerUser, getLibraryElementGVR())
			}

			t.Run("library element viewing", func(t *testing.T) {
				uid, err := createLibraryElement(t, ctx, ctx.AdminUser, "Library Element for "+role+" to view", "", nil)
				require.NoError(t, err)

				viewedLibElement, err := client.Resource.Get(context.Background(), uid, v1.GetOptions{})
				require.NoError(t, err, "All identities should be able to view library elements")
				require.NotNil(t, viewedLibElement)

				err = deleteLibraryElement(t, ctx, ctx.AdminUser, uid)
				require.NoError(t, err)
			})

			t.Run("library element listing", func(t *testing.T) {
				uid, err := createLibraryElement(t, ctx, ctx.AdminUser, "Library Element for "+role+" to list", "", nil)
				require.NoError(t, err)

				listOpts := v1.ListOptions{}
				libElementList, err := client.Resource.List(context.Background(), listOpts)
				require.NoError(t, err, "All identities should be able to list library elements")
				require.NotNil(t, libElementList)
				require.Len(t, libElementList.Items, 1)
				require.Equal(t, uid, libElementList.Items[0].GetName())

				err = deleteLibraryElement(t, ctx, ctx.AdminUser, uid)
				require.NoError(t, err)
			})

			t.Run("library element in a folder only an admin can see", func(t *testing.T) {
				restrictedFolder, err := createFolder(t, ctx.Helper, ctx.AdminUser, "Restricted Folder for "+role)
				require.NoError(t, err)
				require.NotNil(t, restrictedFolder)
				uid, err := createLibraryElement(t, ctx, ctx.AdminUser, "Library Element in restricted folder", restrictedFolder.UID, nil)
				require.NoError(t, err)
				setResourceUserPermission(t, ctx, ctx.AdminUser, false, restrictedFolder.UID, []ResourcePermissionSetting{})

				if role == "Admin" {
					_, err = client.Resource.Get(context.Background(), uid, v1.GetOptions{})
					require.NoError(t, err, "Admin should be able to access library element in restricted folder")
				} else {
					_, err = client.Resource.Get(context.Background(), uid, v1.GetOptions{})
					require.Error(t, err, "Should not be able to access library element in restricted folder")
				}

				err = deleteLibraryElement(t, ctx, ctx.AdminUser, uid)
				require.NoError(t, err)
			})
		})
	}
}

func runLibraryElementCrossOrgTests(t *testing.T, org1Ctx, org2Ctx TestContext) {
	// org1 trying to access org2
	org1CrossEditorClient := org2Ctx.Helper.GetResourceClient(apis.ResourceClientArgs{
		User:      org1Ctx.EditorUser,
		Namespace: org2Ctx.Helper.Namespacer(org2Ctx.OrgID),
		GVR:       getLibraryElementGVR(),
	})
	org1CrossViewerClient := org2Ctx.Helper.GetResourceClient(apis.ResourceClientArgs{
		User:      org1Ctx.ViewerUser,
		Namespace: org2Ctx.Helper.Namespacer(org2Ctx.OrgID),
		GVR:       getLibraryElementGVR(),
	})

	// org2 trying to access org1
	org2CrossEditorClient := org1Ctx.Helper.GetResourceClient(apis.ResourceClientArgs{
		User:      org2Ctx.EditorUser,
		Namespace: org1Ctx.Helper.Namespacer(org1Ctx.OrgID),
		GVR:       getLibraryElementGVR(),
	})
	org2CrossViewerClient := org1Ctx.Helper.GetResourceClient(apis.ResourceClientArgs{
		User:      org2Ctx.ViewerUser,
		Namespace: org1Ctx.Helper.Namespacer(org1Ctx.OrgID),
		GVR:       getLibraryElementGVR(),
	})

	t.Run("Cross-organization access", func(t *testing.T) {
		org1LibElementUID, err := createLibraryElement(t, org1Ctx, org1Ctx.AdminUser, "Org1 Library Element", "", nil)
		require.NoError(t, err)

		org2LibElementUID, err := createLibraryElement(t, org2Ctx, org2Ctx.AdminUser, "Org2 Library Element", "", nil)
		require.NoError(t, err)

		defer func() {
			err = deleteLibraryElement(t, org1Ctx, org1Ctx.AdminUser, org1LibElementUID)
			require.NoError(t, err)

			err = deleteLibraryElement(t, org2Ctx, org2Ctx.AdminUser, org2LibElementUID)
			require.NoError(t, err)
		}()

		testCrossOrgAccess := func(client *apis.K8sResourceClient, targetLibElementUID string, description string) {
			t.Run(description, func(t *testing.T) {
				_, err := client.Resource.Get(context.Background(), targetLibElementUID, v1.GetOptions{})
				require.Error(t, err, "Should not be able to access library element from another org")
			})
		}

		testCrossOrgAccess(org1CrossEditorClient, org2LibElementUID, "Org1 editor cannot access Org2 library element")
		testCrossOrgAccess(org1CrossViewerClient, org2LibElementUID, "Org1 viewer cannot access Org2 library element")

		testCrossOrgAccess(org2CrossEditorClient, org1LibElementUID, "Org2 editor cannot access Org1 library element")
		testCrossOrgAccess(org2CrossViewerClient, org1LibElementUID, "Org2 viewer cannot access Org1 library element")
	})
}

func getLibraryElementGVR() schema.GroupVersionResource {
	return schema.GroupVersionResource{
		Group:    dashboardV0.APIGroup,
		Version:  dashboardV0.VERSION,
		Resource: dashboardV0.LIBRARY_PANEL_RESOURCE,
	}
}

// currently through /api
func createLibraryElement(t *testing.T, ctx TestContext, user apis.User, title string, folderUID string, uid *string) (string, error) {
	t.Helper()
	libraryElement := map[string]interface{}{
		"kind": 1,
		"name": title,
		"model": map[string]interface{}{
			"type":  "text",
			"title": title,
		},
	}
	if folderUID != "" {
		libraryElement["folderUid"] = folderUID
	}

	libraryElementURL := "/api/library-elements"
	libraryElementData, err := postHelper(t, &ctx, libraryElementURL, libraryElement, user)
	if err != nil {
		return "", err
	}

	require.NotNil(t, libraryElementData)
	data := libraryElementData["result"].(map[string]interface{})
	uidStr := data["uid"].(string)
	require.NotEmpty(t, uidStr)

	return uidStr, nil
}

// currently through /api
func deleteLibraryElement(t *testing.T, ctx TestContext, user apis.User, uid string) error {
	t.Helper()
	deleteURL := fmt.Sprintf("/api/library-elements/%s", uid)

	resp := apis.DoRequest(ctx.Helper, apis.RequestParams{
		User:   user,
		Method: http.MethodDelete,
		Path:   deleteURL,
	}, &struct{}{})

	if resp.Response.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to delete library element: %s", resp.Response.Status)
	}

	return nil
}

func TestIntegrationLibraryPanelConnectionsWithFolderAccess(t *testing.T) {
	dualWriterModes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, dualWriterMode := range dualWriterModes {
		t.Run(fmt.Sprintf("DualWriterMode %d", dualWriterMode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableAnonymous: true,
				EnableFeatureToggles: []string{
					"unifiedStorageSearch",
					"kubernetesLibraryPanels",
					"kubernetesClientDashboardsFolders",
				},
			})
			ctx := createTestContext(t, helper, helper.Org1, dualWriterMode)

			accessibleFolder, err := createFolder(t, ctx.Helper, ctx.AdminUser, "AccessibleFolder")
			require.NoError(t, err)
			require.NotNil(t, accessibleFolder)

			inaccessibleFolder, err := createFolder(t, ctx.Helper, ctx.AdminUser, "InAccessibleFolder")
			require.NoError(t, err)
			require.NotNil(t, inaccessibleFolder)

			setResourceUserPermission(t, ctx, ctx.AdminUser, false, accessibleFolder.UID, addUserPermission(t, nil, ctx.ViewerUser, ResourcePermissionLevelView))
			setResourceUserPermission(t, ctx, ctx.AdminUser, false, inaccessibleFolder.UID, []ResourcePermissionSetting{})

			libraryElement := map[string]interface{}{
				"kind":      1,
				"name":      "Accessible Library Panel",
				"folderUid": accessibleFolder.UID,
				"model": map[string]interface{}{
					"type":  "text",
					"title": "Accessible Library Panel",
				},
			}
			libraryElementURL := "/api/library-elements"
			libraryElementData, err := postHelper(t, &ctx, libraryElementURL, libraryElement, ctx.AdminUser)
			require.NoError(t, err)
			require.NotNil(t, libraryElementData)
			data := libraryElementData["result"].(map[string]interface{})
			uid := data["uid"].(string)
			require.NotEmpty(t, uid)

			dashInGeneral := createDashboardObject(t, "Dashboard in General", "", 1)
			dashInGeneral.Object["spec"].(map[string]interface{})["panels"] = []interface{}{
				map[string]interface{}{
					"id":    1,
					"title": "Library Panel",
					"type":  "library-panel-ref",
					"libraryPanel": map[string]interface{}{
						"uid":  uid,
						"name": "Accessible Library Panel",
					},
				},
			}
			adminClient := getResourceClient(t, ctx.Helper, ctx.AdminUser, getDashboardGVR())
			createdDashInGeneral, err := adminClient.Resource.Create(context.Background(), dashInGeneral, v1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, createdDashInGeneral)

			dashInAccessibleFolder := createDashboardObject(t, "Dashboard in Accessible Folder", accessibleFolder.UID, 1)
			dashInAccessibleFolder.Object["spec"].(map[string]interface{})["panels"] = []interface{}{
				map[string]interface{}{
					"id":    1,
					"title": "Library Panel",
					"type":  "library-panel-ref",
					"libraryPanel": map[string]interface{}{
						"uid":  uid,
						"name": "Accessible Library Panel",
					},
				},
			}
			createdDashInAccessible, err := adminClient.Resource.Create(context.Background(), dashInAccessibleFolder, v1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, createdDashInAccessible)

			dashInInaccessibleFolder := createDashboardObject(t, "Dashboard in Inaccessible Folder", inaccessibleFolder.UID, 1)
			dashInInaccessibleFolder.Object["spec"].(map[string]interface{})["panels"] = []interface{}{
				map[string]interface{}{
					"id":    1,
					"title": "Library Panel",
					"type":  "library-panel-ref",
					"libraryPanel": map[string]interface{}{
						"uid":  uid,
						"name": "Accessible Library Panel",
					},
				},
			}
			createdDashInInaccessible, err := adminClient.Resource.Create(context.Background(), dashInInaccessibleFolder, v1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, createdDashInInaccessible)

			connectionsURL := fmt.Sprintf("/api/library-elements/%s/connections", uid)
			connectionsData, err := getDashboardViaHTTP(t, &ctx, connectionsURL, ctx.AdminUser)
			require.NoError(t, err)
			require.NotNil(t, connectionsData)
			connections := connectionsData["result"].([]interface{})
			require.Len(t, connections, 3, "Admin should see all connections")
			connectionUIDs := make([]string, 0, len(connections))
			for _, conn := range connections {
				connMap := conn.(map[string]interface{})
				if connectionUID, ok := connMap["connectionUid"].(string); ok {
					connectionUIDs = append(connectionUIDs, connectionUID)
				}
			}
			generalDashUID := createdDashInGeneral.GetName()
			accessibleDashUID := createdDashInAccessible.GetName()
			inaccessibleDashUID := createdDashInInaccessible.GetName()
			require.Contains(t, connectionUIDs, generalDashUID, "Admin should see dashboard in general folder")
			require.Contains(t, connectionUIDs, accessibleDashUID, "Admin should see dashboard in accessible folder")
			require.Contains(t, connectionUIDs, inaccessibleDashUID, "Admin should see dashboard in inaccessible folder")

			limitedUser := ctx.Helper.CreateUser("limited-user", "Org1", org.RoleViewer, nil)
			// can access accessibleFolder but not inaccessibleFolder
			setResourceUserPermission(t, ctx, ctx.AdminUser, false, accessibleFolder.UID, addUserPermission(t, nil, limitedUser, ResourcePermissionLevelView))
			setResourceUserPermission(t, ctx, ctx.AdminUser, false, inaccessibleFolder.UID, []ResourcePermissionSetting{})
			connectionsDataLimited, err := getDashboardViaHTTP(t, &ctx, connectionsURL, limitedUser)
			require.NoError(t, err)
			require.NotNil(t, connectionsDataLimited)
			connectionsLimited := connectionsDataLimited["result"].([]interface{})
			require.Len(t, connectionsLimited, 2, "Limited user should only see connections to accessible dashboards")

			connectionUIDsLimited := make([]string, 0, len(connectionsLimited))
			for _, conn := range connectionsLimited {
				connMap := conn.(map[string]interface{})
				if connectionUID, ok := connMap["connectionUid"].(string); ok {
					connectionUIDsLimited = append(connectionUIDsLimited, connectionUID)
				}
			}
			require.Contains(t, connectionUIDsLimited, generalDashUID, "Limited user should see dashboard in general folder")
			require.Contains(t, connectionUIDsLimited, accessibleDashUID, "Limited user should see dashboard in accessible folder")
			require.NotContains(t, connectionUIDsLimited, inaccessibleDashUID, "Limited user should NOT see dashboard in inaccessible folder")

			err = adminClient.Resource.Delete(context.Background(), createdDashInGeneral.GetName(), v1.DeleteOptions{})
			require.NoError(t, err)
			err = adminClient.Resource.Delete(context.Background(), createdDashInAccessible.GetName(), v1.DeleteOptions{})
			require.NoError(t, err)
			err = adminClient.Resource.Delete(context.Background(), createdDashInInaccessible.GetName(), v1.DeleteOptions{})
			require.NoError(t, err)
		})
	}
}
