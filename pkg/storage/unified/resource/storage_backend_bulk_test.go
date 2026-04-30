package resource

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	infdb "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	kvpkg "github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	sqldb "github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/storage/unified/sql/rvmanager"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

const (
	testBulkImportGroup    = "bulk.grafana.app"
	testBulkImportResource = "items"
)

type batchOnlyBulkIterator struct {
	idx     int
	batches [][]*resourcepb.BulkRequest
}

func newBatchOnlyBulkIterator(batches ...[]*resourcepb.BulkRequest) *batchOnlyBulkIterator {
	return &batchOnlyBulkIterator{idx: -1, batches: batches}
}

func (i *batchOnlyBulkIterator) Next() bool {
	panic("Next should not be called when batch iteration is available")
}

func (i *batchOnlyBulkIterator) Request() *resourcepb.BulkRequest {
	return nil
}

func (i *batchOnlyBulkIterator) NextBatch() bool {
	i.idx++
	return i.idx < len(i.batches)
}

func (i *batchOnlyBulkIterator) Batch() []*resourcepb.BulkRequest {
	return i.batches[i.idx]
}

func (i *batchOnlyBulkIterator) RollbackRequested() bool {
	return false
}

type sliceBulkIterator struct {
	idx   int
	items []*resourcepb.BulkRequest
}

func newSliceBulkIterator(items ...*resourcepb.BulkRequest) *sliceBulkIterator {
	return &sliceBulkIterator{idx: -1, items: items}
}

func (i *sliceBulkIterator) Next() bool {
	i.idx++
	return i.idx < len(i.items)
}

func (i *sliceBulkIterator) Request() *resourcepb.BulkRequest {
	return i.items[i.idx]
}

func (i *sliceBulkIterator) RollbackRequested() bool {
	return false
}

type failAfterImportKV struct {
	KV
	writer    dataImportBatchWriter
	failAfter int
	calls     int
	err       error
}

func (f *failAfterImportKV) InsertDataImportBatch(ctx context.Context, rows []kvpkg.DataImportRow) error {
	f.calls++
	if f.calls > f.failAfter {
		return f.err
	}

	return f.writer.InsertDataImportBatch(ctx, rows)
}

func TestKVStorageBackendProcessBulkImportBatching(t *testing.T) {
	tests := []struct {
		name         string
		namespace    string
		buildIter    func(namespace string) BulkRequestIterator
		expectedRows []string
		rejected     int
		processed    int64
	}{
		{
			name:      "batch iterator",
			namespace: "sqlkv-batch",
			buildIter: func(namespace string) BulkRequestIterator {
				return newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{
					newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED),
					newBulkImportRequest(namespace, "item-bad", resourcepb.BulkRequest_UNKNOWN),
					newBulkImportRequest(namespace, "item-2", resourcepb.BulkRequest_ADDED),
				})
			},
			expectedRows: []string{"item-1", "item-2"},
			rejected:     1,
			processed:    3,
		},
		{
			name:      "single iterator fallback",
			namespace: "sqlkv-single",
			buildIter: func(namespace string) BulkRequestIterator {
				return newSliceBulkIterator(
					newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED),
					newBulkImportRequest(namespace, "item-2", resourcepb.BulkRequest_ADDED),
				)
			},
			expectedRows: []string{"item-1", "item-2"},
			rejected:     0,
			processed:    2,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			backend := setupTestStorageBackend(t, withKV(setupSqlKV(t)))
			resp := backend.ProcessBulk(context.Background(), BulkSettings{
				Collection: []*resourcepb.ResourceKey{{
					Namespace: tc.namespace,
					Group:     testBulkImportGroup,
					Resource:  testBulkImportResource,
				}},
			}, tc.buildIter(tc.namespace))

			require.Nil(t, resp.Error)
			require.Len(t, resp.Rejected, tc.rejected)
			require.Equal(t, tc.processed, resp.Processed)
			require.Equal(t, tc.expectedRows, collectBulkImportNames(t, backend, tc.namespace))
		})
	}
}

func TestKVStorageBackendProcessBulkUsesSaveFallbackWhenBatchWriterUnavailable(t *testing.T) {
	backend := setupTestStorageBackend(t)

	const namespace = "badger-save-fallback"
	resp := backend.ProcessBulk(context.Background(), BulkSettings{
		Collection: []*resourcepb.ResourceKey{{
			Namespace: namespace,
			Group:     testBulkImportGroup,
			Resource:  testBulkImportResource,
		}},
	}, newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{
		newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED),
		newBulkImportRequest(namespace, "item-2", resourcepb.BulkRequest_ADDED),
	}))

	require.Nil(t, resp.Error)
	require.Empty(t, resp.Rejected)
	require.Equal(t, int64(2), resp.Processed)
	require.Equal(t, []string{"item-1", "item-2"}, collectBulkImportNames(t, backend, namespace))
	require.Equal(t, []string{"item-1", "item-2"}, collectLatestBulkImportNames(t, backend, namespace))
}

func TestKVStorageBackendProcessBulkPreservesImportedHistory(t *testing.T) {
	backend := setupTestStorageBackend(t, withKV(setupSqlKV(t)))

	const namespace = "sqlkv-history"
	resp := backend.ProcessBulk(context.Background(), BulkSettings{
		Collection: []*resourcepb.ResourceKey{{
			Namespace: namespace,
			Group:     testBulkImportGroup,
			Resource:  testBulkImportResource,
		}},
	}, newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{
		newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED),
		newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED),
		newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_DELETED),
	}))

	require.Nil(t, resp.Error)
	require.Empty(t, resp.Rejected)
	require.Equal(t, int64(3), resp.Processed)
	require.Equal(t, []string{"item-1", "item-1", "item-1"}, collectBulkImportNames(t, backend, namespace))
	require.Empty(t, collectLatestBulkImportNames(t, backend, namespace))
}

func TestKVStorageBackendProcessBulkWritesLegacyHistoryFieldsUpFront(t *testing.T) {
	backend, dbConn := setupCompatSqlKVStorageBackend(t)

	const namespace = "sqlkv-compat-history"
	resp := backend.ProcessBulk(context.Background(), BulkSettings{
		Collection: []*resourcepb.ResourceKey{{
			Namespace: namespace,
			Group:     testBulkImportGroup,
			Resource:  testBulkImportResource,
		}},
	}, newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{
		newBulkImportRequestWithGeneration(namespace, "item-1", resourcepb.BulkRequest_ADDED, 3),
		newBulkImportRequestWithGeneration(namespace, "item-1", resourcepb.BulkRequest_MODIFIED, 4),
		newBulkImportRequestWithGeneration(namespace, "item-1", resourcepb.BulkRequest_DELETED, 5),
	}))

	require.Nil(t, resp.Error)
	require.Empty(t, resp.Rejected)
	require.Equal(t, int64(3), resp.Processed)

	rows := collectLegacyHistoryRows(t, dbConn, namespace)
	require.Len(t, rows, 3)

	require.Equal(t, int64(1), rows[0].Action)
	require.Zero(t, rows[0].PreviousResourceVersion)
	require.Equal(t, int64(3), rows[0].Generation)

	require.Equal(t, int64(2), rows[1].Action)
	require.Equal(t, rows[0].ResourceVersion, rows[1].PreviousResourceVersion)
	require.Equal(t, int64(4), rows[1].Generation)

	require.Equal(t, int64(3), rows[2].Action)
	require.Equal(t, rows[1].ResourceVersion, rows[2].PreviousResourceVersion)
	require.Zero(t, rows[2].Generation)
}

func TestKVStorageBackendProcessBulkRejectsEmptyBatch(t *testing.T) {
	backend := setupTestStorageBackend(t, withKV(setupSqlKV(t)))

	const namespace = "sqlkv-empty-batch"
	resp := backend.ProcessBulk(context.Background(), BulkSettings{
		Collection: []*resourcepb.ResourceKey{{
			Namespace: namespace,
			Group:     testBulkImportGroup,
			Resource:  testBulkImportResource,
		}},
	}, newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{}))

	require.NotNil(t, resp.Error)
	require.Contains(t, resp.Error.Message, "missing request batch")
	require.Equal(t, int64(0), resp.Processed)
	require.Empty(t, collectBulkImportNames(t, backend, namespace))
}

func TestKVStorageBackendProcessBulkRejectsInvalidDataKeysBeforeBatchInsert(t *testing.T) {
	backend := setupTestStorageBackend(t, withKV(setupSqlKV(t)))

	const namespace = "sqlkv-invalid-key"
	req := newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED)
	req.Folder = "bad/folder"

	resp := backend.ProcessBulk(context.Background(), BulkSettings{
		Collection: []*resourcepb.ResourceKey{{
			Namespace: namespace,
			Group:     testBulkImportGroup,
			Resource:  testBulkImportResource,
		}},
	}, newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{req}))

	require.Nil(t, resp.Error)
	require.Len(t, resp.Rejected, 1)
	require.Contains(t, resp.Rejected[0].Error, "invalid data key")
	require.Equal(t, int64(1), resp.Processed)
	require.Empty(t, collectBulkImportNames(t, backend, namespace))
	require.Empty(t, collectLatestBulkImportNames(t, backend, namespace))
}

func TestKVStorageBackendProcessBulkRollsBackOnImportBatchError(t *testing.T) {
	sqlKV := setupSqlKV(t)
	writer, ok := sqlKV.(dataImportBatchWriter)
	require.True(t, ok)

	backend := setupTestStorageBackend(t, withKV(&failAfterImportKV{
		KV:        sqlKV,
		writer:    writer,
		failAfter: 1,
		err:       errors.New("batch insert failed"),
	}))

	const namespace = "sqlkv-rollback"
	resp := backend.ProcessBulk(context.Background(), BulkSettings{
		Collection: []*resourcepb.ResourceKey{{
			Namespace: namespace,
			Group:     testBulkImportGroup,
			Resource:  testBulkImportResource,
		}},
	}, newBatchOnlyBulkIterator(
		[]*resourcepb.BulkRequest{newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED)},
		[]*resourcepb.BulkRequest{newBulkImportRequest(namespace, "item-2", resourcepb.BulkRequest_ADDED)},
	))

	require.NotNil(t, resp.Error)
	require.Contains(t, resp.Error.Message, "failed to save resource batch")
	require.Empty(t, collectBulkImportNames(t, backend, namespace))
}

func TestKVStorageBackendProcessBulkReturnsSummary(t *testing.T) {
	tests := []struct {
		name    string
		backend func() *kvStorageBackend
	}{
		{
			name:    "badger kv",
			backend: func() *kvStorageBackend { return setupTestStorageBackend(t) },
		},
		{
			name:    "sql kv",
			backend: func() *kvStorageBackend { return setupTestStorageBackend(t, withKV(setupSqlKV(t))) },
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			backend := tc.backend()
			const namespace = "summary-test"
			collKey := &resourcepb.ResourceKey{
				Namespace: namespace,
				Group:     testBulkImportGroup,
				Resource:  testBulkImportResource,
			}

			// First import: 3 items, 1 rejected (unknown action).
			resp := backend.ProcessBulk(context.Background(), BulkSettings{
				Collection: []*resourcepb.ResourceKey{collKey},
			}, newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{
				newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED),
				newBulkImportRequest(namespace, "item-2", resourcepb.BulkRequest_ADDED),
				newBulkImportRequest(namespace, "item-bad", resourcepb.BulkRequest_UNKNOWN),
			}))

			require.Nil(t, resp.Error)
			require.Len(t, resp.Summary, 1, "expected one summary entry per collection key")

			summary := resp.Summary[0]
			require.Equal(t, namespace, summary.Namespace)
			require.Equal(t, testBulkImportGroup, summary.Group)
			require.Equal(t, testBulkImportResource, summary.Resource)
			require.Equal(t, int64(2), summary.Count, "only successfully written items should be counted")
			require.Equal(t, int64(0), summary.PreviousCount, "nothing existed before the first import")

			// Second import: replaces the collection with 1 item.
			resp2 := backend.ProcessBulk(context.Background(), BulkSettings{
				Collection: []*resourcepb.ResourceKey{collKey},
			}, newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{
				newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED),
			}))

			require.Nil(t, resp2.Error)
			require.Len(t, resp2.Summary, 1)

			summary2 := resp2.Summary[0]
			require.Equal(t, int64(1), summary2.Count)
			require.Equal(t, int64(2), summary2.PreviousCount, "previous import wrote 2 items")
		})
	}
}

func newBulkImportRequest(namespace, name string, action resourcepb.BulkRequest_Action) *resourcepb.BulkRequest {
	return &resourcepb.BulkRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: namespace,
			Group:     testBulkImportGroup,
			Resource:  testBulkImportResource,
			Name:      name,
		},
		Action: action,
		Value: []byte(fmt.Sprintf(
			`{"apiVersion":"bulk.grafana.app/v1","kind":"Item","metadata":{"name":"%s","namespace":"%s"},"spec":{"name":"%s"}}`,
			name,
			namespace,
			name,
		)),
	}
}

func newBulkImportRequestWithGeneration(namespace, name string, action resourcepb.BulkRequest_Action, generation int64) *resourcepb.BulkRequest {
	return &resourcepb.BulkRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: namespace,
			Group:     testBulkImportGroup,
			Resource:  testBulkImportResource,
			Name:      name,
		},
		Action: action,
		Value: []byte(fmt.Sprintf(
			`{"apiVersion":"bulk.grafana.app/v1","kind":"Item","metadata":{"name":"%s","namespace":"%s","generation":%d},"spec":{"name":"%s"}}`,
			name,
			namespace,
			generation,
			name,
		)),
	}
}

type legacyHistoryRow struct {
	Action                  int64
	ResourceVersion         int64
	PreviousResourceVersion int64
	Generation              int64
}

func setupCompatSqlKVStorageBackend(t *testing.T) (*kvStorageBackend, sqldb.DB) {
	t.Helper()

	dbstore := infdb.InitTestDB(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)
	dbConn, err := eDB.Init(context.Background())
	require.NoError(t, err)

	kvStore, err := kvpkg.NewSQLKV(dbConn.SqlDB(), dbConn.DriverName())
	require.NoError(t, err)

	rvManager, err := rvmanager.NewResourceVersionManager(rvmanager.ResourceManagerOptions{
		Dialect: sqltemplate.DialectForDriver(dbConn.DriverName()),
		DB:      dbConn,
	})
	require.NoError(t, err)

	opts := KVBackendOptions{
		KvStore:     kvStore,
		RvManager:   rvManager,
		DBKeepAlive: eDB,
		WatchOptions: WatchOptions{
			SettleDelay: time.Millisecond,
		},
	}
	if dbConn.DriverName() == "sqlite3" {
		opts.UseChannelNotifier = true
	}

	backend, err := NewKVStorageBackend(opts)
	require.NoError(t, err)

	kvBackend := backend.(*kvStorageBackend)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = kvBackend.Stop(ctx)
	})

	return kvBackend, dbConn
}

func collectLegacyHistoryRows(t *testing.T, dbConn sqldb.DB, namespace string) []legacyHistoryRow {
	t.Helper()

	dialect, err := kvpkg.DialectFromDriver(dbConn.DriverName())
	require.NoError(t, err)

	query := fmt.Sprintf(
		"SELECT %s, %s, %s, %s FROM %s WHERE %s = %s AND %s = %s AND %s = %s ORDER BY %s ASC",
		dialect.QuoteIdent("action"),
		dialect.QuoteIdent("resource_version"),
		dialect.QuoteIdent("previous_resource_version"),
		dialect.QuoteIdent("generation"),
		dialect.QuoteIdent("resource_history"),
		dialect.QuoteIdent("namespace"),
		dialect.Placeholder(1),
		dialect.QuoteIdent("group"),
		dialect.Placeholder(2),
		dialect.QuoteIdent("resource"),
		dialect.Placeholder(3),
		dialect.QuoteIdent("resource_version"),
	)

	rows, err := dbConn.QueryContext(context.Background(), query, namespace, testBulkImportGroup, testBulkImportResource)
	require.NoError(t, err)
	defer func() {
		require.NoError(t, rows.Close())
	}()

	var records []legacyHistoryRow
	for rows.Next() {
		var record legacyHistoryRow
		require.NoError(t, rows.Scan(
			&record.Action,
			&record.ResourceVersion,
			&record.PreviousResourceVersion,
			&record.Generation,
		))
		records = append(records, record)
	}

	require.NoError(t, rows.Err())
	return records
}

func collectBulkImportNames(t *testing.T, backend *kvStorageBackend, namespace string) []string {
	t.Helper()

	names := make([]string, 0, 2)
	for key, err := range backend.dataStore.Keys(context.Background(), ListRequestKey{
		Namespace: namespace,
		Group:     testBulkImportGroup,
		Resource:  testBulkImportResource,
	}, SortOrderAsc) {
		require.NoError(t, err)
		names = append(names, key.Name)
	}

	slices.Sort(names)
	return names
}

func collectLatestBulkImportNames(t *testing.T, backend *kvStorageBackend, namespace string) []string {
	t.Helper()

	names := make([]string, 0, 2)
	for key, err := range backend.dataStore.ListLatestResourceKeys(context.Background(), ListRequestKey{
		Namespace: namespace,
		Group:     testBulkImportGroup,
		Resource:  testBulkImportResource,
	}) {
		require.NoError(t, err)
		names = append(names, key.Name)
	}

	slices.Sort(names)
	return names
}
