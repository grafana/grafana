package test

import (
	"bytes"
	"context"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationSQLKVSearchSnapshotSections verifies that SqlKV routes
// the search/snapshot-manifest and search/snapshot-data sections to
// their dedicated tables and round-trips arbitrary binary values. The
// data section stores Bleve index chunks, which are not UTF-8 safe and
// can reach the default 10 MiB chunk size. Runs against every supported
// database in CI so Postgres BYTEA, MySQL LONGBLOB, and SQLite BLOB are
// all covered.
func TestIntegrationSQLKVSearchSnapshotSections(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Cleanup(db.CleanupTestDB)

	store := newSQLKVForTest(t)

	cases := []struct {
		name  string
		value []byte
	}{
		{
			// Includes NUL and high bytes — would silently truncate or
			// fail on a TEXT column.
			name:  "small_binary",
			value: []byte{0x00, 0x01, 0xff, 0xfe, 'a', 'b', 'c', 0x00, 0xde, 0xad},
		},
		{
			// Matches defaultKVChunkSize in the search package.
			name:  "10MiB_binary",
			value: bytes.Repeat([]byte{0xde, 0xad, 0xbe, 0xef}, 10*1024*1024/4),
		},
	}

	for _, section := range []string{kv.SearchSnapshotManifestSection, kv.SearchSnapshotDataSection} {
		for _, c := range cases {
			t.Run(section+"/"+c.name, func(t *testing.T) {
				ctx := t.Context()
				key := "ns/res/group/01HQABCDEFGHJKMNPQRSTVWXYZ/000000"

				w, err := store.Save(ctx, section, key)
				require.NoError(t, err)
				n, err := w.Write(c.value)
				require.NoError(t, err)
				assert.Equal(t, len(c.value), n)
				require.NoError(t, w.Close())

				r, err := store.Get(ctx, section, key)
				require.NoError(t, err)
				got, err := io.ReadAll(r)
				require.NoError(t, err)
				require.NoError(t, r.Close())
				assert.True(t, bytes.Equal(c.value, got), "round-tripped value should match original bytes")

				// Listing only returns keys from this section's table.
				var found []string
				for k, err := range store.Keys(ctx, section, kv.ListOptions{}) {
					require.NoError(t, err)
					found = append(found, k)
				}
				assert.Equal(t, []string{key}, found)

				require.NoError(t, store.Delete(ctx, section, key))
				_, err = store.Get(ctx, section, key)
				require.ErrorIs(t, err, kv.ErrNotFound)
			})
		}
	}
}

func newSQLKVForTest(t *testing.T) resource.KV {
	t.Helper()
	ctx := context.Background()
	dbstore := db.InitTestDB(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)
	dbConn, err := eDB.Init(ctx)
	require.NoError(t, err)
	store, err := kv.NewSQLKV(dbConn.SqlDB(), dbConn.DriverName())
	require.NoError(t, err)
	return store
}
