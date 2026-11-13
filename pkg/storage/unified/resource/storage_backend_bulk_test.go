package resource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"testing"
	"testing/synctest"
	"time"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/db"
	kvpkg "github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
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

func (i *batchOnlyBulkIterator) NextBatch(ctx context.Context) bool {
	if ctx.Err() != nil {
		return false
	}
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

func TestSingleBulkRequestBatchIteratorCancellation(t *testing.T) {
	iter := newSliceBulkIterator(newBulkImportRequest("ns", "item-1", resourcepb.BulkRequest_ADDED))
	batchIter := &singleBulkRequestBatchIterator{iter: iter}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	require.False(t, batchIter.NextBatch(ctx))
	require.Equal(t, -1, iter.idx, "cancellation must not advance the underlying iterator")
	require.True(t, batchIter.NextBatch(t.Context()))
	require.Equal(t, "item-1", batchIter.Batch()[0].Key.Name)
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
			resp, err := backend.ProcessBulk(context.Background(), BulkSettings{
				Collection: []*resourcepb.ResourceKey{{
					Namespace: tc.namespace,
					Group:     testBulkImportGroup,
					Resource:  testBulkImportResource,
				}},
			}, tc.buildIter(tc.namespace))

			require.NoError(t, err)
			require.Len(t, resp.Rejected, tc.rejected)
			require.Equal(t, tc.processed, resp.Processed)
			require.Equal(t, tc.expectedRows, collectBulkImportNames(t, backend, tc.namespace))
		})
	}
}

func TestKVStorageBackendProcessBulkUsesSaveFallbackWhenBatchWriterUnavailable(t *testing.T) {
	backend := setupTestStorageBackend(t)

	const namespace = "badger-save-fallback"
	resp, err := backend.ProcessBulk(context.Background(), BulkSettings{
		Collection: []*resourcepb.ResourceKey{{
			Namespace: namespace,
			Group:     testBulkImportGroup,
			Resource:  testBulkImportResource,
		}},
	}, newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{
		newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED),
		newBulkImportRequest(namespace, "item-2", resourcepb.BulkRequest_ADDED),
	}))

	require.NoError(t, err)
	require.Empty(t, resp.Rejected)
	require.Equal(t, int64(2), resp.Processed)
	require.Equal(t, []string{"item-1", "item-2"}, collectBulkImportNames(t, backend, namespace))
	require.Equal(t, []string{"item-1", "item-2"}, collectLatestBulkImportNames(t, backend, namespace))
}

func TestKVStorageBackendProcessBulkPreservesImportedHistory(t *testing.T) {
	backend := setupTestStorageBackend(t, withKV(setupSqlKV(t)))

	const namespace = "sqlkv-history"
	resp, err := backend.ProcessBulk(context.Background(), BulkSettings{
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

	require.NoError(t, err)
	require.Empty(t, resp.Rejected)
	require.Equal(t, int64(3), resp.Processed)
	require.Equal(t, []string{"item-1", "item-1", "item-1"}, collectBulkImportNames(t, backend, namespace))
	require.Empty(t, collectLatestBulkImportNames(t, backend, namespace))
}

func TestKVStorageBackendProcessBulkRejectsEmptyBatch(t *testing.T) {
	backend := setupTestStorageBackend(t, withKV(setupSqlKV(t)))

	const namespace = "sqlkv-empty-batch"
	resp, err := backend.ProcessBulk(context.Background(), BulkSettings{
		Collection: []*resourcepb.ResourceKey{{
			Namespace: namespace,
			Group:     testBulkImportGroup,
			Resource:  testBulkImportResource,
		}},
	}, newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{}))

	require.ErrorContains(t, err, "missing request batch")
	require.Nil(t, resp)
	require.Empty(t, collectBulkImportNames(t, backend, namespace))
}

func TestKVStorageBackendProcessBulkRejectsInvalidDataKeysBeforeBatchInsert(t *testing.T) {
	backend := setupTestStorageBackend(t, withKV(setupSqlKV(t)))

	const namespace = "sqlkv-invalid-key"
	req := newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED)
	req.Folder = "bad/folder"

	resp, err := backend.ProcessBulk(context.Background(), BulkSettings{
		Collection: []*resourcepb.ResourceKey{{
			Namespace: namespace,
			Group:     testBulkImportGroup,
			Resource:  testBulkImportResource,
		}},
	}, newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{req}))

	require.NoError(t, err)
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
	resp, err := backend.ProcessBulk(context.Background(), BulkSettings{
		Collection: []*resourcepb.ResourceKey{{
			Namespace: namespace,
			Group:     testBulkImportGroup,
			Resource:  testBulkImportResource,
		}},
	}, newBatchOnlyBulkIterator(
		[]*resourcepb.BulkRequest{newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED)},
		[]*resourcepb.BulkRequest{newBulkImportRequest(namespace, "item-2", resourcepb.BulkRequest_ADDED)},
	))

	require.ErrorContains(t, err, "failed to save resource batch")
	require.Nil(t, resp)
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
			resp, err := backend.ProcessBulk(context.Background(), BulkSettings{
				Collection: []*resourcepb.ResourceKey{collKey},
			}, newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{
				newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED),
				newBulkImportRequest(namespace, "item-2", resourcepb.BulkRequest_ADDED),
				newBulkImportRequest(namespace, "item-bad", resourcepb.BulkRequest_UNKNOWN),
			}))

			require.NoError(t, err)
			require.Len(t, resp.Summary, 1, "expected one summary entry per collection key")

			summary := resp.Summary[0]
			require.Equal(t, namespace, summary.Namespace)
			require.Equal(t, testBulkImportGroup, summary.Group)
			require.Equal(t, testBulkImportResource, summary.Resource)
			require.Equal(t, int64(2), summary.Count, "only successfully written items should be counted")
			require.Equal(t, int64(0), summary.PreviousCount, "nothing existed before the first import")

			// Second import: replaces the collection with 1 item.
			resp2, err := backend.ProcessBulk(context.Background(), BulkSettings{
				Collection: []*resourcepb.ResourceKey{collKey},
			}, newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{
				newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED),
			}))

			require.NoError(t, err)
			require.Len(t, resp2.Summary, 1)

			summary2 := resp2.Summary[0]
			require.Equal(t, int64(1), summary2.Count)
			require.Equal(t, int64(2), summary2.PreviousCount, "previous import wrote 2 items")
		})
	}
}

type failLastImportKV struct {
	KV
	err error
}

func (f *failLastImportKV) Save(ctx context.Context, section string, key string) (io.WriteCloser, error) {
	if section == lastImportTimesSection {
		return nil, f.err
	}
	return f.KV.Save(ctx, section, key)
}

func TestKVStorageBackendProcessBulkReturnsLastImportError(t *testing.T) {
	want := errors.New("last import write failed")
	backend := setupTestStorageBackend(t, withKV(&failLastImportKV{KV: setupBadgerKV(t), err: want}))
	const namespace = "last-import-failure"

	resp, err := backend.ProcessBulk(t.Context(), BulkSettings{Collection: []*resourcepb.ResourceKey{{
		Namespace: namespace, Group: testBulkImportGroup, Resource: testBulkImportResource,
	}}}, newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{
		newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED),
	}))
	require.Nil(t, resp)
	require.ErrorIs(t, err, want)
	require.ErrorContains(t, err, "failed to save last import time")
}

func TestKVStorageBackendProcessBulkReturnsLockError(t *testing.T) {
	backend := setupTestStorageBackend(t)
	settings := BulkSettings{Collection: []*resourcepb.ResourceKey{{
		Namespace: "bulk-locked", Group: testBulkImportGroup, Resource: testBulkImportResource,
	}}}
	require.NoError(t, backend.bulkLock.Start(settings.Collection))
	defer backend.bulkLock.Finish(settings.Collection)

	resp, err := backend.ProcessBulk(t.Context(), settings, newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{}))
	require.Nil(t, resp)
	require.EqualValues(t, http.StatusPreconditionFailed, AsErrorResult(err).Code)
}

type checkingBulkIterator struct {
	*batchOnlyBulkIterator
	beforeNext func()
}

func (i *checkingBulkIterator) NextBatch(ctx context.Context) bool {
	i.beforeNext()
	return i.batchOnlyBulkIterator.NextBatch(ctx)
}

func TestKVStorageBackendProcessBulkLeaseAcrossBackends(t *testing.T) {
	store := setupBadgerKV(t)
	setup := func(opts *KVBackendOptions) {
		opts.KvStore = store
		opts.DisableStorageServices = true
	}
	backend := setupTestStorageBackend(t, setup)
	other := setupTestStorageBackend(t, setup)
	const namespace = "bulk-leased"
	settings := BulkSettings{Collection: []*resourcepb.ResourceKey{{
		Namespace: namespace, Group: testBulkImportGroup, Resource: testBulkImportResource,
	}}}
	importItems := func(name string) BulkRequestIterator {
		return newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{
			newBulkImportRequest(namespace, name, resourcepb.BulkRequest_ADDED),
		})
	}
	_, err := backend.ProcessBulk(t.Context(), settings, importItems("item-1"))
	require.NoError(t, err)

	_, release, err := other.acquireBulkLeases(t.Context(), settings.Collection)
	require.NoError(t, err)
	resp, err := backend.ProcessBulk(t.Context(), settings, importItems("item-2"))
	require.Nil(t, resp)
	require.EqualValues(t, http.StatusPreconditionFailed, AsErrorResult(err).Code)
	require.Equal(t, []string{"item-1"}, collectBulkImportNames(t, backend, namespace), "rejected import must leave previously imported data intact")
	release()

	_, err = backend.ProcessBulk(t.Context(), settings, &checkingBulkIterator{
		batchOnlyBulkIterator: importItems("item-1").(*batchOnlyBulkIterator),
		beforeNext: func() {
			competing, err := other.ProcessBulk(t.Context(), settings, importItems("item-2"))
			require.Nil(t, competing)
			require.EqualValues(t, http.StatusPreconditionFailed, AsErrorResult(err).Code)
		},
	})
	require.NoError(t, err)

	require.Equal(t, []string{"item-1"}, collectBulkImportNames(t, backend, namespace), "competing import must not replace the active import's data")

	// An import error must also release the lease for another backend.
	_, err = backend.ProcessBulk(t.Context(), settings, newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{}))
	require.Error(t, err)
	_, err = other.ProcessBulk(t.Context(), settings, importItems("item-2"))
	require.NoError(t, err)
	require.Equal(t, []string{"item-2"}, collectBulkImportNames(t, backend, namespace))
}

func TestKVStorageBackendProcessBulkCancellationReleasesLeaseAndRollsBack(t *testing.T) {
	backend := setupTestStorageBackend(t)
	const namespace = "bulk-canceled"
	settings := BulkSettings{Collection: []*resourcepb.ResourceKey{{
		Namespace: namespace, Group: testBulkImportGroup, Resource: testBulkImportResource,
	}}}
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	iter := &checkingBulkIterator{
		batchOnlyBulkIterator: newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{
			newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED),
		}),
	}
	iter.beforeNext = func() {
		if iter.idx == 0 {
			require.Equal(t, []string{"item-1"}, collectBulkImportNames(t, backend, namespace))
			cancel()
		}
	}
	resp, err := backend.ProcessBulk(ctx, settings, iter)
	require.Nil(t, resp)
	require.ErrorIs(t, err, context.Canceled)
	require.Equal(t, codes.Canceled, status.Code(rpcErrorFrom(err)), "a cancelled import must report only the cancellation")
	require.Empty(t, collectBulkImportNames(t, backend, namespace))
	_, release, err := backend.acquireBulkLeases(t.Context(), settings.Collection)
	require.NoError(t, err)
	release()
}

type transactionBulkTestServer struct {
	resourcepb.UnimplementedBulkStoreServer
	backend  *kvStorageBackend
	settings BulkSettings
	iter     BulkRequestIterator
}

func (s *transactionBulkTestServer) BulkProcess(stream resourcepb.BulkStore_BulkProcessServer) error {
	rsp, err := s.backend.ProcessBulk(stream.Context(), s.settings, s.iter)
	if err != nil {
		return rpcErrorFrom(err)
	}
	return stream.SendAndClose(rsp)
}

func TestKVStorageBackendProcessBulkExternalSQLiteTransaction(t *testing.T) {
	store, db := setupSqlKVWithDB(t)
	backend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
		opts.KvStore = store
		opts.DisableStorageServices = true
	})
	_, err := db.ExecContext(t.Context(), "CREATE TABLE bulk_lease_test_lock (id INTEGER)")
	require.NoError(t, err)

	synctest.Test(t, func(t *testing.T) {
		time.Sleep(time.Until(time.Date(2025, time.January, 1, 0, 0, 0, 0, time.UTC)))
		tx, err := db.BeginTx(t.Context(), nil)
		require.NoError(t, err)
		defer func() { _ = tx.Rollback() }()
		_, err = tx.ExecContext(t.Context(), "INSERT INTO bulk_lease_test_lock VALUES (1)")
		require.NoError(t, err)
		const namespace = "bulk-external-tx"
		iter := &checkingBulkIterator{
			batchOnlyBulkIterator: newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{
				newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED),
			}),
			beforeNext: func() { time.Sleep(30 * time.Second) },
		}
		channel := &inprocgrpc.Channel{}
		resourcepb.RegisterBulkStoreServer(channel, &transactionBulkTestServer{
			backend: backend,
			settings: BulkSettings{Collection: []*resourcepb.ResourceKey{{
				Namespace: namespace, Group: testBulkImportGroup, Resource: testBulkImportResource,
			}}},
			iter: iter,
		})
		stream, err := resourcepb.NewBulkStoreClient(channel).BulkProcess(ContextWithTransaction(t.Context(), tx))
		require.NoError(t, err)
		resp, err := stream.CloseAndRecv()
		require.NoError(t, err)
		require.EqualValues(t, 1, resp.Processed)
		require.NoError(t, tx.Commit())
		require.Equal(t, []string{"item-1"}, collectBulkImportNames(t, backend, namespace))
	})
}

func TestKVStorageBackendProcessBulkLeaseLossInterruptsBatchWait(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		time.Sleep(time.Until(time.Date(2025, time.January, 1, 0, 0, 0, 0, time.UTC)))
		store := setupBadgerKV(t)
		// Avoid the data store cache's permanent background goroutine inside synctest.
		backend := &kvStorageBackend{
			kv:              store,
			bulkLock:        NewBulkLock(),
			dataStore:       &dataStore{kv: store},
			eventStore:      newEventStore(store),
			lastImportStore: newLastImportStore(store),
			leaseManager:    lease.NewManager(store, "test", "storage", nil, lease.WithGarbageCollectionDisabled),
			log:             &logging.NoOpLogger{},
		}
		const namespace = "bulk-lease-lost"
		settings := BulkSettings{Collection: []*resourcepb.ResourceKey{
			{Namespace: namespace, Group: testBulkImportGroup, Resource: testBulkImportResource},
			{Namespace: "unaffected", Group: testBulkImportGroup, Resource: testBulkImportResource},
		}}
		runner := newTestBatchRunner(&testBulkProcessServer{}, settings.Collection[0], BulkBatchOptions{MaxItems: 1})
		runner.recvOnce.Do(func() { runner.recvCh = make(chan batchStreamResult, 1) })
		runner.recvCh <- batchStreamResult{request: newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED)}
		defer runner.stop()
		done := make(chan error, 1)
		go func() {
			_, err := backend.ProcessBulk(t.Context(), settings, runner)
			done <- err
		}()
		synctest.Wait()
		require.Equal(t, []string{"item-1"}, collectBulkImportNames(t, backend, namespace))

		// Simulate another holder taking over one lease before the next renewal.
		prefix := "bulk/" + testBulkImportGroup + "/" + testBulkImportResource + "/" + namespace + "~"
		keys := 0
		for key, err := range backend.KV().Keys(t.Context(), kvpkg.LeasesSection, kvpkg.ListOptions{
			StartKey: prefix, EndKey: kvpkg.PrefixRangeEnd(prefix),
		}) {
			require.NoError(t, err)
			keys++
			value, err := json.Marshal(map[string]any{"holder": "other", "expires": time.Now().Add(time.Minute).UnixNano()})
			require.NoError(t, err)
			writer, err := backend.KV().Save(t.Context(), kvpkg.LeasesSection, key)
			require.NoError(t, err)
			_, err = writer.Write(value)
			require.NoError(t, err)
			require.NoError(t, writer.Close())
		}
		require.Equal(t, 1, keys)
		time.Sleep(4 * time.Second)
		synctest.Wait()
		select {
		case err := <-done:
			require.Error(t, err)
		default:
			t.Fatal("lease loss did not interrupt the blocked batch iterator")
		}
		require.Empty(t, collectBulkImportNames(t, backend, namespace))
		_, release, err := backend.acquireBulkLeases(t.Context(), settings.Collection[1:])
		require.NoError(t, err, "unaffected leases must be released without waiting for client input")
		release()
	})
}

func TestBatchRunnerLeaseContextInterruptsBatchWait(t *testing.T) {
	for _, bufferedRequest := range []bool{false, true} {
		t.Run(fmt.Sprintf("buffered=%t", bufferedRequest), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				runner := newTestBatchRunner(&testBulkProcessServer{}, newTestBulkRequest("item-1").Key, BulkBatchOptions{MaxItems: 10})
				runner.recvOnce.Do(func() { runner.recvCh = make(chan batchStreamResult, 1) })
				if bufferedRequest {
					runner.recvCh <- batchStreamResult{request: newTestBulkRequest("item-1")}
				}
				defer runner.stop()
				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()
				done := make(chan struct{})
				go func() {
					runner.NextBatch(ctx)
					close(done)
				}()
				synctest.Wait()
				cancel()
				synctest.Wait()
				select {
				case <-done:
				default:
					t.Fatal("lease context cancellation did not interrupt batch waiting")
				}
			})
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
		Value: fmt.Appendf(nil,
			`{"apiVersion":"bulk.grafana.app/v1","kind":"Item","metadata":{"name":"%s","namespace":"%s"},"spec":{"name":"%s"}}`,
			name,
			namespace,
			name,
		),
	}
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

func TestIntegrationKVStorageBackendProcessBulkStatementTimeout(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if !db.IsTestDbPostgres() {
		t.Skip("statement_timeout is Postgres only")
	}
	store, sqlDB := setupSqlKVWithDB(t)
	ctx := t.Context()

	// Record the statement_timeout every import write runs under: history deletes and inserts, and
	// the last import time
	_, err := sqlDB.ExecContext(ctx, `CREATE TABLE kv_timeout_probe (write text, v text);
CREATE FUNCTION kv_timeout_probe() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO kv_timeout_probe VALUES (TG_TABLE_NAME || ' ' || TG_OP, current_setting('statement_timeout')); RETURN NULL; END $$;
CREATE TRIGGER kv_timeout_probe BEFORE INSERT OR DELETE ON resource_history FOR EACH STATEMENT EXECUTE FUNCTION kv_timeout_probe();
CREATE TRIGGER kv_timeout_probe BEFORE INSERT ON resource_last_import_time FOR EACH STATEMENT EXECUTE FUNCTION kv_timeout_probe();`)
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = sqlDB.ExecContext(context.Background(), `DROP TRIGGER IF EXISTS kv_timeout_probe ON resource_history;
DROP TRIGGER IF EXISTS kv_timeout_probe ON resource_last_import_time;
DROP FUNCTION IF EXISTS kv_timeout_probe();
DROP TABLE IF EXISTS kv_timeout_probe;`)
	})
	var poolDefault string
	require.NoError(t, sqlDB.QueryRowContext(ctx, "SHOW statement_timeout").Scan(&poolDefault))

	for _, tc := range []struct {
		name      string
		namespace string
		timeout   time.Duration
		want      string
	}{
		{"override applies to every write", "timeout-set", 15 * time.Minute, "15min"},
		{"unset keeps the database setting", "timeout-unset", 0, poolDefault},
	} {
		t.Run(tc.name, func(t *testing.T) {
			backend := setupTestStorageBackend(t, withKV(store), func(opts *KVBackendOptions) {
				opts.MigrationStatementTimeout = tc.timeout
			})
			namespace := tc.namespace
			importItems := func() {
				resp, err := backend.ProcessBulk(ctx, BulkSettings{
					Collection: []*resourcepb.ResourceKey{{Namespace: namespace, Group: testBulkImportGroup, Resource: testBulkImportResource}},
				}, newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{
					newBulkImportRequest(namespace, "item-1", resourcepb.BulkRequest_ADDED),
					newBulkImportRequest(namespace, "item-2", resourcepb.BulkRequest_ADDED),
				}))
				require.NoError(t, err)
				require.Empty(t, resp.Rejected)
			}
			// The second import deletes the first one's rows before inserting again
			importItems()
			_, err := sqlDB.ExecContext(ctx, "DELETE FROM kv_timeout_probe")
			require.NoError(t, err)
			importItems()

			rows, err := sqlDB.QueryContext(ctx, "SELECT write, v FROM kv_timeout_probe")
			require.NoError(t, err)
			seen := map[string][]string{}
			for rows.Next() {
				var write, v string
				require.NoError(t, rows.Scan(&write, &v))
				seen[write] = append(seen[write], v)
			}
			require.NoError(t, rows.Err())
			require.NoError(t, rows.Close())
			for _, write := range []string{"resource_history DELETE", "resource_history INSERT", "resource_last_import_time INSERT"} {
				require.NotEmpty(t, seen[write], write)
				for _, v := range seen[write] {
					require.Equal(t, tc.want, v, write)
				}
			}

			var after string
			require.NoError(t, sqlDB.QueryRowContext(ctx, "SHOW statement_timeout").Scan(&after))
			require.Equal(t, poolDefault, after, "the override ends with each write's transaction")
		})
	}
}
