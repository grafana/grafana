package test

import (
	"context"
	"testing"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	sqldb "github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

func TestBadgerKVStorageBackend(t *testing.T) {
	RunStorageBackendTest(t, func(ctx context.Context) resource.StorageBackend {
		opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
		db, err := badger.Open(opts)
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = db.Close()
		})
		kvOpts := resource.KVBackendOptions{
			KvStore: resource.NewBadgerKV(db),
		}
		backend, err := resource.NewKVStorageBackend(kvOpts)
		require.NoError(t, err)
		return backend
	}, &TestOptions{
		NSPrefix: "badgerkvstorage-test",
		SkipTests: map[string]bool{
			// TODO: fix these tests and remove this skip
			TestBlobSupport:       true,
			TestListModifiedSince: true,
			// Badger does not support bulk import yet.
			TestGetResourceLastImportTime: true,
		},
	})
}

func TestSQLKVStorageBackend(t *testing.T) {
	newBackendFunc := func(ctx context.Context) (resource.StorageBackend, sqldb.DB) {
		dbstore := db.InitTestDB(t)
		eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
		require.NoError(t, err)
		kv, err := resource.NewSQLKV(eDB)
		require.NoError(t, err)
		kvOpts := resource.KVBackendOptions{
			KvStore: kv,
		}
		backend, err := resource.NewKVStorageBackend(kvOpts)
		require.NoError(t, err)
		db, err := eDB.Init(ctx)
		require.NoError(t, err)
		return backend, db
	}

	RunStorageBackendTest(t, func(ctx context.Context) resource.StorageBackend {
		backend, _ := newBackendFunc(ctx)
		return backend
	}, &TestOptions{
		NSPrefix: "sqlkvstorage-test",
		SkipTests: map[string]bool{
			TestHappyPath:                 true,
			TestWatchWriteEvents:          true,
			TestList:                      true,
			TestBlobSupport:               true,
			TestGetResourceStats:          true,
			TestListHistory:               true,
			TestListHistoryErrorReporting: true,
			TestListModifiedSince:         true,
			TestListTrash:                 true,
			TestCreateNewResource:         true,
			TestGetResourceLastImportTime: true,
			TestOptimisticLocking:         true,
			TestKeyPathGeneration:         true,
		},
	})

	RunSQLStorageBackendCompatibilityTest(t, newBackendFunc, &TestOptions{
		NSPrefix: "sqlkvstorage-compatibility-test",
		SkipTests: map[string]bool{
			TestKeyPathGeneration: true,
		},
	})
}
