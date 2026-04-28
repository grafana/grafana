package migrations_test

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	dashboard "github.com/grafana/grafana/pkg/registry/apis/dashboard"
	dashboardmigrator "github.com/grafana/grafana/pkg/registry/apis/dashboard/migrator"
	playlist "github.com/grafana/grafana/pkg/registry/apps/playlist"
	playlistmigrator "github.com/grafana/grafana/pkg/registry/apps/playlist/migrator"
	shorturl "github.com/grafana/grafana/pkg/registry/apps/shorturl"
	shorturlmigrator "github.com/grafana/grafana/pkg/registry/apps/shorturl/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/migrations/testcases"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func defaultMigrationTestCases() []testcases.ResourceMigratorTestCase {
	cases := []testcases.ResourceMigratorTestCase{
		testcases.NewFoldersAndDashboardsTestCase(),
		testcases.NewPlaylistsTestCase(),
		testcases.NewShortURLsTestCase(),
		testcases.NewStarsTestCase(),
	}
	// TODO: fix datasource migration tests on sqlite, see:
	// https://github.com/grafana/grafana-enterprise/issues/11313
	if !db.IsTestDbSQLite() {
		cases = append(cases, testcases.NewDataSourceTestCase())
	}
	return cases
}

// TestIntegrationMigrations verifies that legacy storage data is correctly migrated to unified storage.
// The test follows a multi-step process:
// Step 1: inserts legacy data (migration disabled at startup)
// Step 2: verifies that the data is not in unified storage
// Step 3: migration runs at startup, and the test verifies that the data is in unified storage
func TestIntegrationMigrations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	runMigrationTestSuite(t, defaultMigrationTestCases(), migrationTestOptions{})
}

// TestIntegrationKVMigrations runs the same migration test suite as TestIntegrationMigrations
// but with the KV storage backend enabled instead of the SQL backend.
func TestIntegrationKVMigrations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	runMigrationTestSuite(t, defaultMigrationTestCases(), migrationTestOptions{enableSQLKVBackend: true})
}

type migrationTestOptions struct {
	enableSQLKVBackend bool
	// extraMigrationIDs adds migration IDs (and their default status) to the verification map.
	// Used by enterprise tests to include enterprise-only migrations.
	extraMigrationIDs map[string]bool
}

// runMigrationTestSuite executes the migration test suite for the given test cases
func runMigrationTestSuite(t *testing.T, testCases []testcases.ResourceMigratorTestCase, opts migrationTestOptions) {
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

		// Reset the global testSQLStore singleton after this test suite finishes.
		// testinfra sets testSQLStore to an engine pointing at the temp DB file above;
		// when t.TempDir() cleanup deletes that file, the engine becomes stale.
		// Without this, subsequent tests calling db.InitTestDB will try to truncate
		// tables on the stale engine and fail with "attempt to write a readonly database".
		t.Cleanup(db.CleanupTestDB)
	}

	// Clean up leftover state from previous test runs (e.g., renamed _legacy tables).
	// Also register cleanup to run after this test, so other packages sharing the same
	// MySQL/Postgres test DB don't see the renamed tables (e.g. short_url_legacy).
	// Failing to do so may cause subsequent tests to fail in environments where the database is shared between tests.
	if !db.IsTestDbSQLite() {
		cleanupLegacyTables(t, testCases)
		t.Cleanup(func() { cleanupLegacyTables(t, testCases) })
	}

	// Collect feature toggles required by all test cases
	var featureToggles []string
	seen := make(map[string]bool)
	for _, tc := range testCases {
		for _, ft := range tc.FeatureToggles() {
			if !seen[ft] {
				featureToggles = append(featureToggles, ft)
				seen[ft] = true
			}
		}
	}

	// Store UIDs created by each test case
	type testCaseState struct {
		tc testcases.ResourceMigratorTestCase
	}
	testStates := make([]testCaseState, len(testCases))
	for i, tc := range testCases {
		testStates[i].tc = tc
	}

	// reuse org users throughout the tests
	var org1 *apis.OrgUsers
	var orgB *apis.OrgUsers

	// Step 1: Create data in legacy
	func() {
		// Enforce Mode0 for all migrated resources
		unifiedConfig := make(map[string]setting.UnifiedStorageConfig)
		for _, tc := range testCases {
			for _, gvr := range tc.Resources() {
				resourceKey := fmt.Sprintf("%s.%s", gvr.Resource, gvr.Group)
				unifiedConfig[resourceKey] = setting.UnifiedStorageConfig{
					DualWriterMode: grafanarest.Mode0,
				}
			}
		}
		// Explicitly disable migrations for all resources enabled by default that are not
		// covered by the test cases. Without this, applyMigrationEnforcements would enforce
		// Mode5 for any enabled-by-default resource absent from cfg.UnifiedStorage.
		disableMigrationsForDefaultResources(unifiedConfig)

		// Set up test environment with Mode0 (writes only to legacy)
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			DisableDBCleanup:     true,
			APIServerStorageType: "unified",
			UnifiedStorageConfig: unifiedConfig,
			EnableFeatureToggles: featureToggles,
			EnableSQLKVBackend:   opts.enableSQLKVBackend,
		})
		defer helper.Shutdown()
		org1 = &helper.Org1
		orgB = &helper.OrgB

		// create legacy tables (the ones that are no longer setup by default)
		env := helper.GetEnv()
		mg := migrator.NewScopedMigrator(env.SQLStore.GetEngine(), env.Cfg, "unified_migrator_tests")
		mg.AddCreateMigration()
		for _, v := range testStates {
			v.tc.AddLegacySQLMigrations(mg)
		}
		err := mg.RunMigrations(t.Context(), false, 5000)
		require.NoError(t, err, "error running migrations")

		// Setup
		for i := range testStates {
			state := &testStates[i]
			t.Run(state.tc.Name()+"/Step 1: Create data in legacy", func(t *testing.T) {
				inK8s := state.tc.Setup(t, helper)
				// Verify resources were created in legacy storage
				state.tc.Verify(t, helper, inK8s)
			})
		}
	}()

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

	// Step 2: Verify data is NOT in unified storage before the migration
	func() {
		// Build unified storage config for Mode5
		unifiedConfig := make(map[string]setting.UnifiedStorageConfig)
		for _, tc := range testCases {
			for _, gvr := range tc.Resources() {
				resourceKey := fmt.Sprintf("%s.%s", gvr.Resource, gvr.Group)
				unifiedConfig[resourceKey] = setting.UnifiedStorageConfig{
					DualWriterMode: grafanarest.Mode5,
				}
			}
		}
		disableMigrationsForDefaultResources(unifiedConfig)

		helper := apis.NewK8sTestHelperWithOpts(t, apis.K8sTestHelperOpts{
			GrafanaOpts: testinfra.GrafanaOpts{
				AppModeProduction:    true,
				DisableAnonymous:     true,
				DisableDBCleanup:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: unifiedConfig,
				EnableFeatureToggles: featureToggles,
				EnableSQLKVBackend:   opts.enableSQLKVBackend,
			},
			Org1Users: org1,
			OrgBUsers: orgB,
		})
		defer helper.Shutdown()

		for _, state := range testStates {
			t.Run(state.tc.Name()+"/Step 2: Verify data is NOT in unified storage before the migration", func(t *testing.T) {
				// Verify resources don't exist in unified storage yet
				state.tc.Verify(t, helper, false)
			})
		}
	}()

	// Step 3: verify that opted-out resources are not migrated
	func() {
		// Build unified storage config for Mode5
		unifiedConfig := make(map[string]setting.UnifiedStorageConfig)
		for _, tc := range testCases {
			for _, gvr := range tc.Resources() {
				resourceKey := fmt.Sprintf("%s.%s", gvr.Resource, gvr.Group)
				unifiedConfig[resourceKey] = setting.UnifiedStorageConfig{
					DualWriterMode:  grafanarest.Mode5,
					EnableMigration: false,
				}
			}
		}

		helper := apis.NewK8sTestHelperWithOpts(t, apis.K8sTestHelperOpts{
			GrafanaOpts: testinfra.GrafanaOpts{
				AppModeProduction:    true,
				DisableAnonymous:     true,
				DisableDBCleanup:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: unifiedConfig,
				EnableFeatureToggles: featureToggles,
				EnableSQLKVBackend:   opts.enableSQLKVBackend,
			},
			Org1Users: org1,
			OrgBUsers: orgB,
		})
		defer helper.Shutdown()

		for _, state := range testStates {
			t.Run(state.tc.Name()+"/Step 3: verify that opted-out resources are not migrated", func(t *testing.T) {
				// Verify resources don't exist in unified storage yet
				state.tc.Verify(t, helper, false)
			})
		}
		verifyRegisteredMigrations(t, helper, false, true, opts.extraMigrationIDs)
	}()

	// Step 4: verify data is migrated to unified storage
	func() {
		// Migrations enabled by default will run automatically at startup and mode 5 is enforced by the config
		helper := apis.NewK8sTestHelperWithOpts(t, apis.K8sTestHelperOpts{
			GrafanaOpts: testinfra.GrafanaOpts{
				AppModeProduction:    true,
				DisableAnonymous:     true,
				DisableDBCleanup:     true,
				APIServerStorageType: "unified",
				EnableFeatureToggles: featureToggles,
				EnableSQLKVBackend:   opts.enableSQLKVBackend,
			},
			Org1Users: org1,
			OrgBUsers: orgB,
		})
		defer helper.Shutdown()

		for _, state := range testStates {
			t.Run(state.tc.Name()+"/Step 4: verify data is migrated to unified storage", func(t *testing.T) {
				for _, gvr := range state.tc.Resources() {
					resourceKey := fmt.Sprintf("%s.%s", gvr.Resource, gvr.Group)
					// Only verify resources that are expected to be migrated by default.
					// Resources outside this map won't have mode 5 enforced, so the K8s API
					// may still serve them from legacy storage, making verification unreliable.
					if !setting.MigratedUnifiedResources[resourceKey] {
						t.Skipf("Resource %s is not migrated by default, skipping verification", resourceKey)
						return
					}
				}
				state.tc.Verify(t, helper, true)
			})
		}

		t.Logf("Verifying migrations are correctly registered")
		verifyRegisteredMigrations(t, helper, true, false, opts.extraMigrationIDs)
	}()

	// Step 5: verify data is migrated for all migrations
	func() {
		// Trigger migrations that are not enabled by default
		unifiedConfig := make(map[string]setting.UnifiedStorageConfig)
		for _, tc := range testCases {
			for _, gvr := range tc.Resources() {
				resourceKey := fmt.Sprintf("%s.%s", gvr.Resource, gvr.Group)
				unifiedConfig[resourceKey] = setting.UnifiedStorageConfig{
					EnableMigration: true,
				}
			}
		}
		helper := apis.NewK8sTestHelperWithOpts(t, apis.K8sTestHelperOpts{
			GrafanaOpts: testinfra.GrafanaOpts{
				AppModeProduction:      true,
				DisableAnonymous:       true,
				APIServerStorageType:   "unified",
				UnifiedStorageConfig:   unifiedConfig,
				MigrationParquetBuffer: true,
				EnableFeatureToggles:   featureToggles,
				EnableSQLKVBackend:     opts.enableSQLKVBackend,
			},
			Org1Users: org1,
			OrgBUsers: orgB,
		})
		defer helper.Shutdown()

		for _, state := range testStates {
			t.Run(state.tc.Name()+"/Step 5: verify data is migrated for all migrations", func(t *testing.T) {
				// Verify resources still exist in unified storage after restart
				state.tc.Verify(t, helper, true)
			})
		}

		t.Logf("Verifying migrations are correctly registered")
		verifyRegisteredMigrations(t, helper, false, false, opts.extraMigrationIDs)

		t.Logf("Verifying key_path is populated in resource_history after bulkimport")
		verifyKeyPathPopulated(t, helper)

		t.Logf("Verifying legacy tables were renamed")
		verifyTablesRenamed(t, helper, testCases)
	}()
}

const (
	migrationScope = "unifiedstorage"
	migrationTable = migrationScope + "_migration_log"

	playlistsID            = "playlists migration"
	foldersAndDashboardsID = "folders and dashboards migration"
	shorturlsID            = "shorturls migration"
	starsID                = "stars migration"
	datasourceID           = "datasources migration"
)

var migrationIDsToDefault = map[string]bool{
	playlistsID:            true,
	foldersAndDashboardsID: true, // Auto-migrated when resource count is below threshold
	shorturlsID:            false,
	datasourceID:           false,
	starsID:                false,
}

func verifyRegisteredMigrations(t *testing.T, helper *apis.K8sTestHelper, onlyDefault bool, optOut bool, extraMigrationIDs map[string]bool) {
	getMigrationsQuery := fmt.Sprintf("SELECT migration_id FROM %s", migrationTable)
	createTableMigrationID := fmt.Sprintf("create %s table", migrationTable)
	expectedMigrationIDs := []string{createTableMigrationID}

	allMigrationIDs := make(map[string]bool)
	for id, enabled := range migrationIDsToDefault {
		allMigrationIDs[id] = enabled
	}
	for id, enabled := range extraMigrationIDs {
		allMigrationIDs[id] = enabled
	}

	for id, enabled := range allMigrationIDs {
		if onlyDefault && !enabled {
			continue
		}
		if optOut {
			continue
		}
		if db.IsTestDbSQLite() && id == datasourceID {
			continue
		}
		expectedMigrationIDs = append(expectedMigrationIDs, id)
	}
	rows, err := helper.GetEnv().SQLStore.GetEngine().DB().Query(getMigrationsQuery)
	require.NoError(t, err)
	defer func() {
		require.NoError(t, rows.Close())
	}()

	migrationIDs := make(map[string]struct{})
	for rows.Next() {
		var migrationID string
		require.NoError(t, rows.Scan(&migrationID))
		require.Contains(t, expectedMigrationIDs, migrationID)
		migrationIDs[migrationID] = struct{}{}
	}
	require.NoError(t, rows.Err())
	require.Len(t, migrationIDs, len(expectedMigrationIDs))
}

// verifyKeyPathPopulated verifies that all rows in resource_history have a non-empty key_path.
// This is important because bulkimport must populate key_path for indexing/searching to work.
func verifyKeyPathPopulated(t *testing.T, helper *apis.K8sTestHelper) {
	t.Helper()

	query := "SELECT COUNT(*) FROM resource_history WHERE key_path = ''"
	rows, err := helper.GetEnv().SQLStore.GetEngine().DB().Query(query)
	require.NoError(t, err)
	defer func() {
		require.NoError(t, rows.Close())
	}()

	var emptyKeyPathCount int
	require.True(t, rows.Next(), "expected at least one row from COUNT query")
	require.NoError(t, rows.Scan(&emptyKeyPathCount))
	require.NoError(t, rows.Err())

	require.Equal(t, 0, emptyKeyPathCount, "found %d rows in resource_history with empty key_path", emptyKeyPathCount)

	// Also verify that there are actually some rows with key_path populated
	queryTotal := "SELECT COUNT(*) FROM resource_history WHERE key_path != ''"
	rowsTotal, err := helper.GetEnv().SQLStore.GetEngine().DB().Query(queryTotal)
	require.NoError(t, err)
	defer func() {
		require.NoError(t, rowsTotal.Close())
	}()

	var populatedKeyPathCount int
	require.True(t, rowsTotal.Next(), "expected at least one row from COUNT query")
	require.NoError(t, rowsTotal.Scan(&populatedKeyPathCount))
	require.NoError(t, rowsTotal.Err())

	t.Logf("Verified %d rows in resource_history have populated key_path", populatedKeyPathCount)
	require.Greater(t, populatedKeyPathCount, 0, "expected at least one row in resource_history with populated key_path")
}

// verifyTablesRenamed checks that legacy tables were renamed to _legacy after migration.
func verifyTablesRenamed(t *testing.T, helper *apis.K8sTestHelper, testCases []testcases.ResourceMigratorTestCase) {
	t.Helper()
	engine := helper.GetEnv().SQLStore.GetEngine()

	for _, tc := range testCases {
		for _, table := range tc.RenameTables() {
			legacyName := table + "_legacy"

			exists, err := engine.IsTableExist(table)
			require.NoError(t, err)
			require.False(t, exists, "original table %q should no longer exist after migration", table)

			exists, err = engine.IsTableExist(legacyName)
			require.NoError(t, err)
			require.True(t, exists, "renamed table %q should exist after migration", legacyName)

			t.Logf("Verified table %q was renamed to %q", table, legacyName)
		}
	}
}

// disableMigrationsForDefaultResources ensures that all resources which are enabled by
// default in MigratedUnifiedResources have an explicit entry in unifiedConfig with
// EnableMigration: false. Without this, applyMigrationEnforcements would enforce Mode5
// for any enabled-by-default resource that is absent from cfg.UnifiedStorage (i.e. not
// covered by the current test cases).
func disableMigrationsForDefaultResources(unifiedConfig map[string]setting.UnifiedStorageConfig) {
	for resource, enabledByDefault := range setting.MigratedUnifiedResources {
		if enabledByDefault {
			if _, exists := unifiedConfig[resource]; !exists {
				unifiedConfig[resource] = setting.UnifiedStorageConfig{
					EnableMigration: false,
				}
			}
		}
	}
}

// cleanupLegacyTables restores _legacy tables back to their original names
func cleanupLegacyTables(t *testing.T, testCases []testcases.ResourceMigratorTestCase) {
	t.Helper()

	testDB, err := sqlutil.GetTestDB(sqlutil.GetTestDBType())
	require.NoError(t, err)

	engine, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
	require.NoError(t, err)
	defer func() { _ = engine.Close() }()

	// Restore renamed tables
	for _, tc := range testCases {
		for _, table := range tc.RenameTables() {
			legacyName := table + "_legacy"
			exists, err := engine.IsTableExist(legacyName)
			require.NoError(t, err)
			if exists {
				origExists, err := engine.IsTableExist(table)
				require.NoError(t, err)
				if origExists {
					t.Logf("Both %q and %q exist, dropping legacy table", table, legacyName)
					_, err = engine.Exec("DROP TABLE " + engine.Quote(legacyName))
					require.NoError(t, err)
				} else {
					t.Logf("Restoring %q back to %q", legacyName, table)
					_, err = engine.Exec(fmt.Sprintf("ALTER TABLE %s RENAME TO %s", engine.Quote(legacyName), engine.Quote(table)))
					require.NoError(t, err)
				}
			}
		}
	}
}

// TestUnifiedMigration_Migrate_CancelsStreamContext tests that
// when BulkProcess or a migrator function fails, the stream
// context is canceled so the server-side handler releases its bulk lock.
func TestUnifiedMigration_Migrate_CancelsStreamContext(t *testing.T) {
	gr := schema.GroupResource{Group: "test.grafana.app", Resource: "tests"}

	tests := []struct {
		name        string
		streamErr   error
		migratorErr error
	}{
		{
			name:      "stream error",
			streamErr: fmt.Errorf("simulated stream error"),
		},
		{
			name:        "migrator error",
			migratorErr: fmt.Errorf("simulated migration failure"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := resource.NewMockResourceClient(t)

			var capturedCtx context.Context
			bulkStream := &noopBulkProcessClient{}
			var streamResult resourcepb.BulkStore_BulkProcessClient
			if tt.streamErr == nil {
				streamResult = bulkStream
			}

			mockClient.EXPECT().
				BulkProcess(mock.Anything).
				Run(func(ctx context.Context, opts ...grpc.CallOption) {
					capturedCtx = ctx
				}).
				Return(streamResult, tt.streamErr)

			registry := migrations.NewMigrationRegistry()
			registry.Register(migrations.MigrationDefinition{
				ID:          "test-migration",
				MigrationID: "test migration",
				Resources: []migrations.ResourceInfo{
					{GroupResource: gr},
				},
				Migrators: map[schema.GroupResource]migrations.MigratorFunc{
					gr: func(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
						return tt.migratorErr
					},
				},
			})

			migrator := migrations.ProvideUnifiedMigrator(mockClient, registry)
			_, err := migrator.Migrate(context.Background(), migrations.MigrateOptions{
				Namespace: "default",
				Resources: []schema.GroupResource{gr},
			})

			require.Error(t, err)
			require.NotNil(t, capturedCtx, "BulkProcess should have been called")
			require.Error(t, capturedCtx.Err(), "stream context should be canceled after Migrate returns an error")
		})
	}
}

// noopBulkProcessClient is a minimal BulkStore_BulkProcessClient for testing.
type noopBulkProcessClient struct {
	grpc.ClientStream
}

func (n *noopBulkProcessClient) Send(*resourcepb.BulkRequest) error {
	return nil
}

func (n *noopBulkProcessClient) CloseAndRecv() (*resourcepb.BulkResponse, error) {
	return &resourcepb.BulkResponse{}, nil
}

func TestUnifiedMigration_RebuildIndexes(t *testing.T) {
	tests := []struct {
		name         string
		response     *resourcepb.RebuildIndexesResponse
		responseErr  error
		expectErr    bool
		expectErrMsg string
		numRetries   int // Expected number of RPC calls (1 for success, 5 for max retries)
	}{
		{
			name: "response error retries and returns error",
			response: &resourcepb.RebuildIndexesResponse{
				Error: &resourcepb.ErrorResult{
					Message: "failed to rebuild index",
					Reason:  "IndexError",
				},
			},
			responseErr:  nil,
			expectErr:    true,
			expectErrMsg: "failed to rebuild index",
			numRetries:   5, // MaxRetries: 5 means 5 total attempts
		},
		{
			name:         "RPC error retries and returns error",
			response:     nil,
			responseErr:  fmt.Errorf("connection failed"),
			expectErr:    true,
			expectErrMsg: "connection failed",
			numRetries:   5, // MaxRetries: 5 means 5 total attempts
		},
		{
			name: "no error succeeds on first attempt",
			response: &resourcepb.RebuildIndexesResponse{
				Error: nil,
			},
			responseErr: nil,
			expectErr:   false,
			numRetries:  1, // Only initial attempt, no retries needed
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mock SearchClient
			mockClient := resource.NewMockResourceClient(t)

			// Setup expectation for RebuildIndexes call - will be called numRetries times
			mockClient.EXPECT().
				RebuildIndexes(mock.Anything, mock.Anything).
				Return(tt.response, tt.responseErr).
				Times(tt.numRetries)

			// Create migrator with mock client
			registry := migrations.NewMigrationRegistry()
			registry.Register(dashboard.FoldersDashboardsMigration(dashboardmigrator.ProvideFoldersDashboardsMigrator(nil)))
			registry.Register(playlist.PlaylistMigration(playlistmigrator.ProvidePlaylistMigrator(nil)))
			registry.Register(shorturl.ShortURLMigration(shorturlmigrator.ProvideShortURLMigrator(nil)))
			migrator := migrations.ProvideUnifiedMigrator(
				mockClient,
				registry,
			)

			// Create test data
			info := authlib.NamespaceInfo{
				OrgID: 1,
				Value: "stack-123",
			}
			resources := []schema.GroupResource{
				{Group: "dashboard.grafana.app", Resource: "dashboards"},
			}

			// Execute the method
			err := migrator.RebuildIndexes(context.Background(), migrations.RebuildIndexOptions{
				UsingDistributor:    false,
				NamespaceInfo:       info,
				Resources:           resources,
				MigrationFinishedAt: time.Now(),
			})

			// Verify results
			if tt.expectErr {
				require.Error(t, err)
				if tt.expectErrMsg != "" {
					require.Contains(t, err.Error(), tt.expectErrMsg)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestUnifiedMigration_RebuildIndexes_RetrySuccess(t *testing.T) {
	// Test that retries work - first call fails, second succeeds
	mockClient := resource.NewMockResourceClient(t)

	// First call returns an error
	mockClient.EXPECT().
		RebuildIndexes(mock.Anything, mock.Anything).
		Return(nil, fmt.Errorf("temporary failure")).
		Once()

	// Second call succeeds
	mockClient.EXPECT().
		RebuildIndexes(mock.Anything, mock.Anything).
		Return(&resourcepb.RebuildIndexesResponse{Error: nil}, nil).
		Once()

	// Create migrator with mock client
	registry := migrations.NewMigrationRegistry()
	registry.Register(dashboard.FoldersDashboardsMigration(dashboardmigrator.ProvideFoldersDashboardsMigrator(nil)))
	registry.Register(playlist.PlaylistMigration(playlistmigrator.ProvidePlaylistMigrator(nil)))
	registry.Register(shorturl.ShortURLMigration(shorturlmigrator.ProvideShortURLMigrator(nil)))
	migrator := migrations.ProvideUnifiedMigrator(
		mockClient,
		registry,
	)

	// Create test data
	info := authlib.NamespaceInfo{
		OrgID: 1,
		Value: "stack-123",
	}
	resources := []schema.GroupResource{
		{Group: "dashboard.grafana.app", Resource: "dashboards"},
	}

	// Execute the method
	err := migrator.RebuildIndexes(context.Background(), migrations.RebuildIndexOptions{
		UsingDistributor:    false,
		NamespaceInfo:       info,
		Resources:           resources,
		MigrationFinishedAt: time.Now(),
	})

	// Should succeed after retry
	require.NoError(t, err)
}

func TestUnifiedMigration_RebuildIndexes_UsingDistributor(t *testing.T) {
	migrationFinishedAt := time.Now()

	tests := []struct {
		name         string
		response     *resourcepb.RebuildIndexesResponse
		resources    []schema.GroupResource
		expectErr    bool
		expectErrMsg string
		numRetries   int // Expected number of RPC calls (1 for success, 5 for max retries)
	}{
		{
			name: "not all pods contacted retries and returns error",
			response: &resourcepb.RebuildIndexesResponse{
				ContactedAllInstances: false,
			},
			resources: []schema.GroupResource{
				{Group: "dashboard.grafana.app", Resource: "dashboards"},
			},
			expectErr:    true,
			expectErrMsg: "distributor did not contact all instances",
			numRetries:   5, // MaxRetries: 5 means 5 total attempts
		},
		{
			name: "missing build time for resource succeeds (index may not exist)",
			response: &resourcepb.RebuildIndexesResponse{
				ContactedAllInstances: true,
				BuildTimes: []*resourcepb.RebuildIndexesResponse_IndexBuildTime{
					{
						Group:         "dashboard.grafana.app",
						Resource:      "dashboards",
						BuildTimeUnix: migrationFinishedAt.Unix(),
					},
				},
			},
			resources: []schema.GroupResource{
				{Group: "dashboard.grafana.app", Resource: "dashboards"},
				{Group: "dashboard.grafana.app", Resource: "folders"},
			},
			expectErr:  false,
			numRetries: 1, // Only initial attempt, no retries needed
		},
		{
			name: "build time before migration finished retries and returns error",
			response: &resourcepb.RebuildIndexesResponse{
				ContactedAllInstances: true,
				BuildTimes: []*resourcepb.RebuildIndexesResponse_IndexBuildTime{
					{
						Group:         "dashboard.grafana.app",
						Resource:      "dashboards",
						BuildTimeUnix: migrationFinishedAt.Add(-1 * time.Second).Unix(), // 1 second before migration
					},
				},
			},
			resources: []schema.GroupResource{
				{Group: "dashboard.grafana.app", Resource: "dashboards"},
			},
			expectErr:    true,
			expectErrMsg: "was built before migration finished",
			numRetries:   5, // MaxRetries: 5 means 5 total attempts
		},
		{
			name: "build time exactly at migration time succeeds",
			response: &resourcepb.RebuildIndexesResponse{
				ContactedAllInstances: true,
				BuildTimes: []*resourcepb.RebuildIndexesResponse_IndexBuildTime{
					{
						Group:         "dashboard.grafana.app",
						Resource:      "dashboards",
						BuildTimeUnix: migrationFinishedAt.Unix(),
					},
				},
			},
			resources: []schema.GroupResource{
				{Group: "dashboard.grafana.app", Resource: "dashboards"},
			},
			expectErr:  false,
			numRetries: 1, // Only initial attempt, no retries needed
		},
		{
			name: "build time after migration time succeeds",
			response: &resourcepb.RebuildIndexesResponse{
				ContactedAllInstances: true,
				BuildTimes: []*resourcepb.RebuildIndexesResponse_IndexBuildTime{
					{
						Group:         "dashboard.grafana.app",
						Resource:      "dashboards",
						BuildTimeUnix: migrationFinishedAt.Add(10 * time.Second).Unix(),
					},
				},
			},
			resources: []schema.GroupResource{
				{Group: "dashboard.grafana.app", Resource: "dashboards"},
			},
			expectErr:  false,
			numRetries: 1, // Only initial attempt, no retries needed
		},
		{
			name: "response error retries and returns error even with valid build times",
			response: &resourcepb.RebuildIndexesResponse{
				ContactedAllInstances: true,
				BuildTimes: []*resourcepb.RebuildIndexesResponse_IndexBuildTime{
					{
						Group:         "dashboard.grafana.app",
						Resource:      "dashboards",
						BuildTimeUnix: migrationFinishedAt.Unix(),
					},
				},
				Error: &resourcepb.ErrorResult{
					Message: "some pods failed to rebuild",
					Reason:  "PartialFailure",
				},
			},
			resources: []schema.GroupResource{
				{Group: "dashboard.grafana.app", Resource: "dashboards"},
			},
			expectErr:    true,
			expectErrMsg: "some pods failed to rebuild",
			numRetries:   5, // MaxRetries: 5 means 5 total attempts
		},
		{
			name: "multiple resources with valid build times succeeds",
			response: &resourcepb.RebuildIndexesResponse{
				ContactedAllInstances: true,
				BuildTimes: []*resourcepb.RebuildIndexesResponse_IndexBuildTime{
					{
						Group:         "dashboard.grafana.app",
						Resource:      "dashboards",
						BuildTimeUnix: migrationFinishedAt.Unix(),
					},
					{
						Group:         "dashboard.grafana.app",
						Resource:      "folders",
						BuildTimeUnix: migrationFinishedAt.Add(5 * time.Second).Unix(),
					},
				},
			},
			resources: []schema.GroupResource{
				{Group: "dashboard.grafana.app", Resource: "dashboards"},
				{Group: "dashboard.grafana.app", Resource: "folders"},
			},
			expectErr:  false,
			numRetries: 1, // Only initial attempt, no retries needed
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mock SearchClient
			mockClient := resource.NewMockResourceClient(t)

			// Setup expectation for RebuildIndexes call - will be called numRetries times
			mockClient.EXPECT().
				RebuildIndexes(mock.Anything, mock.Anything).
				Return(tt.response, nil).
				Times(tt.numRetries)

			// Create migrator with mock client
			registry := migrations.NewMigrationRegistry()
			registry.Register(dashboard.FoldersDashboardsMigration(dashboardmigrator.ProvideFoldersDashboardsMigrator(nil)))
			registry.Register(playlist.PlaylistMigration(playlistmigrator.ProvidePlaylistMigrator(nil)))
			registry.Register(shorturl.ShortURLMigration(shorturlmigrator.ProvideShortURLMigrator(nil)))
			migrator := migrations.ProvideUnifiedMigrator(
				mockClient,
				registry,
			)

			// Create test data
			info := authlib.NamespaceInfo{
				OrgID: 1,
				Value: "stack-123",
			}

			// Execute the method
			err := migrator.RebuildIndexes(context.Background(), migrations.RebuildIndexOptions{
				UsingDistributor:    true,
				NamespaceInfo:       info,
				Resources:           tt.resources,
				MigrationFinishedAt: migrationFinishedAt,
			})

			// Verify results
			if tt.expectErr {
				require.Error(t, err)
				if tt.expectErrMsg != "" {
					require.Contains(t, err.Error(), tt.expectErrMsg)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestUnifiedMigration_RebuildIndexes_UsingDistributor_RetrySuccess(t *testing.T) {
	// Test that retries work with distributor - first call has stale build time, second succeeds
	migrationFinishedAt := time.Now()
	mockClient := resource.NewMockResourceClient(t)

	// First call returns stale build time (before migration)
	mockClient.EXPECT().
		RebuildIndexes(mock.Anything, mock.Anything).
		Return(&resourcepb.RebuildIndexesResponse{
			ContactedAllInstances: true,
			BuildTimes: []*resourcepb.RebuildIndexesResponse_IndexBuildTime{
				{
					Group:         "dashboard.grafana.app",
					Resource:      "dashboards",
					BuildTimeUnix: migrationFinishedAt.Add(-1 * time.Second).Unix(),
				},
			},
		}, nil).
		Once()

	// Second call succeeds with fresh build time
	mockClient.EXPECT().
		RebuildIndexes(mock.Anything, mock.Anything).
		Return(&resourcepb.RebuildIndexesResponse{
			ContactedAllInstances: true,
			BuildTimes: []*resourcepb.RebuildIndexesResponse_IndexBuildTime{
				{
					Group:         "dashboard.grafana.app",
					Resource:      "dashboards",
					BuildTimeUnix: migrationFinishedAt.Unix(),
				},
			},
		}, nil).
		Once()

	// Create migrator with mock client
	registry := migrations.NewMigrationRegistry()
	registry.Register(dashboard.FoldersDashboardsMigration(dashboardmigrator.ProvideFoldersDashboardsMigrator(nil)))
	registry.Register(playlist.PlaylistMigration(playlistmigrator.ProvidePlaylistMigrator(nil)))
	registry.Register(shorturl.ShortURLMigration(shorturlmigrator.ProvideShortURLMigrator(nil)))
	migrator := migrations.ProvideUnifiedMigrator(
		mockClient,
		registry,
	)

	// Create test data
	info := authlib.NamespaceInfo{
		OrgID: 1,
		Value: "stack-123",
	}
	resources := []schema.GroupResource{
		{Group: "dashboard.grafana.app", Resource: "dashboards"},
	}

	// Execute the method
	err := migrator.RebuildIndexes(context.Background(), migrations.RebuildIndexOptions{
		UsingDistributor:    true,
		NamespaceInfo:       info,
		Resources:           resources,
		MigrationFinishedAt: migrationFinishedAt,
	})

	// Should succeed after retry
	require.NoError(t, err)
}
