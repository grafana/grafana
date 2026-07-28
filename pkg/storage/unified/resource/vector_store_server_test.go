package resource

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

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
	s := NewVectorStoreServer(nil, newTestEmbedder(&fakeTextEmbedder{dim: 4}), []string{"g/r"}, nil)
	s.store = store // swap the nil concrete backend for the fake
	return s
}

func vsAuthedCtx() context.Context {
	return authlib.WithAuthInfo(context.Background(),
		&identity.StaticRequester{UserID: 1, UserUID: "u", Namespace: "ns", Type: authlib.TypeUser},
	)
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
	s := NewVectorStoreServer(nil, newTestEmbedder(&fakeTextEmbedder{dim: 4, wantErr: errors.New("provider down")}), []string{"g/r"}, nil)
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
