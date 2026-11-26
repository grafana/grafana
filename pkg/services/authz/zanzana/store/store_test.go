package store

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/oklog/ulid/v2"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestSqliteConnectionString(t *testing.T) {
	testCases := []struct {
		desc string
		in   string
		out  string
	}{
		{
			desc: "production database shares the hardcoded zanzana.db",
			in:   "file:/var/lib/grafana/grafana.db?cache=private",
			out:  "file:/var/lib/grafana/zanzana.db",
		},
		{
			desc: "legacy shared test database gets a per-database sibling",
			in:   "file:/home/u/.cache/grafana-test/grafana-test-123.db",
			out:  "file:/home/u/.cache/grafana-test/zanzana-test-123.db",
		},
		{
			desc: "NewTestStore database gets a per-database sibling",
			in:   "file:/tmp/grafana-test-sqlite-abc.db?cache=private&mode=rwc",
			out:  "file:/tmp/zanzana-test-sqlite-abc.db?cache=private&mode=rwc",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			assert.Equal(t, tc.out, sqliteConnectionString(tc.in))
		})
	}
}

// A read waiting for a connection from an exhausted pool must still honour its
// context, otherwise cancelled requests pile up behind the pool and never return.
func TestIntegrationReadHonoursDeadlineWhenPoolExhausted(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	cfg := setting.NewCfg()
	testStore := sqlstore.NewTestStore(t, sqlstore.WithCfg(cfg))
	if testStore.GetDialect().DriverName() == migrator.SQLite {
		t.Skip("OpenFGA's SQLite datastore does not apply max_open_conn, so its pool cannot be exhausted")
	}
	cfg.Raw.Section("database").Key("max_open_conn").SetValue("1")
	cfg.Raw.Section("database").Key("max_idle_conn").SetValue("1")

	ds, err := NewEmbeddedStore(cfg, testStore, log.NewNopLogger())
	require.NoError(t, err)
	t.Cleanup(ds.Close)

	ctx := context.Background()
	storeID := ulid.Make().String()
	for b := range 5 {
		writes := make(storage.Writes, 0, 100)
		for i := range 100 {
			writes = append(writes, &openfgav1.TupleKey{Object: fmt.Sprintf("doc:%d", b*100+i), Relation: "viewer", User: "user:1"})
		}
		require.NoError(t, ds.Write(ctx, storeID, nil, writes))
	}
	filter := storage.ReadFilter{Object: "doc:"}

	// An iterator keeps its connection until its rows are drained or it is stopped.
	holder, err := ds.Read(ctx, storeID, filter, storage.ReadOptions{})
	require.NoError(t, err)
	_, err = holder.Next(ctx)
	require.NoError(t, err)

	reqCtx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
	defer cancel()

	done := make(chan error, 1)
	go func() {
		it, err := ds.Read(reqCtx, storeID, filter, storage.ReadOptions{})
		if err != nil {
			done <- err
			return
		}
		defer it.Stop()
		_, err = it.Next(reqCtx)
		done <- err
	}()

	select {
	case err := <-done:
		holder.Stop()
		require.ErrorIs(t, err, context.DeadlineExceeded)
	case <-time.After(10 * time.Second):
		holder.Stop()
		<-done
		t.Fatal("read blocked on the exhausted pool past its deadline")
	}
}
