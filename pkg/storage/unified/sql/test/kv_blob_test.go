package test

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationKVBlobSupportOnResourceBlob(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	dbstore := db.NewTestStore(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)
	dbConn, err := eDB.Init(ctx)
	require.NoError(t, err)
	sqlKV, err := kv.NewSQLKV(dbConn.SqlDB(), dbConn.DriverName())
	require.NoError(t, err)

	kvBlobs := resource.NewKVBlobSupport(sqlKV)
	sqlBackend, err := sql.NewBackend(sql.BackendOptions{DBProvider: eDB})
	require.NoError(t, err)
	svc, ok := sqlBackend.(services.Service)
	require.True(t, ok)
	require.NoError(t, services.StartAndAwaitRunning(ctx, svc))
	t.Cleanup(func() { _ = services.StopAndAwaitTerminated(context.Background(), svc) })
	sqlBlobs, ok := sqlBackend.(resource.BlobSupport)
	require.True(t, ok)

	key := &resourcepb.ResourceKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "snapshots", Name: "snap-1"}
	put := func(store resource.BlobSupport, value string) *resourcepb.PutBlobResponse {
		rsp, err := store.PutResourceBlob(ctx, &resourcepb.PutBlobRequest{
			Resource:    key,
			Method:      resourcepb.PutBlobRequest_GRPC,
			ContentType: "application/json",
			Value:       []byte(value),
		})
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		return rsp
	}
	get := func(store resource.BlobSupport, uid string) *resourcepb.GetBlobResponse {
		rsp, err := store.GetResourceBlob(ctx, key, &utils.BlobInfo{UID: uid, MimeType: "application/json"}, true)
		require.NoError(t, err)
		return rsp
	}

	fromKV := put(kvBlobs, `{"from":"kv"}`)
	fromSQL := put(sqlBlobs, `{"from":"sql"}`)
	require.Equal(t, fromSQL.Hash, put(kvBlobs, `{"from":"sql"}`).Hash)

	t.Run("kv reads its own blob and content type from the key", func(t *testing.T) {
		rsp, err := kvBlobs.GetResourceBlob(ctx, key, &utils.BlobInfo{UID: fromKV.Uid}, true)
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		require.Equal(t, `{"from":"kv"}`, string(rsp.Value))
		require.Equal(t, "application/json", rsp.ContentType)
	})

	t.Run("sql backend reads a blob and content type written through kv", func(t *testing.T) {
		rsp := get(sqlBlobs, fromKV.Uid)
		require.Nil(t, rsp.Error)
		require.Equal(t, `{"from":"kv"}`, string(rsp.Value))
		require.Equal(t, "application/json", rsp.ContentType)
	})

	t.Run("kv reads a blob written by the sql backend", func(t *testing.T) {
		rsp := get(kvBlobs, fromSQL.Uid)
		require.Nil(t, rsp.Error)
		require.Equal(t, `{"from":"sql"}`, string(rsp.Value))
	})

	t.Run("kv does not read a blob under another resource name", func(t *testing.T) {
		other := &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: "snap-2"}
		rsp, err := kvBlobs.GetResourceBlob(ctx, other, &utils.BlobInfo{UID: fromKV.Uid}, true)
		require.NoError(t, err)
		require.Equal(t, int32(http.StatusNotFound), rsp.Error.Code)
	})

	t.Run("kv rejects signed url uploads as not implemented", func(t *testing.T) {
		rsp, err := kvBlobs.PutResourceBlob(ctx, &resourcepb.PutBlobRequest{Resource: key, Method: resourcepb.PutBlobRequest_HTTP})
		require.NoError(t, err)
		require.Equal(t, int32(http.StatusNotImplemented), rsp.Error.Code)
	})

	t.Run("kv lists and deletes blob keys", func(t *testing.T) {
		prefix := strings.Join([]string{key.Group, key.Resource, key.Namespace, key.Name}, "/") + "/"
		var keys []string
		for k, err := range sqlKV.Keys(ctx, kv.BlobDataSection, kv.ListOptions{StartKey: prefix, EndKey: kv.PrefixRangeEnd(prefix)}) {
			require.NoError(t, err)
			keys = append(keys, k)
		}
		require.Len(t, keys, 3)
		require.IsIncreasing(t, keys)
		kvKey := prefix + fromKV.Uid + "~application%2Fjson"
		require.Contains(t, keys, kvKey)

		require.NoError(t, sqlKV.Delete(ctx, kv.BlobDataSection, kvKey))
		require.Equal(t, int32(http.StatusNotFound), get(kvBlobs, fromKV.Uid).Error.Code)
		require.Equal(t, int32(http.StatusNotFound), get(sqlBlobs, fromKV.Uid).Error.Code)
	})
}
