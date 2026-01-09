package threshold

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"testing"

	authlib "github.com/grafana/authlib/types"
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

// TODO: remove this test before Grafana 13 GA
func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// TestIntegrationAutoMigrateThresholdExceeded verifies that auto-migration is skipped when
// resource count exceeds the configured threshold.
// TODO: remove this test before Grafana 13 GA
func TestIntegrationAutoMigrateThresholdExceeded(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if db.IsTestDbSQLite() {
		// Share the same SQLite DB file between steps
		tmpDir := t.TempDir()
		dbPath := tmpDir + "/shared-threshold-test.db"

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

	dashboardGVR := schema.GroupVersionResource{
		Group:    "dashboard.grafana.app",
		Version:  "v1beta1",
		Resource: "dashboards",
	}
	folderGVR := schema.GroupVersionResource{
		Group:    "folder.grafana.app",
		Version:  "v1beta1",
		Resource: "folders",
	}

	dashboardKey := fmt.Sprintf("%s.%s", dashboardGVR.Resource, dashboardGVR.Group)
	folderKey := fmt.Sprintf("%s.%s", folderGVR.Resource, folderGVR.Group)
	playlistKey := "playlists.playlist.grafana.app"

	// Step 1: Create resources exceeding the threshold (3 resources, threshold=1)
	t.Run("Step 1: Create resources exceeding threshold", func(t *testing.T) {
		unifiedConfig := map[string]setting.UnifiedStorageConfig{}
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:     true,
			DisableAnonymous:      true,
			DisableDataMigrations: true,
			DisableDBCleanup:      true,
			APIServerStorageType:  "unified",
			UnifiedStorageConfig:  unifiedConfig,
		})
		org1 = &helper.Org1
		orgB = &helper.OrgB

		// Create 3 dashboards
		for i := 1; i <= 3; i++ {
			createTestDashboard(t, helper, fmt.Sprintf("Threshold Dashboard %d", i))
		}

		// Create 3 folders
		for i := 1; i <= 3; i++ {
			createTestFolder(t, helper, fmt.Sprintf("folder-%d", i), fmt.Sprintf("Threshold Folder %d", i), "")
		}

		// Explicitly shutdown helper before Step 1 ends to ensure database is properly closed
		helper.Shutdown()
	})

	// Set SKIP_DB_TRUNCATE to prevent truncation in subsequent steps
	oldSkipTruncate := os.Getenv("SKIP_DB_TRUNCATE")
	require.NoError(t, os.Setenv("SKIP_DB_TRUNCATE", "true"))
	t.Cleanup(func() {
		if oldSkipTruncate == "" {
			_ = os.Unsetenv("SKIP_DB_TRUNCATE")
		} else {
			_ = os.Setenv("SKIP_DB_TRUNCATE", oldSkipTruncate)
		}
	})

	// Step 2: Verify auto-migration is skipped due to threshold
	t.Run("Step 2: Verify auto-migration skipped (threshold exceeded)", func(t *testing.T) {
		// Set threshold=1, but we have 3 resources of each type, so migration should be skipped
		// Disable playlists migration since we're only testing dashboard/folder threshold behavior
		unifiedConfig := map[string]setting.UnifiedStorageConfig{
			dashboardKey: {AutoMigrationThreshold: 1, EnableMigration: false},
			folderKey:    {AutoMigrationThreshold: 1, EnableMigration: false},
			playlistKey:  {EnableMigration: false},
		}
		helper := apis.NewK8sTestHelperWithOpts(t, apis.K8sTestHelperOpts{
			GrafanaOpts: testinfra.GrafanaOpts{
				AppModeProduction:     true,
				DisableAnonymous:      true,
				DisableDataMigrations: false, // Allow migration system to run
				APIServerStorageType:  "unified",
				UnifiedStorageConfig:  unifiedConfig,
			},
			Org1Users: org1,
			OrgBUsers: orgB,
		})
		t.Cleanup(helper.Shutdown)

		namespace := authlib.OrgNamespaceFormatter(helper.Org1.OrgID)

		dashCli := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: namespace,
			GVR:       dashboardGVR,
		})
		verifyResourceCount(t, dashCli, 3)

		folderCli := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: namespace,
			GVR:       folderGVR,
		})
		verifyResourceCount(t, folderCli, 3)

		// Verify migration did NOT run by checking the migration log
		count, err := helper.GetEnv().SQLStore.GetEngine().Table("unifiedstorage_migration_log").
			Where("migration_id = ?", "folders and dashboards migration").
			Count()
		require.NoError(t, err)
		require.Equal(t, int64(0), count, "Migration should not have run")
	})
}

func createTestDashboard(t *testing.T, helper *apis.K8sTestHelper, title string) string {
	t.Helper()

	payload := fmt.Sprintf(`{"dashboard": {"title": "%s", "panels": []}, "overwrite": false}`, title)

	result := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: "POST",
		Path:   "/api/dashboards/db",
		Body:   []byte(payload),
	}, &map[string]interface{}{})

	require.NotNil(t, result.Response)
	require.Equal(t, 200, result.Response.StatusCode)

	uid := (*result.Result)["uid"].(string)
	require.NotEmpty(t, uid)
	return uid
}

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
	return folderCreate.Result
}

// verifyResourceCount verifies that the expected number of resources exist in K8s storage
func verifyResourceCount(t *testing.T, client *apis.K8sResourceClient, expectedCount int) {
	t.Helper()

	l, err := client.Resource.List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)

	resources, err := meta.ExtractList(l)
	require.NoError(t, err)
	require.Equal(t, expectedCount, len(resources))
}
