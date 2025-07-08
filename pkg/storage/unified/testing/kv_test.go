package test

import (
	"context"
	"testing"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestBadgerKV(t *testing.T) {
	RunKVTest(t, func(ctx context.Context) resource.KV {
		opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
		db, err := badger.Open(opts)
		require.NoError(t, err)

		t.Cleanup(func() {
			err := db.Close()
			require.NoError(t, err)
		})

		return resource.NewBadgerKV(db)
	}, &KVTestOptions{
		NSPrefix: "badger-kv-test",
	})
}
