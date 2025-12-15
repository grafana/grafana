package migrations_test

import (
	"context"
	"fmt"
	"os"
	"testing"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
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

// resourceMigratorTestCase defines the interface for testing a resource migrator.
type resourceMigratorTestCase interface {
	// name returns the test case name
	name() string
	// resources returns the GVRs that this migrator handles
	resources() []schema.GroupVersionResource
	// setup creates test resources in legacy storage (Mode0)
	setup(t *testing.T, helper *apis.K8sTestHelper)
	// verify checks that resources exist (or don't exist) in unified storage
	verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool)
}

// TestIntegrationMigrations verifies that legacy storage data is correctly migrated to unified storage.
// The test follows a three-step process:
// Step 1: inserts legacy data (migration disabled at startup)
// Step 2: verifies that the data is not in unified storage
// Step 3: migration runs at startup, and the test verifies that the data is in unified storage
func TestIntegrationMigrations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	migrationTestCases := []resourceMigratorTestCase{
		newFoldersAndDashboardsTestCase(),
		newPlaylistsTestCase(),
	}

	runMigrationTestSuite(t, migrationTestCases)
}

// runMigrationTestSuite executes the migration test suite for the given test cases
func runMigrationTestSuite(t *testing.T, testCases []resourceMigratorTestCase) {
	if db.IsTestDbSQLite() {
		// Share the same SQLite DB file between steps
		tmpDir := t.TempDir()
		dbPath := tmpDir + "/shared-migration-test-suite.db"

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

	// Store UIDs created by each test case
	type testCaseState struct {
		tc resourceMigratorTestCase
	}
	testStates := make([]testCaseState, len(testCases))
	for i, tc := range testCases {
		testStates[i].tc = tc
	}

	// reuse org users throughout the tests
	var org1 *apis.OrgUsers
	var orgB *apis.OrgUsers
	t.Run("Step 1: Create data in legacy", func(t *testing.T) {
		// Enforce Mode0 for all migrated resources
		unifiedConfig := make(map[string]setting.UnifiedStorageConfig)
		for _, tc := range testCases {
			for _, gvr := range tc.resources() {
				resourceKey := fmt.Sprintf("%s.%s", gvr.Resource, gvr.Group)
				unifiedConfig[resourceKey] = setting.UnifiedStorageConfig{
					DualWriterMode: grafanarest.Mode0,
				}
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

		for i := range testStates {
			state := &testStates[i]
			t.Run(state.tc.name(), func(t *testing.T) {
				state.tc.setup(t, helper)
				// Verify resources were created in legacy storage
				state.tc.verify(t, helper, true)
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
		for _, tc := range testCases {
			for _, gvr := range tc.resources() {
				resourceKey := fmt.Sprintf("%s.%s", gvr.Resource, gvr.Group)
				unifiedConfig[resourceKey] = setting.UnifiedStorageConfig{
					DualWriterMode: grafanarest.Mode5,
				}
			}
		}

		helper := apis.NewK8sTestHelperWithOpts(t, apis.K8sTestHelperOpts{
			GrafanaOpts: testinfra.GrafanaOpts{
				AppModeProduction:     true,
				DisableAnonymous:      true,
				DisableDataMigrations: true,
				DisableDBCleanup:      true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig:  unifiedConfig,
			},
			Org1Users: org1,
			OrgBUsers: orgB,
		})
		t.Cleanup(helper.Shutdown)

		for _, state := range testStates {
			t.Run(state.tc.name(), func(t *testing.T) {
				// Verify resources don't exist in unified storage yet
				state.tc.verify(t, helper, false)
			})
		}
	})

	t.Run("Step 3: verify data is migrated to unified storage", func(t *testing.T) {
		// Migrations will run automatically at startup and mode 5 is enforced by the config
		helper := apis.NewK8sTestHelperWithOpts(t, apis.K8sTestHelperOpts{
			GrafanaOpts: testinfra.GrafanaOpts{
				// EnableLog:             true,
				AppModeProduction:     true,
				DisableAnonymous:      true,
				DisableDataMigrations: false, // Run migrations at startup
				APIServerStorageType:  "unified",
			},
			Org1Users: org1,
			OrgBUsers: orgB,
		})
		t.Cleanup(helper.Shutdown)

		for _, state := range testStates {
			t.Run(state.tc.name(), func(t *testing.T) {
				// Verify resources now exist in unified storage after migration
				state.tc.verify(t, helper, true)
			})
		}
	})
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

// verifyResource verifies that a resource with the given UID exists in K8s storage
func verifyResource(t *testing.T, client *apis.K8sResourceClient, uid string, shouldExist bool) {
	t.Helper()

	_, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
	if shouldExist {
		require.NoError(t, err)
	} else {
		require.Error(t, err)
	}
}
