package test

import (
	"context"
	"io"
	"net/http"
	"testing"
	"uuid"

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
	env := newKVBlobTestEnv(t)

	t.Run("kv", func(t *testing.T) {
		t.Run("save overwrites an existing key", func(t *testing.T) {
			k := newBlobKey(env.newResource(t, "default"), "text/plain")
			env.save(t, k, "first")
			env.save(t, k, "second")

			value, err := env.read(t, k)
			require.NoError(t, err)
			require.Equal(t, "second", value)
			require.Equal(t, []string{k.String()}, env.keys(t, k.UIDPrefix()))
		})

		t.Run("get and delete match the content type in the key", func(t *testing.T) {
			k := newBlobKey(env.newResource(t, "default"), "text/plain")
			env.save(t, k, "plain")
			wrong := k
			wrong.ContentType = "application/json"

			_, err := env.read(t, wrong)
			require.ErrorIs(t, err, kv.ErrNotFound)

			require.NoError(t, env.kv.Delete(env.ctx, kv.BlobDataSection, wrong.String()))
			value, err := env.read(t, k)
			require.NoError(t, err)
			require.Equal(t, "plain", value)
		})

		t.Run("lists the keys of a resource in order", func(t *testing.T) {
			key := env.newResource(t, "default")
			fromKV := env.put(t, env.kvBlobs, key, "application/json", "kv")
			fromSQL := env.put(t, env.sqlBlobs, key, "text/plain", "sql")
			env.put(t, env.kvBlobs, env.newResource(t, "default"), "text/plain", "other resource")

			keys := env.keys(t, resourcePrefix(key))
			require.ElementsMatch(t, []string{
				blobKeyWithUID(key, fromKV.Uid, "application/json").String(),
				blobKeyWithUID(key, fromSQL.Uid, "text/plain").String(),
			}, keys)
			require.IsIncreasing(t, keys)
		})

		t.Run("delete removes the blob from both stores", func(t *testing.T) {
			key := env.newResource(t, "default")
			put := env.put(t, env.kvBlobs, key, "application/json", "kv")

			require.NoError(t, env.kv.Delete(env.ctx, kv.BlobDataSection, blobKeyWithUID(key, put.Uid, "application/json").String()))
			for _, s := range env.stores() {
				require.Equal(t, int32(http.StatusNotFound), env.get(t, s.store, key, put.Uid).Error.Code, s.name)
			}
		})
	})

	t.Run("blob support", func(t *testing.T) {
		for _, tc := range []struct {
			name      string
			namespace string
		}{
			{name: "namespaced", namespace: "default"},
			{name: "cluster-scoped", namespace: ""},
		} {
			t.Run(tc.name, func(t *testing.T) {
				for _, writer := range env.stores() {
					for _, reader := range env.stores() {
						t.Run(reader.name+" reads a blob written by "+writer.name, func(t *testing.T) {
							key := env.newResource(t, tc.namespace)
							put := env.put(t, writer.store, key, "application/json", `{"from":"`+writer.name+`"}`)

							rsp := env.get(t, reader.store, key, put.Uid)
							require.Nil(t, rsp.Error)
							require.Equal(t, `{"from":"`+writer.name+`"}`, string(rsp.Value))
							require.Equal(t, "application/json", rsp.ContentType)
						})
					}
				}
			})
		}

		t.Run("kv and sql backend compute the same hash", func(t *testing.T) {
			key := env.newResource(t, "default")
			require.Equal(t,
				env.put(t, env.sqlBlobs, key, "application/json", "same").Hash,
				env.put(t, env.kvBlobs, key, "application/json", "same").Hash)
		})

		t.Run("kv does not read a blob under another resource name", func(t *testing.T) {
			put := env.put(t, env.kvBlobs, env.newResource(t, "default"), "application/json", "kv")
			rsp := env.get(t, env.kvBlobs, env.newResource(t, "default"), put.Uid)
			require.Equal(t, int32(http.StatusNotFound), rsp.Error.Code)
		})

		t.Run("kv rejects signed url uploads as not implemented", func(t *testing.T) {
			rsp, err := env.kvBlobs.PutResourceBlob(env.ctx, &resourcepb.PutBlobRequest{Resource: env.newResource(t, "default"), Method: resourcepb.PutBlobRequest_HTTP})
			require.NoError(t, err)
			require.Equal(t, int32(http.StatusNotImplemented), rsp.Error.Code)
		})
	})
}

type kvBlobTestEnv struct {
	ctx      context.Context
	kv       kv.KV
	kvBlobs  resource.BlobSupport
	sqlBlobs resource.BlobSupport
}

func newKVBlobTestEnv(t *testing.T) *kvBlobTestEnv {
	t.Helper()
	ctx := context.Background()
	dbstore := db.NewTestStore(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)
	dbConn, err := eDB.Init(ctx)
	require.NoError(t, err)
	sqlKV, err := kv.NewSQLKV(dbConn.SqlDB(), dbConn.DriverName())
	require.NoError(t, err)

	sqlBackend, err := sql.NewBackend(sql.BackendOptions{DBProvider: eDB})
	require.NoError(t, err)
	svc, ok := sqlBackend.(services.Service)
	require.True(t, ok)
	require.NoError(t, services.StartAndAwaitRunning(ctx, svc))
	t.Cleanup(func() { _ = services.StopAndAwaitTerminated(context.Background(), svc) })
	sqlBlobs, ok := sqlBackend.(resource.BlobSupport)
	require.True(t, ok)

	return &kvBlobTestEnv{ctx: ctx, kv: sqlKV, kvBlobs: resource.NewKVBlobSupport(sqlKV), sqlBlobs: sqlBlobs}
}

type namedBlobStore struct {
	name  string
	store resource.BlobSupport
}

func (e *kvBlobTestEnv) stores() []namedBlobStore {
	return []namedBlobStore{{name: "kv", store: e.kvBlobs}, {name: "sql backend", store: e.sqlBlobs}}
}

func (e *kvBlobTestEnv) newResource(t *testing.T, namespace string) *resourcepb.ResourceKey {
	t.Helper()
	key := &resourcepb.ResourceKey{Namespace: namespace, Group: "dashboard.grafana.app", Resource: "snapshots", Name: "snap-" + uuid.NewV4().String()}
	t.Cleanup(func() {
		for _, k := range e.keys(t, resourcePrefix(key)) {
			require.NoError(t, e.kv.Delete(context.Background(), kv.BlobDataSection, k))
		}
	})
	return key
}

func (e *kvBlobTestEnv) put(t *testing.T, store resource.BlobSupport, key *resourcepb.ResourceKey, contentType, value string) *resourcepb.PutBlobResponse {
	t.Helper()
	rsp, err := store.PutResourceBlob(e.ctx, &resourcepb.PutBlobRequest{
		Resource:    key,
		Method:      resourcepb.PutBlobRequest_GRPC,
		ContentType: contentType,
		Value:       []byte(value),
	})
	require.NoError(t, err)
	require.Nil(t, rsp.Error)
	return rsp
}

func (e *kvBlobTestEnv) get(t *testing.T, store resource.BlobSupport, key *resourcepb.ResourceKey, uid string) *resourcepb.GetBlobResponse {
	t.Helper()
	rsp, err := store.GetResourceBlob(e.ctx, key, &utils.BlobInfo{UID: uid}, true)
	require.NoError(t, err)
	return rsp
}

func (e *kvBlobTestEnv) save(t *testing.T, k kv.BlobKey, value string) {
	t.Helper()
	w, err := e.kv.Save(e.ctx, kv.BlobDataSection, k.String())
	require.NoError(t, err)
	_, err = w.Write([]byte(value))
	require.NoError(t, err)
	require.NoError(t, w.Close())
}

func (e *kvBlobTestEnv) read(t *testing.T, k kv.BlobKey) (string, error) {
	t.Helper()
	r, err := e.kv.Get(e.ctx, kv.BlobDataSection, k.String())
	if err != nil {
		return "", err
	}
	defer func() { _ = r.Close() }()
	value, err := io.ReadAll(r)
	require.NoError(t, err)
	return string(value), nil
}

func (e *kvBlobTestEnv) keys(t *testing.T, prefix string) []string {
	t.Helper()
	var keys []string
	for k, err := range e.kv.Keys(context.Background(), kv.BlobDataSection, kv.ListOptions{StartKey: prefix, EndKey: kv.PrefixRangeEnd(prefix)}) {
		require.NoError(t, err)
		keys = append(keys, k)
	}
	return keys
}

func resourcePrefix(key *resourcepb.ResourceKey) string {
	return key.Group + "/" + key.Resource + "/" + key.Namespace + "/" + key.Name + "/"
}

func blobKeyWithUID(key *resourcepb.ResourceKey, uid, contentType string) kv.BlobKey {
	return kv.BlobKey{Group: key.Group, Resource: key.Resource, Namespace: key.Namespace, Name: key.Name, UID: uid, ContentType: contentType}
}

func newBlobKey(key *resourcepb.ResourceKey, contentType string) kv.BlobKey {
	return blobKeyWithUID(key, uuid.NewV4().String(), contentType)
}
