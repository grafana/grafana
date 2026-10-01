package kvsubresource

// Tests for KVConnector — the generic k8s rest.Connecter for the KV subresource.
//
// Design:
//   - The KV gRPC client is backed by the real resourceKVServer + in-memory BadgerKV
//     (the resource KV store and ResourceKV server). A thin serverToClient adapter wires the server directly as a
//     client, bypassing the gRPC channel.  This keeps the test self-contained and
//     avoids the large dependency tree of NewLocalResourceClient while still
//     exercising the real storage implementation.
//   - The parent getter and access control are fakes that the tests control
//     per-subcase.
//   - Both the Connect context and every HTTP request context carry a service
//     identity so that checkWriteAuthz (uses identity.GetRequester) and the gRPC
//     server's requireIdentity (uses authlib claims.AuthInfoFrom) are satisfied
//     through the shared identity.WithRequester/WithServiceIdentity path.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"

	authlib "github.com/grafana/authlib/types"
	app "github.com/grafana/grafana-app-sdk/app"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	resourcepkg "github.com/grafana/grafana/pkg/storage/unified/resource"
	kv "github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	resourcepb "github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// ─── test-only types ─────────────────────────────────────────────────────────

// fakeParent is a minimal runtime.Object that satisfies utils.MetaAccessor
// (name + namespace) without importing a full k8s object type.
type fakeParent struct {
	metav1.ObjectMeta
}

func (f *fakeParent) GetObjectKind() schema.ObjectKind { return schema.EmptyObjectKind }
func (f *fakeParent) DeepCopyObject() runtime.Object   { cp := *f; return &cp }

// getterFunc is a functional rest.Getter for test control.
type getterFunc func(context.Context, string, *metav1.GetOptions) (runtime.Object, error)

func (g getterFunc) Get(ctx context.Context, name string, opts *metav1.GetOptions) (runtime.Object, error) {
	return g(ctx, name, opts)
}

// successGetter returns a fakeParent with the given namespace and name.
func successGetter(ns, name string) getterFunc {
	return func(_ context.Context, _ string, _ *metav1.GetOptions) (runtime.Object, error) {
		return &fakeParent{ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: name}}, nil
	}
}

// errorGetter returns an error on every Get call.
func errorGetter(err error) getterFunc {
	return func(_ context.Context, _ string, _ *metav1.GetOptions) (runtime.Object, error) {
		return nil, err
	}
}

// permissionsAC is a fine-grained AccessControl implementation that evaluates
// permissions directly without resolvers or caching.
type permissionsAC struct {
	// permissions maps action → allowed scopes.
	permissions map[string][]string
}

func allowOwners(owners ...string) *permissionsAC {
	scopes := make([]string, len(owners))
	for i, o := range owners {
		scopes[i] = kvScopePrefix + o
	}
	return &permissionsAC{permissions: map[string][]string{kvActionWrite: scopes}}
}

func denyAll() *permissionsAC { return &permissionsAC{} }

func (ac *permissionsAC) Evaluate(_ context.Context, _ identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	return evaluator.Evaluate(ac.permissions), nil
}

func (ac *permissionsAC) RegisterScopeAttributeResolver(_ string, _ accesscontrol.ScopeAttributeResolver) {
}

func (ac *permissionsAC) WithoutResolvers() accesscontrol.AccessControl { return ac }

func (ac *permissionsAC) InvalidateResolverCache(_ int64, _ string) {}

// erroringAC is an AccessControl that always returns an error from Evaluate.
// Used to test the 500 / generic-error path in checkWriteAuthz.
type erroringAC struct {
	err error
}

func (ac *erroringAC) Evaluate(_ context.Context, _ identity.Requester, _ accesscontrol.Evaluator) (bool, error) {
	return false, ac.err
}

func (ac *erroringAC) RegisterScopeAttributeResolver(_ string, _ accesscontrol.ScopeAttributeResolver) {
}

func (ac *erroringAC) WithoutResolvers() accesscontrol.AccessControl { return ac }

func (ac *erroringAC) InvalidateResolverCache(_ int64, _ string) {}

// fixedErrorKVClient returns a pre-configured error for every RPC method.
// Used to test the writeGRPCError response-body behavior.
type fixedErrorKVClient struct {
	err error
}

func (f *fixedErrorKVClient) Get(_ context.Context, _ *resourcepb.ResourceKVGetRequest, _ ...grpc.CallOption) (*resourcepb.ResourceKVGetResponse, error) {
	return nil, f.err
}
func (f *fixedErrorKVClient) Save(_ context.Context, _ *resourcepb.ResourceKVSaveRequest, _ ...grpc.CallOption) (*resourcepb.ResourceKVSaveResponse, error) {
	return nil, f.err
}
func (f *fixedErrorKVClient) Delete(_ context.Context, _ *resourcepb.ResourceKVDeleteRequest, _ ...grpc.CallOption) (*resourcepb.ResourceKVDeleteResponse, error) {
	return nil, f.err
}
func (f *fixedErrorKVClient) Keys(_ context.Context, _ *resourcepb.ResourceKVKeysRequest, _ ...grpc.CallOption) (*resourcepb.ResourceKVKeysResponse, error) {
	return nil, f.err
}
func (f *fixedErrorKVClient) Batch(_ context.Context, _ *resourcepb.ResourceKVBatchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceKVBatchResponse, error) {
	return nil, f.err
}
func (f *fixedErrorKVClient) ScanNamespace(_ context.Context, _ *resourcepb.ResourceKVScanRequest, _ ...grpc.CallOption) (resourcepb.ResourceKV_ScanNamespaceClient, error) {
	panic("fixedErrorKVClient.ScanNamespace not implemented")
}
func (f *fixedErrorKVClient) DeleteAllForName(_ context.Context, _ *resourcepb.ResourceKVDeleteAllForNameRequest, _ ...grpc.CallOption) (*resourcepb.ResourceKVDeleteAllForNameResponse, error) {
	panic("fixedErrorKVClient.DeleteAllForName not implemented")
}

// readCounter wraps an io.Reader and counts how many bytes were actually read.
// Used to verify that io.LimitReader prevents reading beyond the configured cap.
type readCounter struct {
	io.Reader
	N int
}

func (r *readCounter) Read(p []byte) (int, error) {
	n, err := r.Reader.Read(p)
	r.N += n
	return n, err
}

// ─── in-process KV client (adapter) ─────────────────────────────────────────

// serverToClient wraps a ResourceKVServer as a ResourceKVClient.  The context
// is forwarded directly so the server's requireIdentity check sees the
// identity.WithServiceIdentity value set on the request context.
// ScanNamespace and DeleteAllForName are not used by the connector; they panic.
type serverToClient struct {
	srv resourcepb.ResourceKVServer
}

func (a *serverToClient) Get(ctx context.Context, in *resourcepb.ResourceKVGetRequest, _ ...grpc.CallOption) (*resourcepb.ResourceKVGetResponse, error) {
	return a.srv.Get(ctx, in)
}
func (a *serverToClient) Save(ctx context.Context, in *resourcepb.ResourceKVSaveRequest, _ ...grpc.CallOption) (*resourcepb.ResourceKVSaveResponse, error) {
	return a.srv.Save(ctx, in)
}
func (a *serverToClient) Delete(ctx context.Context, in *resourcepb.ResourceKVDeleteRequest, _ ...grpc.CallOption) (*resourcepb.ResourceKVDeleteResponse, error) {
	return a.srv.Delete(ctx, in)
}
func (a *serverToClient) Keys(ctx context.Context, in *resourcepb.ResourceKVKeysRequest, _ ...grpc.CallOption) (*resourcepb.ResourceKVKeysResponse, error) {
	return a.srv.Keys(ctx, in)
}
func (a *serverToClient) Batch(ctx context.Context, in *resourcepb.ResourceKVBatchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceKVBatchResponse, error) {
	return a.srv.Batch(ctx, in)
}
func (a *serverToClient) ScanNamespace(_ context.Context, _ *resourcepb.ResourceKVScanRequest, _ ...grpc.CallOption) (resourcepb.ResourceKV_ScanNamespaceClient, error) {
	panic("serverToClient.ScanNamespace not implemented")
}
func (a *serverToClient) DeleteAllForName(_ context.Context, _ *resourcepb.ResourceKVDeleteAllForNameRequest, _ ...grpc.CallOption) (*resourcepb.ResourceKVDeleteAllForNameResponse, error) {
	panic("serverToClient.DeleteAllForName not implemented")
}

// ─── test environment ─────────────────────────────────────────────────────────

const (
	testNS       = "default"
	testName     = "d1"
	testGroup    = "dashboard.grafana.app"
	testResource = "dashboards"
	testOwner    = "usageinsights.grafana.app"
	testKey      = "stats"
)

var testGR = schema.GroupResource{Group: testGroup, Resource: testResource}

// newKVClient opens an in-memory BadgerDB, creates the full ResourceKVStore +
// resourceKVServer chain, and returns a ResourceKVClient adapter.
func newKVClient(t *testing.T) resourcepb.ResourceKVClient {
	t.Helper()
	opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
	db, err := badger.Open(opts)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	store := kv.NewResourceKVStore(kv.NewBadgerKV(db))
	srv := resourcepkg.NewResourceKVServer(store)
	return &serverToClient{srv: srv}
}

// serviceCtx returns a context with a service identity that satisfies both
// identity.GetRequester (used by checkWriteAuthz) and authlib claims.AuthInfoFrom
// (used by the gRPC server's requireIdentity).
func serviceCtx(t *testing.T) context.Context {
	t.Helper()
	ctx, _ := identity.WithServiceIdentity(context.Background(), 1)
	return ctx
}

// newReq builds an HTTP request with:
//   - a service identity in its context (for gRPC calls via the KV client)
//   - k8s RequestInfo (Subresource + Parts) as the connector expects
//
// parts are the extra path segments after the subresource, e.g. ["owner", "key"].
func newReq(t *testing.T, method, urlPath, subresource string, body io.Reader, parts ...string) *http.Request {
	t.Helper()
	req := httptest.NewRequest(method, urlPath, body)
	ctx := req.Context()
	ctx, _ = identity.WithServiceIdentity(ctx, 1)
	allParts := append([]string{testResource, testName, subresource}, parts...)
	ctx = k8srequest.WithRequestInfo(ctx, &k8srequest.RequestInfo{
		Subresource: subresource,
		Parts:       allParts,
	})
	return req.WithContext(ctx)
}

// newReqNoIdentity builds a request with RequestInfo but NO identity.
// Used to verify 401 paths on write operations.
func newReqNoIdentity(method, urlPath, subresource string, body io.Reader, parts ...string) *http.Request {
	req := httptest.NewRequest(method, urlPath, body)
	allParts := append([]string{testResource, testName, subresource}, parts...)
	ctx := k8srequest.WithRequestInfo(req.Context(), &k8srequest.RequestInfo{
		Subresource: subresource,
		Parts:       allParts,
	})
	return req.WithContext(ctx)
}

// newReqUser builds a request that carries a user (non-service) identity.
// This is used by finding-8 tests: the user identity satisfies both
// identity.GetRequester (used by checkWriteAuthz) and authlib.AuthInfoFrom
// (used by the gRPC server's requireIdentity) because identity.WithRequester
// also calls types.WithAuthInfo internally.
func newReqUser(t *testing.T, method, urlPath, subresource string, body io.Reader, parts ...string) *http.Request {
	t.Helper()
	req := httptest.NewRequest(method, urlPath, body)
	ctx := req.Context()
	requester := &identity.StaticRequester{
		Type:    authlib.TypeUser,
		UserID:  42,
		UserUID: "user-uid-42",
		OrgID:   1,
		Login:   "test-user",
	}
	ctx = identity.WithRequester(ctx, requester)
	allParts := append([]string{testResource, testName, subresource}, parts...)
	ctx = k8srequest.WithRequestInfo(ctx, &k8srequest.RequestInfo{
		Subresource: subresource,
		Parts:       allParts,
	})
	return req.WithContext(ctx)
}

// connectAndServe calls Connect then immediately serves req through the handler.
// connectCtx carries the identity for authz checks inside the handler closure.
func connectAndServe(t *testing.T, c *KVConnector, connectCtx context.Context, req *http.Request) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	handler, err := c.Connect(connectCtx, testName, nil, nil)
	require.NoError(t, err, "Connect must not return an error")
	require.NotNil(t, handler)
	handler.ServeHTTP(w, req)
	return w
}

// ─── AddToScheme / types tests ────────────────────────────────────────────────

// TestKVConnector_NewAndProducesObject_ReturnKVResponse verifies that both
// New() and ProducesObject() return a *KVResponse (the k8s scheme type and
// OpenAPI type are the same).
func TestKVConnector_NewAndProducesObject_ReturnKVResponse(t *testing.T) {
	t.Parallel()
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), denyAll(), nil)

	t.Run("New", func(t *testing.T) {
		t.Parallel()
		obj := c.New()
		require.NotNil(t, obj)
		_, ok := obj.(*KVResponse)
		require.True(t, ok, "New() must return *KVResponse")
	})

	t.Run("ProducesObject", func(t *testing.T) {
		t.Parallel()
		obj := c.ProducesObject("")
		require.NotNil(t, obj)
		_, ok := obj.(*KVResponse)
		require.True(t, ok, "ProducesObject() must return *KVResponse")
	})
}

func TestAddToScheme_RegistersKVResponse(t *testing.T) {
	t.Parallel()
	scheme := runtime.NewScheme()
	gv := schema.GroupVersion{Group: testGroup, Version: "v1alpha1"}

	require.NoError(t, AddToScheme(scheme, gv))

	// The scheme must now know KVResponse under gv/KVResponse.
	gvk := gv.WithKind("KVResponse")
	obj, err := scheme.New(gvk)
	require.NoError(t, err, "scheme.New must succeed for the registered GVK")
	_, ok := obj.(*KVResponse)
	require.True(t, ok, "scheme.New must return *KVResponse")
}

// ─── connector metadata ───────────────────────────────────────────────────────

func TestKVConnector_ConnectMethods(t *testing.T) {
	t.Parallel()
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), denyAll(), nil)
	methods := c.ConnectMethods()
	assert.ElementsMatch(t, []string{"GET", "PUT", "DELETE", "POST"}, methods)
}

func TestKVConnector_NewConnectOptions(t *testing.T) {
	t.Parallel()
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), denyAll(), nil)
	opts, acceptSubpath, prefix := c.NewConnectOptions()
	assert.Nil(t, opts)
	assert.True(t, acceptSubpath, "NewConnectOptions must accept trailing subpath")
	assert.Equal(t, "", prefix)
}

func TestKVConnector_ProducesMIMETypes_ReturnsNil(t *testing.T) {
	t.Parallel()
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), denyAll(), nil)
	assert.Nil(t, c.ProducesMIMETypes("GET"))
}

// ─── Connect: parent read error propagation ───────────────────────────────────

func TestKVConnector_Connect_GetterError_PropagatesError(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		err  error
	}{
		{"not found", fmt.Errorf("resource not found")},
		{"forbidden", fmt.Errorf("forbidden")},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			c := NewKVConnector(testGR, errorGetter(tc.err), newKVClient(t), denyAll(), nil)
			handler, err := c.Connect(serviceCtx(t), testName, nil, nil)
			assert.Nil(t, handler, "no handler must be returned when the parent getter fails")
			assert.ErrorIs(t, err, tc.err, "Connect must return the getter's error")
		})
	}
}

// ─── GET list ─────────────────────────────────────────────────────────────────

func TestKVConnector_GET_List_EmptyReturnsEmptyKeys(t *testing.T) {
	t.Parallel()
	kvClient := newKVClient(t)
	c := NewKVConnector(testGR, successGetter(testNS, testName), kvClient, denyAll(), nil)
	ctx := serviceCtx(t)

	req := newReq(t, http.MethodGet, "/kv", "kv", nil)
	w := connectAndServe(t, c, ctx, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))

	var resp kvListResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotNil(t, resp.Keys, "keys field must not be null")
	assert.Empty(t, resp.Keys)
}

func TestKVConnector_GET_List_ReturnsAllKeys(t *testing.T) {
	t.Parallel()
	kvClient := newKVClient(t)
	ctx := serviceCtx(t)
	// Grant both owners so we can seed keys for each, verifying the list returns all.
	c := NewKVConnector(testGR, successGetter(testNS, testName), kvClient, allowOwners(testOwner, "other.app"), nil)

	// Seed two keys for testOwner and one for a different owner.
	saveKV(t, c, ctx, testOwner, "key-a", []byte(`{"x":1}`))
	saveKV(t, c, ctx, testOwner, "key-b", []byte(`{"x":2}`))
	saveKV(t, c, ctx, "other.app", "key-c", []byte(`{"x":3}`))

	req := newReq(t, http.MethodGet, "/kv", "kv", nil)
	w := connectAndServe(t, c, ctx, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp kvListResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Len(t, resp.Keys, 3, "list without owner filter must return all keys")
}

func TestKVConnector_GET_List_FilterByOwner(t *testing.T) {
	t.Parallel()
	kvClient := newKVClient(t)
	ctx := serviceCtx(t)
	c := NewKVConnector(testGR, successGetter(testNS, testName), kvClient, allowOwners(testOwner, "other.app"), nil)

	saveKV(t, c, ctx, testOwner, "k1", []byte(`{}`))
	saveKV(t, c, ctx, testOwner, "k2", []byte(`{}`))
	saveKV(t, c, ctx, "other.app", "k3", []byte(`{}`))

	req := newReq(t, http.MethodGet, "/kv?owner="+testOwner, "kv", nil)
	w := connectAndServe(t, c, ctx, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp kvListResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Len(t, resp.Keys, 2, "list with owner filter must return only that owner's keys")
}

// ─── GET key: value, Content-Type, metadata headers ─────────────────────────

func TestKVConnector_GET_Key_ReturnsExactJSONAndHeaders(t *testing.T) {
	t.Parallel()
	kvClient := newKVClient(t)
	ctx := serviceCtx(t)
	c := NewKVConnector(testGR, successGetter(testNS, testName), kvClient, allowOwners(testOwner), nil)

	payload := []byte(`{"views_total":42}`)
	saveKV(t, c, ctx, testOwner, testKey, payload)

	req := newReq(t, http.MethodGet, "/kv/"+testOwner+"/"+testKey, "kv", nil, testOwner, testKey)
	w := connectAndServe(t, c, ctx, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))
	assert.JSONEq(t, string(payload), w.Body.String())

	// Metadata headers must be present.
	assert.NotEmpty(t, w.Header().Get("X-Grafana-KV-Updated-At"), "X-Grafana-KV-Updated-At must be set")
	assert.NotEmpty(t, w.Header().Get("X-Grafana-KV-Updated-By"), "X-Grafana-KV-Updated-By must be set")
}

func TestKVConnector_GET_Key_NotFound_Returns404(t *testing.T) {
	t.Parallel()
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), denyAll(), nil)
	ctx := serviceCtx(t)

	req := newReq(t, http.MethodGet, "/kv/"+testOwner+"/missing", "kv", nil, testOwner, "missing")
	w := connectAndServe(t, c, ctx, req)

	require.Equal(t, http.StatusNotFound, w.Code)
}

// ─── PUT → GET round trip ─────────────────────────────────────────────────────

func TestKVConnector_PUT_GET_RoundTrip(t *testing.T) {
	t.Parallel()
	kvClient := newKVClient(t)
	ctx := serviceCtx(t)
	c := NewKVConnector(testGR, successGetter(testNS, testName), kvClient, allowOwners(testOwner), nil)

	payload := []byte(`{"round_trip":true}`)
	putReq := newReq(t, http.MethodPut, "/kv/"+testOwner+"/"+testKey, "kv", bytes.NewReader(payload), testOwner, testKey)
	putW := connectAndServe(t, c, ctx, putReq)
	require.Equal(t, http.StatusNoContent, putW.Code, "PUT must return 204")

	getReq := newReq(t, http.MethodGet, "/kv/"+testOwner+"/"+testKey, "kv", nil, testOwner, testKey)
	getW := connectAndServe(t, c, ctx, getReq)
	require.Equal(t, http.StatusOK, getW.Code)
	assert.JSONEq(t, string(payload), getW.Body.String())
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

func TestKVConnector_DELETE_RemovesKey(t *testing.T) {
	t.Parallel()
	kvClient := newKVClient(t)
	ctx := serviceCtx(t)
	c := NewKVConnector(testGR, successGetter(testNS, testName), kvClient, allowOwners(testOwner), nil)

	saveKV(t, c, ctx, testOwner, testKey, []byte(`{"x":1}`))

	delReq := newReq(t, http.MethodDelete, "/kv/"+testOwner+"/"+testKey, "kv", nil, testOwner, testKey)
	delW := connectAndServe(t, c, ctx, delReq)
	require.Equal(t, http.StatusNoContent, delW.Code, "DELETE must return 204")

	// Now GET must return 404.
	getReq := newReq(t, http.MethodGet, "/kv/"+testOwner+"/"+testKey, "kv", nil, testOwner, testKey)
	getW := connectAndServe(t, c, ctx, getReq)
	assert.Equal(t, http.StatusNotFound, getW.Code)
}

// ─── batch ────────────────────────────────────────────────────────────────────

func TestKVConnector_Batch_CreateAndUpdateAndDelete(t *testing.T) {
	t.Parallel()
	kvClient := newKVClient(t)
	ctx := serviceCtx(t)
	c := NewKVConnector(testGR, successGetter(testNS, testName), kvClient, allowOwners(testOwner), nil)

	// Pre-create a key that will be updated and one that will be deleted.
	saveKV(t, c, ctx, testOwner, "update-me", []byte(`{"v":1}`))
	saveKV(t, c, ctx, testOwner, "delete-me", []byte(`{"v":1}`))

	batch := kvBatchRequest{Ops: []kvBatchOpJSON{
		{Mode: "CREATE", Owner: testOwner, Key: "new-key", Value: json.RawMessage(`{"v":"created"}`)},
		{Mode: "UPDATE", Owner: testOwner, Key: "update-me", Value: json.RawMessage(`{"v":2}`)},
		{Mode: "DELETE", Owner: testOwner, Key: "delete-me"},
	}}
	body, _ := json.Marshal(batch)
	batchReq := newReq(t, http.MethodPost, "/kv:batch", "kv:batch", bytes.NewReader(body))
	batchW := connectAndServe(t, c, ctx, batchReq)
	require.Equal(t, http.StatusNoContent, batchW.Code, "batch POST must return 204")

	// Verify CREATE created the key.
	getW := connectAndServe(t, c, ctx, newReq(t, http.MethodGet, "/kv/"+testOwner+"/new-key", "kv", nil, testOwner, "new-key"))
	require.Equal(t, http.StatusOK, getW.Code)
	assert.JSONEq(t, `{"v":"created"}`, getW.Body.String())

	// Verify UPDATE updated the key.
	getW = connectAndServe(t, c, ctx, newReq(t, http.MethodGet, "/kv/"+testOwner+"/update-me", "kv", nil, testOwner, "update-me"))
	require.Equal(t, http.StatusOK, getW.Code)
	assert.JSONEq(t, `{"v":2}`, getW.Body.String())

	// Verify DELETE removed the key.
	getW = connectAndServe(t, c, ctx, newReq(t, http.MethodGet, "/kv/"+testOwner+"/delete-me", "kv", nil, testOwner, "delete-me"))
	assert.Equal(t, http.StatusNotFound, getW.Code)
}

func TestKVConnector_Batch_Create_AlreadyExists_Returns409(t *testing.T) {
	t.Parallel()
	kvClient := newKVClient(t)
	ctx := serviceCtx(t)
	c := NewKVConnector(testGR, successGetter(testNS, testName), kvClient, allowOwners(testOwner), nil)

	saveKV(t, c, ctx, testOwner, testKey, []byte(`{"existing":true}`))

	batch := kvBatchRequest{Ops: []kvBatchOpJSON{
		{Mode: "CREATE", Owner: testOwner, Key: testKey, Value: json.RawMessage(`{"new":true}`)},
	}}
	body, _ := json.Marshal(batch)
	req := newReq(t, http.MethodPost, "/kv:batch", "kv:batch", bytes.NewReader(body))
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusConflict, w.Code, "CREATE on existing key must return 409")
}

func TestKVConnector_Batch_Update_NotFound_Returns404(t *testing.T) {
	t.Parallel()
	kvClient := newKVClient(t)
	ctx := serviceCtx(t)
	c := NewKVConnector(testGR, successGetter(testNS, testName), kvClient, allowOwners(testOwner), nil)

	batch := kvBatchRequest{Ops: []kvBatchOpJSON{
		{Mode: "UPDATE", Owner: testOwner, Key: "nonexistent", Value: json.RawMessage(`{"x":1}`)},
	}}
	body, _ := json.Marshal(batch)
	req := newReq(t, http.MethodPost, "/kv:batch", "kv:batch", bytes.NewReader(body))
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusNotFound, w.Code, "UPDATE on nonexistent key must return 404")
}

func TestKVConnector_Batch_InvalidMethod_Returns405(t *testing.T) {
	t.Parallel()
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), denyAll(), nil)
	ctx := serviceCtx(t)

	req := newReq(t, http.MethodGet, "/kv:batch", "kv:batch", nil)
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

// ─── authorization tests ──────────────────────────────────────────────────────

func TestKVConnector_PUT_NoIdentity_Returns401(t *testing.T) {
	t.Parallel()
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), denyAll(), nil)

	// Connect context has no identity.
	connectCtx := context.Background()

	w := httptest.NewRecorder()
	handler, err := c.Connect(connectCtx, testName, nil, nil)
	require.NoError(t, err)

	req := newReqNoIdentity(http.MethodPut, "/kv/"+testOwner+"/"+testKey, "kv", bytes.NewReader([]byte(`{}`)), testOwner, testKey)
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestKVConnector_DELETE_NoIdentity_Returns401(t *testing.T) {
	t.Parallel()
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), denyAll(), nil)

	connectCtx := context.Background()
	handler, err := c.Connect(connectCtx, testName, nil, nil)
	require.NoError(t, err)

	req := newReqNoIdentity(http.MethodDelete, "/kv/"+testOwner+"/"+testKey, "kv", nil, testOwner, testKey)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestKVConnector_PUT_Unauthorized_Returns403(t *testing.T) {
	t.Parallel()
	// Access control denies all writes.
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), denyAll(), nil)
	ctx := serviceCtx(t)

	req := newReq(t, http.MethodPut, "/kv/"+testOwner+"/"+testKey, "kv", bytes.NewReader([]byte(`{}`)), testOwner, testKey)
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestKVConnector_PUT_WrongOwnerGrant_Returns403(t *testing.T) {
	t.Parallel()
	// Grant write permission for "other.app" only, not testOwner.
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), allowOwners("other.app"), nil)
	ctx := serviceCtx(t)

	req := newReq(t, http.MethodPut, "/kv/"+testOwner+"/"+testKey, "kv", bytes.NewReader([]byte(`{}`)), testOwner, testKey)
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestKVConnector_Batch_NoIdentity_Returns401(t *testing.T) {
	t.Parallel()
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), denyAll(), nil)

	connectCtx := context.Background()
	handler, err := c.Connect(connectCtx, testName, nil, nil)
	require.NoError(t, err)

	batch := kvBatchRequest{Ops: []kvBatchOpJSON{
		{Mode: "PUT", Owner: testOwner, Key: testKey, Value: json.RawMessage(`{}`)},
	}}
	body, _ := json.Marshal(batch)
	req := newReqNoIdentity(http.MethodPost, "/kv:batch", "kv:batch", bytes.NewReader(body))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestKVConnector_Batch_UnauthorizedOwner_Returns403AndNothingWritten(t *testing.T) {
	t.Parallel()
	kvClient := newKVClient(t)
	ctx := serviceCtx(t)
	// Allow testOwner but deny "blocked.app".
	c := NewKVConnector(testGR, successGetter(testNS, testName), kvClient, allowOwners(testOwner), nil)

	// First op: allowed; second op: denied owner.
	batch := kvBatchRequest{Ops: []kvBatchOpJSON{
		{Mode: "PUT", Owner: testOwner, Key: "first", Value: json.RawMessage(`{"x":1}`)},
		{Mode: "PUT", Owner: "blocked.app", Key: "second", Value: json.RawMessage(`{"x":2}`)},
	}}
	body, _ := json.Marshal(batch)
	req := newReq(t, http.MethodPost, "/kv:batch", "kv:batch", bytes.NewReader(body))
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusForbidden, w.Code, "batch op with unauthorized owner must return 403")

	// Nothing must have been written (authz is checked before the gRPC Batch call).
	getW := connectAndServe(t, c, ctx, newReq(t, http.MethodGet, "/kv/"+testOwner+"/first", "kv", nil, testOwner, "first"))
	assert.Equal(t, http.StatusNotFound, getW.Code, "no key must be written after a 403")
}

// ─── oversize body ────────────────────────────────────────────────────────────

func TestKVConnector_PUT_OversizeBody_PlatformDefault_Returns413(t *testing.T) {
	t.Parallel()
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), allowOwners(testOwner), nil)
	ctx := serviceCtx(t)

	// Exactly one byte over the platform default.
	oversized := make([]byte, kv.MaxKVValueBytes+1)
	for i := range oversized {
		oversized[i] = 'x'
	}

	req := newReq(t, http.MethodPut, "/kv/"+testOwner+"/"+testKey, "kv", bytes.NewReader(oversized), testOwner, testKey)
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusRequestEntityTooLarge, w.Code)
}

func TestKVConnector_PUT_OversizeBody_LoweredLimit_Returns413(t *testing.T) {
	t.Parallel()
	const customLimit = 16
	kvLimits := &app.ManifestVersionKindKV{MaxValueBytes: customLimit}
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), allowOwners(testOwner), kvLimits)
	ctx := serviceCtx(t)

	// Exactly one byte over the per-kind lowered limit.
	oversized := bytes.Repeat([]byte("x"), customLimit+1)

	req := newReq(t, http.MethodPut, "/kv/"+testOwner+"/"+testKey, "kv", bytes.NewReader(oversized), testOwner, testKey)
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusRequestEntityTooLarge, w.Code)
}

func TestKVConnector_PUT_AtLimit_Succeeds(t *testing.T) {
	t.Parallel()
	const customLimit = 32
	kvLimits := &app.ManifestVersionKindKV{MaxValueBytes: customLimit}
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), allowOwners(testOwner), kvLimits)
	ctx := serviceCtx(t)

	// Exactly at the lowered limit: should succeed.
	// Value must be valid JSON; wrapEnvelope marshals it as json.RawMessage.
	// 32 bytes: {"d":"aaaaaaaaaaaaaaaaaaaaaaaa"} (8 overhead + 24 content = 32)
	payload := []byte(`{"d":"aaaaaaaaaaaaaaaaaaaaaaaa"}`)

	req := newReq(t, http.MethodPut, "/kv/"+testOwner+"/"+testKey, "kv", bytes.NewReader(payload), testOwner, testKey)
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
}

// ─── invalid key ─────────────────────────────────────────────────────────────

func TestKVConnector_GET_InvalidKey_MissingSlash_Returns400(t *testing.T) {
	t.Parallel()
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), denyAll(), nil)
	ctx := serviceCtx(t)

	// Only one part after kv → subpath has no slash → splitOwnerKey returns error.
	req := newReq(t, http.MethodGet, "/kv/ownerwithoutkey", "kv", nil, "ownerwithoutkey")
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestKVConnector_PUT_InvalidOwner_Returns400(t *testing.T) {
	t.Parallel()
	// INVALID_OWNER contains uppercase characters which the store rejects with
	// codes.InvalidArgument → HTTP 400.
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), allowOwners("INVALID_OWNER"), nil)
	ctx := serviceCtx(t)

	req := newReq(t, http.MethodPut, "/kv/INVALID_OWNER/"+testKey, "kv", bytes.NewReader([]byte(`{}`)), "INVALID_OWNER", testKey)
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// ─── multi-segment key round trip ────────────────────────────────────────────

func TestKVConnector_MultiSegmentKey_RoundTrip(t *testing.T) {
	t.Parallel()
	kvClient := newKVClient(t)
	ctx := serviceCtx(t)
	c := NewKVConnector(testGR, successGetter(testNS, testName), kvClient, allowOwners(testOwner), nil)

	// key = "dashboard/stats" (two path segments)
	owner := testOwner
	key := "dashboard/stats"
	payload := []byte(`{"multi_segment":true}`)

	// PUT with multi-segment key: Parts = [..., owner, "dashboard", "stats"]
	keyParts := strings.Split(key, "/")
	allParts := append([]string{owner}, keyParts...)
	putReq := newReq(t, http.MethodPut, "/kv/"+owner+"/"+key, "kv", bytes.NewReader(payload), allParts...)
	putW := connectAndServe(t, c, ctx, putReq)
	require.Equal(t, http.StatusNoContent, putW.Code, "PUT with multi-segment key must succeed")

	// GET with same multi-segment key.
	getReq := newReq(t, http.MethodGet, "/kv/"+owner+"/"+key, "kv", nil, allParts...)
	getW := connectAndServe(t, c, ctx, getReq)
	require.Equal(t, http.StatusOK, getW.Code)
	assert.JSONEq(t, string(payload), getW.Body.String())
}

// ─── maxValueBytes override ───────────────────────────────────────────────────

func TestNewKVConnector_MaxValueBytes_Override(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name         string
		kvLimits     *app.ManifestVersionKindKV
		wantMaxBytes int
	}{
		{"nil limits uses platform default", nil, kv.MaxKVValueBytes},
		{"zero MaxValueBytes uses platform default", &app.ManifestVersionKindKV{MaxValueBytes: 0}, kv.MaxKVValueBytes},
		{"positive lower limit is applied", &app.ManifestVersionKindKV{MaxValueBytes: 1024}, 1024},
		{"limit above platform default uses platform default", &app.ManifestVersionKindKV{MaxValueBytes: kv.MaxKVValueBytes + 1}, kv.MaxKVValueBytes},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), denyAll(), tc.kvLimits)
			assert.Equal(t, tc.wantMaxBytes, c.maxValueBytes, tc.name)
		})
	}
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// saveKV issues a PUT through the handler to seed a value.  parts contains
// the extra URL path segments: first the owner, then optional key segments.
// e.g. saveKV(t, c, ctx, "owner.app", "key", []byte(`{}`)) uses parts=["owner.app", "key"].
func saveKV(t *testing.T, c *KVConnector, ctx context.Context, owner, key string, value []byte, extraParts ...string) {
	t.Helper()
	parts := append([]string{owner}, extraParts...)
	if len(parts) == 1 {
		// caller passed (owner, key) directly — use key as the second part
		parts = append(parts, key)
	}
	subpath := strings.Join(parts, "/")
	allParts := append([]string{owner}, extraParts...)
	if len(extraParts) == 0 {
		allParts = []string{owner, key}
	}
	req := newReq(t, http.MethodPut, "/kv/"+subpath, "kv", bytes.NewReader(value), allParts...)
	w := connectAndServe(t, c, ctx, req)
	require.Equal(t, http.StatusNoContent, w.Code, "saveKV: PUT must return 204 for owner=%q key=%q", owner, key)
}

// ─── Destroy (sanity) ─────────────────────────────────────────────────────────

func TestKVConnector_Destroy_IsNoOp(t *testing.T) {
	t.Parallel()
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), denyAll(), nil)
	// Must not panic.
	require.NotPanics(t, func() { c.Destroy() })
}

// ─── KVResponse deep copy ─────────────────────────────────────────────────────

func TestKVResponse_DeepCopyObject_CopiesKeys(t *testing.T) {
	t.Parallel()
	orig := &KVResponse{
		ObjectMeta: metav1.ObjectMeta{
			Name:        "test",
			Annotations: map[string]string{"k": "v"},
			Labels:      map[string]string{"env": "test"},
		},
		Keys: []string{"a", "b"},
	}
	cp := orig.DeepCopyObject()
	cpResp, ok := cp.(*KVResponse)
	require.True(t, ok)
	assert.Equal(t, orig.Keys, cpResp.Keys)
	assert.Equal(t, orig.Annotations, cpResp.Annotations)
	assert.Equal(t, orig.Labels, cpResp.Labels)

	// Mutation of original Keys must not affect copy.
	orig.Keys[0] = "mutated"
	assert.Equal(t, "a", cpResp.Keys[0], "deep copy must be independent for Keys")

	// Mutation of original Annotations must not affect copy.
	orig.Annotations["k"] = "mutated"
	assert.Equal(t, "v", cpResp.Annotations["k"], "deep copy must be independent for Annotations")
}

func TestKVResponse_DeepCopyObject_NilKeys(t *testing.T) {
	t.Parallel()
	orig := &KVResponse{}
	cp := orig.DeepCopyObject()
	cpResp, ok := cp.(*KVResponse)
	require.True(t, ok)
	assert.Nil(t, cpResp.Keys)
}

// ─── Finding 1: non-JSON PUT body → 400 ──────────────────────────────────────

func TestKVConnector_PUT_NonJSONBody_Returns400(t *testing.T) {
	t.Parallel()
	kvClient := newKVClient(t)
	ctx := serviceCtx(t)
	c := NewKVConnector(testGR, successGetter(testNS, testName), kvClient, allowOwners(testOwner), nil)

	req := newReq(t, http.MethodPut, "/kv/"+testOwner+"/"+testKey, "kv", bytes.NewReader([]byte("not json")), testOwner, testKey)
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusBadRequest, w.Code, "non-JSON body must return 400")

	// Nothing must have been stored.
	getReq := newReq(t, http.MethodGet, "/kv/"+testOwner+"/"+testKey, "kv", nil, testOwner, testKey)
	getW := connectAndServe(t, c, ctx, getReq)
	assert.Equal(t, http.StatusNotFound, getW.Code, "nothing must be stored after a 400")
}

// ─── Finding 2: LimitReader caps at maxValueBytes+1 ──────────────────────────

func TestKVConnector_PUT_LimitReaderCapsAtMaxPlusOne(t *testing.T) {
	t.Parallel()
	const customLimit = 32
	kvLimits := &app.ManifestVersionKindKV{MaxValueBytes: customLimit}
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), allowOwners(testOwner), kvLimits)
	ctx := serviceCtx(t)

	// Body is 10× the limit — without LimitReader the handler would read all of it.
	innerData := bytes.Repeat([]byte("x"), customLimit*10)
	counter := &readCounter{Reader: bytes.NewReader(innerData)}

	req := newReq(t, http.MethodPut, "/kv/"+testOwner+"/"+testKey, "kv", counter, testOwner, testKey)
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusRequestEntityTooLarge, w.Code)
	assert.LessOrEqual(t, counter.N, customLimit+1, "LimitReader must not read more than maxValueBytes+1 bytes")
}

// ─── Finding 3: oversize batch body → 413 ────────────────────────────────────

func TestKVConnector_Batch_OversizeBody_Returns413(t *testing.T) {
	t.Parallel()
	const customLimit = 64 // very small for test speed
	kvLimits := &app.ManifestVersionKindKV{MaxValueBytes: customLimit}
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), allowOwners(testOwner), kvLimits)
	ctx := serviceCtx(t)

	// Compute the batch body limit and send one byte over it.
	batchBodyLimit := int64(kv.MaxBatchOps)*int64(customLimit+kvBatchOpJSONOverhead) + 128
	oversizedBody := bytes.Repeat([]byte("x"), int(batchBodyLimit)+1)

	req := newReq(t, http.MethodPost, "/kv:batch", "kv:batch", bytes.NewReader(oversizedBody))
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusRequestEntityTooLarge, w.Code, "oversize batch body must return 413")
}

// ─── Finding 4: writeGRPCError must not leak "rpc error" text ────────────────

// TestKVConnector_WriteGRPCError_4xx_NoRPCText verifies that 4xx gRPC errors
// use the bare gRPC message, not the full "rpc error: code = … desc = …" string.
func TestKVConnector_WriteGRPCError_4xx_NoRPCText(t *testing.T) {
	t.Parallel()
	grpcErr := grpcstatus.Error(codes.NotFound, "key not found")
	c := NewKVConnector(testGR, successGetter(testNS, testName),
		&fixedErrorKVClient{err: grpcErr}, allowOwners(testOwner), nil)
	ctx := serviceCtx(t)

	req := newReq(t, http.MethodGet, "/kv/"+testOwner+"/"+testKey, "kv", nil, testOwner, testKey)
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
	body := w.Body.String()
	assert.NotContains(t, body, "rpc error", "response body must not contain raw gRPC error text")
}

// TestKVConnector_WriteGRPCError_5xx_Generic verifies that unknown gRPC codes
// produce a generic 500 body without internal details.
func TestKVConnector_WriteGRPCError_5xx_Generic(t *testing.T) {
	t.Parallel()
	grpcErr := grpcstatus.Error(codes.Internal, "internal storage failure: bad block at offset 42")
	c := NewKVConnector(testGR, successGetter(testNS, testName),
		&fixedErrorKVClient{err: grpcErr}, allowOwners(testOwner), nil)
	ctx := serviceCtx(t)

	req := newReq(t, http.MethodGet, "/kv/"+testOwner+"/"+testKey, "kv", nil, testOwner, testKey)
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	body := w.Body.String()
	assert.NotContains(t, body, "rpc error", "5xx body must not contain raw gRPC error text")
	assert.NotContains(t, body, "bad block", "5xx body must not contain internal detail")
}

// ─── Finding 5: checkWriteAuthz error → generic 500 ──────────────────────────

func TestKVConnector_CheckWriteAuthz_ErrorAC_Returns500Generic(t *testing.T) {
	t.Parallel()
	internalErr := fmt.Errorf("db: connection timeout to authz-store at 10.0.0.1:5432")
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t),
		&erroringAC{err: internalErr}, nil)
	ctx := serviceCtx(t)

	req := newReq(t, http.MethodPut, "/kv/"+testOwner+"/"+testKey, "kv", bytes.NewReader([]byte(`{}`)), testOwner, testKey)
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	body := w.Body.String()
	assert.NotContains(t, body, "db:", "500 body must not expose internal error details")
	assert.NotContains(t, body, "authz-store", "500 body must not expose internal error details")
}

// ─── Finding 6: unknown batch mode → 400 ─────────────────────────────────────

func TestKVConnector_Batch_UnknownMode_Returns400(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		mode string
	}{
		{"empty mode", ""},
		{"unknown mode", "UPSERT"},
		{"typo mode", "DELET"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), allowOwners(testOwner), nil)
			ctx := serviceCtx(t)

			batch := kvBatchRequest{Ops: []kvBatchOpJSON{
				{Mode: tc.mode, Owner: testOwner, Key: testKey, Value: json.RawMessage(`{"v":1}`)},
			}}
			body, _ := json.Marshal(batch)
			req := newReq(t, http.MethodPost, "/kv:batch", "kv:batch", bytes.NewReader(body))
			w := connectAndServe(t, c, ctx, req)

			assert.Equal(t, http.StatusBadRequest, w.Code, "mode=%q must return 400", tc.mode)
		})
	}
}

// ─── Finding 8: user identity tests ──────────────────────────────────────────

// TestKVConnector_UserIdentity_GET verifies that a user identity (non-service)
// can perform a GET once a value has been written (no kv:write required for
// reads; the kv:write grant has no role in GET path).
func TestKVConnector_UserIdentity_GET(t *testing.T) {
	t.Parallel()
	kvClient := newKVClient(t)
	svcCtx := serviceCtx(t)
	// Write a value first using a service identity with write permission.
	c := NewKVConnector(testGR, successGetter(testNS, testName), kvClient, allowOwners(testOwner), nil)
	saveKV(t, c, svcCtx, testOwner, testKey, []byte(`{"user_get":true}`))

	// Now GET using a user identity (parent "read" is already satisfied by the
	// successGetter; the gRPC server only checks that some identity is present).
	getReq := newReqUser(t, http.MethodGet, "/kv/"+testOwner+"/"+testKey, "kv", nil, testOwner, testKey)
	getW := connectAndServe(t, c, context.Background(), getReq)

	require.Equal(t, http.StatusOK, getW.Code, "user identity must be able to GET")
	assert.JSONEq(t, `{"user_get":true}`, getW.Body.String())
}

// TestKVConnector_UserIdentity_PUT_NoPermission verifies that a user without
// kv:write gets 403.
func TestKVConnector_UserIdentity_PUT_NoPermission(t *testing.T) {
	t.Parallel()
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), denyAll(), nil)

	req := newReqUser(t, http.MethodPut, "/kv/"+testOwner+"/"+testKey, "kv",
		bytes.NewReader([]byte(`{"v":1}`)), testOwner, testKey)
	w := connectAndServe(t, c, context.Background(), req)

	assert.Equal(t, http.StatusForbidden, w.Code, "user without kv:write must get 403")
}

// TestKVConnector_UserIdentity_PUT_WithPermission verifies that a user with
// kv:write on the owner can PUT successfully.
func TestKVConnector_UserIdentity_PUT_WithPermission(t *testing.T) {
	t.Parallel()
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), allowOwners(testOwner), nil)

	req := newReqUser(t, http.MethodPut, "/kv/"+testOwner+"/"+testKey, "kv",
		bytes.NewReader([]byte(`{"user_put":true}`)), testOwner, testKey)
	w := connectAndServe(t, c, context.Background(), req)

	assert.Equal(t, http.StatusNoContent, w.Code, "user with kv:write must be able to PUT")
}

// ─── Finding 10: POST on kv subresource → 405 ────────────────────────────────

func TestKVConnector_POST_KV_Returns405(t *testing.T) {
	t.Parallel()
	c := NewKVConnector(testGR, successGetter(testNS, testName), newKVClient(t), denyAll(), nil)
	ctx := serviceCtx(t)

	// POST is valid only on kv:batch, not on the plain kv subresource.
	req := newReq(t, http.MethodPost, "/kv", "kv", bytes.NewReader([]byte(`{}`)))
	w := connectAndServe(t, c, ctx, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code, "POST on kv (not kv:batch) must return 405")
}
