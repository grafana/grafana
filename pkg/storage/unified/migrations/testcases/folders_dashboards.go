package testcases

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/tests/apis"
)

// foldersAndDashboardsTestCase tests the "folders-dashboards" ResourceMigration
type foldersAndDashboardsTestCase struct {
	parentFolderUID   string
	childFolderUID    string
	dashboardUID      string
	largeDashboardUID string
	libPanelUID       string
}

// NewFoldersAndDashboardsTestCase creates a test case for the compound folders+dashboards migrator
func NewFoldersAndDashboardsTestCase() ResourceMigratorTestCase {
	return &foldersAndDashboardsTestCase{
		parentFolderUID: "parent-folder-uid",
		childFolderUID:  "child-folder-uid",
		dashboardUID:    "", // Will be generated during setup
		libPanelUID:     "", // Will be generated during setup
	}
}

func (tc *foldersAndDashboardsTestCase) Name() string {
	return "folders-dashboards"
}

func (tc *foldersAndDashboardsTestCase) FeatureToggles() []string {
	return nil
}

func (tc *foldersAndDashboardsTestCase) RenameTables() []string {
	return []string{}
}

func (tc *foldersAndDashboardsTestCase) Resources() []schema.GroupVersionResource {
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

func (tc *foldersAndDashboardsTestCase) AddLegacySQLMigrations(mg *migrator.Migrator) {
	// nothing
}

func (tc *foldersAndDashboardsTestCase) Setup(t *testing.T, helper *apis.K8sTestHelper) bool {
	t.Helper()

	db := helper.GetEnv().SQLStore
	cfg := helper.GetEnv().Cfg
	legacyFolders := folderimpl.ProvideStore(db, cfg)
	legacyDashboards, err := database.ProvideDashboardStore(
		db, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(db))
	require.NoError(t, err)

	// Create parent folder
	parent := createTestFolder(t, helper, legacyFolders, tc.parentFolderUID, "parent-folder", "")

	// Create child folder (nested under parent)
	child := createTestFolder(t, helper, legacyFolders, tc.childFolderUID, "child-folder", parent.UID)

	// Create library panel in child folder
	tc.libPanelUID = createTestLibraryPanel(t, helper, "Test Library Panel", child.UID)

	// Create a large dashboard (~3MB) to test migration performance with big resources.
	// On SQLite without sufficient cache_size, large inserts cause cache spills that
	// escalate to EXCLUSIVE locks and deadlock with concurrent readers.
	tc.largeDashboardUID = createLargeDashboard(t, helper, legacyDashboards, child.UID, 3*1024*1024)

	// Create dashboard with library panel in child folder
	tc.dashboardUID = createTestDashboardWithLibraryPanel(t, helper, legacyDashboards, "dashboard-with-library-panel",
		tc.libPanelUID, "Test LP in dashboard", child.UID)

	return false // mode0 is not supported
}

func (tc *foldersAndDashboardsTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	// Build maps of UIDs by resource type
	folderUIDs := []string{tc.parentFolderUID, tc.childFolderUID}
	dashboardUIDs := []string{tc.dashboardUID, tc.largeDashboardUID}

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
func createTestFolder(t *testing.T, helper *apis.K8sTestHelper, store folder.Store, uid, title, parentUID string) *folder.Folder {
	t.Helper()

	f, err := store.Create(context.Background(), folder.CreateFolderCommand{
		UID:          uid,
		Title:        title,
		OrgID:        helper.Org1.OrgID,
		ParentUID:    parentUID,
		SignedInUser: helper.Org1.Admin.Identity,
	})

	require.NoError(t, err)
	require.Equal(t, uid, f.UID)

	return f
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
func createTestDashboardWithLibraryPanel(t *testing.T, helper *apis.K8sTestHelper, store dashboards.Store, dashTitle, libPanelUID, libPanelName, folderUID string) string {
	t.Helper()

	dashPayload := fmt.Sprintf(`{
			"title": "%s",
			"panels": [{
				"id": 1,
				"libraryPanel": {
					"uid": "%s",
					"name": "%s"
				}
			}]
	}`, dashTitle, libPanelUID, libPanelName)

	userID, err := helper.Org1.Admin.Identity.GetInternalID()
	require.NoError(t, err)

	rsp, err := store.SaveDashboard(context.Background(), dashboards.SaveDashboardCommand{
		OrgID:     helper.Org1.OrgID,
		UserID:    userID,
		Dashboard: simplejson.MustJson([]byte(dashPayload)),
		Overwrite: false,
		FolderUID: folderUID,
	})
	require.NoError(t, err)
	require.NotEmpty(t, rsp.UID)
	return rsp.UID
}

// createLargeDashboard creates a dashboard with padded description to reach targetBytes.
func createLargeDashboard(t *testing.T, helper *apis.K8sTestHelper, store dashboards.Store, folderUID string, targetBytes int) string {
	t.Helper()

	// Generate padding to reach the target size. Each panel has ~100 bytes of overhead,
	// so we use a single panel with a large description field.
	padding := strings.Repeat("x", targetBytes)
	dashPayload := fmt.Sprintf(`{
		"title": "large-dashboard-for-migration-test",
		"panels": [{
			"id": 1,
			"type": "text",
			"title": "padding",
			"options": {"content": "%s"}
		}]
	}`, padding)

	userID, err := helper.Org1.Admin.Identity.GetInternalID()
	require.NoError(t, err)

	rsp, err := store.SaveDashboard(context.Background(), dashboards.SaveDashboardCommand{
		OrgID:     helper.Org1.OrgID,
		UserID:    userID,
		Dashboard: simplejson.MustJson([]byte(dashPayload)),
		Overwrite: false,
		FolderUID: folderUID,
	})
	require.NoError(t, err)

	// require.NotNil(t, dashCreate.Response)
	// require.Equal(t, http.StatusOK, dashCreate.Response.StatusCode,
	// 	"failed to create large dashboard (%d bytes)", targetBytes)

	require.NotEmpty(t, rsp.UID)
	t.Logf("Created large dashboard %s (%d bytes)", rsp.UID, targetBytes)
	return rsp.UID
}
