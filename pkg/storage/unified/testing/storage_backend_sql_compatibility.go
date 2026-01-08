package test

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/bwmarrin/snowflake"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
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
	kv, err := resource.NewSQLKV(eDB)
	require.NoError(t, err)
	db, err := eDB.Init(ctx)
	require.NoError(t, err)

	kvOpts := resource.KVBackendOptions{
		KvStore: kv,
	}

	if withRvManager {
		dialect := sqltemplate.DialectForDriver(db.DriverName())
		rvManager, err := rvmanager.NewResourceVersionManager(rvmanager.ResourceManagerOptions{
			Dialect: dialect,
			DB:      db,
		})
		require.NoError(t, err)

		kvOpts.RvManager = rvManager
	}

	backend, err := resource.NewKVStorageBackend(kvOpts)
	require.NoError(t, err)
	return backend, db
}

func RunSQLStorageBackendCompatibilityTest(t *testing.T, newSqlBackend, newKvBackend NewBackendWithDBFunc, opts *TestOptions) {
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
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if opts.SkipTests[tc.name] {
				t.Skip()
			}

			kvbackend, db := newKvBackend(t.Context())
			sqlbackend, _ := newSqlBackend(t.Context())
			tc.fn(t, sqlbackend, kvbackend, opts.NSPrefix, db)
		})
	}
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
		key := &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
			Namespace: nsPrefix,
			Name:      fmt.Sprintf("test-playlist-%d", i),
		}

		// Create resource JSON with folder annotation for resource 2
		resourceJSON := fmt.Sprintf(`{
			"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind": "Playlist",
			"metadata": {
				"name": "test-playlist-%d",
				"namespace": "%s",
				"uid": "test-uid-%d"%s
			},
			"spec": {
				"title": "My Test Playlist %d"
			}
		}`, i, nsPrefix, i, getAnnotationsJSON(i == 2), i)

		// Create the resource using server.Create
		created, err := server.Create(ctx, &resourcepb.CreateRequest{
			Key:   key,
			Value: []byte(resourceJSON),
		})
		require.NoError(t, err)
		require.Nil(t, created.Error)
		require.Greater(t, created.ResourceVersion, int64(0))
		currentRVs[i-1] = created.ResourceVersion

		// Verify created resource key_path (with folder for resource 2)
		if i == 2 {
			verifyKeyPath(t, db, ctx, key, "created", created.ResourceVersion, "test-folder")
		} else {
			verifyKeyPath(t, db, ctx, key, "created", created.ResourceVersion, "")
		}
	}

	// Update the 3 resources
	for i := 1; i <= 3; i++ {
		key := &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
			Namespace: nsPrefix,
			Name:      fmt.Sprintf("test-playlist-%d", i),
		}

		// Create updated resource JSON with folder annotation for resource 2
		updatedResourceJSON := fmt.Sprintf(`{
			"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind": "Playlist",
			"metadata": {
				"name": "test-playlist-%d",
				"namespace": "%s",
				"uid": "test-uid-%d"%s
			},
			"spec": {
				"title": "My Updated Playlist %d"
			}
		}`, i, nsPrefix, i, getAnnotationsJSON(i == 2), i)

		// Update the resource using server.Update
		updated, err := server.Update(ctx, &resourcepb.UpdateRequest{
			Key:             key,
			Value:           []byte(updatedResourceJSON),
			ResourceVersion: currentRVs[i-1], // Use the resource version returned by previous operation
		})
		require.NoError(t, err)
		require.Nil(t, updated.Error)
		require.Greater(t, updated.ResourceVersion, currentRVs[i-1])
		currentRVs[i-1] = updated.ResourceVersion // Update to the latest resource version

		// Verify updated resource key_path (with folder for resource 2)
		if i == 2 {
			verifyKeyPath(t, db, ctx, key, "updated", updated.ResourceVersion, "test-folder")
		} else {
			verifyKeyPath(t, db, ctx, key, "updated", updated.ResourceVersion, "")
		}
	}

	// Delete the 3 resources
	for i := 1; i <= 3; i++ {
		key := &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
			Namespace: nsPrefix,
			Name:      fmt.Sprintf("test-playlist-%d", i),
		}

		// Delete the resource using server.Delete
		deleted, err := server.Delete(ctx, &resourcepb.DeleteRequest{
			Key:             key,
			ResourceVersion: currentRVs[i-1], // Use the resource version from previous operation
		})
		require.NoError(t, err)
		require.Greater(t, deleted.ResourceVersion, currentRVs[i-1])

		// Verify deleted resource key_path (with folder for resource 2)
		if i == 2 {
			verifyKeyPath(t, db, ctx, key, "deleted", deleted.ResourceVersion, "test-folder")
		} else {
			verifyKeyPath(t, db, ctx, key, "deleted", deleted.ResourceVersion, "")
		}
	}
}

// verifyKeyPath is a helper function to verify key_path generation
func verifyKeyPath(t *testing.T, db sqldb.DB, ctx context.Context, key *resourcepb.ResourceKey, action string, resourceVersion int64, expectedFolder string) {
	var query string
	if db.DriverName() == "postgres" {
		query = "SELECT key_path, resource_version, action, folder FROM resource_history WHERE namespace = $1 AND name = $2 AND resource_version = $3"
	} else {
		query = "SELECT key_path, resource_version, action, folder FROM resource_history WHERE namespace = ? AND name = ? AND resource_version = ?"
	}
	rows, err := db.QueryContext(ctx, query, key.Namespace, key.Name, resourceVersion)
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

	// Verify snowflake calculation
	expectedSnowflake := (((resourceVersion / 1000) - snowflake.Epoch) << (snowflake.NodeBits + snowflake.StepBits)) + (resourceVersion % 1000)
	require.Contains(t, keyPath, fmt.Sprintf("/%d~", expectedSnowflake), "actual RV: %d", actualRV)

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

// getAnnotationsJSON returns the annotations JSON string for the folder annotation if needed
func getAnnotationsJSON(withFolder bool) string {
	if withFolder {
		return `,
				"annotations": {
					"grafana.app/folder": "test-folder"
				}`
	}
	return ""
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
		key := &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
			Namespace: namespace,
			Name:      res.name,
		}

		// Create resource JSON with folder annotation and generation=1 for creates
		resourceJSON := fmt.Sprintf(`{
			"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind": "Playlist",
			"metadata": {
				"name": "%s",
				"namespace": "%s",
				"uid": "test-uid-%d",
				"generation": 1%s
			},
			"spec": {
				"title": "Test Playlist %d"
			}
		}`, res.name, namespace, i+1, getAnnotationsJSON(res.folder != ""), i+1)

		// Create the resource
		created, err := server.Create(ctx, &resourcepb.CreateRequest{
			Key:   key,
			Value: []byte(resourceJSON),
		})
		require.NoError(t, err)
		require.Nil(t, created.Error)
		require.Greater(t, created.ResourceVersion, int64(0))

		// Store the resource version
		resourceVersions[i] = append(resourceVersions[i], created.ResourceVersion)
	}

	// Update 3 resources
	for i, res := range resources {
		key := &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
			Namespace: namespace,
			Name:      res.name,
		}

		// Update resource JSON with generation=2 for updates
		resourceJSON := fmt.Sprintf(`{
			"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind": "Playlist",
			"metadata": {
				"name": "%s",
				"namespace": "%s",
				"uid": "test-uid-%d",
				"generation": 2%s
			},
			"spec": {
				"title": "Updated Test Playlist %d"
			}
		}`, res.name, namespace, i+1, getAnnotationsJSON(res.folder != ""), i+1)

		// Update the resource using the current resource version
		currentRV := resourceVersions[i][len(resourceVersions[i])-1]
		updated, err := server.Update(ctx, &resourcepb.UpdateRequest{
			Key:             key,
			Value:           []byte(resourceJSON),
			ResourceVersion: currentRV,
		})
		require.NoError(t, err)
		require.Nil(t, updated.Error)
		require.Greater(t, updated.ResourceVersion, currentRV)

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
	ctx := context.Background()
	query := buildCrossDatabaseQuery(db.DriverName(), `
		SELECT guid, "group", resource, namespace, name, value, action, folder,
		       previous_resource_version, generation, resource_version
		FROM resource_history
		WHERE namespace = ?
		ORDER BY resource_version ASC
	`)

	rows, err := db.QueryContext(ctx, query, namespace)
	require.NoError(t, err)
	defer func() {
		_ = rows.Close()
	}()

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
		verifyResourceHistoryRecord(t, createRecord, res, resourceIdx, 1, 0, 1, resourceVersions[resourceIdx][0])
		recordIndex++
	}

	for resourceIdx, res := range resources {
		// Check update record (action=2, generation=2)
		updateRecord := records[recordIndex]
		verifyResourceHistoryRecord(t, updateRecord, res, resourceIdx, 2, resourceVersions[resourceIdx][0], 2, resourceVersions[resourceIdx][1])
		recordIndex++
	}

	for resourceIdx, res := range resources[:2] {
		// Check delete record (action=3, generation=0) - only first 2 resources were deleted
		deleteRecord := records[recordIndex]
		verifyResourceHistoryRecord(t, deleteRecord, res, resourceIdx, 3, resourceVersions[resourceIdx][1], 0, resourceVersions[resourceIdx][2])
		recordIndex++
	}
}

// verifyResourceHistoryRecord validates a single resource_history record
func verifyResourceHistoryRecord(t *testing.T, record ResourceHistoryRecord, expectedRes struct{ name, folder string }, resourceIdx, expectedAction int, expectedPrevRV int64, expectedGeneration int, expectedRV int64) {
	// Validate GUID (should be non-empty)
	require.NotEmpty(t, record.GUID, "GUID should not be empty")

	// Validate group/resource/namespace/name
	require.Equal(t, "playlist.grafana.app", record.Group)
	require.Equal(t, "playlists", record.Resource)
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
	// For KV backend operations, resource versions are stored as snowflake format
	// but expectedPrevRV is in microsecond format, so we need to use IsRvEqual for comparison
	if strings.Contains(record.Namespace, "-kv") {
		require.True(t, rvmanager.IsRvEqual(record.PreviousResourceVersion, expectedPrevRV),
			"Previous resource version should match (KV backend snowflake format)")
	} else {
		require.Equal(t, expectedPrevRV, record.PreviousResourceVersion)
	}

	// Validate generation: 1 for create, 2 for update, 0 for delete
	require.Equal(t, expectedGeneration, record.Generation)

	// Validate resource_version
	// For KV backend operations, resource versions are stored as snowflake format
	if strings.Contains(record.Namespace, "-kv") {
		require.True(t, rvmanager.IsRvEqual(record.ResourceVersion, expectedRV),
			"Resource version should match (KV backend snowflake format)")
	} else {
		require.Equal(t, expectedRV, record.ResourceVersion)
	}
}

// verifyResourceTable validates the resource table (latest state only)
func verifyResourceTable(t *testing.T, db sqldb.DB, namespace string, resources []struct{ name, folder string }, resourceVersions [][]int64) {
	ctx := context.Background()
	query := buildCrossDatabaseQuery(db.DriverName(), `
		SELECT guid, "group", resource, namespace, name, value, action, folder,
		       previous_resource_version, resource_version
		FROM resource
		WHERE namespace = ?
		ORDER BY name ASC
	`)

	rows, err := db.QueryContext(ctx, query, namespace)
	require.NoError(t, err)
	defer func() {
		_ = rows.Close()
	}()

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
		require.True(t, rvmanager.IsRvEqual(record.ResourceVersion, expectedRV),
			"Resource version should match (KV backend snowflake format)")
	} else {
		require.Equal(t, expectedRV, record.ResourceVersion)
	}
}

// verifyResourceVersionTable validates the resource_version table
func verifyResourceVersionTable(t *testing.T, db sqldb.DB, namespace string, resources []struct{ name, folder string }, resourceVersions [][]int64) {
	ctx := context.Background()
	query := buildCrossDatabaseQuery(db.DriverName(), `
		SELECT "group", resource, resource_version
		FROM resource_version
		WHERE "group" = ? AND resource = ?
	`)

	// Check that we have exactly one entry for playlist.grafana.app/playlists
	rows, err := db.QueryContext(ctx, query, "playlist.grafana.app", "playlists")
	require.NoError(t, err)
	defer func() {
		_ = rows.Close()
	}()

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
	require.GreaterOrEqual(t, record.ResourceVersion, maxRV, "resource_version should be at least the latest RV we tracked")
	// But it shouldn't be too much higher (within a reasonable range)
	require.LessOrEqual(t, record.ResourceVersion, maxRV+100, "resource_version shouldn't be much higher than expected")
}
