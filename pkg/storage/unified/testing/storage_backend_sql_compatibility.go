package test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	sqldb "github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/storage/unified/sql/rvmanager"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func NewTestSqlKvBackend(t *testing.T, ctx context.Context, withRvManager bool) (resource.KVBackend, sqldb.DB) {
	dbstore := db.InitTestDB(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)
	dbConn, err := eDB.Init(ctx)
	require.NoError(t, err)
	kv, err := kv.NewSQLKV(dbConn.SqlDB(), dbConn.DriverName())
	require.NoError(t, err)

	kvOpts := resource.KVBackendOptions{
		KvStore: kv,
	}

	if dbConn.DriverName() == "sqlite3" {
		kvOpts.UseChannelNotifier = true
	}

	if withRvManager {
		dialect := sqltemplate.DialectForDriver(dbConn.DriverName())
		rvManager, err := rvmanager.NewResourceVersionManager(rvmanager.ResourceManagerOptions{
			Dialect: dialect,
			DB:      dbConn,
		})
		require.NoError(t, err)

		kvOpts.RvManager = rvManager
	}

	backend, err := resource.NewKVStorageBackend(kvOpts)
	require.NoError(t, err)
	return backend, dbConn
}

func RunSQLStorageBackendCompatibilityTest(t *testing.T, newSqlBackend NewBackendFunc, newKvBackend NewBackendWithDBFunc, opts *TestOptions) {
	if opts == nil {
		opts = &TestOptions{}
	}

	if opts.NSPrefix == "" {
		opts.NSPrefix = GenerateRandomNSPrefix()
	}

	t.Logf("Running tests with namespace prefix: %s", opts.NSPrefix)

	cases := []struct {
		name string
		fn   func(*testing.T, resource.StorageBackend, resource.StorageBackend, string, sqldb.DB)
	}{
		{"key_path generation", runTestIntegrationBackendKeyPathGeneration},
		{"sql backend fields compatibility", runTestSQLBackendFieldsCompatibility},
		{"cross backend consistency", runTestCrossBackendConsistency},
		{"concurrent operations stress", runTestConcurrentOperationsStress},
		{"optimistic locking database integrity", runTestOptimisticLockingDatabaseIntegrity},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if opts.SkipTests[tc.name] {
				t.Skip()
			}

			kvbackend, db := newKvBackend(t.Context())
			sqlbackend := newSqlBackend(t.Context())

			tc.fn(t, sqlbackend, kvbackend, opts.NSPrefix, db)
		})
	}

	// Search operations compatibility test (handled separately due to additional SearchServerFactory parameter)
	t.Run("search operations compatibility", func(t *testing.T) {
		if opts.SkipTests["search operations compatibility"] {
			t.Skip()
		}

		kvbackend, db := newKvBackend(t.Context())
		sqlbackend := newSqlBackend(t.Context())

		runTestSearchOperationsCompatibility(t, sqlbackend, kvbackend, opts.NSPrefix, db, opts.SearchServerFactory)
	})
}

func newIntegrationTestContext(t *testing.T) context.Context {
	t.Helper()
	return testutil.NewTestContext(t, time.Now().Add(30*time.Second))
}

func runTestIntegrationBackendKeyPathGeneration(t *testing.T, sqlBackend, kvBackend resource.StorageBackend, nsPrefix string, db sqldb.DB) {
	ctx := testutil.NewDefaultTestContext(t)

	// Test SQL backend with 3 writes, 3 updates, 3 deletes
	t.Run("SQL Backend Operations", func(t *testing.T) {
		runKeyPathTest(t, sqlBackend, nsPrefix+"-sql", db, ctx)
	})

	// Test SQL KV backend with 3 writes, 3 updates, 3 deletes
	t.Run("SQL KV Backend Operations", func(t *testing.T) {
		runKeyPathTest(t, kvBackend, nsPrefix+"-kv", db, ctx)
	})
}

// runKeyPathTest performs 3 writes, 3 updates, and 3 deletes on a backend then verifies that key_path is properly
// generated across both backends
func runKeyPathTest(t *testing.T, backend resource.StorageBackend, nsPrefix string, db sqldb.DB, ctx context.Context) {
	// Create storage server from backend
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:      backend,
		AccessClient: claims.FixedAccessClient(true), // Allow all operations for testing
	})
	require.NoError(t, err)

	// Track the current resource version for each resource (index 0, 1, 2 for resources 1, 2, 3)
	currentRVs := make([]int64, 3)

	// Create 3 resources
	for i := 1; i <= 3; i++ {
		folder := ""
		if i == 2 {
			folder = "test-folder" // Resource 2 has folder annotation
		}

		opts := PlaylistResourceOptions{
			Name:       fmt.Sprintf("test-playlist-%d", i),
			Namespace:  nsPrefix,
			UID:        fmt.Sprintf("test-uid-%d", i),
			Generation: 1,
			Title:      fmt.Sprintf("My Test Playlist %d", i),
			Folder:     folder,
		}

		created := createPlaylistResource(t, server, ctx, opts)
		currentRVs[i-1] = created.ResourceVersion

		// Verify created resource key_path (with folder for resource 2)
		key := createPlaylistKey(nsPrefix, fmt.Sprintf("test-playlist-%d", i))
		if i == 2 {
			verifyKeyPath(t, db, ctx, key, "created", created.ResourceVersion, "test-folder")
		} else {
			verifyKeyPath(t, db, ctx, key, "created", created.ResourceVersion, "")
		}
	}

	// Update the 3 resources
	for i := 1; i <= 3; i++ {
		folder := ""
		if i == 2 {
			folder = "test-folder" // Resource 2 has folder annotation
		}

		opts := PlaylistResourceOptions{
			Name:       fmt.Sprintf("test-playlist-%d", i),
			Namespace:  nsPrefix,
			UID:        fmt.Sprintf("test-uid-%d", i),
			Generation: 2,
			Title:      fmt.Sprintf("My Updated Playlist %d", i),
			Folder:     folder,
		}

		updated := updatePlaylistResource(t, server, ctx, opts, currentRVs[i-1])
		currentRVs[i-1] = updated.ResourceVersion // Update to the latest resource version

		// Verify updated resource key_path (with folder for resource 2)
		key := createPlaylistKey(nsPrefix, fmt.Sprintf("test-playlist-%d", i))
		if i == 2 {
			verifyKeyPath(t, db, ctx, key, "updated", updated.ResourceVersion, "test-folder")
		} else {
			verifyKeyPath(t, db, ctx, key, "updated", updated.ResourceVersion, "")
		}
	}

	// Delete the 3 resources
	for i := 1; i <= 3; i++ {
		name := fmt.Sprintf("test-playlist-%d", i)
		deleted := deletePlaylistResource(t, server, ctx, nsPrefix, name, currentRVs[i-1]) //nolint:gosec // i-1 is bounded by loop range [0,2]

		// Verify deleted resource key_path (with folder for resource 2)
		key := createPlaylistKey(nsPrefix, name)
		if i == 2 {
			verifyKeyPath(t, db, ctx, key, "deleted", deleted.ResourceVersion, "test-folder")
		} else {
			verifyKeyPath(t, db, ctx, key, "deleted", deleted.ResourceVersion, "")
		}
	}
}

// verifyKeyPath is a helper function to verify key_path generation
func verifyKeyPath(t *testing.T, db sqldb.DB, ctx context.Context, key *resourcepb.ResourceKey, action string, resourceVersion int64, expectedFolder string) {
	// For SQL backend (namespace contains "-sql"), resourceVersion is in microsecond format
	// but key_path stores snowflake RV, so convert to snowflake
	// For KV backend (namespace contains "-kv"), resourceVersion is already in snowflake format
	isSqlBackend := strings.Contains(key.Namespace, "-sql")

	var keyPathRV int64
	if isSqlBackend {
		// Convert microsecond RV to snowflake for key_path construction
		keyPathRV = rvmanager.SnowflakeFromRV(resourceVersion)
	} else {
		// KV backend already provides snowflake RV
		keyPathRV = resourceVersion
	}

	// Build the expected key_path using DataKey format: unified/data/group/resource/namespace/name/resourceVersion~action~folder
	expectedKeyPath := fmt.Sprintf("unified/data/%s/%s/%s/%s/%d~%s~%s", key.Group, key.Resource, key.Namespace, key.Name, keyPathRV, action, expectedFolder)

	var query string
	if db.DriverName() == "postgres" {
		query = "SELECT key_path, resource_version, action, folder FROM resource_history WHERE key_path = $1"
	} else {
		query = "SELECT key_path, resource_version, action, folder FROM resource_history WHERE key_path = ?"
	}
	rows, err := db.QueryContext(ctx, query, expectedKeyPath)
	require.NoError(t, err)

	require.True(t, rows.Next(), "Resource not found in resource_history table - both SQL and KV backends should write to this table")

	var keyPath string
	var actualRV int64
	var actualAction int
	var actualFolder string

	err = rows.Scan(&keyPath, &actualRV, &actualAction, &actualFolder)
	require.NoError(t, err)

	// Ensure there's exactly one row and no errors
	require.False(t, rows.Next())
	require.NoError(t, rows.Err())

	// Verify basic key_path format
	require.Contains(t, keyPath, "unified/data/")
	require.Contains(t, keyPath, key.Group)
	require.Contains(t, keyPath, key.Resource)
	require.Contains(t, keyPath, key.Namespace)
	require.Contains(t, keyPath, key.Name)

	// Verify action suffix
	require.Contains(t, keyPath, fmt.Sprintf("~%s~", action))

	// Verify folder if specified
	if expectedFolder != "" {
		require.Equal(t, expectedFolder, actualFolder)
		require.Contains(t, keyPath, expectedFolder)
	}

	// Verify action code matches
	var expectedActionCode int
	switch action {
	case "created":
		expectedActionCode = 1
	case "updated":
		expectedActionCode = 2
	case "deleted":
		expectedActionCode = 3
	}
	require.Equal(t, expectedActionCode, actualAction)
}

// runTestSQLBackendFieldsCompatibility tests that KV backend with RvManager populates all SQL backend legacy fields
func runTestSQLBackendFieldsCompatibility(t *testing.T, sqlBackend, kvBackend resource.StorageBackend, nsPrefix string, db sqldb.DB) {
	ctx := testutil.NewDefaultTestContext(t)

	// Create unique namespace for isolation
	namespace := nsPrefix + "-fields-test"

	// Test SQL backend with 3 resources through complete lifecycle
	t.Run("SQL Backend Operations", func(t *testing.T) {
		runSQLBackendFieldsTest(t, sqlBackend, namespace+"-sql", db, ctx)
	})

	// Test KV backend with 3 resources through complete lifecycle
	t.Run("KV Backend Operations", func(t *testing.T) {
		runSQLBackendFieldsTest(t, kvBackend, namespace+"-kv", db, ctx)
	})
}

// buildCrossDatabaseQuery converts query placeholders for different database drivers
func buildCrossDatabaseQuery(driverName, baseQuery string) string {
	if driverName == "postgres" {
		// Convert ? placeholders to $1, $2, etc. for PostgreSQL
		placeholderCount := 1
		result := baseQuery
		for {
			oldResult := result
			result = strings.Replace(result, "?", fmt.Sprintf("$%d", placeholderCount), 1)
			if result == oldResult {
				break
			}
			placeholderCount++
		}
		return result
	}
	// MySQL and SQLite use ? placeholders
	return baseQuery
}

// runSQLBackendFieldsTest performs complete resource lifecycle testing and verifies all legacy SQL fields
func runSQLBackendFieldsTest(t *testing.T, backend resource.StorageBackend, namespace string, db sqldb.DB, ctx context.Context) {
	// Create storage server from backend
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:      backend,
		AccessClient: claims.FixedAccessClient(true), // Allow all operations for testing
	})
	require.NoError(t, err)

	// Resource definitions with different folder configurations
	resources := []struct {
		name   string
		folder string
	}{
		{"test-resource-1", ""},            // No folder
		{"test-resource-2", "test-folder"}, // With folder
		{"test-resource-3", ""},            // No folder
	}

	// Track resource versions for each resource
	resourceVersions := make([][]int64, len(resources)) // [resourceIndex][versionIndex]

	// Create 3 resources
	for i, res := range resources {
		// Create the resource using helper function
		opts := PlaylistResourceOptions{
			Name:       res.name,
			Namespace:  namespace,
			UID:        fmt.Sprintf("test-uid-%d", i+1),
			Generation: 1,
			Title:      fmt.Sprintf("Test Playlist %d", i+1),
			Folder:     res.folder,
		}

		created := createPlaylistResource(t, server, ctx, opts)
		// Store the resource version
		resourceVersions[i] = append(resourceVersions[i], created.ResourceVersion)
	}

	// Update 3 resources
	for i, res := range resources {
		// Update the resource using helper function
		opts := PlaylistResourceOptions{
			Name:       res.name,
			Namespace:  namespace,
			UID:        fmt.Sprintf("test-uid-%d", i+1),
			Generation: 2,
			Title:      fmt.Sprintf("Updated Test Playlist %d", i+1),
			Folder:     res.folder,
		}

		currentRV := resourceVersions[i][len(resourceVersions[i])-1]
		updated := updatePlaylistResource(t, server, ctx, opts, currentRV)
		// Store the new resource version
		resourceVersions[i] = append(resourceVersions[i], updated.ResourceVersion)
	}

	// Delete first 2 resources (leave the last one to validate resource table)
	for i, res := range resources[:2] {
		key := &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
			Namespace: namespace,
			Name:      res.name,
		}

		// Delete the resource using the current resource version
		currentRV := resourceVersions[i][len(resourceVersions[i])-1]
		deleted, err := server.Delete(ctx, &resourcepb.DeleteRequest{
			Key:             key,
			ResourceVersion: currentRV,
		})
		require.NoError(t, err)
		require.Nil(t, deleted.Error)
		require.Greater(t, deleted.ResourceVersion, currentRV)

		// Store the delete resource version
		resourceVersions[i] = append(resourceVersions[i], deleted.ResourceVersion)
	}

	// Verify all legacy SQL fields are populated correctly
	verifyResourceHistoryTable(t, db, namespace, resources, resourceVersions)
	verifyResourceTable(t, db, namespace, resources, resourceVersions)
	verifyResourceVersionTable(t, db, namespace, resources, resourceVersions)
}

// ResourceHistoryRecord represents a row from the resource_history table
type ResourceHistoryRecord struct {
	GUID                    string
	Group                   string
	Resource                string
	Namespace               string
	Name                    string
	Value                   string
	Action                  int
	Folder                  string
	PreviousResourceVersion int64
	Generation              int
	ResourceVersion         int64
}

// ResourceRecord represents a row from the resource table
type ResourceRecord struct {
	GUID                    string
	Group                   string
	Resource                string
	Namespace               string
	Name                    string
	Value                   string
	Action                  int
	Folder                  string
	PreviousResourceVersion int64
	ResourceVersion         int64
}

// ResourceVersionRecord represents a row from the resource_version table
type ResourceVersionRecord struct {
	Group           string
	Resource        string
	ResourceVersion int64
}

// verifyResourceHistoryTable validates all resource_history entries
func verifyResourceHistoryTable(t *testing.T, db sqldb.DB, namespace string, resources []struct{ name, folder string }, resourceVersions [][]int64) {
	ctx := t.Context()
	query := buildCrossDatabaseQuery(db.DriverName(), `
		SELECT guid, "group", resource, namespace, name, value, action, folder,
		       previous_resource_version, generation, resource_version
		FROM resource_history
		WHERE namespace = ?
		ORDER BY resource_version ASC
	`)

	rows, err := db.QueryContext(ctx, query, namespace)
	require.NoError(t, err)

	var records []ResourceHistoryRecord
	for rows.Next() {
		var record ResourceHistoryRecord
		err := rows.Scan(
			&record.GUID, &record.Group, &record.Resource, &record.Namespace, &record.Name,
			&record.Value, &record.Action, &record.Folder, &record.PreviousResourceVersion,
			&record.Generation, &record.ResourceVersion,
		)
		require.NoError(t, err)
		records = append(records, record)
	}
	require.NoError(t, rows.Err())

	// We expect 8 records total: 3 creates + 3 updates + 2 deletes
	require.Len(t, records, 8, "Expected 8 resource_history records (3 creates + 3 updates + 2 deletes)")

	// Verify each record - we'll validate in the order they were created (by resource_version)
	// The records are already sorted by resource_version ASC, so we just need to verify each one
	recordIndex := 0
	for resourceIdx, res := range resources {
		// Check create record (action=1, generation=1)
		createRecord := records[recordIndex]
		verifyResourceHistoryRecord(t, createRecord, namespace, res, resourceIdx, 1, 0, 1, resourceVersions[resourceIdx][0])
		recordIndex++
	}

	for resourceIdx, res := range resources {
		// Check update record (action=2, generation=2)
		updateRecord := records[recordIndex]
		verifyResourceHistoryRecord(t, updateRecord, namespace, res, resourceIdx, 2, resourceVersions[resourceIdx][0], 2, resourceVersions[resourceIdx][1])
		recordIndex++
	}

	for resourceIdx, res := range resources[:2] {
		// Check delete record (action=3, generation=0) - only first 2 resources were deleted
		deleteRecord := records[recordIndex]
		verifyResourceHistoryRecord(t, deleteRecord, namespace, res, resourceIdx, 3, resourceVersions[resourceIdx][1], 0, resourceVersions[resourceIdx][2])
		recordIndex++
	}
}

// verifyResourceHistoryRecord validates a single resource_history record
func verifyResourceHistoryRecord(t *testing.T, record ResourceHistoryRecord, namespace string, expectedRes struct{ name, folder string }, resourceIdx, expectedAction int, expectedPrevRV int64, expectedGeneration int, expectedRV int64) {
	// Validate GUID (should be non-empty)
	require.NotEmpty(t, record.GUID, "GUID should not be empty")

	// Validate group/resource/namespace/name
	require.Equal(t, "playlist.grafana.app", record.Group)
	require.Equal(t, "playlists", record.Resource)
	require.Equal(t, namespace, record.Namespace)
	require.Equal(t, expectedRes.name, record.Name)

	// Validate value contains expected JSON - server modifies/formats the JSON differently for different operations
	// Check for both formats (with and without space after colon)
	nameFound := strings.Contains(record.Value, fmt.Sprintf(`"name": "%s"`, expectedRes.name)) ||
		strings.Contains(record.Value, fmt.Sprintf(`"name":"%s"`, expectedRes.name))
	require.True(t, nameFound, "JSON should contain the expected name field")

	kindFound := strings.Contains(record.Value, `"kind": "Playlist"`) ||
		strings.Contains(record.Value, `"kind":"Playlist"`)
	require.True(t, kindFound, "JSON should contain the expected kind field")

	// Validate action
	require.Equal(t, expectedAction, record.Action)

	// Validate folder
	if expectedRes.folder == "" {
		require.Equal(t, "", record.Folder, "Folder should be empty when no folder annotation")
	} else {
		require.Equal(t, expectedRes.folder, record.Folder, "Folder should match annotation")
	}

	// Validate previous_resource_version
	// For KV backend operations, expectedPrevRV is now in snowflake format (returned by KV backend)
	// but resource_history table stores microsecond RV, so we need to use IsRvEqual for comparison
	if strings.Contains(record.Namespace, "-kv") {
		if expectedPrevRV == 0 {
			require.Zero(t, record.PreviousResourceVersion)
		} else {
			require.Equal(t, expectedPrevRV, rvmanager.SnowflakeFromRV(record.PreviousResourceVersion),
				"Previous resource version should match (KV backend snowflake format)")
		}
	} else {
		require.Equal(t, expectedPrevRV, record.PreviousResourceVersion)
	}

	// Validate generation: 1 for create, 2 for update, 0 for delete
	require.Equal(t, expectedGeneration, record.Generation)

	// Validate resource_version
	// For KV backend operations, expectedRV is now in snowflake format (returned by KV backend)
	// but resource_history table stores microsecond RV, so we need to use IsRvEqual for comparison
	if strings.Contains(record.Namespace, "-kv") {
		require.True(t, rvmanager.IsRvEqual(expectedRV, record.ResourceVersion),
			"Resource version should match (KV backend snowflake format)")
	} else {
		require.Equal(t, expectedRV, record.ResourceVersion)
	}
}

// verifyResourceTable validates the resource table (latest state only)
func verifyResourceTable(t *testing.T, db sqldb.DB, namespace string, resources []struct{ name, folder string }, resourceVersions [][]int64) {
	ctx := t.Context()
	query := buildCrossDatabaseQuery(db.DriverName(), `
		SELECT guid, "group", resource, namespace, name, value, action, folder,
		       previous_resource_version, resource_version
		FROM resource
		WHERE namespace = ?
		ORDER BY name ASC
	`)

	rows, err := db.QueryContext(ctx, query, namespace)
	require.NoError(t, err)

	var records []ResourceRecord
	for rows.Next() {
		var record ResourceRecord
		err := rows.Scan(
			&record.GUID, &record.Group, &record.Resource, &record.Namespace, &record.Name,
			&record.Value, &record.Action, &record.Folder, &record.PreviousResourceVersion,
			&record.ResourceVersion,
		)
		require.NoError(t, err)
		records = append(records, record)
	}
	require.NoError(t, rows.Err())

	// We expect 1 record since only 2 resources were deleted (the 3rd remains)
	require.Len(t, records, 1, "Expected 1 resource record since only 2 resources were deleted")

	// Validate the remaining record (should be the 3rd resource after update)
	record := records[0]
	require.Equal(t, "playlist.grafana.app", record.Group)
	require.Equal(t, "playlists", record.Resource)
	require.Equal(t, "test-resource-3", record.Name)

	// Should be an update action (2) - resource table stores latest action
	require.Equal(t, 2, record.Action)

	// Validate value contains expected JSON
	nameFound := strings.Contains(record.Value, fmt.Sprintf(`"name": "%s"`, "test-resource-3")) ||
		strings.Contains(record.Value, fmt.Sprintf(`"name":"%s"`, "test-resource-3"))
	require.True(t, nameFound, "JSON should contain the expected name field")

	kindFound := strings.Contains(record.Value, `"kind": "Playlist"`) ||
		strings.Contains(record.Value, `"kind":"Playlist"`)
	require.True(t, kindFound, "JSON should contain the expected kind field")

	// Folder should be empty (3rd resource has no folder annotation)
	require.Equal(t, "", record.Folder, "3rd resource should have no folder")

	// GUID should be non-empty
	require.NotEmpty(t, record.GUID, "GUID should not be empty")

	// Resource version should match the expected version for test-resource-3 (updated version)
	expectedRV := resourceVersions[2][1] // test-resource-3's update version
	if strings.Contains(namespace, "-kv") {
		require.True(t, rvmanager.IsRvEqual(expectedRV, record.ResourceVersion),
			"Resource version should match (KV backend snowflake format)")
	} else {
		require.Equal(t, expectedRV, record.ResourceVersion)
	}
}

// verifyResourceVersionTable validates the resource_version table
func verifyResourceVersionTable(t *testing.T, db sqldb.DB, namespace string, resources []struct{ name, folder string }, resourceVersions [][]int64) {
	ctx := t.Context()
	query := buildCrossDatabaseQuery(db.DriverName(), `
		SELECT "group", resource, resource_version
		FROM resource_version
		WHERE "group" = ? AND resource = ?
	`)

	// Check that we have exactly one entry for playlist.grafana.app/playlists
	rows, err := db.QueryContext(ctx, query, "playlist.grafana.app", "playlists")
	require.NoError(t, err)

	var records []ResourceVersionRecord
	for rows.Next() {
		var record ResourceVersionRecord
		err := rows.Scan(&record.Group, &record.Resource, &record.ResourceVersion)
		require.NoError(t, err)
		records = append(records, record)
	}
	require.NoError(t, rows.Err())

	// We expect exactly 1 record for the group+resource combination
	require.Len(t, records, 1, "Expected 1 resource_version record for playlist.grafana.app/playlists")

	record := records[0]
	require.Equal(t, "playlist.grafana.app", record.Group)
	require.Equal(t, "playlists", record.Resource)

	// Find the highest resource version across all resources
	var maxRV int64
	for _, rvs := range resourceVersions {
		for _, rv := range rvs {
			if rv > maxRV {
				maxRV = rv
			}
		}
	}

	// The resource_version table should contain the latest RV for the group+resource
	// It might be slightly higher due to RV manager operations, so check it's at least our max
	// For KV backend, maxRV is in snowflake format but record.ResourceVersion is in microsecond format
	// Use IsRvEqual for proper comparison between different RV formats
	isKvBackend := strings.Contains(namespace, "-kv")
	recordResourceVersion := record.ResourceVersion
	if isKvBackend {
		recordResourceVersion = rvmanager.SnowflakeFromRV(record.ResourceVersion)
	}

	require.Less(t, recordResourceVersion, int64(9223372036854775807), "resource_version should be reasonable")
	require.Greater(t, recordResourceVersion, maxRV, "resource_version should be at least the latest RV we tracked")
}

// runTestCrossBackendConsistency tests basic consistency between SQL and KV backends (lightweight)
func runTestCrossBackendConsistency(t *testing.T, sqlBackend, kvBackend resource.StorageBackend, nsPrefix string, db sqldb.DB) {
	ctx := newIntegrationTestContext(t)

	// Create storage servers from both backends
	sqlServer, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:      sqlBackend,
		AccessClient: claims.FixedAccessClient(true), // Allow all operations for testing
	})
	require.NoError(t, err)

	kvServer, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:      kvBackend,
		AccessClient: claims.FixedAccessClient(true), // Allow all operations for testing
	})
	require.NoError(t, err)

	// Create isolated namespaces for each test phase
	sqlNamespace := nsPrefix + "-concurrent-sql"
	kvNamespace := nsPrefix + "-concurrent-kv"

	t.Run("Write to SQL, Read from Both", func(t *testing.T) {
		runWriteToOneReadFromBoth(t, sqlServer, kvServer, sqlNamespace+"-writeSQL", ctx, "sql")
	})

	t.Run("Write to KV, Read from Both", func(t *testing.T) {
		runWriteToOneReadFromBoth(t, kvServer, sqlServer, kvNamespace+"-writeKV", ctx, "kv")
	})

	t.Run("Resource Version Consistency", func(t *testing.T) {
		runResourceVersionConsistencyTest(t, sqlServer, kvServer, nsPrefix+"-rv-consistency", ctx)
	})
}

// runTestConcurrentOperationsStress tests heavy concurrent operations between SQL and KV backends
func runTestConcurrentOperationsStress(t *testing.T, sqlBackend, kvBackend resource.StorageBackend, nsPrefix string, db sqldb.DB) {
	// Skip on SQLite due to concurrency limitations
	if db.DriverName() == "sqlite3" {
		t.Skip("Skipping concurrent operations stress test on SQLite")
	}

	ctx := newIntegrationTestContext(t)

	// Create storage servers from both backends
	sqlServer, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:      sqlBackend,
		AccessClient: claims.FixedAccessClient(true), // Allow all operations for testing
	})
	require.NoError(t, err)

	kvServer, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:      kvBackend,
		AccessClient: claims.FixedAccessClient(true), // Allow all operations for testing
	})
	require.NoError(t, err)

	// Create isolated namespace for mixed operations
	mixedNamespace := nsPrefix + "-concurrent-mixed"

	// do a single create using the sql backend to initialize the resource_version table
	// without this, both backend may try to insert the same group+resource to the resource_version which breaks the
	// tests
	initNamespace := mixedNamespace + "-init"
	initOpts := PlaylistResourceOptions{
		Name:       "init-resource",
		Namespace:  initNamespace,
		UID:        "init-uid",
		Generation: 1,
		Title:      "Init Resource",
		Folder:     "",
	}
	createPlaylistResource(t, sqlServer, ctx, initOpts)

	// Heavy Mixed Concurrent Operations
	t.Run("Mixed Concurrent Operations", func(t *testing.T) {
		runMixedConcurrentOperations(t, sqlServer, kvServer, mixedNamespace, ctx)
	})
}

func runTestOptimisticLockingDatabaseIntegrity(t *testing.T, sqlBackend, kvBackend resource.StorageBackend, nsPrefix string, db sqldb.DB) {
	// Skip on SQLite due to concurrency limitations
	if db.DriverName() == "sqlite3" {
		t.Skip("Skipping optimistic locking database integrity test on SQLite")
	}

	// Keep this short: namespace has a 63-char limit and test prefixes are random.
	baseNamespace := nsPrefix + "-oldb"

	t.Run("SQL Backend Operations", func(t *testing.T) {
		ctx := newIntegrationTestContext(t)
		runOptimisticLockingDatabaseIntegrityForBackend(t, sqlBackend, baseNamespace+"-sql", db, ctx)
	})

	t.Run("KV Backend Operations", func(t *testing.T) {
		ctx := newIntegrationTestContext(t)
		runOptimisticLockingDatabaseIntegrityForBackend(t, kvBackend, baseNamespace+"-kv", db, ctx)
	})
}

type optimisticResourceState struct {
	name      string
	currentRV int64
	exists    bool
}

type writeRaceResult struct {
	rv      int64
	err     error
	payload string
}

func runOptimisticLockingDatabaseIntegrityForBackend(t *testing.T, backend resource.StorageBackend, namespace string, db sqldb.DB, ctx context.Context) {
	const (
		resourceCount      = 5
		concurrentRequests = 5
		group              = "dashboard.grafana.app"
		resourceName       = "dashboards"
	)

	states := make([]optimisticResourceState, 0, resourceCount)

	// Create 5 resources. For each resource name, send 5 concurrent create requests with different titles.
	for i := range resourceCount {
		name := fmt.Sprintf("db-int-dashboard-%d", i+1)
		sentTitles := make(map[string]struct{}, concurrentRequests*3)

		var (
			createdSuccessfully bool
			currentRV           int64
		)

		// Retry the concurrent create race a few times to avoid flaky all-failed batches.
		for attempt := 1; attempt <= 3 && !createdSuccessfully; attempt++ {
			start := make(chan struct{})
			results := make(chan writeRaceResult, concurrentRequests)
			var wg sync.WaitGroup

			for j := range concurrentRequests {
				wg.Go(func() {
					<-start
					title := fmt.Sprintf("create-title-%d-%d-attempt-%d", i+1, j+1, attempt)
					rv, err := WriteEvent(ctx, backend, name, resourcepb.WatchEvent_ADDED,
						WithNamespace(namespace),
						WithGroup(group),
						WithResource(resourceName),
						WithFolder(""),
						WithValue(title))
					results <- writeRaceResult{rv: rv, err: err, payload: title}
				})
			}
			close(start)
			wg.Wait()
			close(results)

			successes := 0
			for res := range results {
				sentTitles[res.payload] = struct{}{}
				if res.err == nil {
					successes++
				}
			}
			require.LessOrEqual(t, successes, 1, "at most one create should succeed for %s", name)

			history := queryResourceHistoryRows(t, db, namespace, group, resourceName, name)
			require.LessOrEqual(t, len(history), 1, "expected at most one resource_history record after concurrent create for %s", name)

			resourceRow, resourceExists := queryResourceRow(t, db, namespace, group, resourceName, name)
			if len(history) == 0 {
				require.False(t, resourceExists, "resource row should not exist when history is empty after create race for %s", name)
				continue
			}
			require.True(t, resourceExists, "resource row should exist when one history row exists for %s", name)

			require.Equal(t, 1, history[0].Action, "create action should be persisted for %s", name)
			_, titleWasSent := sentTitles[extractSpecValue(t, history[0].Value)]
			require.True(t, titleWasSent, "stored create payload must be one of the attempted create payloads for %s", name)

			requireResourceMatchesHistory(t, *resourceRow, history[0], name)

			existsInBackend, rv := readBackendResourceState(t, backend, namespace, group, resourceName, name)
			require.True(t, existsInBackend, "resource should exist in backend after successful create for %s", name)
			currentRV = rv
			createdSuccessfully = true
		}

		if !createdSuccessfully {
			// KV + RV manager may batch same-key concurrent creates and roll back all of them.
			// Seed one deterministic create so the remaining integrity scenarios can proceed.
			title := fmt.Sprintf("create-title-%d-bootstrap", i+1)
			rv, err := WriteEvent(ctx, backend, name, resourcepb.WatchEvent_ADDED,
				WithNamespace(namespace),
				WithGroup(group),
				WithResource(resourceName),
				WithFolder(""),
				WithValue(title))
			require.NoError(t, err, "bootstrap create must succeed for %s", name)

			history := queryResourceHistoryRows(t, db, namespace, group, resourceName, name)
			require.Len(t, history, 1, "expected a single resource_history record after bootstrap create for %s", name)
			resourceRow, ok := queryResourceRow(t, db, namespace, group, resourceName, name)
			require.True(t, ok, "resource row should exist after bootstrap create for %s", name)
			require.Equal(t, title, extractSpecValue(t, history[0].Value), "bootstrap create payload mismatch for %s", name)
			requireResourceMatchesHistory(t, *resourceRow, history[0], name)

			currentRV = rv
			createdSuccessfully = true
		}

		states = append(states, optimisticResourceState{
			name:      name,
			currentRV: currentRV,
			exists:    true,
		})
	}

	// For each resource, send 5 concurrent updates with the same previous RV and different titles.
	for i := range states {
		state := &states[i]
		require.True(t, state.exists, "resource must exist before update race: %s", state.name)

		start := make(chan struct{})
		results := make(chan writeRaceResult, concurrentRequests)
		var wg sync.WaitGroup
		baseRV := state.currentRV

		for j := range concurrentRequests {
			wg.Go(func() {
				<-start
				title := fmt.Sprintf("update-title-%d-%d", i+1, j+1)
				rv, err := WriteEvent(ctx, backend, state.name, resourcepb.WatchEvent_MODIFIED,
					WithNamespaceAndRV(namespace, baseRV),
					WithGroup(group),
					WithResource(resourceName),
					WithFolder(""),
					WithValue(title))
				results <- writeRaceResult{rv: rv, err: err, payload: title}
			})
		}
		close(start)
		wg.Wait()
		close(results)

		successes := 0
		for res := range results {
			if res.err == nil {
				successes++
				state.currentRV = res.rv
			}
		}
		require.LessOrEqual(t, successes, 1, "at most one update should succeed for %s", state.name)

		assertLatestHistoryAndResourceAreSynced(t, db, namespace, group, resourceName, state.name)
		existsInBackend, rv := readBackendResourceState(t, backend, namespace, group, resourceName, state.name)
		state.exists = existsInBackend
		if existsInBackend {
			state.currentRV = rv
		}
	}

	// Update + delete race. Update request is intentionally fired first, delete shortly after.
	for i := range states {
		state := &states[i]
		require.True(t, state.exists, "resource must exist before update+delete race: %s", state.name)

		baseRV := state.currentRV
		start := make(chan struct{})
		results := make(chan struct {
			op string
			writeRaceResult
		}, 2)
		var wg sync.WaitGroup

		wg.Go(func() {
			<-start
			title := fmt.Sprintf("race-update-title-%d", i+1)
			rv, err := WriteEvent(ctx, backend, state.name, resourcepb.WatchEvent_MODIFIED,
				WithNamespaceAndRV(namespace, baseRV),
				WithGroup(group),
				WithResource(resourceName),
				WithFolder(""),
				WithValue(title))
			results <- struct {
				op string
				writeRaceResult
			}{op: "update", writeRaceResult: writeRaceResult{rv: rv, err: err, payload: title}}
		})

		wg.Go(func() {
			<-start
			// Keep requests concurrent while making update reach storage first.
			time.Sleep(5 * time.Millisecond)
			rv, err := WriteEvent(ctx, backend, state.name, resourcepb.WatchEvent_DELETED,
				WithNamespaceAndRV(namespace, baseRV),
				WithGroup(group),
				WithResource(resourceName),
				WithFolder(""),
				WithValue(fmt.Sprintf("race-delete-%d", i+1)))
			results <- struct {
				op string
				writeRaceResult
			}{op: "delete", writeRaceResult: writeRaceResult{rv: rv, err: err}}
		})

		close(start)
		wg.Wait()
		close(results)

		for res := range results {
			if res.err != nil {
				continue
			}
			if res.op == "update" {
				state.currentRV = res.rv
				state.exists = true
			} else {
				state.currentRV = res.rv
				state.exists = false
			}
		}

		assertLatestHistoryAndResourceAreSynced(t, db, namespace, group, resourceName, state.name)
		existsInBackend, rv := readBackendResourceState(t, backend, namespace, group, resourceName, state.name)
		state.exists = existsInBackend
		if existsInBackend {
			state.currentRV = rv
		}
	}

	// Send 5 concurrent deletes for each resource and verify one delete history entry in total per resource.
	for i := range states {
		state := &states[i]
		start := make(chan struct{})
		results := make(chan writeRaceResult, concurrentRequests)
		var wg sync.WaitGroup
		baseRV := state.currentRV

		for j := range concurrentRequests {
			wg.Go(func() {
				<-start
				// Keep requests concurrent but avoid same-batch rollback behavior.
				time.Sleep(time.Duration(j) * 2 * time.Millisecond)
				rv, err := WriteEvent(ctx, backend, state.name, resourcepb.WatchEvent_DELETED,
					WithNamespaceAndRV(namespace, baseRV),
					WithGroup(group),
					WithResource(resourceName),
					WithFolder(""),
					WithValue(fmt.Sprintf("delete-title-%d-%d", i+1, j+1)))
				results <- writeRaceResult{rv: rv, err: err}
			})
		}
		close(start)
		wg.Wait()
		close(results)

		for res := range results {
			if res.err == nil {
				state.currentRV = res.rv
				state.exists = false
			}
		}

		history := queryResourceHistoryRows(t, db, namespace, group, resourceName, state.name)
		deleteCount := 0
		for _, h := range history {
			if h.Action == 3 {
				deleteCount++
			}
		}
		require.Equal(t, 1, deleteCount, "expected exactly one delete history record for %s", state.name)

		_, ok := queryResourceRow(t, db, namespace, group, resourceName, state.name)
		require.False(t, ok, "resource should not exist after delete race for %s", state.name)
	}
}

func queryResourceHistoryRows(t *testing.T, db sqldb.DB, namespace, group, resourceName, name string) []ResourceHistoryRecord {
	t.Helper()
	ctx := t.Context()
	query := buildCrossDatabaseQuery(db.DriverName(), `
		SELECT guid, "group", resource, namespace, name, value, action, folder,
		       previous_resource_version, generation, resource_version
		FROM resource_history
		WHERE namespace = ? AND "group" = ? AND resource = ? AND name = ?
		ORDER BY resource_version ASC
	`)

	rows, err := db.QueryContext(ctx, query, namespace, group, resourceName, name)
	require.NoError(t, err)
	defer func() {
		require.NoError(t, rows.Close())
	}()

	var out []ResourceHistoryRecord
	for rows.Next() {
		var record ResourceHistoryRecord
		err := rows.Scan(
			&record.GUID, &record.Group, &record.Resource, &record.Namespace, &record.Name,
			&record.Value, &record.Action, &record.Folder, &record.PreviousResourceVersion,
			&record.Generation, &record.ResourceVersion,
		)
		require.NoError(t, err)
		out = append(out, record)
	}
	require.NoError(t, rows.Err())
	return out
}

func queryResourceRow(t *testing.T, db sqldb.DB, namespace, group, resourceName, name string) (*ResourceRecord, bool) {
	t.Helper()
	ctx := t.Context()
	query := buildCrossDatabaseQuery(db.DriverName(), `
		SELECT guid, "group", resource, namespace, name, value, action, folder,
		       previous_resource_version, resource_version
		FROM resource
		WHERE namespace = ? AND "group" = ? AND resource = ? AND name = ?
	`)

	rows, err := db.QueryContext(ctx, query, namespace, group, resourceName, name)
	require.NoError(t, err)
	defer func() {
		require.NoError(t, rows.Close())
	}()

	var out []ResourceRecord
	for rows.Next() {
		var record ResourceRecord
		err := rows.Scan(
			&record.GUID, &record.Group, &record.Resource, &record.Namespace, &record.Name,
			&record.Value, &record.Action, &record.Folder, &record.PreviousResourceVersion,
			&record.ResourceVersion,
		)
		require.NoError(t, err)
		out = append(out, record)
	}
	require.NoError(t, rows.Err())

	require.LessOrEqual(t, len(out), 1, "resource table must have at most one row for a unique key")
	if len(out) == 0 {
		return nil, false
	}
	return &out[0], true
}

func extractSpecValue(t *testing.T, rawJSON string) string {
	t.Helper()
	var payload map[string]any
	require.NoError(t, json.Unmarshal([]byte(rawJSON), &payload))

	spec, ok := payload["spec"].(map[string]any)
	require.True(t, ok, "resource value should include spec object")

	value, ok := spec["value"].(string)
	require.True(t, ok, "resource value should include spec.value string")
	return value
}

func requireResourceMatchesHistory(t *testing.T, resourceRow ResourceRecord, historyRow ResourceHistoryRecord, name string) {
	t.Helper()
	require.Equal(t, historyRow.GUID, resourceRow.GUID, "guid mismatch for %s", name)
	require.Equal(t, historyRow.Group, resourceRow.Group, "group mismatch for %s", name)
	require.Equal(t, historyRow.Resource, resourceRow.Resource, "resource mismatch for %s", name)
	require.Equal(t, historyRow.Namespace, resourceRow.Namespace, "namespace mismatch for %s", name)
	require.Equal(t, historyRow.Name, resourceRow.Name, "name mismatch for %s", name)
	require.Equal(t, historyRow.Action, resourceRow.Action, "action mismatch for %s", name)
	require.Equal(t, historyRow.Folder, resourceRow.Folder, "folder mismatch for %s", name)
	require.Equal(t, historyRow.ResourceVersion, resourceRow.ResourceVersion, "resource_version mismatch for %s", name)
	require.JSONEq(t, historyRow.Value, resourceRow.Value, "value mismatch for %s", name)
}

func assertLatestHistoryAndResourceAreSynced(t *testing.T, db sqldb.DB, namespace, group, resourceName, name string) {
	t.Helper()
	history := queryResourceHistoryRows(t, db, namespace, group, resourceName, name)
	require.NotEmpty(t, history, "resource_history must contain rows for %s", name)
	latest := history[len(history)-1]

	resourceRow, exists := queryResourceRow(t, db, namespace, group, resourceName, name)
	if latest.Action == 3 {
		require.False(t, exists, "resource row must not exist when latest history action is delete for %s", name)
		return
	}

	require.True(t, exists, "resource row must exist for non-deleted latest history row %s", name)
	requireResourceMatchesHistory(t, *resourceRow, latest, name)
}

func readBackendResourceState(t *testing.T, backend resource.StorageBackend, namespace, group, resourceName, name string) (bool, int64) {
	t.Helper()

	resp := backend.ReadResource(t.Context(), &resourcepb.ReadRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: namespace,
			Group:     group,
			Resource:  resourceName,
			Name:      name,
		},
	})

	if resp.Error != nil {
		if resp.Error.Code == int32(http.StatusNotFound) {
			return false, 0
		}
		require.Failf(t, "unexpected backend read error", "name=%s code=%d message=%s", name, resp.Error.Code, resp.Error.Message)
		return false, 0
	}

	return true, resp.ResourceVersion
}

// runWriteToOneReadFromBoth writes resources to one backend then reads from both to verify consistency
func runWriteToOneReadFromBoth(t *testing.T, writeServer, readServer resource.ResourceServer, namespace string, ctx context.Context, writerBackend string) {
	// Create 5 test resources
	resourceNames := []string{
		fmt.Sprintf("resource-%s-1", writerBackend),
		fmt.Sprintf("resource-%s-2", writerBackend),
		fmt.Sprintf("resource-%s-3", writerBackend),
		fmt.Sprintf("resource-%s-4", writerBackend),
		fmt.Sprintf("resource-%s-5", writerBackend),
	}

	createdResourceVersions := make([]int64, len(resourceNames))

	// Write all resources to the write backend
	for i, resourceName := range resourceNames {
		key := &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
			Namespace: namespace,
			Name:      resourceName,
		}

		resourceJSON := fmt.Sprintf(`{
			"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind": "Playlist",
			"metadata": {
				"name": "%s",
				"namespace": "%s",
				"uid": "test-uid-%d",
				"generation": 1
			},
			"spec": {
				"title": "Concurrent Test Playlist %d"
			}
		}`, resourceName, namespace, i+1, i+1)

		created, err := writeServer.Create(ctx, &resourcepb.CreateRequest{
			Key:   key,
			Value: []byte(resourceJSON),
		})
		require.NoError(t, err)
		require.Nil(t, created.Error)
		require.Greater(t, created.ResourceVersion, int64(0))
		createdResourceVersions[i] = created.ResourceVersion
	}

	// Add a small delay to ensure data propagates
	time.Sleep(10 * time.Millisecond)

	// Read from both backends and compare payloads
	for _, resourceName := range resourceNames {
		key := &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
			Namespace: namespace,
			Name:      resourceName,
		}

		// Read from write backend
		writeResp, err := writeServer.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err, "Failed to read %s from write backend", resourceName)
		require.Nil(t, writeResp.Error, "Read error from write backend %s: %s", resourceName, writeResp.Error)
		require.Greater(t, writeResp.ResourceVersion, int64(0), "Invalid resource version for %s on write backend", resourceName)

		// Read from read backend
		readResp, err := readServer.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err, "Failed to read %s from read backend", resourceName)
		require.Nil(t, readResp.Error, "Read error from read backend %s: %s", resourceName, readResp.Error)
		require.Greater(t, readResp.ResourceVersion, int64(0), "Invalid resource version for %s on read backend", resourceName)

		// Validate that both backends return identical payload content
		require.JSONEq(t, string(writeResp.Value), string(readResp.Value),
			"Payload mismatch for resource %s between write and read backends.\nWrite backend: %s\nRead backend: %s",
			resourceName, string(writeResp.Value), string(readResp.Value))

		// Validate that both backends return equivalent resource versions using rvmanager compatibility check
		// Note: rvmanager.IsRvEqual expects snowflake format as first parameter, so we check both orderings
		require.True(t, rvmanager.IsRvEqual(writeResp.ResourceVersion, readResp.ResourceVersion) || rvmanager.IsRvEqual(readResp.ResourceVersion, writeResp.ResourceVersion),
			"Resource version mismatch for resource %s between backends.\nWrite backend (%s): %d\nRead backend (%s): %d",
			resourceName, writerBackend, writeResp.ResourceVersion, getOtherBackendName(writerBackend), readResp.ResourceVersion)

		t.Logf("✓ Resource %s: payload and resource version (%d) consistency verified between %s (write) and %s (read) backends",
			resourceName, writeResp.ResourceVersion, writerBackend, getOtherBackendName(writerBackend))
	}

	// Verify List consistency between backends
	verifyListConsistencyBetweenServers(t, writeServer, readServer, namespace, len(resourceNames))
}

// getOtherBackendName returns the complementary backend name
func getOtherBackendName(backend string) string {
	if backend == "sql" {
		return "kv"
	}
	return "sql"
}

// runMixedConcurrentOperations runs different operations simultaneously on both backends
func runMixedConcurrentOperations(t *testing.T, sqlServer, kvServer resource.ResourceServer, namespace string, ctx context.Context) {
	var wg sync.WaitGroup
	errors := make(chan error, 20)
	startBarrier := make(chan struct{})

	// Use higher operation counts to ensure concurrency
	opCounts := BackendOperationCounts{
		Creates: 25,
		Updates: 15,
		Deletes: 10,
	}

	// SQL backend operations
	wg.Go(func() {
		<-startBarrier // Wait for signal to start
		if err := runBackendOperationsWithCounts(ctx, sqlServer, namespace+"-sql", "sql", opCounts); err != nil {
			errors <- fmt.Errorf("SQL backend operations failed: %w", err)
		}
	})

	// KV backend operations
	wg.Go(func() {
		<-startBarrier // Wait for signal to start
		if err := runBackendOperationsWithCounts(ctx, kvServer, namespace+"-kv", "kv", opCounts); err != nil {
			errors <- fmt.Errorf("KV backend operations failed: %w", err)
		}
	})

	// Start both goroutines simultaneously
	close(startBarrier)

	// Wait for operations to complete with timeout
	done := make(chan bool)
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		// Operations completed
	case <-time.After(10 * time.Second):
		t.Fatal("Timeout waiting for mixed concurrent operations")
	}

	// Check for errors
	close(errors)
	for err := range errors {
		t.Error(err)
	}

	// Allow some time for data propagation
	time.Sleep(50 * time.Millisecond)

	// Calculate expected remaining resources based on operation counts
	expectedRemaining := opCounts.Creates - opCounts.Deletes // Creates - Deletes = Remaining

	// Verify consistency of resources created by SQL backend operations
	// Note: Skip resource version checking since these are separate operations on different backends
	verifyListConsistencyBetweenServersWithRVCheck(t, sqlServer, kvServer, namespace+"-sql", expectedRemaining, false)

	// Verify consistency of resources created by KV backend operations
	// Note: Skip resource version checking since these are separate operations on different backends
	verifyListConsistencyBetweenServersWithRVCheck(t, sqlServer, kvServer, namespace+"-kv", expectedRemaining, false)
}

// BackendOperationCounts defines how many operations of each type to perform
type BackendOperationCounts struct {
	Creates int
	Updates int
	Deletes int
}

// runBackendOperationsWithCounts performs configurable create, update, delete operations on a backend
func runBackendOperationsWithCounts(ctx context.Context, server resource.ResourceServer, namespace, backendType string, counts BackendOperationCounts) error {
	// Create resources
	resourceVersions := make([]int64, counts.Creates)
	for i := 1; i <= counts.Creates; i++ {
		key := &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
			Namespace: namespace,
			Name:      fmt.Sprintf("resource-%s-%d", backendType, i),
		}

		resourceJSON := fmt.Sprintf(`{
			"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind": "Playlist",
			"metadata": {
				"name": "resource-%s-%d",
				"namespace": "%s",
				"uid": "test-uid-%s-%d",
				"generation": 1
			},
			"spec": {
				"title": "Mixed Test Playlist %s %d"
			}
		}`, backendType, i, namespace, backendType, i, backendType, i)

		created, err := server.Create(ctx, &resourcepb.CreateRequest{
			Key:   key,
			Value: []byte(resourceJSON),
		})
		if err != nil {
			return fmt.Errorf("failed to create resource %d: %w", i, err)
		}
		if created.Error != nil {
			return fmt.Errorf("create error for resource %d: %s", i, created.Error.Message)
		}
		resourceVersions[i-1] = created.ResourceVersion
	}

	// Update resources (only update as many as we have, limited by creates and updates count)
	updateCount := counts.Updates
	if updateCount > counts.Creates {
		updateCount = counts.Creates // Can't update more resources than we created
	}
	for i := 1; i <= updateCount; i++ {
		key := &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
			Namespace: namespace,
			Name:      fmt.Sprintf("resource-%s-%d", backendType, i),
		}

		updatedJSON := fmt.Sprintf(`{
			"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind": "Playlist",
			"metadata": {
				"name": "resource-%s-%d",
				"namespace": "%s",
				"uid": "test-uid-%s-%d",
				"generation": 2
			},
			"spec": {
				"title": "Updated Mixed Test Playlist %s %d"
			}
		}`, backendType, i, namespace, backendType, i, backendType, i)

		updated, err := server.Update(ctx, &resourcepb.UpdateRequest{
			Key:             key,
			Value:           []byte(updatedJSON),
			ResourceVersion: resourceVersions[i-1],
		})
		if err != nil {
			return fmt.Errorf("failed to update resource %d: %w", i, err)
		}
		if updated.Error != nil {
			return fmt.Errorf("update error for resource %d: %s", i, updated.Error.Message)
		}
		resourceVersions[i-1] = updated.ResourceVersion
	}

	// Delete resources (only delete as many as we have, limited by creates and deletes count)
	deleteCount := counts.Deletes
	if deleteCount > updateCount {
		deleteCount = updateCount // Can only delete resources that were updated (have latest RV)
	}
	for i := 1; i <= deleteCount; i++ {
		key := &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
			Namespace: namespace,
			Name:      fmt.Sprintf("resource-%s-%d", backendType, i),
		}

		deleted, err := server.Delete(ctx, &resourcepb.DeleteRequest{
			Key:             key,
			ResourceVersion: resourceVersions[i-1], // Use the resource version from updates
		})
		if err != nil {
			return fmt.Errorf("failed to delete resource %d: %w", i, err)
		}
		if deleted.Error != nil {
			return fmt.Errorf("delete error for resource %d: %s", i, deleted.Error.Message)
		}
	}

	return nil
}

// runResourceVersionConsistencyTest verifies resource version handling across backends
func runResourceVersionConsistencyTest(t *testing.T, sqlServer, kvServer resource.ResourceServer, namespace string, ctx context.Context) {
	// Create a resource on SQL backend
	opts := PlaylistResourceOptions{
		Name:       "rv-test-resource",
		Namespace:  namespace,
		UID:        "test-uid-rv",
		Generation: 1,
		Title:      "RV Test Playlist",
		Folder:     "", // No folder
	}

	createPlaylistResource(t, sqlServer, ctx, opts)

	// Allow data to propagate
	time.Sleep(10 * time.Millisecond)

	// Read from KV backend to get the same resource
	key := createPlaylistKey(namespace, "rv-test-resource")
	kvRead, err := kvServer.Read(ctx, &resourcepb.ReadRequest{Key: key})
	require.NoError(t, err)
	require.Nil(t, kvRead.Error)
	// Note: Resource versions may differ between backends, but content should be the same
	require.Greater(t, kvRead.ResourceVersion, int64(0), "KV backend should return a valid resource version")

	// Read from SQL backend to compare content
	sqlReadInitial, err := sqlServer.Read(ctx, &resourcepb.ReadRequest{Key: key})
	require.NoError(t, err)
	require.Nil(t, sqlReadInitial.Error)
	require.JSONEq(t, string(sqlReadInitial.Value), string(kvRead.Value), "Both backends should return the same initial content")

	// Update via KV backend
	updateOpts := PlaylistResourceOptions{
		Name:       "rv-test-resource",
		Namespace:  namespace,
		UID:        "test-uid-rv",
		Generation: 2,
		Title:      "Updated RV Test Playlist",
		Folder:     "", // No folder
	}

	updatePlaylistResource(t, kvServer, ctx, updateOpts, kvRead.ResourceVersion)

	// Allow data to propagate
	time.Sleep(10 * time.Millisecond)

	// Read from SQL backend to verify consistency
	sqlRead, err := sqlServer.Read(ctx, &resourcepb.ReadRequest{Key: key})
	require.NoError(t, err)
	require.Nil(t, sqlRead.Error)
	// Note: Resource versions may differ, but content should be consistent
	require.Greater(t, sqlRead.ResourceVersion, int64(0), "SQL backend should return a valid resource version")

	// Verify both backends return the same content - we need to read from KV again to get the Value
	kvReadAfterUpdate, err := kvServer.Read(ctx, &resourcepb.ReadRequest{Key: key})
	require.NoError(t, err)
	require.Nil(t, kvReadAfterUpdate.Error)
	require.JSONEq(t, string(kvReadAfterUpdate.Value), string(sqlRead.Value), "Both backends should return the same updated content")
}

// verifyListConsistencyBetweenServers verifies that both servers return consistent list results
func verifyListConsistencyBetweenServers(t *testing.T, server1, server2 resource.ResourceServer, namespace string, expectedCount int) {
	verifyListConsistencyBetweenServersWithRVCheck(t, server1, server2, namespace, expectedCount, true)
}

// verifyListConsistencyBetweenServersWithRVCheck verifies list consistency with optional resource version checking
func verifyListConsistencyBetweenServersWithRVCheck(t *testing.T, server1, server2 resource.ResourceServer, namespace string, expectedCount int, checkResourceVersions bool) {
	ctx := testutil.NewDefaultTestContext(t)

	// Get lists from both servers
	list1, err := server1.List(ctx, &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     "playlist.grafana.app",
				Resource:  "playlists",
				Namespace: namespace,
			},
		},
	})
	require.NoError(t, err)
	require.Nil(t, list1.Error)

	list2, err := server2.List(ctx, &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     "playlist.grafana.app",
				Resource:  "playlists",
				Namespace: namespace,
			},
		},
	})
	require.NoError(t, err)
	require.Nil(t, list2.Error)

	// Create maps for easier comparison by extracting names from JSON
	items1 := make(map[string]*resourcepb.ResourceWrapper)
	for _, item := range list1.Items {
		itemNamespace := extractResourceNamespaceFromJSON(t, item.Value)
		if itemNamespace == namespace { // Only compare items from our exact namespace
			name := extractResourceNameFromJSON(t, item.Value)
			items1[name] = item
		}
	}

	items2 := make(map[string]*resourcepb.ResourceWrapper)
	for _, item := range list2.Items {
		itemNamespace := extractResourceNamespaceFromJSON(t, item.Value)
		if itemNamespace == namespace { // Only compare items from our exact namespace
			name := extractResourceNameFromJSON(t, item.Value)
			items2[name] = item
		}
	}

	// Verify counts match after filtering by namespace
	require.Equal(t, expectedCount, len(items1), "Server 1 should return expected count after filtering")
	require.Equal(t, expectedCount, len(items2), "Server 2 should return expected count after filtering")
	require.Equal(t, len(items1), len(items2), "Both servers should return same count after filtering")

	// Verify all items exist in both lists with same content and resource version
	for name, item1 := range items1 {
		item2, exists := items2[name]
		require.True(t, exists, "Item %s should exist in both lists", name)
		require.Greater(t, item1.ResourceVersion, int64(0), "Item1 should have valid resource version for %s", name)
		require.Greater(t, item2.ResourceVersion, int64(0), "Item2 should have valid resource version for %s", name)
		require.JSONEq(t, string(item1.Value), string(item2.Value), "Content should match for %s", name)

		// Validate that both backends return equivalent resource versions using rvmanager compatibility check
		if checkResourceVersions {
			require.True(t, rvmanager.IsRvEqual(item1.ResourceVersion, item2.ResourceVersion) || rvmanager.IsRvEqual(item2.ResourceVersion, item1.ResourceVersion),
				"Resource version mismatch for item %s between backends. Item1: %d, Item2: %d", name, item1.ResourceVersion, item2.ResourceVersion)
		}
	}
}

// extractResourceNameFromJSON extracts the resource name from JSON metadata
func extractResourceNameFromJSON(t *testing.T, jsonData []byte) string {
	var obj map[string]interface{}
	err := json.Unmarshal(jsonData, &obj)
	require.NoError(t, err, "Failed to unmarshal JSON")

	metadata, ok := obj["metadata"].(map[string]interface{})
	require.True(t, ok, "metadata field not found or not an object")

	name, ok := metadata["name"].(string)
	require.True(t, ok, "name field not found or not a string")

	return name
}

// extractResourceNamespaceFromJSON extracts the resource namespace from JSON metadata
func extractResourceNamespaceFromJSON(t *testing.T, jsonData []byte) string {
	var obj map[string]interface{}
	err := json.Unmarshal(jsonData, &obj)
	require.NoError(t, err, "Failed to unmarshal JSON")

	metadata, ok := obj["metadata"].(map[string]interface{})
	require.True(t, ok, "metadata field not found or not an object")

	namespace, ok := metadata["namespace"].(string)
	require.True(t, ok, "namespace field not found or not a string")

	return namespace
}

// PlaylistResourceOptions defines options for creating test playlist resources
type PlaylistResourceOptions struct {
	Name       string
	Namespace  string
	UID        string
	Generation int
	Title      string
	Folder     string // optional - empty string means no folder
}

// createPlaylistJSON creates standardized JSON for playlist resources
func createPlaylistJSON(opts PlaylistResourceOptions) []byte {
	folderAnnotation := ""
	if opts.Folder != "" {
		folderAnnotation = fmt.Sprintf(`,
				"annotations": {
					"grafana.app/folder": "%s"
				}`, opts.Folder)
	}

	jsonStr := fmt.Sprintf(`{
		"apiVersion": "playlist.grafana.app/v0alpha1",
		"kind": "Playlist",
		"metadata": {
			"name": "%s",
			"namespace": "%s",
			"uid": "%s",
			"generation": %d%s
		},
		"spec": {
			"title": "%s"
		}
	}`, opts.Name, opts.Namespace, opts.UID, opts.Generation, folderAnnotation, opts.Title)

	return []byte(jsonStr)
}

// createPlaylistKey creates standardized ResourceKey for playlist resources
func createPlaylistKey(namespace, name string) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{
		Group:     "playlist.grafana.app",
		Resource:  "playlists",
		Namespace: namespace,
		Name:      name,
	}
}

// createPlaylistResource creates a playlist resource using the server with consistent error handling
func createPlaylistResource(t *testing.T, server resource.ResourceServer, ctx context.Context, opts PlaylistResourceOptions) *resourcepb.CreateResponse {
	t.Helper()
	key := createPlaylistKey(opts.Namespace, opts.Name)
	value := createPlaylistJSON(opts)

	created, err := server.Create(ctx, &resourcepb.CreateRequest{
		Key:   key,
		Value: value,
	})
	require.NoError(t, err)
	require.Nil(t, created.Error)
	require.Greater(t, created.ResourceVersion, int64(0))

	return created
}

// updatePlaylistResource updates a playlist resource using the server with consistent error handling
func updatePlaylistResource(t *testing.T, server resource.ResourceServer, ctx context.Context, opts PlaylistResourceOptions, resourceVersion int64) *resourcepb.UpdateResponse {
	t.Helper()
	key := createPlaylistKey(opts.Namespace, opts.Name)
	value := createPlaylistJSON(opts)

	updated, err := server.Update(ctx, &resourcepb.UpdateRequest{
		Key:             key,
		Value:           value,
		ResourceVersion: resourceVersion,
	})
	require.NoError(t, err)
	require.Nil(t, updated.Error)
	require.Greater(t, updated.ResourceVersion, int64(0)) // Just check it's positive, not necessarily greater than input

	return updated
}

// deletePlaylistResource deletes a playlist resource using the server with consistent error handling
func deletePlaylistResource(t *testing.T, server resource.ResourceServer, ctx context.Context, namespace, name string, resourceVersion int64) *resourcepb.DeleteResponse {
	t.Helper()
	key := createPlaylistKey(namespace, name)

	deleted, err := server.Delete(ctx, &resourcepb.DeleteRequest{
		Key:             key,
		ResourceVersion: resourceVersion,
	})
	require.NoError(t, err)
	require.Nil(t, deleted.Error)
	require.Greater(t, deleted.ResourceVersion, int64(0))

	return deleted
}

// createStorageServer creates a ResourceServer without search enabled (storage-api only)
func createStorageServer(t *testing.T, backend resource.StorageBackend) resource.ResourceServer {
	t.Helper()
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:      backend,
		AccessClient: claims.FixedAccessClient(true), // Allow all operations for testing
	})
	require.NoError(t, err)
	return server
}

// verifySearchServerStats verifies GetStats returns expected count from search server
func verifySearchServerStats(t *testing.T, searchServer resource.ResourceServer, namespace string, expectedCount int64) {
	t.Helper()
	ctx := testutil.NewDefaultTestContext(t)

	stats, err := searchServer.GetStats(ctx, &resourcepb.ResourceStatsRequest{
		Namespace: namespace,
	})
	require.NoError(t, err)
	require.Nil(t, stats.Error, "GetStats returned error: %v", stats.Error)

	// GetStats returns aggregate stats per group/resource
	// Since we only create playlists, we expect 1 stat entry
	require.Len(t, stats.Stats, 1, "Expected 1 stat entry for playlist.grafana.app/playlists")
	require.Equal(t, expectedCount, stats.Stats[0].Count, "Resource count mismatch")

	t.Logf("GetStats OK: %d resources in namespace %s", expectedCount, namespace)
}

// verifySearchServerResults verifies Search returns expected results from search server
func verifySearchServerResults(t *testing.T, searchServer resource.ResourceServer, namespace string, query string, expectedHits int, expectedNames []string) {
	t.Helper()
	ctx := testutil.NewDefaultTestContext(t)

	searchReq := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     "playlist.grafana.app",
				Resource:  "playlists",
				Namespace: namespace,
			},
		},
		Query: query,
		Limit: 100, // high enough to get all results
	}

	searchResp, err := searchServer.Search(ctx, searchReq)
	require.NoError(t, err)
	require.Nil(t, searchResp.Error, "Search returned error: %v", searchResp.Error)

	// Verify total hits
	require.Equal(t, int64(expectedHits), searchResp.TotalHits, "Search hits mismatch")

	// Verify result names match expected (order-agnostic)
	require.NotNil(t, searchResp.Results, "Search results should not be nil")
	actualNames := make([]string, 0, len(searchResp.Results.Rows))
	for _, row := range searchResp.Results.Rows {
		actualNames = append(actualNames, row.Key.Name)
	}
	require.ElementsMatch(t, expectedNames, actualNames, "Search result names mismatch")

	// Log for debugging
	queryDesc := query
	if queryDesc == "" {
		queryDesc = "(all)"
	}
	t.Logf("Search OK: query=%s, hits=%d", queryDesc, expectedHits)
}

// SearchServerFactory is a function that creates a ResourceServer with search enabled
type SearchServerFactory func(t *testing.T, backend resource.StorageBackend) resource.ResourceServer

// runTestSearchOperationsCompatibility tests search-api with different backend combinations
// Simulates production rollout: Phase 1 (search=sql, storage=mixed) -> Phase 2 (search=kv, storage=kv)
// The searchServerFactory parameter allows the caller to provide a function that creates search-enabled servers,
// avoiding import cycles with the search package.
func runTestSearchOperationsCompatibility(t *testing.T, sqlBackend, kvBackend resource.StorageBackend, nsPrefix string, db sqldb.DB, searchServerFactory SearchServerFactory) {
	// Skip on SQLite due to concurrency limitations
	if db.DriverName() == "sqlite3" {
		t.Skip("Skipping search operations compatibility test on SQLite")
	}

	// Search server factory is required for search compatibility tests
	require.NotNil(t, searchServerFactory, "SearchServerFactory must be provided in TestOptions for search compatibility tests")

	// Test 1: Phase 1 Rollout - Search server uses SQL backend, Storage servers use both
	// This simulates the transitional state where storage-api migrates to sqlkv
	// while search-api continues using sqlbackend
	t.Run("Search with SQL backend, Storage mixed", func(t *testing.T) {
		runSearchCompatibilityScenario(t, searchCompatibilityTestConfig{
			namespace:    nsPrefix + "-search-sql",
			searchServer: searchServerFactory(t, sqlBackend),
			alphaStorage: createStorageServer(t, sqlBackend),
			betaStorage:  createStorageServer(t, kvBackend),
			alphaPrefix:  "sql",
			betaPrefix:   "kv",
		})
	})

	// Test 2: Phase 2 Final State - All servers use KV backend
	// This simulates the final state after complete migration to sqlkv
	t.Run("Search with KV backend, Storage KV", func(t *testing.T) {
		runSearchCompatibilityScenario(t, searchCompatibilityTestConfig{
			namespace:    nsPrefix + "-search-kv",
			searchServer: searchServerFactory(t, kvBackend),
			alphaStorage: createStorageServer(t, kvBackend),
			betaStorage:  createStorageServer(t, kvBackend),
			alphaPrefix:  "kv1",
			betaPrefix:   "kv2",
		})
	})
}

// numberToWord converts numbers 1-8 to words for test data variety
func numberToWord(n int) string {
	words := []string{"Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"}
	if n >= 0 && n < len(words) {
		return words[n]
	}
	return fmt.Sprintf("%d", n)
}

// searchCompatibilityTestConfig defines configuration for a search compatibility test scenario
type searchCompatibilityTestConfig struct {
	namespace    string                  // namespace for test isolation
	searchServer resource.ResourceServer // search server (with search enabled)
	alphaStorage resource.ResourceServer // storage server for Alpha resources
	betaStorage  resource.ResourceServer // storage server for Beta resources
	alphaPrefix  string                  // prefix for Alpha resource names (e.g., "sql", "kv1")
	betaPrefix   string                  // prefix for Beta resource names (e.g., "kv", "kv2")
}

// runSearchCompatibilityScenario runs a complete search compatibility test scenario
// with create, update, and delete phases
func runSearchCompatibilityScenario(t *testing.T, cfg searchCompatibilityTestConfig) {
	t.Helper()
	ctx := newIntegrationTestContext(t)

	searchServer := cfg.searchServer

	// Track resource versions for update/delete phases
	resourceVersions := make(map[string]int64)

	// Helper to generate resource name
	alphaName := func(i int) string {
		return fmt.Sprintf("%s-playlist-alpha-%d", cfg.alphaPrefix, i)
	}
	betaName := func(i int) string {
		return fmt.Sprintf("%s-playlist-beta-%d", cfg.betaPrefix, i)
	}

	// Phase A: Alpha storage creates resources with "Alpha" prefix
	t.Run("Phase A: Create Alpha resources", func(t *testing.T) {
		for i := 1; i <= 4; i++ {
			name := alphaName(i)
			created := createPlaylistResource(t, cfg.alphaStorage, ctx, PlaylistResourceOptions{
				Name:       name,
				Namespace:  cfg.namespace,
				UID:        fmt.Sprintf("%s-uid-alpha-%d", cfg.alphaPrefix, i),
				Generation: 1,
				Title:      fmt.Sprintf("Alpha Playlist %s", numberToWord(i)),
				Folder:     "",
			})
			resourceVersions[name] = created.ResourceVersion
		}

		expectedNames := []string{alphaName(1), alphaName(2), alphaName(3), alphaName(4)}
		verifySearchServerStats(t, searchServer, cfg.namespace, 4)
		verifySearchServerResults(t, searchServer, cfg.namespace, "", 4, expectedNames)
		verifySearchServerResults(t, searchServer, cfg.namespace, "Alpha", 4, expectedNames)
	})

	// Phase B: Beta storage creates resources with "Beta" prefix
	t.Run("Phase B: Create Beta resources", func(t *testing.T) {
		for i := 1; i <= 4; i++ {
			name := betaName(i)
			created := createPlaylistResource(t, cfg.betaStorage, ctx, PlaylistResourceOptions{
				Name:       name,
				Namespace:  cfg.namespace,
				UID:        fmt.Sprintf("%s-uid-beta-%d", cfg.betaPrefix, i),
				Generation: 1,
				Title:      fmt.Sprintf("Beta Playlist %s", numberToWord(i)),
				Folder:     "",
			})
			resourceVersions[name] = created.ResourceVersion
		}

		allNames := []string{
			alphaName(1), alphaName(2), alphaName(3), alphaName(4),
			betaName(1), betaName(2), betaName(3), betaName(4),
		}
		alphaNames := []string{alphaName(1), alphaName(2), alphaName(3), alphaName(4)}
		betaNames := []string{betaName(1), betaName(2), betaName(3), betaName(4)}

		verifySearchServerStats(t, searchServer, cfg.namespace, 8)
		verifySearchServerResults(t, searchServer, cfg.namespace, "", 8, allNames)
		verifySearchServerResults(t, searchServer, cfg.namespace, "Alpha", 4, alphaNames)
		verifySearchServerResults(t, searchServer, cfg.namespace, "Beta", 4, betaNames)
	})

	// Phase C: Alpha storage creates more Alpha resources
	t.Run("Phase C: Create more Alpha resources", func(t *testing.T) {
		for i := 5; i <= 7; i++ {
			name := alphaName(i)
			created := createPlaylistResource(t, cfg.alphaStorage, ctx, PlaylistResourceOptions{
				Name:       name,
				Namespace:  cfg.namespace,
				UID:        fmt.Sprintf("%s-uid-alpha-%d", cfg.alphaPrefix, i),
				Generation: 1,
				Title:      fmt.Sprintf("Alpha Playlist %s", numberToWord(i)),
				Folder:     "",
			})
			resourceVersions[name] = created.ResourceVersion
		}

		alphaNames := []string{
			alphaName(1), alphaName(2), alphaName(3), alphaName(4),
			alphaName(5), alphaName(6), alphaName(7),
		}
		verifySearchServerStats(t, searchServer, cfg.namespace, 11)
		verifySearchServerResults(t, searchServer, cfg.namespace, "Alpha", 7, alphaNames)
	})

	// Phase D: Beta storage creates more Beta resources
	t.Run("Phase D: Create more Beta resources", func(t *testing.T) {
		for i := 5; i <= 7; i++ {
			name := betaName(i)
			created := createPlaylistResource(t, cfg.betaStorage, ctx, PlaylistResourceOptions{
				Name:       name,
				Namespace:  cfg.namespace,
				UID:        fmt.Sprintf("%s-uid-beta-%d", cfg.betaPrefix, i),
				Generation: 1,
				Title:      fmt.Sprintf("Beta Playlist %s", numberToWord(i)),
				Folder:     "",
			})
			resourceVersions[name] = created.ResourceVersion
		}

		betaNames := []string{
			betaName(1), betaName(2), betaName(3), betaName(4),
			betaName(5), betaName(6), betaName(7),
		}
		verifySearchServerStats(t, searchServer, cfg.namespace, 14)
		verifySearchServerResults(t, searchServer, cfg.namespace, "Beta", 7, betaNames)
	})

	// Phase E: Update resources and verify search reflects changes
	t.Run("Phase E: Update resources and verify search", func(t *testing.T) {
		// Update first Alpha resource with new title containing "Updated"
		name := alphaName(1)
		updated := updatePlaylistResource(t, cfg.alphaStorage, ctx, PlaylistResourceOptions{
			Name:       name,
			Namespace:  cfg.namespace,
			UID:        fmt.Sprintf("%s-uid-alpha-1", cfg.alphaPrefix),
			Generation: 2,
			Title:      "Updated Alpha Playlist One",
			Folder:     "",
		}, resourceVersions[name])
		resourceVersions[name] = updated.ResourceVersion

		// Update first Beta resource with new title containing "Updated"
		name = betaName(1)
		updated = updatePlaylistResource(t, cfg.betaStorage, ctx, PlaylistResourceOptions{
			Name:       name,
			Namespace:  cfg.namespace,
			UID:        fmt.Sprintf("%s-uid-beta-1", cfg.betaPrefix),
			Generation: 2,
			Title:      "Updated Beta Playlist One",
			Folder:     "",
		}, resourceVersions[name])
		resourceVersions[name] = updated.ResourceVersion

		// Verify total count remains 14
		verifySearchServerStats(t, searchServer, cfg.namespace, 14)

		// Verify search for "Updated" returns 2 results
		verifySearchServerResults(t, searchServer, cfg.namespace, "Updated", 2, []string{
			alphaName(1), betaName(1),
		})

		// Verify Alpha and Beta counts remain correct
		alphaNames := []string{
			alphaName(1), alphaName(2), alphaName(3), alphaName(4),
			alphaName(5), alphaName(6), alphaName(7),
		}
		betaNames := []string{
			betaName(1), betaName(2), betaName(3), betaName(4),
			betaName(5), betaName(6), betaName(7),
		}
		verifySearchServerResults(t, searchServer, cfg.namespace, "Alpha", 7, alphaNames)
		verifySearchServerResults(t, searchServer, cfg.namespace, "Beta", 7, betaNames)
	})

	// Phase F: Delete resources and verify search reflects removal
	t.Run("Phase F: Delete resources and verify search", func(t *testing.T) {
		// Delete last Alpha resource
		name := alphaName(7)
		deletePlaylistResource(t, cfg.alphaStorage, ctx, cfg.namespace, name, resourceVersions[name])

		// Delete last Beta resource
		name = betaName(7)
		deletePlaylistResource(t, cfg.betaStorage, ctx, cfg.namespace, name, resourceVersions[name])

		// Verify total count is now 12 (14 - 2 deleted)
		verifySearchServerStats(t, searchServer, cfg.namespace, 12)

		// Verify Alpha count is now 6 (7 - 1 deleted)
		alphaNames := []string{
			alphaName(1), alphaName(2), alphaName(3), alphaName(4),
			alphaName(5), alphaName(6),
		}
		verifySearchServerResults(t, searchServer, cfg.namespace, "Alpha", 6, alphaNames)

		// Verify Beta count is now 6 (7 - 1 deleted)
		betaNames := []string{
			betaName(1), betaName(2), betaName(3), betaName(4),
			betaName(5), betaName(6),
		}
		verifySearchServerResults(t, searchServer, cfg.namespace, "Beta", 6, betaNames)

		// Verify "Updated" search still returns 2 results (updated resources weren't deleted)
		verifySearchServerResults(t, searchServer, cfg.namespace, "Updated", 2, []string{
			alphaName(1), betaName(1),
		})
	})
}
