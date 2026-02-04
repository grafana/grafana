package migrations_test

import (
	"fmt"
	"net/http"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// foldersAndDashboardsTestCase tests the "folders-dashboards" ResourceMigration
type foldersAndDashboardsTestCase struct {
	parentFolderUID string
	childFolderUID  string
	dashboardUID    string
	libPanelUID     string
}

// newFoldersAndDashboardsTestCase creates a test case for the compound folders+dashboards migrator
func newFoldersAndDashboardsTestCase() resourceMigratorTestCase {
	return &foldersAndDashboardsTestCase{
		parentFolderUID: "parent-folder-uid",
		childFolderUID:  "child-folder-uid",
		dashboardUID:    "", // Will be generated during setup
		libPanelUID:     "", // Will be generated during setup
	}
}

func (tc *foldersAndDashboardsTestCase) name() string {
	return "folders-dashboards"
}

func (tc *foldersAndDashboardsTestCase) resources() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		{
			Group:    "folder.grafana.app",
			Version:  "v1beta1",
			Resource: "folders",
		},
		{
			Group:    "dashboard.grafana.app",
			Version:  "v1beta1",
			Resource: "dashboards",
		},
	}
}

func (tc *foldersAndDashboardsTestCase) setup(t *testing.T, helper *apis.K8sTestHelper) {
	t.Helper()

	// Create parent folder
	parent := createTestFolder(t, helper, tc.parentFolderUID, "parent-folder", "")

	// Create child folder (nested under parent)
	child := createTestFolder(t, helper, tc.childFolderUID, "child-folder", parent.UID)

	// Create library panel in child folder
	tc.libPanelUID = createTestLibraryPanel(t, helper, "Test Library Panel", child.UID)

	// Create dashboard with library panel in child folder
	tc.dashboardUID = createTestDashboardWithLibraryPanel(t, helper, "dashboard-with-library-panel",
		tc.libPanelUID, "Test LP in dashboard", child.UID)
}

func (tc *foldersAndDashboardsTestCase) verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	// Build maps of UIDs by resource type
	folderUIDs := []string{tc.parentFolderUID, tc.childFolderUID}
	dashboardUIDs := []string{tc.dashboardUID}

	expectedFolderCount := 0
	if shouldExist {
		expectedFolderCount = len(folderUIDs)
	}
	orgID := helper.Org1.OrgID
	namespace := authlib.OrgNamespaceFormatter(orgID)

	// Verify folders
	folderCli := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR: schema.GroupVersionResource{
			Group:    "folder.grafana.app",
			Version:  "v1beta1",
			Resource: "folders",
		},
	})
	verifyResourceCount(t, folderCli, expectedFolderCount)
	for _, uid := range folderUIDs {
		verifyResource(t, folderCli, uid, shouldExist)
	}

	// Verify dashboards
	expectedDashboardCount := 0
	if shouldExist {
		expectedDashboardCount = len(dashboardUIDs)
	}
	dashboardCli := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR: schema.GroupVersionResource{
			Group:    "dashboard.grafana.app",
			Version:  "v1beta1",
			Resource: "dashboards",
		},
	})
	verifyResourceCount(t, dashboardCli, expectedDashboardCount)
	for _, uid := range dashboardUIDs {
		verifyResource(t, dashboardCli, uid, shouldExist)
	}
}

// createTestFolder creates a folder with specified UID and optional parent
func createTestFolder(t *testing.T, helper *apis.K8sTestHelper, uid, title, parentUID string) *folder.Folder {
	t.Helper()

	payload := fmt.Sprintf(`{
		"title": "%s",
		"uid": "%s"`, title, uid)

	if parentUID != "" {
		payload += fmt.Sprintf(`,
		"parentUid": "%s"`, parentUID)
	}

	payload += "}"

	folderCreate := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPost,
		Path:   "/api/folders",
		Body:   []byte(payload),
	}, &folder.Folder{})

	require.NotNil(t, folderCreate.Result)
	require.Equal(t, uid, folderCreate.Result.UID)

	return folderCreate.Result
}

// createTestLibraryPanel creates a library panel in a folder
func createTestLibraryPanel(t *testing.T, helper *apis.K8sTestHelper, name, folderUID string) string {
	t.Helper()

	libPanelPayload := fmt.Sprintf(`{
		"kind": 1,
		"name": "%s",
		"folderUid": "%s",
		"model": {
			"type": "text",
			"title": "%s"
		}
	}`, name, folderUID, name)

	libCreate := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPost,
		Path:   "/api/library-elements",
		Body:   []byte(libPanelPayload),
	}, &map[string]interface{}{})

	require.NotNil(t, libCreate.Response)
	require.Equal(t, http.StatusOK, libCreate.Response.StatusCode)

	libPanelUID := (*libCreate.Result)["result"].(map[string]interface{})["uid"].(string)
	require.NotEmpty(t, libPanelUID)

	return libPanelUID
}

// createTestDashboardWithLibraryPanel creates a dashboard that uses a library panel
func createTestDashboardWithLibraryPanel(t *testing.T, helper *apis.K8sTestHelper, dashTitle, libPanelUID, libPanelName, folderUID string) string {
	t.Helper()

	dashPayload := fmt.Sprintf(`{
		"dashboard": {
			"title": "%s",
			"panels": [{
				"id": 1,
				"libraryPanel": {
					"uid": "%s",
					"name": "%s"
				}
			}]
		},
		"folderUid": "%s",
		"overwrite": false
	}`, dashTitle, libPanelUID, libPanelName, folderUID)

	dashCreate := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPost,
		Path:   "/api/dashboards/db",
		Body:   []byte(dashPayload),
	}, &map[string]interface{}{})

	require.NotNil(t, dashCreate.Response)
	require.Equal(t, http.StatusOK, dashCreate.Response.StatusCode)

	dashUID := (*dashCreate.Result)["uid"].(string)
	require.NotEmpty(t, dashUID)
	return dashUID
}
