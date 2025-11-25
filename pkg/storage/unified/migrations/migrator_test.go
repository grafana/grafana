package migrations_test

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"testing"

	authlib "github.com/grafana/authlib/types"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

type migrationTestSuite struct {
	testCases []testCase
}

type testCase struct {
	name          string
	gvr           schema.GroupVersionResource
	createFn      createResourceFn // Creates resources in legacy storage (Mode0)
	expectedCount int
	uids          []string // Populated during creation
}

type createResourceFn func(t *testing.T, ctx *migrationTestContext) []string

// migrationTestContext contains runtime context needed for the test execution and verification
type migrationTestContext struct {
	helper    *apis.K8sTestHelper
	namespace string
	user      apis.User
	TestCase  *testCase
}

// TestIntegrationMigrations verifies that legacy storage data is correctly migrated to unified storage.
// The test follows a three-step process:
// Step 1: inserts legacy data (migration disabled at startup)
// Step 2: verifies that the data is not in unified storage
// Step 3: migration runs at startup, and the test verifies that the data is in unified storage
func TestIntegrationMigrations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	migrationTestCases := []testCase{
		newNestedFolderTestCase("parent-folder-uid", "child-folder-uid"),
		newFolderAndDashboardTestCase("child-folder-uid"),
	}

	suite := &migrationTestSuite{
		testCases: migrationTestCases,
	}

	suite.run(t)
}

// newNestedFolderTestCase creates a test case for nested folders (parent + child)
func newNestedFolderTestCase(parentUID, childUID string) testCase {
	return testCase{
		gvr:           foldersGVR,
		name:          "Test Nested Folder Migration",
		expectedCount: 2, // Parent + child
		createFn: func(t *testing.T, ctx *migrationTestContext) []string {
			parentTitle := "parent-folder"
			childTitle := "child-folder"

			parent := createTestFolder(t, ctx.helper, parentUID, parentTitle, "")
			child := createTestFolder(t, ctx.helper, childUID, childTitle, parent.UID)
			return []string{parent.UID, child.UID}
		},
	}
}

// newFolderAndDashboardTestCase creates a test case with a folder and dashboard with a library panel
func newFolderAndDashboardTestCase(folderUID string) testCase {
	return testCase{
		gvr:           dashboardGVR,
		name:          "Test Dashboard Migration",
		expectedCount: 1, // Only dashboard is counted
		createFn: func(t *testing.T, ctx *migrationTestContext) []string {
			dashboardTitle := "dashboard-with-library-panel"

			libPanelUID := createTestLibraryPanel(t, ctx.helper, "Test LP for "+dashboardTitle, folderUID)

			dashUID := createTestDashboardWithLibraryPanel(t, ctx.helper, dashboardTitle,
				libPanelUID, "Test LP in dashboard", folderUID)
			return []string{dashUID}
		},
	}
}

// run executes the migration test suite
func (s *migrationTestSuite) run(t *testing.T) {
	if db.IsTestDbSQLite() {
		// Share the same SQLite DB file between steps
		tmpDir := t.TempDir()
		dbPath := tmpDir + "/shared-migration-error-test.db"

		oldVal := os.Getenv("SQLITE_TEST_DB")
		require.NoError(t, os.Setenv("SQLITE_TEST_DB", dbPath))
		t.Cleanup(func() {
			if oldVal == "" {
				_ = os.Unsetenv("SQLITE_TEST_DB")
			} else {
				_ = os.Setenv("SQLITE_TEST_DB", oldVal)
			}
		})
		t.Logf("Using shared database path: %s", dbPath)
	}

	var org1 *apis.OrgUsers
	var orgB *apis.OrgUsers
	t.Run("Step 1: Create data in legacy", func(t *testing.T) {
		// Build unified storage config for Mode0
		unifiedConfig := make(map[string]setting.UnifiedStorageConfig)
		for _, tc := range s.testCases {
			resourceKey := fmt.Sprintf("%s.%s", tc.gvr.Resource, tc.gvr.Group)
			unifiedConfig[resourceKey] = setting.UnifiedStorageConfig{
				DualWriterMode: grafanarest.Mode0,
			}
		}

		// Set up test environment with Mode0 (writes only to legacy)
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:     true,
			DisableAnonymous:      true,
			DisableDataMigrations: true,
			DisableDBCleanup:      true,
			APIServerStorageType:  "unified",
			UnifiedStorageConfig:  unifiedConfig,
		})
		t.Cleanup(helper.Shutdown)

		org1 = &helper.Org1
		orgB = &helper.OrgB

		// Execute createFn for each test case
		orgID := helper.Org1.OrgID
		namespace := authlib.OrgNamespaceFormatter(orgID)
		for i := range s.testCases {
			tc := &s.testCases[i]
			t.Run(tc.name, func(t *testing.T) {
				ctx := &migrationTestContext{
					helper:    helper,
					namespace: namespace,
					user:      helper.Org1.Admin,
					TestCase:  tc,
				}

				// Create resources in legacy storage
				uids := tc.createFn(t, ctx)
				tc.uids = uids

				verifyResources(t, ctx, tc.uids, true)
			})
		}
	})

	// Set SKIP_DB_TRUNCATE to not truncate the data created in Step 1
	oldSkipTruncate := os.Getenv("SKIP_DB_TRUNCATE")
	require.NoError(t, os.Setenv("SKIP_DB_TRUNCATE", "true"))
	t.Cleanup(func() {
		if oldSkipTruncate == "" {
			_ = os.Unsetenv("SKIP_DB_TRUNCATE")
		} else {
			_ = os.Setenv("SKIP_DB_TRUNCATE", oldSkipTruncate)
		}
	})

	t.Run("Step 2: Verify data is NOT in unified storage before the migration", func(t *testing.T) {
		// Build unified storage config for Mode5
		unifiedConfig := make(map[string]setting.UnifiedStorageConfig)
		for _, tc := range s.testCases {
			resourceKey := fmt.Sprintf("%s.%s", tc.gvr.Resource, tc.gvr.Group)
			unifiedConfig[resourceKey] = setting.UnifiedStorageConfig{
				DualWriterMode: grafanarest.Mode5,
			}
		}

		helper := apis.NewK8sTestHelperWithOpts(t, apis.K8sTestHelperOpts{
			GrafanaOpts: testinfra.GrafanaOpts{
				AppModeProduction:     true,
				DisableAnonymous:      true,
				DisableDataMigrations: true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig:  unifiedConfig,
			},
			Org1Users: org1,
			OrgBUsers: orgB,
		})
		t.Cleanup(helper.Shutdown)

		orgID := helper.Org1.OrgID
		namespace := authlib.OrgNamespaceFormatter(orgID)
		for _, tc := range s.testCases {
			tc := tc
			t.Run(tc.name, func(t *testing.T) {
				ctx := &migrationTestContext{
					helper:    helper,
					namespace: namespace,
					user:      helper.Org1.Admin,
					TestCase:  &tc,
				}

				verifyResources(t, ctx, tc.uids, false)
			})
		}
	})

	t.Run("Step 3: verify data is migrated to unified storage", func(t *testing.T) {
		// Migrations will run automatically at startup and mode 5 is enforced by the config
		helper := apis.NewK8sTestHelperWithOpts(t, apis.K8sTestHelperOpts{
			GrafanaOpts: testinfra.GrafanaOpts{
				AppModeProduction:     true,
				DisableAnonymous:      true,
				DisableDataMigrations: false, // Enforces mode 5 for migrated resources and run migrations
				APIServerStorageType:  "unified",
			},
			// Reuse created resources from Step 1
			Org1Users: org1,
			OrgBUsers: orgB,
		})
		t.Cleanup(helper.Shutdown)

		orgID := helper.Org1.OrgID
		namespace := authlib.OrgNamespaceFormatter(orgID)
		for _, tc := range s.testCases {
			tc := tc
			t.Run(tc.name, func(t *testing.T) {
				ctx := &migrationTestContext{
					helper:    helper,
					namespace: namespace,
					user:      helper.Org1.Admin,
					TestCase:  &tc,
				}
				verifyResources(t, ctx, tc.uids, true)
			})
		}
	})
}

// verifyResources verifies that resources are returned
func verifyResources(t *testing.T, ctx *migrationTestContext, uids []string, shouldExist bool) {
	t.Helper()

	// Verify expected count
	expectedCount := ctx.TestCase.expectedCount
	if expectedCount == 0 {
		expectedCount = len(uids)
	}
	if shouldExist {
		verifyResourceCount(t, ctx, ctx.TestCase.gvr, expectedCount)
	} else {
		verifyResourceCount(t, ctx, ctx.TestCase.gvr, 0)
	}

	// Verify each UID exists
	for _, uid := range uids {
		verifyResource(t, ctx, ctx.TestCase.gvr, uid, shouldExist)
	}
}

// verifyResourceCount verifies that the expected number of resources exist in K8s storage
func verifyResourceCount(t *testing.T, ctx *migrationTestContext, gvr schema.GroupVersionResource, expectedCount int) {
	t.Helper()

	client := ctx.helper.GetResourceClient(apis.ResourceClientArgs{
		User:      ctx.user,
		Namespace: ctx.namespace,
		GVR:       gvr,
	})

	l, err := client.Resource.List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)

	resources, err := meta.ExtractList(l)
	require.NoError(t, err)
	require.Equal(t, expectedCount, len(resources))
}

// verifyResource verifies that a resource with the given UID exists in K8s storage
func verifyResource(t *testing.T, ctx *migrationTestContext, gvr schema.GroupVersionResource, uid string, shouldExist bool) {
	t.Helper()

	client := ctx.helper.GetResourceClient(apis.ResourceClientArgs{
		User:      ctx.user,
		Namespace: ctx.namespace,
		GVR:       gvr,
	})

	_, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
	if shouldExist {
		require.NoError(t, err)
	} else {
		require.Error(t, err)
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

var foldersGVR = schema.GroupVersionResource{
	Group:    "folder.grafana.app",
	Version:  "v1beta1",
	Resource: "folders",
}

var dashboardGVR = schema.GroupVersionResource{
	Group:    "dashboard.grafana.app",
	Version:  "v1beta1",
	Resource: "dashboards",
}
