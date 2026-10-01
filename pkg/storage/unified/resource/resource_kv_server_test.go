package resource

// Tests for resourceKVServer — the thin gRPC adapter that delegates to a
// ResourceKVStore. All tests use an in-memory BadgerKV store (same helper as
// the kv package tests) so there are no external dependencies.
//
// Coverage targets:
//   - round-trip through every server method (Save→Get, Keys all/by-owner,
//     Delete, Batch create/update, ScanNamespace, DeleteAllForName)
//   - error→status code mapping: InvalidArgument, NotFound, AlreadyExists,
//     Unimplemented (nil store), Unauthenticated (missing identity)
//   - in-process client path: NewLocalResourceClient(..., kvSrv) exposes the
//     same methods end-to-end via the channel

import (
	"context"
	"encoding/json"
	"testing"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// ─── helpers ─────────────────────────────────────────────────────────────────

func newKVServerForTest(t *testing.T) (*resourceKVServer, *kv.ResourceKVStore) {
	t.Helper()
	opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
	db, err := badger.Open(opts)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	store := kv.NewResourceKVStore(kv.NewBadgerKV(db))
	srv := NewResourceKVServer(store).(*resourceKVServer)
	return srv, store
}

// authCtx returns a context carrying a service identity that AuthInfoFrom accepts.
func authCtx(t *testing.T) context.Context {
	t.Helper()
	ctx, _ := identity.WithServiceIdentity(context.Background(), 1)
	return ctx
}

// noAuthCtx is a plain background context with no identity.
func noAuthCtx() context.Context {
	return context.Background()
}

// parentKey returns a ResourceKey suitable for test requests.
func parentKey() *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
		Namespace: "stacks-123",
		Name:      "abc-dash",
	}
}

const (
	testOwner = "usageinsights.grafana.app"
	testKey   = "stats"
	testBy    = "svc:test"
)

var testValue = []byte(`{"views_total":42}`)

// saveViaSrv is a helper that issues a Save RPC.
func saveViaSrv(t *testing.T, srv *resourceKVServer, ctx context.Context, value []byte) {
	t.Helper()
	_, err := srv.Save(ctx, &resourcepb.ResourceKVSaveRequest{
		Parent: parentKey(),
		Owner:  testOwner,
		Key:    testKey,
		Value:  value,
		By:     testBy,
	})
	require.NoError(t, err)
}

// mockScanStream is a fake ResourceKV_ScanNamespaceServer for unit tests.
type mockScanStream struct {
	ctx   context.Context
	items []*resourcepb.ResourceKVScanResponse
}

func (m *mockScanStream) Send(r *resourcepb.ResourceKVScanResponse) error {
	m.items = append(m.items, r)
	return nil
}
func (m *mockScanStream) Context() context.Context { return m.ctx }

// Satisfy grpc.ServerStream — we only need Context and Send above.
func (m *mockScanStream) SetHeader(md metadata.MD) error  { return nil }
func (m *mockScanStream) SendHeader(md metadata.MD) error { return nil }
func (m *mockScanStream) SetTrailer(md metadata.MD)       {}
func (m *mockScanStream) SendMsg(msg any) error           { return nil }
func (m *mockScanStream) RecvMsg(msg any) error           { return nil }

// ─── Unimplemented (nil store) ────────────────────────────────────────────────

func TestResourceKVServer_NilStore_ReturnsUnimplemented(t *testing.T) {
	t.Parallel()
	srv := NewResourceKVServer(nil).(*resourceKVServer)
	ctx := authCtx(t)
	pk := parentKey()

	t.Run("Get", func(t *testing.T) {
		t.Parallel()
		_, err := srv.Get(ctx, &resourcepb.ResourceKVGetRequest{Parent: pk, Owner: testOwner, Key: testKey})
		require.Equal(t, codes.Unimplemented, status.Code(err))
	})
	t.Run("Save", func(t *testing.T) {
		t.Parallel()
		_, err := srv.Save(ctx, &resourcepb.ResourceKVSaveRequest{Parent: pk, Owner: testOwner, Key: testKey, Value: testValue})
		require.Equal(t, codes.Unimplemented, status.Code(err))
	})
	t.Run("Delete", func(t *testing.T) {
		t.Parallel()
		_, err := srv.Delete(ctx, &resourcepb.ResourceKVDeleteRequest{Parent: pk, Owner: testOwner, Key: testKey})
		require.Equal(t, codes.Unimplemented, status.Code(err))
	})
	t.Run("Keys", func(t *testing.T) {
		t.Parallel()
		_, err := srv.Keys(ctx, &resourcepb.ResourceKVKeysRequest{Parent: pk})
		require.Equal(t, codes.Unimplemented, status.Code(err))
	})
	t.Run("Batch", func(t *testing.T) {
		t.Parallel()
		_, err := srv.Batch(ctx, &resourcepb.ResourceKVBatchRequest{Parent: pk})
		require.Equal(t, codes.Unimplemented, status.Code(err))
	})
	t.Run("ScanNamespace", func(t *testing.T) {
		t.Parallel()
		stream := &mockScanStream{ctx: ctx}
		err := srv.ScanNamespace(&resourcepb.ResourceKVScanRequest{Group: "g", Resource: "r", Namespace: "ns"}, stream)
		require.Equal(t, codes.Unimplemented, status.Code(err))
	})
	t.Run("DeleteAllForName", func(t *testing.T) {
		t.Parallel()
		_, err := srv.DeleteAllForName(ctx, &resourcepb.ResourceKVDeleteAllForNameRequest{
			Group: "g", Resource: "r", Namespace: "ns", Name: "n",
		})
		require.Equal(t, codes.Unimplemented, status.Code(err))
	})
}

// ─── Unauthenticated (no identity in ctx) ─────────────────────────────────────

func TestResourceKVServer_NoIdentity_ReturnsUnauthenticated(t *testing.T) {
	t.Parallel()
	srv, _ := newKVServerForTest(t)
	ctx := noAuthCtx()
	pk := parentKey()

	t.Run("Get", func(t *testing.T) {
		t.Parallel()
		_, err := srv.Get(ctx, &resourcepb.ResourceKVGetRequest{Parent: pk, Owner: testOwner, Key: testKey})
		require.Equal(t, codes.Unauthenticated, status.Code(err))
	})
	t.Run("Save", func(t *testing.T) {
		t.Parallel()
		_, err := srv.Save(ctx, &resourcepb.ResourceKVSaveRequest{Parent: pk, Owner: testOwner, Key: testKey, Value: testValue})
		require.Equal(t, codes.Unauthenticated, status.Code(err))
	})
	t.Run("Delete", func(t *testing.T) {
		t.Parallel()
		_, err := srv.Delete(ctx, &resourcepb.ResourceKVDeleteRequest{Parent: pk, Owner: testOwner, Key: testKey})
		require.Equal(t, codes.Unauthenticated, status.Code(err))
	})
	t.Run("Keys", func(t *testing.T) {
		t.Parallel()
		_, err := srv.Keys(ctx, &resourcepb.ResourceKVKeysRequest{Parent: pk})
		require.Equal(t, codes.Unauthenticated, status.Code(err))
	})
	t.Run("Batch", func(t *testing.T) {
		t.Parallel()
		_, err := srv.Batch(ctx, &resourcepb.ResourceKVBatchRequest{Parent: pk})
		require.Equal(t, codes.Unauthenticated, status.Code(err))
	})
	t.Run("ScanNamespace", func(t *testing.T) {
		t.Parallel()
		stream := &mockScanStream{ctx: ctx}
		err := srv.ScanNamespace(&resourcepb.ResourceKVScanRequest{Group: "g", Resource: "r", Namespace: "ns"}, stream)
		require.Equal(t, codes.Unauthenticated, status.Code(err))
	})
	t.Run("DeleteAllForName", func(t *testing.T) {
		t.Parallel()
		_, err := srv.DeleteAllForName(ctx, &resourcepb.ResourceKVDeleteAllForNameRequest{
			Group: "g", Resource: "r", Namespace: "ns", Name: "n",
		})
		require.Equal(t, codes.Unauthenticated, status.Code(err))
	})
}

// ─── Missing parent (nil) ─────────────────────────────────────────────────────

func TestResourceKVServer_NilParent_ReturnsInvalidArgument(t *testing.T) {
	t.Parallel()
	srv, _ := newKVServerForTest(t)
	ctx := authCtx(t)

	t.Run("Get", func(t *testing.T) {
		t.Parallel()
		_, err := srv.Get(ctx, &resourcepb.ResourceKVGetRequest{Parent: nil})
		require.Equal(t, codes.InvalidArgument, status.Code(err))
	})
	t.Run("Save", func(t *testing.T) {
		t.Parallel()
		_, err := srv.Save(ctx, &resourcepb.ResourceKVSaveRequest{Parent: nil})
		require.Equal(t, codes.InvalidArgument, status.Code(err))
	})
	t.Run("Delete", func(t *testing.T) {
		t.Parallel()
		_, err := srv.Delete(ctx, &resourcepb.ResourceKVDeleteRequest{Parent: nil})
		require.Equal(t, codes.InvalidArgument, status.Code(err))
	})
	t.Run("Keys", func(t *testing.T) {
		t.Parallel()
		_, err := srv.Keys(ctx, &resourcepb.ResourceKVKeysRequest{Parent: nil})
		require.Equal(t, codes.InvalidArgument, status.Code(err))
	})
	t.Run("Batch", func(t *testing.T) {
		t.Parallel()
		_, err := srv.Batch(ctx, &resourcepb.ResourceKVBatchRequest{Parent: nil})
		require.Equal(t, codes.InvalidArgument, status.Code(err))
	})
}

// ─── Save → Get round-trip ────────────────────────────────────────────────────

func TestResourceKVServer_SaveGet_RoundTrip(t *testing.T) {
	t.Parallel()
	srv, _ := newKVServerForTest(t)
	ctx := authCtx(t)

	saveViaSrv(t, srv, ctx, testValue)

	resp, err := srv.Get(ctx, &resourcepb.ResourceKVGetRequest{
		Parent: parentKey(),
		Owner:  testOwner,
		Key:    testKey,
	})
	require.NoError(t, err)
	assert.JSONEq(t, string(testValue), string(resp.GetValue()))
	assert.Greater(t, resp.GetUpdatedAt(), int64(0), "UpdatedAt must be a positive unix timestamp")
	assert.Equal(t, testBy, resp.GetUpdatedBy())
}

// ─── Get: NotFound ────────────────────────────────────────────────────────────

func TestResourceKVServer_Get_NotFound(t *testing.T) {
	t.Parallel()
	srv, _ := newKVServerForTest(t)
	ctx := authCtx(t)

	_, err := srv.Get(ctx, &resourcepb.ResourceKVGetRequest{
		Parent: parentKey(),
		Owner:  testOwner,
		Key:    "nonexistent",
	})
	require.Equal(t, codes.NotFound, status.Code(err))
}

// ─── Save: invalid key → InvalidArgument ─────────────────────────────────────

func TestResourceKVServer_Save_InvalidKey_ReturnsInvalidArgument(t *testing.T) {
	t.Parallel()
	srv, _ := newKVServerForTest(t)
	ctx := authCtx(t)

	_, err := srv.Save(ctx, &resourcepb.ResourceKVSaveRequest{
		Parent: parentKey(),
		Owner:  "INVALID_OWNER", // uppercase not allowed
		Key:    testKey,
		Value:  testValue,
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}

// ─── Save: value too large → InvalidArgument ─────────────────────────────────

func TestResourceKVServer_Save_ValueTooLarge_ReturnsInvalidArgument(t *testing.T) {
	t.Parallel()
	srv, _ := newKVServerForTest(t)
	ctx := authCtx(t)

	oversized := make([]byte, kv.MaxKVValueBytes+1)
	for i := range oversized {
		oversized[i] = 'x'
	}

	_, err := srv.Save(ctx, &resourcepb.ResourceKVSaveRequest{
		Parent: parentKey(),
		Owner:  testOwner,
		Key:    testKey,
		Value:  oversized,
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}

// ─── Delete ────────────────────────────────────────────────────────────────────

func TestResourceKVServer_Delete_RoundTrip(t *testing.T) {
	t.Parallel()
	srv, _ := newKVServerForTest(t)
	ctx := authCtx(t)

	saveViaSrv(t, srv, ctx, testValue)

	_, err := srv.Delete(ctx, &resourcepb.ResourceKVDeleteRequest{
		Parent: parentKey(),
		Owner:  testOwner,
		Key:    testKey,
	})
	require.NoError(t, err)

	// The key must now be gone.
	_, getErr := srv.Get(ctx, &resourcepb.ResourceKVGetRequest{
		Parent: parentKey(),
		Owner:  testOwner,
		Key:    testKey,
	})
	require.Equal(t, codes.NotFound, status.Code(getErr))
}

// ─── Keys: all keys and by owner ─────────────────────────────────────────────

func TestResourceKVServer_Keys_AllAndByOwner(t *testing.T) {
	t.Parallel()
	srv, _ := newKVServerForTest(t)
	ctx := authCtx(t)
	pk := parentKey()

	saveKey := func(owner, key string) {
		t.Helper()
		_, err := srv.Save(ctx, &resourcepb.ResourceKVSaveRequest{
			Parent: pk, Owner: owner, Key: key, Value: []byte(`{}`), By: testBy,
		})
		require.NoError(t, err)
	}

	saveKey(testOwner, "stats")
	saveKey(testOwner, "daily")
	saveKey("rendering.grafana.app", "stats")

	// All keys — owner field empty.
	allResp, err := srv.Keys(ctx, &resourcepb.ResourceKVKeysRequest{Parent: pk})
	require.NoError(t, err)
	assert.Len(t, allResp.GetKeys(), 3, "Keys() without owner must return all entries")

	// Narrowed scan — only the owner's keys.
	ownerResp, err := srv.Keys(ctx, &resourcepb.ResourceKVKeysRequest{
		Parent: pk, Owner: testOwner,
	})
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"stats", "daily"}, ownerResp.GetKeys(),
		"Keys() with owner must return only bare key names for that owner")

	// No-match owner must return empty.
	noneResp, err := srv.Keys(ctx, &resourcepb.ResourceKVKeysRequest{
		Parent: pk, Owner: "nobody.grafana.app",
	})
	require.NoError(t, err)
	assert.Empty(t, noneResp.GetKeys())
}

// ─── Batch: create semantics (AlreadyExists on duplicate) ────────────────────

func TestResourceKVServer_Batch_CreateAlreadyExists(t *testing.T) {
	t.Parallel()
	srv, _ := newKVServerForTest(t)
	ctx := authCtx(t)

	// Seed the key via a plain Save.
	saveViaSrv(t, srv, ctx, testValue)

	_, err := srv.Batch(ctx, &resourcepb.ResourceKVBatchRequest{
		Parent: parentKey(),
		Ops: []*resourcepb.ResourceKVBatchOp{
			{
				Mode:  resourcepb.ResourceKVBatchOp_CREATE,
				Owner: testOwner,
				Key:   testKey,
				Value: []byte(`{"new":true}`),
			},
		},
	})
	require.Equal(t, codes.AlreadyExists, status.Code(err))
}

// ─── Batch: update semantics (updates existing key) ──────────────────────────

func TestResourceKVServer_Batch_UpdateExistingKey(t *testing.T) {
	t.Parallel()
	srv, _ := newKVServerForTest(t)
	ctx := authCtx(t)

	saveViaSrv(t, srv, ctx, testValue)

	_, err := srv.Batch(ctx, &resourcepb.ResourceKVBatchRequest{
		Parent: parentKey(),
		Ops: []*resourcepb.ResourceKVBatchOp{
			{
				Mode:  resourcepb.ResourceKVBatchOp_UPDATE,
				Owner: testOwner,
				Key:   testKey,
				Value: []byte(`{"views_total":99}`),
				By:    testBy,
			},
		},
	})
	require.NoError(t, err)

	resp, err := srv.Get(ctx, &resourcepb.ResourceKVGetRequest{
		Parent: parentKey(), Owner: testOwner, Key: testKey,
	})
	require.NoError(t, err)
	assert.JSONEq(t, `{"views_total":99}`, string(resp.GetValue()))
}

// ─── Batch: too many ops → InvalidArgument ────────────────────────────────────

func TestResourceKVServer_Batch_TooManyOps_ReturnsInvalidArgument(t *testing.T) {
	t.Parallel()
	srv, _ := newKVServerForTest(t)
	ctx := authCtx(t)

	ops := make([]*resourcepb.ResourceKVBatchOp, kv.MaxBatchOps+1)
	for i := range ops {
		ops[i] = &resourcepb.ResourceKVBatchOp{
			Mode:  resourcepb.ResourceKVBatchOp_PUT,
			Owner: testOwner,
			Key:   testKey,
			Value: []byte(`{}`),
		}
	}
	_, err := srv.Batch(ctx, &resourcepb.ResourceKVBatchRequest{
		Parent: parentKey(),
		Ops:    ops,
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}

// ─── Batch: invalid op mode → InvalidArgument ────────────────────────────────

func TestResourceKVServer_Batch_InvalidMode_ReturnsInvalidArgument(t *testing.T) {
	t.Parallel()
	srv, _ := newKVServerForTest(t)
	ctx := authCtx(t)

	_, err := srv.Batch(ctx, &resourcepb.ResourceKVBatchRequest{
		Parent: parentKey(),
		Ops: []*resourcepb.ResourceKVBatchOp{
			{
				Mode:  resourcepb.ResourceKVBatchOp_Mode(99), // unknown mode
				Owner: testOwner,
				Key:   testKey,
				Value: []byte(`{}`),
			},
		},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}

// ─── ScanNamespace streaming ──────────────────────────────────────────────────

func TestResourceKVServer_ScanNamespace(t *testing.T) {
	t.Parallel()
	srv, _ := newKVServerForTest(t)
	ctx := authCtx(t)

	const (
		group    = "dashboard.grafana.app"
		resource = "dashboards"
		ns       = "stacks-scan"
	)

	// Helper to save a key for a specific name.
	save := func(name, key string, value []byte) {
		t.Helper()
		_, err := srv.Save(ctx, &resourcepb.ResourceKVSaveRequest{
			Parent: &resourcepb.ResourceKey{
				Group: group, Resource: resource, Namespace: ns, Name: name,
			},
			Owner: testOwner, Key: key, Value: value, By: testBy,
		})
		require.NoError(t, err)
	}

	save("d1", "stats", []byte(`{"views_total":1}`))
	save("d2", "stats", []byte(`{"views_total":2}`))

	// Write into a different namespace — must not appear.
	_, err := srv.Save(ctx, &resourcepb.ResourceKVSaveRequest{
		Parent: &resourcepb.ResourceKey{Group: group, Resource: resource, Namespace: "other-ns", Name: "d3"},
		Owner:  testOwner, Key: "stats", Value: []byte(`{"views_total":99}`), By: testBy,
	})
	require.NoError(t, err)

	stream := &mockScanStream{ctx: ctx}
	require.NoError(t, srv.ScanNamespace(
		&resourcepb.ResourceKVScanRequest{Group: group, Resource: resource, Namespace: ns},
		stream,
	))
	require.Len(t, stream.items, 2, "ScanNamespace must return only entries in the target namespace")

	byName := make(map[string]*resourcepb.ResourceKVScanResponse)
	for _, item := range stream.items {
		byName[item.GetName()] = item
	}

	r1, ok := byName["d1"]
	require.True(t, ok, "d1 must appear in scan results")
	assert.Equal(t, "d1", r1.GetName())
	assert.Equal(t, testOwner, r1.GetOwner())
	assert.Equal(t, "stats", r1.GetKey())
	assert.JSONEq(t, `{"views_total":1}`, string(r1.GetValue()))

	r2, ok := byName["d2"]
	require.True(t, ok, "d2 must appear in scan results")
	assert.Equal(t, "d2", r2.GetName())
}

// ─── DeleteAllForName ─────────────────────────────────────────────────────────

func TestResourceKVServer_DeleteAllForName(t *testing.T) {
	t.Parallel()
	srv, _ := newKVServerForTest(t)
	ctx := authCtx(t)

	const (
		group    = "dashboard.grafana.app"
		resource = "dashboards"
		ns       = "stacks-123"
		name     = "to-delete"
	)

	pk := func(n string) *resourcepb.ResourceKey {
		return &resourcepb.ResourceKey{Group: group, Resource: resource, Namespace: ns, Name: n}
	}

	// Write multiple keys for the target name.
	for _, key := range []string{testKey, "daily"} {
		_, err := srv.Save(ctx, &resourcepb.ResourceKVSaveRequest{
			Parent: pk(name),
			Owner:  testOwner, Key: key, Value: testValue, By: testBy,
		})
		require.NoError(t, err)
	}

	// Different name — must survive.
	const survivorName = "survivor"
	_, err := srv.Save(ctx, &resourcepb.ResourceKVSaveRequest{
		Parent: pk(survivorName),
		Owner:  testOwner, Key: testKey, Value: testValue, By: testBy,
	})
	require.NoError(t, err)

	_, err = srv.DeleteAllForName(ctx, &resourcepb.ResourceKVDeleteAllForNameRequest{
		Group: group, Resource: resource, Namespace: ns, Name: name,
	})
	require.NoError(t, err)

	// All target keys must be gone.
	for _, key := range []string{testKey, "daily"} {
		_, getErr := srv.Get(ctx, &resourcepb.ResourceKVGetRequest{
			Parent: pk(name), Owner: testOwner, Key: key,
		})
		require.Equal(t, codes.NotFound, status.Code(getErr), "key %q must be removed", key)
	}

	// Survivor must be untouched.
	resp, err := srv.Get(ctx, &resourcepb.ResourceKVGetRequest{
		Parent: pk(survivorName), Owner: testOwner, Key: testKey,
	})
	require.NoError(t, err)
	assert.JSONEq(t, string(testValue), string(resp.GetValue()))
}

// ─── DeleteAllForName: missing fields → InvalidArgument ───────────────────────

func TestResourceKVServer_DeleteAllForName_MissingFields(t *testing.T) {
	t.Parallel()
	srv, _ := newKVServerForTest(t)
	ctx := authCtx(t)

	cases := []struct {
		name string
		req  *resourcepb.ResourceKVDeleteAllForNameRequest
	}{
		{"missing group", &resourcepb.ResourceKVDeleteAllForNameRequest{Resource: "r", Namespace: "ns", Name: "n"}},
		{"missing resource", &resourcepb.ResourceKVDeleteAllForNameRequest{Group: "g", Namespace: "ns", Name: "n"}},
		{"missing namespace", &resourcepb.ResourceKVDeleteAllForNameRequest{Group: "g", Resource: "r", Name: "n"}},
		{"missing name", &resourcepb.ResourceKVDeleteAllForNameRequest{Group: "g", Resource: "r", Namespace: "ns"}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			_, err := srv.DeleteAllForName(ctx, tc.req)
			require.Equal(t, codes.InvalidArgument, status.Code(err), tc.name)
		})
	}
}

// ─── mapStoreError unit test ──────────────────────────────────────────────────

func TestMapStoreError(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		err      error
		wantCode codes.Code
	}{
		{"nil passes through", nil, codes.OK},
		{"ErrInvalidKey → InvalidArgument", kv.ErrInvalidKey, codes.InvalidArgument},
		{"ErrValueTooLarge → InvalidArgument", kv.ErrValueTooLarge, codes.InvalidArgument},
		{"ErrNotFound → NotFound", kv.ErrNotFound, codes.NotFound},
		{"ErrKeyAlreadyExists → AlreadyExists", kv.ErrKeyAlreadyExists, codes.AlreadyExists},
		{"BatchError wrapping ErrInvalidKey → InvalidArgument",
			&kv.BatchError{Index: 0, Err: kv.ErrInvalidKey}, codes.InvalidArgument},
		{"BatchError wrapping ErrNotFound → NotFound",
			&kv.BatchError{Index: 0, Err: kv.ErrNotFound}, codes.NotFound},
		{"BatchError wrapping ErrKeyAlreadyExists → AlreadyExists",
			&kv.BatchError{Index: 0, Err: kv.ErrKeyAlreadyExists}, codes.AlreadyExists},
		{"unknown error → Internal", assert.AnError, codes.Internal},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			mapped := mapStoreError("op", tc.err)
			require.Equal(t, tc.wantCode, status.Code(mapped))
		})
	}
}

// ─── In-process client path ───────────────────────────────────────────────────

func TestResourceKVServer_InProcessClient_SaveGet(t *testing.T) {
	// Tests that NewLocalResourceClient(..., kvSrv) wires the channel correctly
	// so that KV().Save and KV().Get work end-to-end through the in-proc channel.
	t.Parallel()

	opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
	db, err := badger.Open(opts)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	store := kv.NewResourceKVStore(kv.NewBadgerKV(db))
	kvSrv := NewResourceKVServer(store)

	// A minimal ResourceServer stub to satisfy NewLocalResourceClient.
	client := NewLocalResourceClient(newResourceServerStub(), kvSrv)

	// Build a context with identity: the in-proc channel injects it as a service
	// identity so the auth interceptor is satisfied.
	ctx, _ := identity.WithServiceIdentity(context.Background(), 1)

	pk := parentKey()
	const owner = testOwner
	const key = "in-proc-key"
	value := []byte(`{"in_proc":true}`)

	_, saveErr := client.KV().Save(ctx, &resourcepb.ResourceKVSaveRequest{
		Parent: pk, Owner: owner, Key: key, Value: value, By: testBy,
	})
	require.NoError(t, saveErr, "in-process Save must succeed")

	resp, getErr := client.KV().Get(ctx, &resourcepb.ResourceKVGetRequest{
		Parent: pk, Owner: owner, Key: key,
	})
	require.NoError(t, getErr, "in-process Get must succeed")
	assert.JSONEq(t, string(value), string(resp.GetValue()))
}

// ─── JSON roundtrip (envelope preservation) ───────────────────────────────────

func TestResourceKVServer_SaveGet_EnvelopeRoundTrip(t *testing.T) {
	// Verifies that the value bytes returned by Get are the unwrapped user JSON,
	// not the internal {v,at,by} envelope.
	t.Parallel()
	srv, _ := newKVServerForTest(t)
	ctx := authCtx(t)

	const complexJSON = `{"nested":{"list":[1,2,3],"ok":true}}`
	saveViaSrv(t, srv, ctx, []byte(complexJSON))

	resp, err := srv.Get(ctx, &resourcepb.ResourceKVGetRequest{
		Parent: parentKey(), Owner: testOwner, Key: testKey,
	})
	require.NoError(t, err)

	// The value must not be an envelope — there must be no top-level "v" key.
	var raw map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(resp.GetValue(), &raw))
	_, hasV := raw["v"]
	assert.False(t, hasV, "Get must return the user JSON, not the internal envelope")
	assert.JSONEq(t, complexJSON, string(resp.GetValue()))
}

// ─── resourceServerStub ───────────────────────────────────────────────────────

// resourceServerStub satisfies ResourceServer by embedding all of the
// Unimplemented* proto stubs. No real RPCs are served; the KV tests only need
// the KV service registered on the same in-proc channel.
type resourceServerStub struct {
	resourcepb.UnimplementedResourceStoreServer
	resourcepb.UnimplementedResourceStatsServer
	resourcepb.UnimplementedBulkStoreServer
	resourcepb.UnimplementedBlobStoreServer
	resourcepb.UnimplementedQuotasServer
	resourcepb.UnimplementedDiagnosticsServer
	resourcepb.UnimplementedResourceIndexServer
	resourcepb.UnimplementedManagedObjectIndexServer
}

// newResourceServerStub returns a minimal ResourceServer for NewLocalResourceClient.
func newResourceServerStub() ResourceServer {
	return &resourceServerStub{}
}

// Init satisfies SearchServer.
func (s *resourceServerStub) Init(_ context.Context) error { return nil }

// Stop satisfies ResourceServerStopper.
func (s *resourceServerStub) Stop(_ context.Context) error { return nil }

func TestResourceKVServer_Batch_UnspecifiedMode_ReturnsInvalidArgument(t *testing.T) {
	t.Parallel()
	srv, _ := newKVServerForTest(t)

	_, err := srv.Batch(authCtx(t), &resourcepb.ResourceKVBatchRequest{
		Parent: parentKey(),
		Ops:    []*resourcepb.ResourceKVBatchOp{{Owner: testOwner, Key: testKey, Value: []byte(`{}`)}},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}
