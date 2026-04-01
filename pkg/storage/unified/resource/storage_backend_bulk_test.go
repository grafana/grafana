package resource

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"

	kvpkg "github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
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

type importBatchWriter interface {
	InsertDataImportBatch(ctx context.Context, rows []kvpkg.DataImportRow) error
}

type failAfterImportKV struct {
	KV
	writer    importBatchWriter
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

func TestKVStorageBackendProcessBulkRollsBackOnImportBatchError(t *testing.T) {
	sqlKV := setupSqlKV(t)
	writer, ok := sqlKV.(importBatchWriter)
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

func collectBulkImportNames(t *testing.T, backend *kvStorageBackend, namespace string) []string {
	t.Helper()

	names := make([]string, 0)
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
