package resource

import (
	"context"
	"errors"

	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

func sharedWriteServer(store *fakeWriteStore) *VectorStoreServer {
	s := NewVectorStoreServer(nil, newTestEmbedder(&fakeTextEmbedder{dim: 4}), nil, nil, []string{"g/r"}, []string{"publisher"}, nil)
	s.store = store
	return s
}

func TestSharedVectorStoreRequiresPublisherAcrossMutations(t *testing.T) {
	store := &fakeWriteStore{resolveFound: true, collection: vector.Collection{Group: "g", Resource: "r", PartitionKey: "r_external", IsExternal: true, Scope: vector.ScopeShared}}
	s := sharedWriteServer(store)
	for _, service := range []string{"", "legacy"} {
		ctx := vsAuthedCtxAs(service)
		_, err := s.Upsert(ctx, validUpsertReq())
		require.Equal(t, codes.PermissionDenied, status.Code(err))
		_, err = s.UpsertSubresources(ctx, &resourcepb.VectorUpsertSubresourcesRequest{Namespace: "ns", Group: "g", Resource: "r", Uid: "u", Inputs: []*resourcepb.EmbeddingInput{{Content: "a", Title: "t"}}})
		require.Equal(t, codes.PermissionDenied, status.Code(err))
		_, err = s.Delete(ctx, &resourcepb.VectorDeleteRequest{Namespace: "ns", Group: "g", Resource: "r", Selector: &resourcepb.VectorDeleteRequest_DeleteAll{DeleteAll: true}})
		require.Equal(t, codes.PermissionDenied, status.Code(err))
		_, err = s.UpdateMetadata(ctx, &resourcepb.VectorUpdateMetadataRequest{Namespace: "ns", Group: "g", Resource: "r", Filter: []byte(`{"x":1}`), Set: []byte(`{"x":2}`)})
		require.Equal(t, codes.PermissionDenied, status.Code(err))
	}
	require.Empty(t, store.upserts)
	require.Empty(t, store.deleteCalls)
	require.Empty(t, store.updateCalls)
}

func TestSharedVectorStoreWritesUseSharedNamespace(t *testing.T) {
	store := &fakeWriteStore{resolveFound: true, collection: vector.Collection{Group: "g", Resource: "r", PartitionKey: "r_external", IsExternal: true, Scope: vector.ScopeShared}}
	s := sharedWriteServer(store)
	ctx := vsAuthedCtxAs("publisher")
	_, err := s.Upsert(ctx, validUpsertReq())
	require.NoError(t, err)
	require.Equal(t, vector.SharedNamespace, store.upserts[0][0].Namespace)
	_, err = s.UpsertSubresources(ctx, &resourcepb.VectorUpsertSubresourcesRequest{Namespace: "ns", Group: "g", Resource: "r", Uid: "u", Inputs: []*resourcepb.EmbeddingInput{{Content: "a", Title: "t"}}})
	require.NoError(t, err)
	require.Equal(t, vector.SharedNamespace, store.replaceCalls[0].Namespace)
	require.Equal(t, vector.SharedNamespace, store.replaceCalls[0].Changed[0].Namespace)
	_, err = s.Delete(ctx, &resourcepb.VectorDeleteRequest{Namespace: "ns", Group: "g", Resource: "r", Selector: &resourcepb.VectorDeleteRequest_DeleteAll{DeleteAll: true}})
	require.NoError(t, err)
	require.Equal(t, vector.SharedNamespace, store.deleteCalls[0].Namespace)
	_, err = s.UpdateMetadata(ctx, &resourcepb.VectorUpdateMetadataRequest{Namespace: "ns", Group: "g", Resource: "r", Filter: []byte(`{"x":1}`), Set: []byte(`{"x":2}`)})
	require.NoError(t, err)
	require.Equal(t, vector.SharedNamespace, store.updateCalls[0].Namespace)
}

func TestSharedVectorStoreRejectsFolders(t *testing.T) {
	store := &fakeWriteStore{}
	s := sharedWriteServer(store)
	embed := &countingTextEmbedder{client: &fakeTextEmbedder{dim: 4}}
	s.embedder.TextEmbedder = embed
	req := validUpsertReq()
	req.Inputs[0].Folder = "private"
	_, err := s.Upsert(vsAuthedCtxAs("publisher"), req)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	_, err = s.UpsertSubresources(vsAuthedCtxAs("publisher"), &resourcepb.VectorUpsertSubresourcesRequest{
		Namespace: "ns", Group: "g", Resource: "r", Uid: "u",
		Inputs: []*resourcepb.EmbeddingInput{{Subresource: "section", Content: "body", Title: "title", Folder: "private"}},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	require.Empty(t, store.ensured, "rejected folders must not provision a collection")
	require.Empty(t, store.upserts)
	require.Empty(t, store.replaceCalls)
	require.Zero(t, embed.calls, "rejected folders must not be embedded")
}

func TestSharedVectorStoreFailsClosedOnPolicyDisagreement(t *testing.T) {
	for _, tc := range []struct {
		name                       string
		legacy, shared, publishers []string
		catalogScope               vector.CollectionScope
		want                       codes.Code
	}{
		{name: "missing enrollment", catalogScope: vector.ScopeShared, want: codes.NotFound},
		{name: "empty publisher list", shared: []string{"g/r"}, catalogScope: vector.ScopeShared, want: codes.Internal},
		{name: "overlapping enrollment", legacy: []string{"g/r"}, shared: []string{"g/r"}, publishers: []string{"publisher"}, catalogScope: vector.ScopeShared, want: codes.Internal},
		{name: "shared enrollment tenant catalog", shared: []string{"g/r"}, publishers: []string{"publisher"}, catalogScope: vector.ScopeTenant, want: codes.Internal},
		{name: "legacy enrollment shared catalog", legacy: []string{"g/r"}, catalogScope: vector.ScopeShared, want: codes.Internal},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := &fakeWriteStore{collection: vector.Collection{Group: "g", Resource: "r", PartitionKey: "r_external", IsExternal: true, Scope: tc.catalogScope}}
			s := NewVectorStoreServer(nil, newTestEmbedder(&fakeTextEmbedder{dim: 4}), tc.legacy, nil, tc.shared, tc.publishers, nil)
			s.store = store
			_, err := s.Upsert(vsAuthedCtxAs("publisher"), validUpsertReq())
			require.Equal(t, tc.want, status.Code(err))
			require.Empty(t, store.upserts)
		})
	}
}

func TestSharedVectorStoreLookupErrorsNeverFallBack(t *testing.T) {
	store := &fakeWriteStore{resolveErr: errors.New("catalog unavailable")}
	s := sharedWriteServer(store)
	ctx := vsAuthedCtxAs("publisher")
	_, err := s.Delete(ctx, &resourcepb.VectorDeleteRequest{Namespace: "ns", Group: "g", Resource: "r", Selector: &resourcepb.VectorDeleteRequest_DeleteAll{DeleteAll: true}})
	require.Equal(t, codes.Internal, status.Code(err))
	_, err = s.UpdateMetadata(ctx, &resourcepb.VectorUpdateMetadataRequest{Namespace: "ns", Group: "g", Resource: "r", Filter: []byte(`{"x":1}`), Set: []byte(`{"x":2}`)})
	require.Equal(t, codes.Internal, status.Code(err))
	require.Empty(t, store.deleteCalls)
	require.Empty(t, store.updateCalls)
	require.Empty(t, store.ensured)
}

func TestSharedVectorStoreMarkerNamedTenantHasNoAuthority(t *testing.T) {
	store := &fakeWriteStore{}
	s := sharedWriteServer(store)
	ctx := authlib.WithAuthInfo(context.Background(), &identity.StaticRequester{UserID: 1, UserUID: "u", Namespace: vector.SharedNamespace, Type: authlib.TypeUser})
	req := validUpsertReq()
	req.Namespace = vector.SharedNamespace
	_, err := s.Upsert(ctx, req)
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	req.Namespace = "different-tenant"
	_, err = s.Upsert(ctx, req)
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	require.Empty(t, store.ensured)
}

func TestSharedVectorStoreDeleteAndMetadataNeverProvision(t *testing.T) {
	store := &fakeWriteStore{}
	s := sharedWriteServer(store)
	ctx := vsAuthedCtxAs("publisher")
	_, err := s.Delete(ctx, &resourcepb.VectorDeleteRequest{Namespace: "ns", Group: "g", Resource: "r", Selector: &resourcepb.VectorDeleteRequest_DeleteAll{DeleteAll: true}})
	require.Equal(t, codes.NotFound, status.Code(err))
	_, err = s.UpdateMetadata(ctx, &resourcepb.VectorUpdateMetadataRequest{Namespace: "ns", Group: "g", Resource: "r", Filter: []byte(`{"x":1}`), Set: []byte(`{"x":2}`)})
	require.Equal(t, codes.NotFound, status.Code(err))
	require.Empty(t, store.ensured)
}

func TestSharedVectorStoreAttributesEmbeddingsToPublisher(t *testing.T) {
	store := &fakeWriteStore{collection: vector.Collection{Group: "g", Resource: "r", PartitionKey: "r_external", IsExternal: true, Scope: vector.ScopeShared}}
	s := sharedWriteServer(store)
	embed := &fakeTextEmbedder{dim: 4}
	s.embedder.TextEmbedder = embed
	_, err := s.Upsert(vsAuthedCtxAs("publisher"), validUpsertReq())
	require.NoError(t, err)
	require.Equal(t, "ns", embed.gotIn.Tenant)
	require.Equal(t, vector.SharedNamespace, store.upserts[0][0].Namespace)
}

func TestSharedVectorStoreUnchangedSubresourcesSkipEmbedding(t *testing.T) {
	store := &fakeWriteStore{stored: map[string]string{"chunk": "same"}, collection: vector.Collection{Group: "g", Resource: "r", PartitionKey: "r_external", IsExternal: true, Scope: vector.ScopeShared}}
	s := sharedWriteServer(store)
	embed := &countingTextEmbedder{client: &fakeTextEmbedder{dim: 4}}
	s.embedder.TextEmbedder = embed
	resp, err := s.UpsertSubresources(vsAuthedCtxAs("publisher"), &resourcepb.VectorUpsertSubresourcesRequest{Namespace: "ns", Group: "g", Resource: "r", Uid: "uid", Inputs: []*resourcepb.EmbeddingInput{{Subresource: "chunk", Content: "same", Title: "new title"}}})
	require.NoError(t, err)
	require.Zero(t, embed.calls)
	require.Zero(t, resp.Created)
	require.Zero(t, resp.Updated)
	require.Len(t, store.replaceCalls, 1)
	require.Equal(t, vector.SharedNamespace, store.replaceCalls[0].Namespace)
	require.Len(t, store.replaceCalls[0].MetadataOnly, 1)
}
