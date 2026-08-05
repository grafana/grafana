package resource

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authnlib "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

// fakeWriteStore implements vectorWriteStore for handler tests.
type fakeWriteStore struct {
	// EnsureCollection/ResolveCollection behavior
	resolveFound bool
	collection   vector.Collection
	ensureErr    error
	resolveErr   error

	// recorded calls
	ensured      []string // "group/resource"
	upserts      [][]vector.Vector
	upsertErr    error
	replaceCalls []replaceCall
	replaceErr   error
	stored       map[string]string // subresource -> content (GetSubresourceContent)
	storedFolder string
	deleteCalls  []deleteRowsCall
	deleteErr    error
	deleted      int64
	hasMore      bool
	lockCalls    int
}

type replaceCall struct {
	Namespace, Model, Resource, UID string
	Changed                         []vector.Vector
	MetadataOnly                    []vector.VectorMeta
	Desired                         []string
}

type deleteRowsCall struct {
	Namespace, Model, Resource string
	Sel                        vector.DeleteSelector
}

func (f *fakeWriteStore) ResolveCollection(_ context.Context, group, resource string) (vector.Collection, bool, error) {
	if f.resolveErr != nil {
		return vector.Collection{}, false, f.resolveErr
	}
	if !f.resolveFound {
		return vector.Collection{}, false, nil
	}
	return f.collectionFor(group, resource), true, nil
}

func (f *fakeWriteStore) EnsureCollection(_ context.Context, group, resource string, isExternal bool) (vector.Collection, error) {
	if f.ensureErr != nil {
		return vector.Collection{}, f.ensureErr
	}
	f.ensured = append(f.ensured, group+"/"+resource)
	return f.collectionFor(group, resource), nil
}

func (f *fakeWriteStore) collectionFor(group, resource string) vector.Collection {
	if f.collection.PartitionKey != "" {
		return f.collection
	}
	return vector.Collection{Group: group, Resource: resource, PartitionKey: resource + "_external", IsExternal: true}
}

func (f *fakeWriteStore) Upsert(_ context.Context, vs []vector.Vector) error {
	if f.upsertErr != nil {
		return f.upsertErr
	}
	f.upserts = append(f.upserts, vs)
	return nil
}

func (f *fakeWriteStore) UpsertReplaceSubresources(_ context.Context, ns, model, res, uid string, changed []vector.Vector, metadataOnly []vector.VectorMeta, desired []string) error {
	if f.replaceErr != nil {
		return f.replaceErr
	}
	f.replaceCalls = append(f.replaceCalls, replaceCall{ns, model, res, uid, changed, metadataOnly, desired})
	return nil
}

func (f *fakeWriteStore) GetSubresourceContent(context.Context, string, string, string, string) (map[string]string, string, error) {
	return f.stored, f.storedFolder, nil
}

func (f *fakeWriteStore) DeleteRows(_ context.Context, ns, model, res string, sel vector.DeleteSelector) (int64, bool, error) {
	if f.deleteErr != nil {
		return 0, false, f.deleteErr
	}
	f.deleteCalls = append(f.deleteCalls, deleteRowsCall{ns, model, res, sel})
	return f.deleted, f.hasMore, nil
}

func (f *fakeWriteStore) WithEntityLock(ctx context.Context, _, _, _ string, fn func(context.Context) error) error {
	f.lockCalls++
	return fn(ctx)
}

func newTestVectorStoreServer(store *fakeWriteStore) *VectorStoreServer {
	s := NewVectorStoreServer(nil, newTestEmbedder(&fakeTextEmbedder{dim: 4}), []string{"g/r"}, nil, nil)
	s.store = store // swap the nil concrete backend for the fake
	return s
}

func vsAuthedCtx() context.Context {
	return vsAuthedCtxAs("")
}

// vsAuthedCtxAs builds an authed context carrying the given service identity
// ("" = a token with no serviceIdentity claim).
func vsAuthedCtxAs(service string) context.Context {
	r := &identity.StaticRequester{UserID: 1, UserUID: "u", Namespace: "ns", Type: authlib.TypeUser}
	if service != "" {
		r.AccessTokenClaims = &authnlib.Claims[authnlib.AccessTokenClaims]{
			Rest: authnlib.AccessTokenClaims{ServiceIdentity: service},
		}
	}
	return authlib.WithAuthInfo(context.Background(), r)
}

func TestVectorStore_ServiceIdentityGate(t *testing.T) {
	s := newTestVectorStoreServer(&fakeWriteStore{})
	s.allowedServices = map[string]struct{}{"assistant": {}}

	// Allowed identity passes.
	_, err := s.Upsert(vsAuthedCtxAs("assistant"), validUpsertReq())
	require.NoError(t, err)

	// Wrong identity and identity-less tokens are denied.
	for _, svc := range []string{"intruder", ""} {
		_, err = s.Upsert(vsAuthedCtxAs(svc), validUpsertReq())
		require.Error(t, err)
		assert.Equal(t, codes.PermissionDenied, status.Code(err), "service %q", svc)
	}

	// Empty config = no restriction.
	s.allowedServices = nil
	_, err = s.Upsert(vsAuthedCtx(), validUpsertReq())
	require.NoError(t, err)

	// A stray comma in the config (empty entry) must not admit
	// identity-less tokens.
	s = newTestVectorStoreServer(&fakeWriteStore{})
	s2 := NewVectorStoreServer(nil, newTestEmbedder(&fakeTextEmbedder{dim: 4}), []string{"g/r"}, []string{"", "assistant"}, nil)
	s2.store = s.store
	_, err = s2.Upsert(vsAuthedCtx(), validUpsertReq())
	require.Error(t, err)
	assert.Equal(t, codes.PermissionDenied, status.Code(err))
	_, err = s2.Upsert(vsAuthedCtxAs("assistant"), validUpsertReq())
	require.NoError(t, err)
}

func validUpsertReq() *resourcepb.VectorUpsertRequest {
	return &resourcepb.VectorUpsertRequest{
		Namespace: "ns", Group: "g", Resource: "r",
		Inputs: []*resourcepb.EmbeddingInput{{Uid: "u1", Content: "hello", Title: "T"}},
	}
}

func TestVectorStore_NoIdentityIsUnauthenticated(t *testing.T) {
	s := newTestVectorStoreServer(&fakeWriteStore{})
	_, err := s.Upsert(context.Background(), validUpsertReq())
	require.Error(t, err)
	assert.Equal(t, codes.Unauthenticated, status.Code(err))
}

func TestVectorStore_NamespaceMismatchIsPermissionDenied(t *testing.T) {
	s := newTestVectorStoreServer(&fakeWriteStore{})
	ctx := authlib.WithAuthInfo(context.Background(),
		&identity.StaticRequester{UserID: 1, UserUID: "u", Namespace: "other", Type: authlib.TypeUser})
	_, err := s.Upsert(ctx, validUpsertReq())
	require.Error(t, err)
	assert.Equal(t, codes.PermissionDenied, status.Code(err))
}

func TestVectorStore_CollectionNotAllowlistedIsNotFound(t *testing.T) {
	s := newTestVectorStoreServer(&fakeWriteStore{})
	req := validUpsertReq()
	req.Group = "not-allowed"
	_, err := s.Upsert(vsAuthedCtx(), req)
	require.Error(t, err)
	assert.Equal(t, codes.NotFound, status.Code(err))
}

func TestVectorStore_MissingKeyFieldsIsInvalidArgument(t *testing.T) {
	s := newTestVectorStoreServer(&fakeWriteStore{})
	for _, mutate := range []func(*resourcepb.VectorUpsertRequest){
		func(r *resourcepb.VectorUpsertRequest) { r.Namespace = "" },
		func(r *resourcepb.VectorUpsertRequest) { r.Group = "" },
		func(r *resourcepb.VectorUpsertRequest) { r.Resource = "" },
	} {
		req := validUpsertReq()
		mutate(req)
		_, err := s.Upsert(vsAuthedCtx(), req)
		require.Error(t, err)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
	}
}

func TestVectorStore_UpdateMetadataUnimplemented(t *testing.T) {
	s := newTestVectorStoreServer(&fakeWriteStore{})
	_, err := s.UpdateMetadata(vsAuthedCtx(), &resourcepb.VectorUpdateMetadataRequest{
		Namespace: "ns", Group: "g", Resource: "r", Filter: []byte(`{}`), Set: []byte(`{}`),
	})
	require.Error(t, err)
	assert.Equal(t, codes.Unimplemented, status.Code(err))
}

func TestVectorStore_UpsertHappyPath(t *testing.T) {
	store := &fakeWriteStore{}
	s := newTestVectorStoreServer(store)

	resp, err := s.Upsert(vsAuthedCtx(), &resourcepb.VectorUpsertRequest{
		Namespace: "ns", Group: "g", Resource: "r",
		Inputs: []*resourcepb.EmbeddingInput{
			{Uid: "u1", Content: "hello", Title: "One", Metadata: []byte(`{"k":"v"}`)},
			{Uid: "u2", Subresource: "chunk/1", Content: "world", Title: "Two"},
		},
	})
	require.NoError(t, err)
	assert.EqualValues(t, 2, resp.Upserted)
	assert.Empty(t, resp.Failures)

	// Provisioned exactly once, then wrote both rows with the partition key.
	assert.Equal(t, []string{"g/r"}, store.ensured)
	require.Len(t, store.upserts, 1)
	rows := store.upserts[0]
	require.Len(t, rows, 2)
	assert.Equal(t, "r_external", rows[0].Resource, "rows carry the partition key, not the resource name")
	assert.Equal(t, "ns", rows[0].Namespace)
	assert.Equal(t, "test/model-1", rows[0].Model)
	assert.Equal(t, "u1", rows[0].UID)
	assert.Equal(t, "One", rows[0].Title)
	assert.Equal(t, "hello", rows[0].Content)
	assert.NotEmpty(t, rows[0].Embedding)
	assert.Equal(t, "chunk/1", rows[1].Subresource)
}

func TestVectorStore_UpsertValidation(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*resourcepb.VectorUpsertRequest)
	}{
		{"empty inputs", func(r *resourcepb.VectorUpsertRequest) { r.Inputs = nil }},
		{"too many inputs", func(r *resourcepb.VectorUpsertRequest) {
			r.Inputs = make([]*resourcepb.EmbeddingInput, 501)
			for i := range r.Inputs {
				r.Inputs[i] = &resourcepb.EmbeddingInput{Uid: "u", Content: "c", Title: "t"}
			}
		}},
		{"missing uid", func(r *resourcepb.VectorUpsertRequest) { r.Inputs[0].Uid = "" }},
		{"missing content", func(r *resourcepb.VectorUpsertRequest) { r.Inputs[0].Content = "" }},
		{"missing title", func(r *resourcepb.VectorUpsertRequest) { r.Inputs[0].Title = "" }},
		{"oversized metadata", func(r *resourcepb.VectorUpsertRequest) {
			r.Inputs[0].Metadata = []byte(`{"k":"` + strings.Repeat("x", 4096) + `"}`)
		}},
		{"invalid metadata json", func(r *resourcepb.VectorUpsertRequest) { r.Inputs[0].Metadata = []byte(`{not json`) }},
		{"oversized uid", func(r *resourcepb.VectorUpsertRequest) { r.Inputs[0].Uid = strings.Repeat("u", 257) }},
		{"oversized subresource", func(r *resourcepb.VectorUpsertRequest) { r.Inputs[0].Subresource = strings.Repeat("s", 257) }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := &fakeWriteStore{}
			s := newTestVectorStoreServer(store)
			req := validUpsertReq()
			tc.mutate(req)
			_, err := s.Upsert(vsAuthedCtx(), req)
			require.Error(t, err)
			assert.Equal(t, codes.InvalidArgument, status.Code(err))
			assert.Empty(t, store.ensured, "validation failures must not provision")
			assert.Empty(t, store.upserts)
		})
	}
}

func TestVectorStore_UpsertEmbedFailureIsInternal(t *testing.T) {
	store := &fakeWriteStore{}
	s := NewVectorStoreServer(nil, newTestEmbedder(&fakeTextEmbedder{dim: 4, wantErr: errors.New("provider down")}), []string{"g/r"}, nil, nil)
	s.store = store
	_, err := s.Upsert(vsAuthedCtx(), validUpsertReq())
	require.Error(t, err)
	assert.Equal(t, codes.Internal, status.Code(err))
	assert.Empty(t, store.upserts)
}

func TestVectorStore_UpsertStorageFailureIsInternal(t *testing.T) {
	store := &fakeWriteStore{upsertErr: errors.New("db down")}
	s := newTestVectorStoreServer(store)
	_, err := s.Upsert(vsAuthedCtx(), validUpsertReq())
	require.Error(t, err)
	assert.Equal(t, codes.Internal, status.Code(err))
}

func TestVectorStore_UpsertSubresourcesDiff(t *testing.T) {
	// Stored: chunk/1 (same content), chunk/2 (old content), chunk/3 (going away).
	// Inputs: chunk/1 (unchanged -> metadataOnly), chunk/2 (changed -> re-embed), chunk/4 (new -> embed).
	store := &fakeWriteStore{stored: map[string]string{
		"chunk/1": "same", "chunk/2": "old", "chunk/3": "gone",
	}}
	s := newTestVectorStoreServer(store)

	resp, err := s.UpsertSubresources(vsAuthedCtx(), &resourcepb.VectorUpsertSubresourcesRequest{
		Namespace: "ns", Group: "g", Resource: "r", Uid: "ent-1",
		Inputs: []*resourcepb.EmbeddingInput{
			{Subresource: "chunk/1", Content: "same", Title: "T1", Metadata: []byte(`{"embeddedAt":2}`)},
			{Subresource: "chunk/2", Content: "new", Title: "T2"},
			{Subresource: "chunk/4", Content: "brand", Title: "T4"},
		},
	})
	require.NoError(t, err)
	assert.EqualValues(t, 1, resp.Created) // chunk/4
	assert.EqualValues(t, 1, resp.Updated) // chunk/2
	assert.EqualValues(t, 1, resp.Deleted) // chunk/3

	assert.Equal(t, 1, store.lockCalls, "flow runs under the entity lock")
	require.Len(t, store.replaceCalls, 1)
	call := store.replaceCalls[0]
	assert.Equal(t, "ent-1", call.UID)
	assert.Equal(t, "r_external", call.Resource)
	assert.ElementsMatch(t, []string{"chunk/1", "chunk/2", "chunk/4"}, call.Desired)
	require.Len(t, call.Changed, 2) // chunk/2 + chunk/4 embedded
	require.Len(t, call.MetadataOnly, 1)
	assert.Equal(t, "chunk/1", call.MetadataOnly[0].Subresource)
	assert.JSONEq(t, `{"embeddedAt":2}`, string(call.MetadataOnly[0].Metadata))
}

func TestVectorStore_UpsertSubresourcesValidation(t *testing.T) {
	store := &fakeWriteStore{}
	s := newTestVectorStoreServer(store)

	// Missing uid.
	_, err := s.UpsertSubresources(vsAuthedCtx(), &resourcepb.VectorUpsertSubresourcesRequest{
		Namespace: "ns", Group: "g", Resource: "r",
		Inputs: []*resourcepb.EmbeddingInput{{Subresource: "c", Content: "x", Title: "t"}},
	})
	require.Error(t, err)
	assert.Equal(t, codes.InvalidArgument, status.Code(err))

	// Empty inputs.
	_, err = s.UpsertSubresources(vsAuthedCtx(), &resourcepb.VectorUpsertSubresourcesRequest{
		Namespace: "ns", Group: "g", Resource: "r", Uid: "e",
	})
	require.Error(t, err)
	assert.Equal(t, codes.InvalidArgument, status.Code(err))

	// Oversized request uid.
	_, err = s.UpsertSubresources(vsAuthedCtx(), &resourcepb.VectorUpsertSubresourcesRequest{
		Namespace: "ns", Group: "g", Resource: "r", Uid: strings.Repeat("e", 257),
		Inputs: []*resourcepb.EmbeddingInput{{Subresource: "c", Content: "x", Title: "t"}},
	})
	require.Error(t, err)
	assert.Equal(t, codes.InvalidArgument, status.Code(err))

	// Mismatched input uid.
	_, err = s.UpsertSubresources(vsAuthedCtx(), &resourcepb.VectorUpsertSubresourcesRequest{
		Namespace: "ns", Group: "g", Resource: "r", Uid: "e",
		Inputs: []*resourcepb.EmbeddingInput{{Uid: "other", Subresource: "c", Content: "x", Title: "t"}},
	})
	require.Error(t, err)
	assert.Equal(t, codes.InvalidArgument, status.Code(err))

	// Duplicate subresource in inputs.
	_, err = s.UpsertSubresources(vsAuthedCtx(), &resourcepb.VectorUpsertSubresourcesRequest{
		Namespace: "ns", Group: "g", Resource: "r", Uid: "e",
		Inputs: []*resourcepb.EmbeddingInput{
			{Subresource: "c", Content: "x", Title: "t"},
			{Subresource: "c", Content: "y", Title: "t"},
		},
	})
	require.Error(t, err)
	assert.Equal(t, codes.InvalidArgument, status.Code(err))
}

func TestVectorStore_DeleteByUIDs(t *testing.T) {
	store := &fakeWriteStore{resolveFound: true, deleted: 3}
	s := newTestVectorStoreServer(store)

	resp, err := s.Delete(vsAuthedCtx(), &resourcepb.VectorDeleteRequest{
		Namespace: "ns", Group: "g", Resource: "r",
		Selector: &resourcepb.VectorDeleteRequest_Uids{Uids: &resourcepb.StringList{Values: []string{"u1", "u2"}}},
	})
	require.NoError(t, err)
	assert.EqualValues(t, 3, resp.Deleted)
	assert.False(t, resp.HasMore)
	require.Len(t, store.deleteCalls, 1)
	assert.Equal(t, []string{"u1", "u2"}, store.deleteCalls[0].Sel.UIDs)
	assert.Equal(t, "r_external", store.deleteCalls[0].Resource)
	assert.Empty(t, store.ensured, "delete must never provision")
}

func TestVectorStore_DeleteAll(t *testing.T) {
	store := &fakeWriteStore{resolveFound: true, deleted: 10000, hasMore: true}
	s := newTestVectorStoreServer(store)

	resp, err := s.Delete(vsAuthedCtx(), &resourcepb.VectorDeleteRequest{
		Namespace: "ns", Group: "g", Resource: "r",
		Selector: &resourcepb.VectorDeleteRequest_DeleteAll{DeleteAll: true},
	})
	require.NoError(t, err)
	assert.EqualValues(t, 10000, resp.Deleted)
	assert.True(t, resp.HasMore)
	require.Len(t, store.deleteCalls, 1)
	assert.True(t, store.deleteCalls[0].Sel.All)
	assert.Equal(t, 10000, store.deleteCalls[0].Sel.Limit)
}

func TestVectorStore_DeleteSelectorValidation(t *testing.T) {
	store := &fakeWriteStore{resolveFound: true}
	s := newTestVectorStoreServer(store)

	// No selector.
	_, err := s.Delete(vsAuthedCtx(), &resourcepb.VectorDeleteRequest{Namespace: "ns", Group: "g", Resource: "r"})
	require.Error(t, err)
	assert.Equal(t, codes.InvalidArgument, status.Code(err))

	// delete_all=false.
	_, err = s.Delete(vsAuthedCtx(), &resourcepb.VectorDeleteRequest{
		Namespace: "ns", Group: "g", Resource: "r",
		Selector: &resourcepb.VectorDeleteRequest_DeleteAll{DeleteAll: false},
	})
	require.Error(t, err)
	assert.Equal(t, codes.InvalidArgument, status.Code(err))

	// Empty uids list.
	_, err = s.Delete(vsAuthedCtx(), &resourcepb.VectorDeleteRequest{
		Namespace: "ns", Group: "g", Resource: "r",
		Selector: &resourcepb.VectorDeleteRequest_Uids{Uids: &resourcepb.StringList{}},
	})
	require.Error(t, err)
	assert.Equal(t, codes.InvalidArgument, status.Code(err))

	// Too many uids.
	many := make([]string, 501)
	for i := range many {
		many[i] = "u"
	}
	_, err = s.Delete(vsAuthedCtx(), &resourcepb.VectorDeleteRequest{
		Namespace: "ns", Group: "g", Resource: "r",
		Selector: &resourcepb.VectorDeleteRequest_Uids{Uids: &resourcepb.StringList{Values: many}},
	})
	require.Error(t, err)
	assert.Equal(t, codes.InvalidArgument, status.Code(err))

	// Filter selector ships with the metadata filter dialect.
	_, err = s.Delete(vsAuthedCtx(), &resourcepb.VectorDeleteRequest{
		Namespace: "ns", Group: "g", Resource: "r",
		Selector: &resourcepb.VectorDeleteRequest_Filter{Filter: []byte(`{}`)},
	})
	require.Error(t, err)
	assert.Equal(t, codes.Unimplemented, status.Code(err))
}

func TestVectorStore_DeleteUnprovisionedIsNotFound(t *testing.T) {
	store := &fakeWriteStore{resolveFound: false}
	s := newTestVectorStoreServer(store)
	_, err := s.Delete(vsAuthedCtx(), &resourcepb.VectorDeleteRequest{
		Namespace: "ns", Group: "g", Resource: "r",
		Selector: &resourcepb.VectorDeleteRequest_Uids{Uids: &resourcepb.StringList{Values: []string{"u"}}},
	})
	require.Error(t, err)
	assert.Equal(t, codes.NotFound, status.Code(err))
}

func TestVectorStore_DeleteInternalCollectionIsNotFound(t *testing.T) {
	// A fat-fingered vector_allowed_external_collections entry naming an
	// internal pair must not let external callers delete its rows, nor
	// learn it exists: same NotFound as an unprovisioned collection.
	store := &fakeWriteStore{
		resolveFound: true,
		collection:   vector.Collection{Group: "g", Resource: "r", PartitionKey: "r", IsExternal: false},
	}
	s := newTestVectorStoreServer(store)
	_, err := s.Delete(vsAuthedCtx(), &resourcepb.VectorDeleteRequest{
		Namespace: "ns", Group: "g", Resource: "r",
		Selector: &resourcepb.VectorDeleteRequest_Uids{Uids: &resourcepb.StringList{Values: []string{"u"}}},
	})
	require.Error(t, err)
	assert.Equal(t, codes.NotFound, status.Code(err))
	assert.Empty(t, store.deleteCalls, "must not delete rows for an internal collection")
}

func TestVectorStore_DeleteResolveFailureWithCancelledContextIsCanceled(t *testing.T) {
	store := &fakeWriteStore{resolveErr: errors.New("db down")}
	s := newTestVectorStoreServer(store)
	ctx, cancel := context.WithCancel(vsAuthedCtx())
	cancel()

	_, err := s.Delete(ctx, &resourcepb.VectorDeleteRequest{
		Namespace: "ns", Group: "g", Resource: "r",
		Selector: &resourcepb.VectorDeleteRequest_Uids{Uids: &resourcepb.StringList{Values: []string{"u"}}},
	})
	require.Error(t, err)
	assert.Equal(t, codes.Canceled, status.Code(err), "a dead caller context wins over the downstream fault")
}

func TestVectorStore_UpsertSubresourcesNoChangesSkipsEmbed(t *testing.T) {
	fake := &fakeTextEmbedder{dim: 4}
	store := &fakeWriteStore{stored: map[string]string{"c": "same"}}
	s := NewVectorStoreServer(nil, newTestEmbedder(fake), []string{"g/r"}, nil, nil)
	s.store = store

	resp, err := s.UpsertSubresources(vsAuthedCtx(), &resourcepb.VectorUpsertSubresourcesRequest{
		Namespace: "ns", Group: "g", Resource: "r", Uid: "e",
		Inputs: []*resourcepb.EmbeddingInput{{Subresource: "c", Content: "same", Title: "t", Metadata: []byte(`{"m":1}`)}},
	})
	require.NoError(t, err)
	assert.Zero(t, resp.Created+resp.Updated+resp.Deleted)
	assert.Empty(t, fake.gotIn.Texts, "nothing embedded")
	require.Len(t, store.replaceCalls, 1, "metadataOnly still written")
	assert.Len(t, store.replaceCalls[0].MetadataOnly, 1)
}

func TestVectorStore_UpsertEmbedQuotaErrorKeepsRetryableCode(t *testing.T) {
	// A provider error already carrying a retryable gRPC code must pass
	// through so client retry policies keyed on ResourceExhausted work.
	store := &fakeWriteStore{}
	s := NewVectorStoreServer(nil, newTestEmbedder(&fakeTextEmbedder{
		dim: 4, wantErr: status.Error(codes.ResourceExhausted, "provider quota"),
	}), []string{"g/r"}, nil, nil)
	s.store = store

	_, err := s.Upsert(vsAuthedCtx(), validUpsertReq())
	require.Error(t, err)
	assert.Equal(t, codes.ResourceExhausted, status.Code(err))
	assert.Empty(t, store.upserts)
}

func TestWriteStatusError_NilErrorIsInternal(t *testing.T) {
	// The embed count-mismatch path passes a nil error; must not panic and
	// must map to Internal.
	err := writeStatusError(context.Background(), nil, "boom")
	require.Error(t, err)
	assert.Equal(t, codes.Internal, status.Code(err))
}

func TestVectorStore_InternalCollectionMismatchIsNotFound(t *testing.T) {
	// Allowlisted name whose catalog row is internal must answer exactly
	// like an absent collection — not Internal — so callers can't probe.
	store := &fakeWriteStore{ensureErr: fmt.Errorf("collection g/r is internal: %w", vector.ErrCollectionKindMismatch)}
	s := newTestVectorStoreServer(store)

	_, err := s.Upsert(vsAuthedCtx(), validUpsertReq())
	require.Error(t, err)
	assert.Equal(t, codes.NotFound, status.Code(err))

	_, err = s.UpsertSubresources(vsAuthedCtx(), &resourcepb.VectorUpsertSubresourcesRequest{
		Namespace: "ns", Group: "g", Resource: "r", Uid: "u1",
		Inputs: []*resourcepb.EmbeddingInput{{Subresource: "c", Content: "x", Title: "t"}},
	})
	require.Error(t, err)
	assert.Equal(t, codes.NotFound, status.Code(err))
}
