package sql

import (
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestBackendInsertHistoryBatch(t *testing.T) {
	b, ctx := setupBackendTest(t)

	b.SQLMock.ExpectExec("insert into resource_history values").
		WillReturnResult(sqlmock.NewResult(0, 2))

	rsp := &resourcepb.BulkResponse{}
	err := b.insertHistoryBatch(ctx, b.db, []*resourcepb.BulkRequest{
		newSQLBulkRequest("item-1", resourcepb.BulkRequest_ADDED, []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"item-1","namespace":"default"},"spec":{"path":"d/test"}}`)),
		newSQLBulkRequest("item-2", resourcepb.BulkRequest_UNKNOWN, []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"item-2","namespace":"default"},"spec":{"path":"d/test"}}`)),
		newSQLBulkRequest("item-3", resourcepb.BulkRequest_ADDED, []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"item-3","namespace":"default"},"spec":{"path":"d/test"}}`)),
	}, newBulkRV(), rsp)
	require.NoError(t, err)
	require.Equal(t, int64(3), rsp.Processed)
	require.Len(t, rsp.Rejected, 1)
	require.Equal(t, "item-2", rsp.Rejected[0].Key.Name)
	require.Equal(t, resourcepb.BulkRequest_UNKNOWN, rsp.Rejected[0].Action)
	require.NoError(t, b.SQLMock.ExpectationsWereMet())
}

func TestBulkHistoryInsertRowLimit(t *testing.T) {
	require.Equal(t, bulkHistoryInsertSQLiteMaxRows, bulkHistoryInsertRowLimit("sqlite"))
	require.Equal(t, bulkHistoryInsertDefaultMaxRows, bulkHistoryInsertRowLimit("mysql"))
	require.Equal(t, bulkHistoryInsertDefaultMaxRows, bulkHistoryInsertRowLimit("postgres"))
}

func newSQLBulkRequest(name string, action resourcepb.BulkRequest_Action, value []byte) *resourcepb.BulkRequest {
	return &resourcepb.BulkRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "shorturl.grafana.app",
			Resource:  "shorturls",
			Name:      name,
		},
		Action: action,
		Value:  value,
	}
}
