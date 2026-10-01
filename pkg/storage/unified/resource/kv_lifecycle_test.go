package resource

// Unit tests for the resource KV lifecycle hooks (clear-on-create and async delete cleanup).
//
// Test matrix:
//  1. create_clears_stale_kv_rows          — pre-existing KV for the name is wiped by a successful create.
//  2. create_bad_request_preserves_rows    — a validation failure in newEvent never reaches the KV clear.
//  3. create_conflict_preserves_rows       — a failed create (name already exists) leaves the live
//                                           object's KV untouched.
//  4. delete_async_removes_kv_rows         — successful delete enqueues cleanup; rows gone eventually.
//  5. kv_failure_does_not_fail_create      — KV errors on clear are best-effort; create still succeeds.
//  6. nil_kvstore_no_panic                 — toggle-off (nil KVStore) preserves normal create/delete.

import (
	"context"
	"errors"
	"io"
	"iter"
	"net/http"
	"testing"
	"time"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// ─── helpers ────────────────────────────────────────────────────────────────

// failKeysKV wraps a KV and makes every Keys() call yield one error and stop.
// This causes ResourceKVStore.DeleteAllForName to fail, letting tests verify that
// a KV error during clear-on-create does not propagate to the caller.
type failKeysKV struct {
	inner KV
	err   error
}

func (f *failKeysKV) Keys(_ context.Context, _ string, _ ListOptions) iter.Seq2[string, error] {
	return func(yield func(string, error) bool) {
		yield("", f.err) // inject one error, then stop
	}
}

func (f *failKeysKV) Get(ctx context.Context, section, key string) (io.ReadCloser, error) {
	return f.inner.Get(ctx, section, key)
}

func (f *failKeysKV) BatchGet(ctx context.Context, section string, keys []string) iter.Seq2[KeyValue, error] {
	return f.inner.BatchGet(ctx, section, keys)
}

func (f *failKeysKV) Save(ctx context.Context, section, key string) (io.WriteCloser, error) {
	return f.inner.Save(ctx, section, key)
}

func (f *failKeysKV) Delete(ctx context.Context, section, key string) error {
	return f.inner.Delete(ctx, section, key)
}

func (f *failKeysKV) BatchDelete(ctx context.Context, section string, keys []string) error {
	return f.inner.BatchDelete(ctx, section, keys)
}

func (f *failKeysKV) UnixTimestamp(ctx context.Context) (int64, error) {
	return f.inner.UnixTimestamp(ctx)
}

func (f *failKeysKV) Batch(ctx context.Context, section string, ops []BatchOp) error {
	return f.inner.Batch(ctx, section, ops)
}

// kvLifecycleFixture is the shared test setup for lifecycle tests.
type kvLifecycleFixture struct {
	ctx     context.Context
	srv     *server
	kvStore *kv.ResourceKVStore
	rawKV   KV // the underlying KV shared by backend and ResourceKVStore
}

// newKVLifecycleFixture builds an in-memory server with a KV-backed storage backend
// and a ResourceKVStore sharing the same underlying KV, so test assertions can
// inspect row presence directly through the store.
func newKVLifecycleFixture(t *testing.T) *kvLifecycleFixture {
	t.Helper()

	db, err := badger.Open(badger.DefaultOptions("").
		WithInMemory(true).
		WithLogger(nil))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	rawKV := NewBadgerKV(db)

	store, err := NewKVStorageBackend(KVBackendOptions{KvStore: rawKV})
	require.NoError(t, err)

	kvStore := kv.NewResourceKVStore(rawKV)

	testUser := &identity.StaticRequester{
		Type:           authlib.TypeUser,
		Login:          "testuser",
		UserID:         1,
		UserUID:        "u1",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true,
	}
	ctx := authlib.WithAuthInfo(context.Background(), testUser)

	srv, err := NewResourceServer(ResourceServerOptions{
		Backend: store,
		KVStore: kvStore,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		stopCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Stop(stopCtx)
	})

	return &kvLifecycleFixture{ctx: ctx, srv: srv, kvStore: kvStore, rawKV: rawKV}
}

// playlistJSON builds a minimal valid Playlist JSON body for the given name and namespace.
func playlistJSON(name, namespace string) []byte {
	return []byte(`{
		"apiVersion": "playlist.grafana.app/v0alpha1",
		"kind": "Playlist",
		"metadata": {
			"name": "` + name + `",
			"uid": "test-uid-` + name + `",
			"namespace": "` + namespace + `"
		},
		"spec": {
			"title": "lifecycle test",
			"interval": "5m",
			"items": []
		}
	}`)
}

// playlistKey builds a ResourceKey for the given name in the "default" namespace.
func playlistKey(name string) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{
		Group:     "playlist.grafana.app",
		Resource:  "playlists",
		Namespace: "default",
		Name:      name,
	}
}

// playlistParent returns the kv.ResourceParent for the given resource name.
func playlistParent(name string) kv.ResourceParent {
	return kv.ResourceParent{
		Group:     "playlist.grafana.app",
		Resource:  "playlists",
		Namespace: "default",
		Name:      name,
	}
}

const testKVOwner = "usageinsights.grafana.app"
const testKVKey = "stats"

// seedKVRow writes a single KV entry under the given resource name.
func seedKVRow(t *testing.T, kvStore *kv.ResourceKVStore, ctx context.Context, name string) {
	t.Helper()
	err := kvStore.Save(ctx, playlistParent(name), testKVOwner, testKVKey, []byte(`{"views":1}`), "test")
	require.NoError(t, err, "seeding KV row for %q", name)
}

// kvRowCount returns how many KV rows exist for the given resource name.
func kvRowCount(t *testing.T, kvStore *kv.ResourceKVStore, ctx context.Context, name string) int {
	t.Helper()
	keys, err := kvStore.Keys(ctx, playlistParent(name), kv.ListOptions{})
	require.NoError(t, err)
	return len(keys)
}

// ─── tests ───────────────────────────────────────────────────────────────────

// TestKVLifecycle_Create_ClearsStaleRows verifies that:
// a Create wipes the name's KV prefix before the object is stored,
// so a re-created (or restored) resource always starts with empty KV
// even when the delete-time async cleanup hasn't run yet.
func TestKVLifecycle_Create_ClearsStaleRows(t *testing.T) {
	t.Parallel()
	f := newKVLifecycleFixture(t)

	const name = "kv-create-clear-test"

	// Seed stale rows that would be left by a previous incarnation's delete cleanup failing.
	seedKVRow(t, f.kvStore, f.ctx, name)
	require.Equal(t, 1, kvRowCount(t, f.kvStore, f.ctx, name), "pre-condition: KV row must exist before create")

	// Create the resource.
	rsp, err := f.srv.Create(f.ctx, &resourcepb.CreateRequest{
		Key:   playlistKey(name),
		Value: playlistJSON(name, "default"),
	})
	require.NoError(t, err)
	require.Nil(t, rsp.Error, "create must succeed")

	// The clear-on-create must have removed the stale row.
	assert.Equal(t, 0, kvRowCount(t, f.kvStore, f.ctx, name),
		"KV rows for the new incarnation must be empty after create (clear-on-create)")
}

// TestKVLifecycle_Create_BadRequest_PreservesRows verifies that a Create that fails
// inside newEvent (before the KV clear runs) does NOT touch existing KV rows.
// A namespace mismatch triggers a 400 in newEvent, which returns early.
func TestKVLifecycle_Create_BadRequest_PreservesRows(t *testing.T) {
	t.Parallel()
	f := newKVLifecycleFixture(t)

	const name = "kv-badreq-test"

	seedKVRow(t, f.kvStore, f.ctx, name)
	require.Equal(t, 1, kvRowCount(t, f.kvStore, f.ctx, name))

	// Build a body with a different namespace so newEvent returns 400 before reaching the clear.
	body := []byte(`{
		"apiVersion": "playlist.grafana.app/v0alpha1",
		"kind": "Playlist",
		"metadata": {
			"name": "` + name + `",
			"uid": "uid-badreq",
			"namespace": "wrong-namespace"
		},
		"spec": { "title": "t", "interval": "5m", "items": [] }
	}`)
	rsp, err := f.srv.Create(f.ctx, &resourcepb.CreateRequest{
		Key:   playlistKey(name), // namespace: "default"
		Value: body,              // namespace: "wrong-namespace"
	})
	require.NoError(t, err, "bad-request creates return the error in rsp.Error, not as a gRPC error")
	require.NotNil(t, rsp.Error, "create must fail with a bad-request error")

	// KV rows must be untouched: the clear never ran.
	assert.Equal(t, 1, kvRowCount(t, f.kvStore, f.ctx, name),
		"KV rows must not be cleared when create fails before the clear (bad-request path)")
}

// TestKVLifecycle_Create_Conflict_PreservesRows checks that a create failing because
// the name already exists doesn't touch the live object's KV rows.
func TestKVLifecycle_Create_Conflict_PreservesRows(t *testing.T) {
	t.Parallel()
	f := newKVLifecycleFixture(t)

	const name = "kv-conflict-test"

	// Create the resource successfully.
	rsp, err := f.srv.Create(f.ctx, &resourcepb.CreateRequest{
		Key:   playlistKey(name),
		Value: playlistJSON(name, "default"),
	})
	require.NoError(t, err)
	require.Nil(t, rsp.Error, "first create must succeed")

	// Write KV rows for the live object.
	seedKVRow(t, f.kvStore, f.ctx, name)
	require.Equal(t, 1, kvRowCount(t, f.kvStore, f.ctx, name), "KV row must exist after seeding")

	// Try to create the same name again — ErrResourceAlreadyExists has Reason=AlreadyExists
	// (not Reason=Conflict), so apierrors.IsConflict returns false and the server returns
	// the error as rsp.Error (HTTP 409) rather than as a gRPC Aborted status.
	rsp2, err2 := f.srv.Create(f.ctx, &resourcepb.CreateRequest{
		Key:   playlistKey(name),
		Value: playlistJSON(name, "default"),
	})
	require.NoError(t, err2, "duplicate create must not return a gRPC-level error (AlreadyExists → rsp.Error)")
	require.NotNil(t, rsp2, "response object must be non-nil for response-level errors")
	require.NotNil(t, rsp2.Error, "duplicate create must set rsp.Error (name already exists)")
	assert.EqualValues(t, http.StatusConflict, rsp2.Error.Code,
		"duplicate create must report HTTP 409 Conflict")

	assert.Equal(t, 1, kvRowCount(t, f.kvStore, f.ctx, name),
		"existing object's KV rows must not be wiped by a failed create")
}

// TestKVLifecycle_Delete_AsyncKVCleanup verifies that:
// a successful delete launches a goroutine that eventually removes all KV rows
// for the deleted resource's name; rows for other names are not affected.
func TestKVLifecycle_Delete_AsyncKVCleanup(t *testing.T) {
	t.Parallel()
	f := newKVLifecycleFixture(t)

	const name = "kv-delete-cleanup-test"
	const otherName = "kv-delete-other-test"

	// Create and seed KV for the resource under test.
	createRsp, err := f.srv.Create(f.ctx, &resourcepb.CreateRequest{
		Key:   playlistKey(name),
		Value: playlistJSON(name, "default"),
	})
	require.NoError(t, err)
	require.Nil(t, createRsp.Error)
	seedKVRow(t, f.kvStore, f.ctx, name)
	require.Equal(t, 1, kvRowCount(t, f.kvStore, f.ctx, name))

	// Seed KV for a different resource; it must be left alone.
	seedKVRow(t, f.kvStore, f.ctx, otherName)
	require.Equal(t, 1, kvRowCount(t, f.kvStore, f.ctx, otherName))

	// Soft-delete the resource. This triggers the async goroutine.
	delRsp, err := f.srv.Delete(f.ctx, &resourcepb.DeleteRequest{
		Key:             playlistKey(name),
		ResourceVersion: createRsp.ResourceVersion,
	})
	require.NoError(t, err)
	require.Nil(t, delRsp.Error, "delete must succeed")

	// The async goroutine must eventually remove the rows for the deleted name.
	require.Eventually(t, func() bool {
		return kvRowCount(t, f.kvStore, f.ctx, name) == 0
	}, 5*time.Second, 10*time.Millisecond,
		"KV rows for the deleted resource must be asynchronously cleaned up")

	// Rows for the unrelated resource must be untouched.
	assert.Equal(t, 1, kvRowCount(t, f.kvStore, f.ctx, otherName),
		"KV rows for other resources must not be affected by the delete cleanup")
}

// TestKVLifecycle_KVFailure_CreateSucceeds verifies that a KV failure during
// clear-on-create is best-effort: it is logged and never prevents the create
// from succeeding (clear-on-create is synchronous but best-effort).
func TestKVLifecycle_KVFailure_CreateSucceeds(t *testing.T) {
	t.Parallel()

	// Build a backend using the real KV, but give the ResourceKVStore a failing KV.
	db, err := badger.Open(badger.DefaultOptions("").
		WithInMemory(true).
		WithLogger(nil))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	realKV := NewBadgerKV(db)

	store, err := NewKVStorageBackend(KVBackendOptions{KvStore: realKV})
	require.NoError(t, err)

	// Wrap the real KV in one that returns an error on Keys(), so
	// ResourceKVStore.DeleteAllForName always fails.
	failingKV := &failKeysKV{inner: realKV, err: errors.New("injected KV failure")}
	kvStore := kv.NewResourceKVStore(failingKV)

	testUser := &identity.StaticRequester{
		Type:           authlib.TypeUser,
		Login:          "testuser",
		UserID:         1,
		UserUID:        "u1",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true,
	}
	ctx := authlib.WithAuthInfo(context.Background(), testUser)

	srv, err := NewResourceServer(ResourceServerOptions{
		Backend: store,
		KVStore: kvStore,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		stopCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Stop(stopCtx)
	})

	// Create must succeed even though the KV clear fails.
	const name = "kv-failing-kv-test"
	rsp, err := srv.Create(ctx, &resourcepb.CreateRequest{
		Key:   playlistKey(name),
		Value: playlistJSON(name, "default"),
	})
	require.NoError(t, err)
	assert.Nil(t, rsp.Error, "create must succeed even when the KV clear-on-create fails (best-effort)")
	assert.Positive(t, rsp.ResourceVersion, "resource version must be populated on success")
}

// TestKVLifecycle_NilKVStore_NoPanic verifies the toggle-off path: when KVStore is nil
// (feature toggle off), create and delete work exactly as before and do not panic.
func TestKVLifecycle_NilKVStore_NoPanic(t *testing.T) {
	t.Parallel()

	db, err := badger.Open(badger.DefaultOptions("").
		WithInMemory(true).
		WithLogger(nil))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	store, err := NewKVStorageBackend(KVBackendOptions{KvStore: NewBadgerKV(db)})
	require.NoError(t, err)

	testUser := &identity.StaticRequester{
		Type:           authlib.TypeUser,
		Login:          "testuser",
		UserID:         1,
		UserUID:        "u1",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true,
	}
	ctx := authlib.WithAuthInfo(context.Background(), testUser)

	// KVStore is nil (toggle off).
	srv, err := NewResourceServer(ResourceServerOptions{
		Backend: store,
		KVStore: nil,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		stopCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Stop(stopCtx)
	})

	const name = "kv-nil-store-test"

	// Create must succeed without panicking.
	createRsp, err := srv.Create(ctx, &resourcepb.CreateRequest{
		Key:   playlistKey(name),
		Value: playlistJSON(name, "default"),
	})
	require.NoError(t, err)
	assert.Nil(t, createRsp.Error, "create must succeed with nil KVStore (toggle off)")

	// Delete must also succeed without panicking.
	delRsp, err := srv.Delete(ctx, &resourcepb.DeleteRequest{
		Key:             playlistKey(name),
		ResourceVersion: createRsp.ResourceVersion,
	})
	require.NoError(t, err)
	assert.Nil(t, delRsp.Error, "delete must succeed with nil KVStore (toggle off)")
}

// TestKVLifecycle_Update_PreservesRows checks that updating an object leaves its
// KV rows untouched; only create and delete affect them.
func TestKVLifecycle_Update_PreservesRows(t *testing.T) {
	t.Parallel()
	f := newKVLifecycleFixture(t)

	const name = "kv-update-test"

	created, err := f.srv.Create(f.ctx, &resourcepb.CreateRequest{
		Key:   playlistKey(name),
		Value: playlistJSON(name, "default"),
	})
	require.NoError(t, err)
	require.Nil(t, created.Error)

	seedKVRow(t, f.kvStore, f.ctx, name)
	require.Equal(t, 1, kvRowCount(t, f.kvStore, f.ctx, name))

	updated, err := f.srv.Update(f.ctx, &resourcepb.UpdateRequest{
		Key:             playlistKey(name),
		Value:           playlistJSON(name, "default"),
		ResourceVersion: created.ResourceVersion,
	})
	require.NoError(t, err)
	require.Nil(t, updated.Error, "update must succeed")

	assert.Equal(t, 1, kvRowCount(t, f.kvStore, f.ctx, name), "update must not touch the object's KV rows")
}
