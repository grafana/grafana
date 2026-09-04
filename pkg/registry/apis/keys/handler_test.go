package keys

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Records the request, so a test can assert on what the handler sent.
type fakeStore struct {
	resourcepb.ResourceStoreClient

	calls []*resourcepb.ListRequest
	rsp   *resourcepb.ListResponse
	err   error
}

func (f *fakeStore) List(_ context.Context, req *resourcepb.ListRequest, _ ...grpc.CallOption) (*resourcepb.ListResponse, error) {
	f.calls = append(f.calls, req)
	if f.err != nil {
		return nil, f.err
	}
	if f.rsp != nil {
		return f.rsp, nil
	}
	return &resourcepb.ListResponse{ResourceVersion: 1}, nil
}

const (
	testGroup    = "dashboard.grafana.app"
	testVersion  = "v1beta1"
	testResource = "dashboards"
	testKind     = "Dashboard"
)

func testKind_() kindRef {
	return kindRef{group: testGroup, version: testVersion, resource: testResource, kind: testKind}
}

// The identity a controller gets from identity.WithServiceIdentity, built the
// same way so the test cannot drift from it.
func serviceIdentity() *identity.StaticRequester {
	_, requester := identity.WithServiceIdentity(context.Background(), 1)
	return requester.(*identity.StaticRequester)
}

// Drives the handler as the apiserver would for a cluster-scoped route: no
// namespace in the context.
func do(t *testing.T, store *fakeStore, ident claims.AuthInfo, body string) *httptest.ResponseRecorder {
	t.Helper()

	h := NewHandler(store, noop.NewTracerProvider().Tracer("test"))

	var reader *strings.Reader
	if body == "" {
		reader = strings.NewReader("")
	} else {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(http.MethodPost, "/list-keys", reader)

	ctx := req.Context()
	if ident != nil {
		ctx = claims.WithAuthInfo(ctx, ident)
	}

	rec := httptest.NewRecorder()
	h.ListKeysFor(testKind_())(rec, req.WithContext(ctx))
	return rec
}

func TestListKeys_ProjectsOntoPartialObjectMetadataList(t *testing.T) {
	store := &fakeStore{rsp: &resourcepb.ListResponse{
		ResourceVersion: 4242,
		NextPageToken:   "next-please",
		Items: []*resourcepb.ResourceWrapper{
			{Namespace: "ns-one", Name: "aaa", Folder: "folder-a", ResourceVersion: 11},
			{Namespace: "ns-two", Name: "bbb", ResourceVersion: 22},
		},
	}}

	rec := do(t, store, serviceIdentity(), `{"limit":2}`)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	// Decoded with the real type, not just JSON that looks like one.
	var got metav1.PartialObjectMetadataList
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))

	assert.Equal(t, "PartialObjectMetadataList", got.Kind)
	assert.Equal(t, "meta.k8s.io/v1", got.APIVersion)

	assert.Equal(t, "4242", got.ResourceVersion)
	assert.Equal(t, "next-please", got.Continue)

	require.Len(t, got.Items, 2)
	assert.Equal(t, "ns-one", got.Items[0].Namespace)
	assert.Equal(t, "aaa", got.Items[0].Name)
	assert.Equal(t, "11", got.Items[0].ResourceVersion)
	assert.Equal(t, map[string]string{utils.AnnoKeyFolder: "folder-a"}, got.Items[0].Annotations)

	// No folder stays absent rather than becoming an empty annotation.
	assert.Equal(t, "ns-two", got.Items[1].Namespace)
	assert.Equal(t, "bbb", got.Items[1].Name)
	assert.Equal(t, "22", got.Items[1].ResourceVersion)
	assert.Empty(t, got.Items[1].Annotations)

	require.Len(t, store.calls, 1)
	sent := store.calls[0]
	assert.True(t, sent.KeysOnly, "the handler must set keys_only or it reads whole objects")
	assert.Equal(t, int64(2), sent.Limit)
	assert.Equal(t, testGroup, sent.Options.Key.Group)
	assert.Equal(t, testResource, sent.Options.Key.Resource)
	assert.Empty(t, sent.Options.Key.Namespace,
		"a cluster-scoped list must not pin a namespace, or it silently covers only one")
}

// ListOptions fields must reach the store request unchanged, and an absent body
// must mean defaults rather than an error.
func TestListKeys_TranslatesListOptions(t *testing.T) {
	for name, tc := range map[string]struct {
		body      string
		wantLimit int64
		wantToken string
		wantRV    int64
	}{
		"empty body means defaults": {body: ""},
		"limit only":                {body: `{"limit":5}`, wantLimit: 5},
		"continue token":            {body: `{"continue":"tok"}`, wantToken: "tok"},
		"resource version":          {body: `{"resourceVersion":"999"}`, wantRV: 999},
		"all three": {
			body:      `{"continue":"tok","resourceVersion":"999","limit":5}`,
			wantLimit: 5, wantToken: "tok", wantRV: 999,
		},
	} {
		t.Run(name, func(t *testing.T) {
			store := &fakeStore{}
			rec := do(t, store, serviceIdentity(), tc.body)
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

			require.Len(t, store.calls, 1)
			sent := store.calls[0]
			assert.True(t, sent.KeysOnly)
			assert.Equal(t, tc.wantLimit, sent.Limit)
			assert.Equal(t, tc.wantToken, sent.NextPageToken)
			assert.Equal(t, tc.wantRV, sent.ResourceVersion)
		})
	}
}

// Silently ignoring a selector would hand a reconciliation loop an unfiltered
// list, so this is a trust boundary rather than input tidiness.
func TestListKeys_RejectsUnsupportedListOptions(t *testing.T) {
	for name, body := range map[string]string{
		"labelSelector":        `{"labelSelector":"team=a"}`,
		"fieldSelector":        `{"fieldSelector":"metadata.name=x"}`,
		"watch":                `{"watch":true}`,
		"allowWatchBookmarks":  `{"allowWatchBookmarks":true}`,
		"sendInitialEvents":    `{"sendInitialEvents":true}`,
		"timeoutSeconds":       `{"timeoutSeconds":30}`,
		"resourceVersionMatch": `{"resourceVersionMatch":"Exact"}`,
		"negative limit":       `{"limit":-1}`,
		"unknown field":        `{"nonsense":true}`,
		"wrong kind":           `{"kind":"SearchQuery"}`,
		"bad resourceVersion":  `{"resourceVersion":"not-a-number"}`,
		"two objects":          `{}{}`,
	} {
		t.Run(name, func(t *testing.T) {
			store := &fakeStore{}
			rec := do(t, store, serviceIdentity(), body)
			assert.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
			assert.Empty(t, store.calls, "a rejected request must not reach the store")
		})
	}
}

// Asserting the store was never called matters more than the status code: it is
// what shows the gate runs before any read.
func TestListKeys_ServiceIdentitiesOnly(t *testing.T) {
	withType := func(typ claims.IdentityType) claims.AuthInfo {
		ident := serviceIdentity()
		ident.Type = typ
		return ident
	}

	cases := map[string]struct {
		ident      claims.AuthInfo
		wantStatus int
	}{
		"no identity at all": {ident: nil, wantStatus: http.StatusUnauthorized},
	}
	cases["allowed: service identity"] = struct {
		ident      claims.AuthInfo
		wantStatus int
	}{ident: serviceIdentity(), wantStatus: http.StatusOK}

	// The sharp case: an access policy is the right type, so only the UID
	// distinguishes the service identity from any other token.
	other := serviceIdentity()
	other.UserUID = "some-other-policy"
	cases["refused: another access policy"] = struct {
		ident      claims.AuthInfo
		wantStatus int
	}{ident: other, wantStatus: http.StatusForbidden}

	for _, typ := range []claims.IdentityType{
		claims.TypeServiceAccount,
		claims.TypeUser,
		claims.TypeAPIKey,
		claims.TypeAnonymous,
		claims.TypeRenderService,
		claims.TypeUnauthenticated,
		claims.TypeProvisioning,
		claims.TypePublic,
		claims.TypeEmpty,
	} {
		cases["refused: "+string(typ)] = struct {
			ident      claims.AuthInfo
			wantStatus int
		}{ident: withType(typ), wantStatus: http.StatusForbidden}
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			store := &fakeStore{}
			rec := do(t, store, tc.ident, `{}`)
			require.Equal(t, tc.wantStatus, rec.Code, rec.Body.String())

			if tc.wantStatus == http.StatusOK {
				assert.Len(t, store.calls, 1)
				return
			}
			assert.Empty(t, store.calls, "a refused caller must not reach the store")
		})
	}
}

// The read is cluster-wide, so only a caller scoped to every namespace may make
// it. A narrower one would otherwise reach the resource server and fail partway
// with a namespace mismatch over a partial page instead of a clean refusal.
func TestListKeys_RequiresWildcardNamespaceScope(t *testing.T) {
	for name, tc := range map[string]struct {
		namespace  string
		wantStatus int
	}{
		"all namespaces":                {"*", http.StatusOK},
		"single tenant service account": {"default", http.StatusForbidden},
		"multi tenant stack":            {"stacks-1234", http.StatusForbidden},
		"org scoped":                    {"org-3", http.StatusForbidden},
		"unscoped":                      {"", http.StatusForbidden},
		// The case the wildcard check exists for: WithProvisioningIdentity also
		// satisfies IsServiceIdentity, but is scoped to one namespace.
		"provisioning identity": {"stacks-1234", http.StatusForbidden},
	} {
		t.Run(name, func(t *testing.T) {
			store := &fakeStore{}
			ident := serviceIdentity()
			ident.Namespace = tc.namespace

			rec := do(t, store, ident, `{}`)
			require.Equal(t, tc.wantStatus, rec.Code, rec.Body.String())

			if tc.wantStatus != http.StatusOK {
				assert.Empty(t, store.calls, "a refused caller must not reach the store")
				return
			}
			require.Len(t, store.calls, 1)
			assert.Empty(t, store.calls[0].Options.Key.Namespace)
		})
	}
}

// The backend reports failures in the payload as well as over the transport, so
// both have to become an HTTP status rather than a 200 with no items.
func TestListKeys_SurfacesErrors(t *testing.T) {
	for name, tc := range map[string]struct {
		store    *fakeStore
		wantCode int
		exact    bool
	}{
		"payload error": {
			store: &fakeStore{rsp: &resourcepb.ListResponse{
				Error: &resourcepb.ErrorResult{Code: http.StatusBadRequest, Message: "nope"},
			}},
			wantCode: http.StatusBadRequest,
		},
		"transport error": {
			store:    &fakeStore{err: fmt.Errorf("boom")},
			wantCode: http.StatusInternalServerError,
		},
		// A gRPC status carries the real result in its details; flattening the
		// error instead would report this as a 500.
		"grpc status details": {
			store:    &fakeStore{err: grpcStatusWithResult(http.StatusBadRequest, "Invalid", "bad selector")},
			wantCode: http.StatusBadRequest,
			exact:    true,
		},
	} {
		t.Run(name, func(t *testing.T) {
			rec := do(t, tc.store, serviceIdentity(), `{}`)
			if tc.exact {
				require.Equal(t, tc.wantCode, rec.Code, rec.Body.String())
				return
			}
			assert.GreaterOrEqual(t, rec.Code, tc.wantCode, rec.Body.String())
			assert.NotEqual(t, http.StatusOK, rec.Code)
		})
	}
}

// Mirrors how the resource server reports a failure over gRPC: a status whose
// details carry the structured ErrorResult.
func grpcStatusWithResult(code int32, reason, msg string) error {
	st, err := status.New(codes.InvalidArgument, msg).WithDetails(
		&resourcepb.ErrorResult{Code: code, Reason: reason, Message: msg},
	)
	if err != nil {
		panic(err)
	}
	return st.Err()
}

// Items from many namespaces come back in one page, each carrying its own.
func TestListKeys_ReportsPerItemNamespace(t *testing.T) {
	store := &fakeStore{rsp: &resourcepb.ListResponse{
		ResourceVersion: 7,
		Items: []*resourcepb.ResourceWrapper{
			{Namespace: "ns-one", Name: "aaa", ResourceVersion: 1},
			{Namespace: "ns-two", Name: "bbb", ResourceVersion: 2},
			{Namespace: "ns-two", Name: "ccc", ResourceVersion: 3},
		},
	}}

	rec := do(t, store, serviceIdentity(), `{}`)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var got metav1.PartialObjectMetadataList
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got.Items, 3)

	byName := map[string]string{}
	for _, item := range got.Items {
		byName[item.Name] = item.Namespace
	}
	assert.Equal(t, map[string]string{"aaa": "ns-one", "bbb": "ns-two", "ccc": "ns-two"}, byName)
}
