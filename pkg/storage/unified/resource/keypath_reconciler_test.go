package resource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/sql/rvmanager"
)

func TestKeyPathForEmptyRow(t *testing.T) {
	microRV := int64(1_700_000_000_000_000)
	snowflakeRV := rvmanager.SnowflakeFromRV(microRV)

	tests := []struct {
		name string
		row  kv.EmptyKeyPathRow
		want string
	}{
		{
			name: "namespaced created",
			row: kv.EmptyKeyPathRow{
				GUID: "g1", Group: "playlist.grafana.app", Resource: "playlists",
				Namespace: "default", Name: "p1", ResourceVersion: microRV, Action: 1, Folder: "",
			},
			want: "unified/data/playlist.grafana.app/playlists/default/p1/" +
				intToStr(snowflakeRV) + "~created~",
		},
		{
			name: "namespaced updated with folder",
			row: kv.EmptyKeyPathRow{
				GUID: "g2", Group: "dashboard.grafana.app", Resource: "dashboards",
				Namespace: "default", Name: "d1", ResourceVersion: microRV, Action: 2, Folder: "fold",
			},
			want: "unified/data/dashboard.grafana.app/dashboards/default/d1/" +
				intToStr(snowflakeRV) + "~updated~fold",
		},
		{
			name: "cluster scoped deleted (empty namespace)",
			row: kv.EmptyKeyPathRow{
				GUID: "g3", Group: "iam.grafana.app", Resource: "roles",
				Namespace: "", Name: "admin", ResourceVersion: microRV, Action: 3, Folder: "",
			},
			want: "unified/data/iam.grafana.app/roles/admin/" +
				intToStr(snowflakeRV) + "~deleted~",
		},
		{
			name: "resource_version already snowflake is left unchanged",
			row: kv.EmptyKeyPathRow{
				GUID: "g4", Group: "playlist.grafana.app", Resource: "playlists",
				Namespace: "default", Name: "p2", ResourceVersion: snowflakeRV, Action: 1, Folder: "",
			},
			want: "unified/data/playlist.grafana.app/playlists/default/p2/" +
				intToStr(snowflakeRV) + "~created~",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := keyPathForEmptyRow(tc.row)
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}

	t.Run("invalid action", func(t *testing.T) {
		_, err := keyPathForEmptyRow(kv.EmptyKeyPathRow{GUID: "x", Action: 9})
		require.Error(t, err)
	})
}

// fakeBackfiller is an in-memory keyPathBackfiller for exercising the reconcile
// loop without a database.
type fakeBackfiller struct {
	rows      map[string]kv.EmptyKeyPathRow // guid -> row (empty key_path)
	fixed     map[string]string             // guid -> key_path set
	listCalls int
	// failReconstruct guids are returned by ListEmptyKeyPaths but always fail to
	// be repaired (simulating an unreconstructable row).
	batchSize int
}

func newFakeBackfiller(rows []kv.EmptyKeyPathRow) *fakeBackfiller {
	m := make(map[string]kv.EmptyKeyPathRow, len(rows))
	for _, r := range rows {
		m[r.GUID] = r
	}
	return &fakeBackfiller{rows: m, fixed: map[string]string{}}
}

func (f *fakeBackfiller) ListEmptyKeyPaths(_ context.Context, limit int) ([]kv.EmptyKeyPathRow, error) {
	f.listCalls++
	out := make([]kv.EmptyKeyPathRow, 0, limit)
	// deterministic-ish: iterate map, cap at limit
	for _, r := range f.rows {
		if len(out) >= limit {
			break
		}
		out = append(out, r)
	}
	return out, nil
}

func (f *fakeBackfiller) SetKeyPathIfEmpty(_ context.Context, guid, keyPath string) (bool, error) {
	if _, ok := f.rows[guid]; !ok {
		return false, nil
	}
	delete(f.rows, guid)
	f.fixed[guid] = keyPath
	return true, nil
}

func testBackend(t *testing.T) *kvStorageBackend {
	t.Helper()
	return &kvStorageBackend{log: log.NewNopLogger()}
}

func TestBackfillEmptyKeyPaths(t *testing.T) {
	microRV := int64(1_700_000_000_000_000)

	t.Run("no rows is a no-op", func(t *testing.T) {
		f := newFakeBackfiller(nil)
		b := testBackend(t)
		n, err := b.backfillEmptyKeyPaths(context.Background(), f)
		require.NoError(t, err)
		require.Zero(t, n)
		require.Equal(t, 1, f.listCalls)
	})

	t.Run("repairs all rows across batches", func(t *testing.T) {
		var rows []kv.EmptyKeyPathRow
		for i := 0; i < keyPathReconcileBatchSize+5; i++ {
			rows = append(rows, kv.EmptyKeyPathRow{
				GUID: uuidLike(i), Group: "g", Resource: "r",
				Namespace: "ns", Name: nameLike(i), ResourceVersion: microRV + int64(i), Action: 1,
			})
		}
		f := newFakeBackfiller(rows)
		b := testBackend(t)
		n, err := b.backfillEmptyKeyPaths(context.Background(), f)
		require.NoError(t, err)
		require.Equal(t, len(rows), n)
		require.Empty(t, f.rows, "all rows should have been repaired")
		require.Len(t, f.fixed, len(rows))
		// every fixed key_path is well formed
		for _, kp := range f.fixed {
			require.Contains(t, kp, "unified/data/g/r/ns/")
		}
	})

	t.Run("stops when a batch makes no progress", func(t *testing.T) {
		// a row with an invalid action can never be reconstructed
		f := newFakeBackfiller([]kv.EmptyKeyPathRow{{GUID: "bad", Action: 99}})
		b := testBackend(t)
		n, err := b.backfillEmptyKeyPaths(context.Background(), f)
		require.Error(t, err)
		require.Zero(t, n)
	})
}

// helpers to keep test key paths deterministic without importing extra packages
func intToStr(v int64) string {
	return itoa(v)
}

func itoa(v int64) string {
	if v == 0 {
		return "0"
	}
	neg := v < 0
	if neg {
		v = -v
	}
	var buf [20]byte
	i := len(buf)
	for v > 0 {
		i--
		buf[i] = byte('0' + v%10)
		v /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

func uuidLike(i int) string { return "guid-" + itoa(int64(i)) }
func nameLike(i int) string { return "name-" + itoa(int64(i)) }
