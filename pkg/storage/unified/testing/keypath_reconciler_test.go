package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	sqldb "github.com/grafana/grafana/pkg/storage/unified/sql/db"
)

// keyPathReconciler is the operational hook exposed by the KV storage backend to
// run a key_path backfill pass synchronously.
type keyPathReconciler interface {
	ReconcileKeyPathsNow(ctx context.Context) (int, error)
}

// TestIntegrationKeyPathReconciler simulates the HA rolling-upgrade gap: an older
// instance wrote resource_history rows without populating key_path. Such rows are
// invisible to key-range scans, so the resource can no longer be read. The
// reconciler must repair them so the resource becomes readable again.
func TestIntegrationKeyPathReconciler(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// Compat (rvmanager) mode is the one that populates the legacy columns and
	// key_path together; that is where an older writer can leave key_path empty
	// while the columns needed to reconstruct it are present.
	ctx := newIntegrationTestContext(t)
	backend, db := NewTestSqlKvBackend(t, ctx, SQLKVBackendModeRVManager)

	reconciler, ok := backend.(keyPathReconciler)
	require.True(t, ok, "KV backend must expose ReconcileKeyPathsNow")

	server := createStorageServer(t, backend)

	nsPrefix := GenerateRandomNSPrefix()
	namespace := nsPrefix + "-kp-recon"

	const count = 3
	names := make([]string, count)
	for i := range count {
		name := fmt.Sprintf("kp-playlist-%d", i+1)
		names[i] = name
		folder := ""
		if i == 1 {
			folder = "some-folder"
		}
		createPlaylistResource(t, server, ctx, PlaylistResourceOptions{
			Name:       name,
			Namespace:  namespace,
			UID:        fmt.Sprintf("kp-uid-%d", i+1),
			Generation: 1,
			Title:      fmt.Sprintf("KeyPath Playlist %d", i+1),
			Folder:     folder,
		})
	}

	// sanity: all resources are readable before we corrupt key_path
	for _, name := range names {
		readResp, err := server.Read(ctx, &resourcepb.ReadRequest{Key: createPlaylistKey(namespace, name)})
		require.NoError(t, err)
		require.Nil(t, readResp.Error, "resource %s should be readable before corruption", name)
	}

	// Simulate the older instance: blank out key_path for every row in the
	// namespace, mimicking a write that never populated it.
	corrupted := clearKeyPaths(t, db, ctx, namespace)
	require.Equal(t, count, corrupted, "expected to blank one key_path per resource")

	// With an empty key_path the row is invisible to key-range scans, so the
	// resource must now read as not found.
	for _, name := range names {
		readResp, err := server.Read(ctx, &resourcepb.ReadRequest{Key: createPlaylistKey(namespace, name)})
		require.NoError(t, err)
		require.NotNil(t, readResp.Error, "resource %s should be unreadable while key_path is empty", name)
		require.Equal(t, int32(404), readResp.Error.Code)
	}

	// Run the reconciler; it must repair exactly the rows we blanked.
	fixed, err := reconciler.ReconcileKeyPathsNow(ctx)
	require.NoError(t, err)
	require.GreaterOrEqual(t, fixed, count, "reconciler should backfill at least the blanked rows")

	// No empty key_path rows should remain in the namespace.
	require.Zero(t, countEmptyKeyPaths(t, db, ctx, namespace))

	// Resources are readable again with their original content.
	for i, name := range names {
		readResp, err := server.Read(ctx, &resourcepb.ReadRequest{Key: createPlaylistKey(namespace, name)})
		require.NoError(t, err)
		require.Nil(t, readResp.Error, "resource %s should be readable after reconcile", name)
		require.Contains(t, string(readResp.Value), fmt.Sprintf("KeyPath Playlist %d", i+1))
	}

	// Running again is a no-op.
	fixed, err = reconciler.ReconcileKeyPathsNow(ctx)
	require.NoError(t, err)
	require.Zero(t, fixed, "second reconcile pass should find nothing to fix")
}

func clearKeyPaths(t *testing.T, db sqldb.DB, ctx context.Context, namespace string) int {
	t.Helper()
	query := buildCrossDatabaseQuery(db.DriverName(), "UPDATE resource_history SET key_path = '' WHERE namespace = ?")
	res, err := db.ExecContext(ctx, query, namespace)
	require.NoError(t, err)
	n, err := res.RowsAffected()
	require.NoError(t, err)
	return int(n)
}

func countEmptyKeyPaths(t *testing.T, db sqldb.DB, ctx context.Context, namespace string) int {
	t.Helper()
	query := buildCrossDatabaseQuery(db.DriverName(), "SELECT COUNT(*) FROM resource_history WHERE namespace = ? AND key_path = ''")
	row := db.QueryRowContext(ctx, query, namespace)
	var n int
	require.NoError(t, row.Scan(&n))
	return n
}
