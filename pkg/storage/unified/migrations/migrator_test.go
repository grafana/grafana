package migrations_test

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	authlib "github.com/grafana/authlib/types"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	dashboard "github.com/grafana/grafana/pkg/registry/apis/dashboard"
	dashboardmigrator "github.com/grafana/grafana/pkg/registry/apis/dashboard/migrator"
	playlist "github.com/grafana/grafana/pkg/registry/apps/playlist"
	playlistmigrator "github.com/grafana/grafana/pkg/registry/apps/playlist/migrator"
	shorturl "github.com/grafana/grafana/pkg/registry/apps/shorturl"
	shorturlmigrator "github.com/grafana/grafana/pkg/registry/apps/shorturl/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/migrations/testcases"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// TestIntegrationMigrations verifies that legacy storage data is correctly migrated to unified storage.
// The test follows a three-step process:
// Step 1: inserts legacy data (migration disabled at startup)
// Step 2: verifies that the data is not in unified storage
// Step 3: migration runs at startup, and the test verifies that the data is in unified storage
func TestIntegrationMigrations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	migrationTestCases := []testcases.ResourceMigratorTestCase{
		testcases.NewFoldersAndDashboardsTestCase(),
		testcases.NewPlaylistsTestCase(),
		testcases.NewShortURLsTestCase(),
	}

	runMigrationTestSuite(t, migrationTestCases)
}

// runMigrationTestSuite executes the migration test suite for the given test cases
func runMigrationTestSuite(t *testing.T, testCases []testcases.ResourceMigratorTestCase) {
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
	t.Run("Step 1: Create data in legacy", func(t *testing.T) {
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

		// Set up test environment with Mode0 (writes only to legacy)
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:     true,
			DisableAnonymous:      true,
			DisableDataMigrations: true,
			DisableDBCleanup:      true,
			APIServerStorageType:  "unified",
			UnifiedStorageConfig:  unifiedConfig,
			EnableFeatureToggles:  featureToggles,
		})
		t.Cleanup(helper.Shutdown)
		org1 = &helper.Org1
		orgB = &helper.OrgB

		for i := range testStates {
			state := &testStates[i]
			t.Run(state.tc.Name(), func(t *testing.T) {
				state.tc.Setup(t, helper)
				// Verify resources were created in legacy storage
				state.tc.Verify(t, helper, true)
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
			for _, gvr := range tc.Resources() {
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
				EnableFeatureToggles:  featureToggles,
			},
			Org1Users: org1,
			OrgBUsers: orgB,
		})
		t.Cleanup(helper.Shutdown)

		for _, state := range testStates {
			t.Run(state.tc.Name(), func(t *testing.T) {
				// Verify resources don't exist in unified storage yet
				state.tc.Verify(t, helper, false)
			})
		}
	})

	t.Run("Step 3: verify that opted-out resources are not migrated", func(t *testing.T) {
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
			},
			Org1Users: org1,
			OrgBUsers: orgB,
		})
		t.Cleanup(helper.Shutdown)

		for _, state := range testStates {
			t.Run(state.tc.Name(), func(t *testing.T) {
				// Verify resources don't exist in unified storage yet
				state.tc.Verify(t, helper, false)
			})
		}
		verifyRegisteredMigrations(t, helper, false, true)
	})

	t.Run("Step 4: verify data is migrated to unified storage", func(t *testing.T) {
		// Migrations enabled by default will run automatically at startup and mode 5 is enforced by the config
		helper := apis.NewK8sTestHelperWithOpts(t, apis.K8sTestHelperOpts{
			GrafanaOpts: testinfra.GrafanaOpts{
				AppModeProduction:     true,
				DisableAnonymous:      true,
				DisableDataMigrations: false, // Run migrations at startup
				DisableDBCleanup:      true,
				APIServerStorageType:  "unified",
				EnableFeatureToggles:  featureToggles,
			},
			Org1Users: org1,
			OrgBUsers: orgB,
		})
		t.Cleanup(helper.Shutdown)

		for _, state := range testStates {
			t.Run(state.tc.Name(), func(t *testing.T) {
				for _, gvr := range state.tc.Resources() {
					resourceKey := fmt.Sprintf("%s.%s", gvr.Resource, gvr.Group)
					// Only verify resources that are expected to be migrated, either:
					// 1. In MigratedUnifiedResources (enabled by default), OR
					// 2. In AutoMigratedUnifiedResources (auto-migrated because count is below threshold)
					// Resources not in either map won't have mode 5 enforced, so the K8s API
					// may still serve them from legacy storage, making verification unreliable.
					if !setting.MigratedUnifiedResources[resourceKey] && !setting.AutoMigratedUnifiedResources[resourceKey] {
						t.Skipf("Resource %s is not migrated by default, skipping verification", resourceKey)
						return
					}
				}
				state.tc.Verify(t, helper, true)
			})
		}

		t.Logf("Verifying migrations are correctly registered")
		verifyRegisteredMigrations(t, helper, true, false)
	})

	t.Run("Step 5: verify data is migrated for all migrations", func(t *testing.T) {
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
				// EnableLog:             true,
				AppModeProduction:     true,
				DisableAnonymous:      true,
				DisableDataMigrations: false,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig:  unifiedConfig,
				EnableFeatureToggles:  featureToggles,
			},
			Org1Users: org1,
			OrgBUsers: orgB,
		})
		t.Cleanup(helper.Shutdown)

		for _, state := range testStates {
			t.Run(state.tc.Name(), func(t *testing.T) {
				// Verify resources still exist in unified storage after restart
				state.tc.Verify(t, helper, true)
			})
		}

		t.Logf("Verifying migrations are correctly registered")
		verifyRegisteredMigrations(t, helper, false, false)

		t.Logf("Verifying key_path is populated in resource_history after bulkimport")
		verifyKeyPathPopulated(t, helper)
	})
}

const (
	migrationScope = "unifiedstorage"
	migrationTable = migrationScope + "_migration_log"

	playlistsID            = "playlists migration"
	foldersAndDashboardsID = "folders and dashboards migration"
	shorturlsID            = "shorturls migration"
)

var migrationIDsToDefault = map[string]bool{
	playlistsID:            true,
	foldersAndDashboardsID: true, // Auto-migrated when resource count is below threshold
	shorturlsID:            false,
}

func verifyRegisteredMigrations(t *testing.T, helper *apis.K8sTestHelper, onlyDefault bool, optOut bool) {
	getMigrationsQuery := fmt.Sprintf("SELECT migration_id FROM %s", migrationTable)
	createTableMigrationID := fmt.Sprintf("create %s table", migrationTable)
	expectedMigrationIDs := []string{createTableMigrationID}
	for id, enabled := range migrationIDsToDefault {
		if onlyDefault && !enabled {
			continue
		}
		if optOut {
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
				nil,
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
		nil,
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
				nil,
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
		nil,
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
