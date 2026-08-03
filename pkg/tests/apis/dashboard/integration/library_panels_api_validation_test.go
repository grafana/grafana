package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// this tests the /api path still, but behind the scenes is using search to get the library connections
// as in modes 4+, the connections are found via searching dashboards for the reference of the library panel
//
// it also ensures we create the connection in modes 0-2 if a dashboard v1 is created with a reference
func TestIntegrationLibraryPanelConnections(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagLibraryelementsKubernetesLibraryPanels,
		},
	})
	ctx := createTestContext(t, helper, helper.Org1)
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
}

// this tests the /apis path to ensure authorization is being enforced. /api integration tests are within the service package
// only works in modes 0-2 because the library element is created through the /api path
func TestIntegrationLibraryElementPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagLibraryelementsKubernetesLibraryPanels,
		},
	})
	ctx := createTestContext(t, helper, helper.Org1)

	t.Run("Library element authorization tests", func(t *testing.T) {
		runLibraryElementAuthorizationTests(t, ctx)
	})

	t.Run("Library element cross-organization tests", func(t *testing.T) {
		org2Ctx := createTestContext(t, helper, helper.OrgB)
		runLibraryElementCrossOrgTests(t, ctx, org2Ctx)
	})
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
				uid, err := createLibraryElement(t, ctx, ctx.AdminUser, "Library Element for "+role+" to view", "")
				require.NoError(t, err)

				viewedLibElement, err := client.Resource.Get(context.Background(), uid, v1.GetOptions{})
				require.NoError(t, err, "All identities should be able to view library elements")
				require.NotNil(t, viewedLibElement)

				err = deleteLibraryElement(t, ctx, ctx.AdminUser, uid)
				require.NoError(t, err)
			})

			t.Run("library element listing", func(t *testing.T) {
				uid, err := createLibraryElement(t, ctx, ctx.AdminUser, "Library Element for "+role+" to list", "")
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
				uid, err := createLibraryElement(t, ctx, ctx.AdminUser, "Library Element in restricted folder", restrictedFolder.UID)
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
		org1LibElementUID, err := createLibraryElement(t, org1Ctx, org1Ctx.AdminUser, "Org1 Library Element", "")
		require.NoError(t, err)

		org2LibElementUID, err := createLibraryElement(t, org2Ctx, org2Ctx.AdminUser, "Org2 Library Element", "")
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

// exercises the legacy /api/library-elements surface while requests are routed through
// the k8s /apis endpoints, to ensure the responses keep the legacy contract
func TestIntegrationLibraryElementLegacyAPIThroughK8s(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagLibraryelementsKubernetesLibraryPanels,
		},
	})
	ctx := createTestContext(t, helper, helper.Org1)

	legacyFolderResponse := apis.DoRequest(helper, apis.RequestParams{
		User:        ctx.AdminUser,
		Method:      http.MethodPost,
		Path:        "/api/folders",
		Body:        []byte(`{"title":"Legacy folder ID","uid":"legacy-folder-id"}`),
		ContentType: "application/json",
	}, &folder.Folder{})
	require.Equal(t, http.StatusOK, legacyFolderResponse.Response.StatusCode)
	legacyFolder := legacyFolderResponse.Result
	require.NotNil(t, legacyFolder)
	require.NotZero(t, legacyFolder.ID) // nolint:staticcheck
	createdByFolderID, err := postHelper(t, &ctx, "/api/library-elements", map[string]interface{}{
		"kind":     1,
		"name":     "FolderIDPanel",
		"folderId": legacyFolder.ID, // nolint:staticcheck
		"model": map[string]interface{}{
			"type":  "text",
			"title": "Folder ID panel",
		},
	}, ctx.AdminUser)
	require.NoError(t, err)
	createdByFolderIDResult := createdByFolderID["result"].(map[string]interface{})
	require.Equal(t, legacyFolder.UID, createdByFolderIDResult["folderUid"])
	patchWithoutFolderBody, err := json.Marshal(map[string]interface{}{
		"kind":    1,
		"name":    "FolderIDPanelRenamed",
		"version": 1,
	})
	require.NoError(t, err)
	patchWithoutFolderResponse := apis.DoRequest(ctx.Helper, apis.RequestParams{
		User:        ctx.AdminUser,
		Method:      http.MethodPatch,
		Path:        fmt.Sprintf("/api/library-elements/%s", createdByFolderIDResult["uid"]),
		Body:        patchWithoutFolderBody,
		ContentType: "application/json",
	}, &model.LibraryElementResponse{})
	require.Equal(t, http.StatusOK, patchWithoutFolderResponse.Response.StatusCode)
	require.Equal(t, legacyFolder.UID, patchWithoutFolderResponse.Result.Result.FolderUID)
	require.NoError(t, deleteLibraryElement(t, ctx, ctx.AdminUser, createdByFolderIDResult["uid"].(string)))

	// create: the display title and properties without a typed spec field (e.g.
	// transformations) must survive the conversion round trip
	created, err := postHelper(t, &ctx, "/api/library-elements", map[string]interface{}{
		"kind":      1,
		"name":      "CRUDPanel",
		"folderUid": "",
		"model": map[string]interface{}{
			"type":            "text",
			"title":           "CRUD panel display title",
			"description":     "some description",
			"transformations": []interface{}{map[string]interface{}{"id": "reduce"}},
		},
	}, ctx.AdminUser)
	require.NoError(t, err)
	result := created["result"].(map[string]interface{})
	uid := result["uid"].(string)
	require.NotEmpty(t, uid)
	require.Equal(t, "CRUDPanel", result["name"])
	require.Equal(t, float64(1), result["version"])
	require.Equal(t, "General", result["meta"].(map[string]interface{})["folderName"])
	createdModel := result["model"].(map[string]interface{})
	require.Equal(t, "CRUD panel display title", createdModel["title"])
	require.Contains(t, createdModel, "transformations")
	require.Equal(t, "some description", createdModel["description"])

	// get by uid
	got, err := getDashboardViaHTTP(t, &ctx, fmt.Sprintf("/api/library-elements/%s", uid), ctx.AdminUser)
	require.NoError(t, err)
	gotResult := got["result"].(map[string]interface{})
	require.Equal(t, uid, gotResult["uid"])
	gotModel := gotResult["model"].(map[string]interface{})
	require.Equal(t, "CRUD panel display title", gotModel["title"])
	require.Contains(t, gotModel, "transformations")

	// get all, with and without a matching search string
	all, err := getDashboardViaHTTP(t, &ctx, "/api/library-elements", ctx.AdminUser)
	require.NoError(t, err)
	require.Equal(t, float64(1), all["result"].(map[string]interface{})["totalCount"])
	require.Len(t, all["result"].(map[string]interface{})["elements"], 1)

	filtered, err := getDashboardViaHTTP(t, &ctx, "/api/library-elements?searchString=crudpanel", ctx.AdminUser)
	require.NoError(t, err)
	require.Equal(t, float64(1), filtered["result"].(map[string]interface{})["totalCount"])

	empty, err := getDashboardViaHTTP(t, &ctx, "/api/library-elements?searchString=doesnotmatch", ctx.AdminUser)
	require.NoError(t, err)
	require.Equal(t, float64(0), empty["result"].(map[string]interface{})["totalCount"])

	// get by name
	byName, err := getDashboardViaHTTP(t, &ctx, "/api/library-elements/name/CRUDPanel", ctx.AdminUser)
	require.NoError(t, err)
	require.Len(t, byName["result"], 1)

	// patch with a stale version must fail the optimistic concurrency check
	staleBody, err := json.Marshal(map[string]interface{}{"kind": 1, "name": "CRUDPanelRenamed", "version": 99})
	require.NoError(t, err)
	staleResp := apis.DoRequest(ctx.Helper, apis.RequestParams{
		User:        ctx.AdminUser,
		Method:      http.MethodPatch,
		Path:        fmt.Sprintf("/api/library-elements/%s", uid),
		Body:        staleBody,
		ContentType: "application/json",
	}, &struct{}{})
	require.Equal(t, http.StatusPreconditionFailed, staleResp.Response.StatusCode)

	// patch: rename keeps the model and bumps the version
	patchBody, err := json.Marshal(map[string]interface{}{"kind": 1, "name": "CRUDPanelRenamed", "version": 1})
	require.NoError(t, err)
	patchResp := apis.DoRequest(ctx.Helper, apis.RequestParams{
		User:        ctx.AdminUser,
		Method:      http.MethodPatch,
		Path:        fmt.Sprintf("/api/library-elements/%s", uid),
		Body:        patchBody,
		ContentType: "application/json",
	}, &struct{}{})
	require.Equal(t, http.StatusOK, patchResp.Response.StatusCode)
	var patched map[string]interface{}
	require.NoError(t, json.Unmarshal(patchResp.Body, &patched))
	patchedResult := patched["result"].(map[string]interface{})
	require.Equal(t, "CRUDPanelRenamed", patchedResult["name"])
	require.Equal(t, float64(2), patchedResult["version"])
	patchedModel := patchedResult["model"].(map[string]interface{})
	require.Equal(t, "CRUD panel display title", patchedModel["title"])
	require.Contains(t, patchedModel, "transformations")

	// delete, then a get must return 404
	err = deleteLibraryElement(t, ctx, ctx.AdminUser, uid)
	require.NoError(t, err)
	getResp := apis.DoRequest(ctx.Helper, apis.RequestParams{
		User:   ctx.AdminUser,
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/api/library-elements/%s", uid),
	}, &struct{}{})
	require.Equal(t, http.StatusNotFound, getResp.Response.StatusCode)
	var notFoundBody map[string]interface{}
	require.NoError(t, json.Unmarshal(getResp.Body, &notFoundBody))
	require.Equal(t, "library element could not be found", notFoundBody["message"])
}

func TestIntegrationLibraryPanelPreservesStatusMissingInUnifiedStorage(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"librarypanels.dashboard.grafana.app": {DualWriterMode: grafanarest.Mode5},
		},
	})
	ctx := createTestContext(t, helper, helper.Org1)
	client := getResourceClient(t, ctx.Helper, ctx.AdminUser, getLibraryElementGVR())

	panel := &unstructured.Unstructured{Object: map[string]interface{}{
		"apiVersion": dashboardV0.APIGroup + "/" + dashboardV0.VERSION,
		"kind":       "LibraryPanel",
		"metadata": map[string]interface{}{
			"name": "status-missing-panel",
		},
		"spec": map[string]interface{}{
			"type":        "text",
			"title":       "Status missing panel",
			"panelTitle":  "Panel title",
			"options":     map[string]interface{}{},
			"fieldConfig": map[string]interface{}{},
		},
		"status": map[string]interface{}{
			"missing": map[string]interface{}{
				"transformations": []interface{}{map[string]interface{}{"id": "reduce"}},
			},
		},
	}}

	created, err := client.Resource.Create(context.Background(), panel, v1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = client.Resource.Delete(context.Background(), panel.GetName(), v1.DeleteOptions{})
	})
	missing, found, err := unstructured.NestedMap(created.Object, "status", "missing")
	require.NoError(t, err)
	require.True(t, found)
	require.Contains(t, missing, "transformations")

	require.NoError(t, unstructured.SetNestedField(created.Object, int64(100), "status", "missing", "maxDataPoints"))
	updated, err := client.Resource.Update(context.Background(), created, v1.UpdateOptions{})
	require.NoError(t, err)
	missing, found, err = unstructured.NestedMap(updated.Object, "status", "missing")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, int64(100), missing["maxDataPoints"])
}

func getLibraryElementGVR() schema.GroupVersionResource {
	return schema.GroupVersionResource{
		Group:    dashboardV0.APIGroup,
		Version:  dashboardV0.VERSION,
		Resource: dashboardV0.LIBRARY_PANEL_RESOURCE,
	}
}

// currently through /api
func createLibraryElement(t *testing.T, ctx TestContext, user apis.User, title string, folderUID string) (string, error) {
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
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagLibraryelementsKubernetesLibraryPanels,
		},
	})
	ctx := createTestContext(t, helper, helper.Org1)

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
}

// folderHierarchySetup holds the common test data for folder hierarchy tests.
type folderHierarchySetup struct {
	ctx              TestContext
	parentFolder     *folder.Folder
	childFolder      *folder.Folder
	grandchildFolder *folder.Folder
	libraryElements  []string
	testUser         apis.User
}

// setupFolderHierarchy creates a nested folder structure with library elements and a test user.
func setupFolderHierarchy(t *testing.T, helper *apis.K8sTestHelper) folderHierarchySetup {
	t.Helper()

	ctx := createTestContext(t, helper, helper.Org1)

	// Create a nested folder structure: parentFolder -> childFolder -> grandchildFolder
	parentFolder, err := createFolder(t, ctx.Helper, ctx.AdminUser, "ParentFolder")
	require.NoError(t, err)
	require.NotNil(t, parentFolder)

	childFolder, err := createSubFolder(t, ctx.Helper, ctx.AdminUser, "ChildFolder", parentFolder.UID)
	require.NoError(t, err)
	require.NotNil(t, childFolder)

	grandchildFolder, err := createSubFolder(t, ctx.Helper, ctx.AdminUser, "GrandchildFolder", childFolder.UID)
	require.NoError(t, err)
	require.NotNil(t, grandchildFolder)

	libraryElements := make([]string, 0, 3)
	for _, f := range []*folder.Folder{parentFolder, childFolder, grandchildFolder} {
		libraryElement, err := createLibraryElement(t, ctx, ctx.AdminUser, "Library Element in "+f.Title, f.UID)
		require.NoError(t, err)
		libraryElements = append(libraryElements, libraryElement)
	}
	t.Cleanup(func() {
		for _, uid := range libraryElements {
			err := deleteLibraryElement(t, ctx, ctx.AdminUser, uid)
			require.NoError(t, err)
		}
	})

	testUser := ctx.Helper.CreateUser("hierarchy-test-user", "Org1", org.RoleViewer, nil)

	return folderHierarchySetup{
		ctx:              ctx,
		parentFolder:     parentFolder,
		childFolder:      childFolder,
		grandchildFolder: grandchildFolder,
		libraryElements:  libraryElements,
		testUser:         testUser,
	}
}

// getVisibleLibraryElementUIDs returns the UIDs and total count of library elements visible to the user.
func getVisibleLibraryElementUIDs(t *testing.T, ctx *TestContext, user apis.User) ([]string, int) {
	t.Helper()
	listData, err := getDashboardViaHTTP(t, ctx, "/api/library-elements", user)
	require.NoError(t, err)
	require.NotNil(t, listData)

	result := listData["result"].(map[string]interface{})
	elements := result["elements"].([]interface{})
	totalCount := int(result["totalCount"].(float64))

	visibleUIDs := make([]string, 0, len(elements))
	for _, elem := range elements {
		elemMap := elem.(map[string]interface{})
		if uid, ok := elemMap["uid"].(string); ok {
			visibleUIDs = append(visibleUIDs, uid)
		}
	}
	return visibleUIDs, totalCount
}

// TestIntegrationLibraryElementFolderHierarchy tests that permissions are correctly propagated in a folder hierarchy.
// Each sub-test uses its own K8sTestHelper to ensure independent folder tree caches.
func TestIntegrationLibraryElementFolderHierarchy(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	opts := testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagLibraryelementsKubernetesLibraryPanels,
		},
		DisableAuthZClientCache: true,
	}
	// Test 1: Parent folder access grants access to child folder library elements (inherited permissions)
	t.Run("parent access grants child access", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, opts)
		t.Cleanup(helper.Shutdown)
		s := setupFolderHierarchy(t, helper)

		// Give user access to the parent folder
		setResourceUserPermission(t, s.ctx, s.ctx.AdminUser, false, s.parentFolder.UID, addUserPermission(t, nil, s.testUser, ResourcePermissionLevelView))

		visibleUIDs, totalCount := getVisibleLibraryElementUIDs(t, &s.ctx, s.testUser)

		// User with parent folder access should see ALL library elements
		require.Contains(t, visibleUIDs, s.libraryElements[0])
		require.Contains(t, visibleUIDs, s.libraryElements[1])
		require.Contains(t, visibleUIDs, s.libraryElements[2])
		require.Len(t, visibleUIDs, 3)
		require.Equal(t, 3, totalCount)
	})

	// Test 2: Child folder access does NOT grant access to parent folder library elements (no reverse inheritance)
	t.Run("child access does not grant parent access", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, opts)
		t.Cleanup(helper.Shutdown)
		s := setupFolderHierarchy(t, helper)

		// Remove default viewer access to parent folder so only explicit permissions apply
		setResourceUserPermission(t, s.ctx, s.ctx.AdminUser, false, s.parentFolder.UID, []ResourcePermissionSetting{})

		// Give user access to ONLY the grandchild folder
		setResourceUserPermission(t, s.ctx, s.ctx.AdminUser, false, s.grandchildFolder.UID, addUserPermission(t, nil, s.testUser, ResourcePermissionLevelView))

		visibleUIDs, totalCount := getVisibleLibraryElementUIDs(t, &s.ctx, s.testUser)

		// User should ONLY see the library element in the grandchild folder
		require.Contains(t, visibleUIDs, s.libraryElements[2])
		require.NotContains(t, visibleUIDs, s.libraryElements[1])
		require.NotContains(t, visibleUIDs, s.libraryElements[0])
		require.Len(t, visibleUIDs, 1)
		require.Equal(t, 1, totalCount)
	})
}

// createSubFolder creates a folder with a parent folder
func createSubFolder(t *testing.T, helper *apis.K8sTestHelper, user apis.User, title string, parentUID string) (*folder.Folder, error) {
	t.Helper()

	folderClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      user,
		Namespace: helper.Namespacer(user.Identity.GetOrgID()),
		GVR:       getFolderGVR(),
	})

	folderObj := createFolderObject(t, title, helper.Namespacer(user.Identity.GetOrgID()), parentUID)

	createdFolder, err := folderClient.Resource.Create(context.Background(), folderObj, v1.CreateOptions{})
	if err != nil {
		return nil, err
	}

	apis.AwaitZanzanaReconcileNext(t, helper)

	meta, _ := utils.MetaAccessor(createdFolder)

	return &folder.Folder{
		UID:       createdFolder.GetName(),
		Title:     meta.FindTitle(""),
		ParentUID: parentUID,
	}, nil
}
