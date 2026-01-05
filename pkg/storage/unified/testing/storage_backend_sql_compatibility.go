package test

import (
	"context"
	"fmt"
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
		{TestKeyPathGeneration, runTestIntegrationBackendKeyPathGeneration},
	}

	for _, tc := range cases {
		if shouldSkip := opts.SkipTests[tc.name]; shouldSkip {
			t.Logf("Skipping test: %s", tc.name)
			continue
		}

		t.Run(tc.name, func(t *testing.T) {
			kvbackend, db := newKvBackend(context.Background())
			sqlbackend, _ := newSqlBackend(context.Background())
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
	err = rows.Close()
	require.NoError(t, err)

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
	require.Contains(t, keyPath, fmt.Sprintf("/%d~", expectedSnowflake), fmt.Sprintf("actual RV: %d", actualRV))

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
