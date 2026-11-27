package grpcbackend

import (
	"context"
	"net"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginequery"
)

type queryTestServer struct {
	enginepb.UnimplementedSearchEngineServer
	search func(*enginepb.SearchCandidatesRequest) (*enginepb.SearchCandidatesResponse, error)
	read   func(*enginepb.ReadDocumentsRequest) (*enginepb.ReadDocumentsResponse, error)
}

func (s queryTestServer) SearchCandidates(_ context.Context, req *enginepb.SearchCandidatesRequest) (*enginepb.SearchCandidatesResponse, error) {
	return s.search(req)
}

func (s queryTestServer) ReadDocuments(_ context.Context, req *enginepb.ReadDocumentsRequest) (*enginepb.ReadDocumentsResponse, error) {
	return s.read(req)
}

func newQueryTestClient(t *testing.T, service enginepb.SearchEngineServer) enginepb.SearchEngineClient {
	t.Helper()
	listener := bufconn.Listen(1 << 20)
	server := grpc.NewServer()
	enginepb.RegisterSearchEngineServer(server, service)
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = server.Serve(listener)
	}()
	t.Cleanup(func() { server.Stop(); <-done })
	conn, err := grpc.NewClient("passthrough:///search-engine-test", grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
		return listener.DialContext(ctx)
	}))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, conn.Close()) })
	return enginepb.NewSearchEngineClient(conn)
}

func grpcTestScope(key resource.NamespacedResource) *enginepb.IndexScope {
	return &enginepb.IndexScope{Namespace: key.Namespace, Indexes: []*enginepb.IndexReference{{Group: key.Group, Resource: key.Resource, Generation: "test-generation", SchemaRevision: "test-schema"}}}
}

func TestGRPCQueryBackendRequiresExplicitFolder(t *testing.T) {
	key := &resourcepb.ResourceKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "doc"}
	id := resource.SearchID(key)
	scope := grpcTestScope(resource.NamespacedResource{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource})
	for _, tc := range []struct {
		name   string
		values []*resourcepb.ResourceSearchValue
		code   codes.Code
	}{
		{"missing folder", nil, codes.Internal},
		{"explicit root", []*resourcepb.ResourceSearchValue{{StringValues: []string{""}}}, codes.OK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := queryTestServer{read: func(*enginepb.ReadDocumentsRequest) (*enginepb.ReadDocumentsResponse, error) {
				return &enginepb.ReadDocumentsResponse{
					Fields: []*resourcepb.ResourceSearchField{{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceSearchField_STRING}},
					Hits:   []*enginepb.Hit{{Key: key, StableSortKey: &enginepb.StableSortKey{Value: []byte("doc")}, Values: tc.values}},
				}, nil
			}}
			backend := &QueryBackend{Client: newQueryTestClient(t, server), Scope: scope, Query: &enginepb.QuerySpec{}}
			metadata, err := backend.ReadAuthzMetadata(t.Context(), []string{id})
			require.Equal(t, tc.code, status.Code(err))
			hits, err := backend.Lookup(t.Context(), enginequery.LookupRequest{IDs: []string{id}})
			require.Equal(t, tc.code, status.Code(err))
			if tc.code == codes.OK {
				require.Contains(t, metadata.Values, id)
				require.Equal(t, "", metadata.Values[id].Folder)
				require.Len(t, hits.Hits, 1)
				require.Equal(t, "", hits.Hits[0].Fields[resource.SEARCH_FIELD_FOLDER])
			} else {
				require.Empty(t, metadata.Values)
				require.Empty(t, hits.Hits)
			}
		})
	}
}

func TestQuerySpecRejectsFolderTree(t *testing.T) {
	query, err := QuerySpec(&resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{
		Fields: []*resourcepb.Requirement{{Key: resource.SEARCH_FIELD_FOLDER_TREE, Operator: "=", Values: []string{"team"}}},
	}}, 0)
	require.Equal(t, codes.Unimplemented, status.Code(err))
	require.Nil(t, query)
}

func TestGRPCQueryBackendRejectsInvalidResults(t *testing.T) {
	key := resource.NamespacedResource{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"}
	for _, tc := range []struct {
		name   string
		change func(*enginepb.SearchCandidatesResponse)
	}{
		{"out of scope", func(r *enginepb.SearchCandidatesResponse) { r.Hits[0].Key.Namespace = "other" }},
		{"no cursor", func(r *enginepb.SearchCandidatesResponse) { r.Hits[0].Cursor = nil }},
		{"no stable key", func(r *enginepb.SearchCandidatesResponse) { r.Hits[0].StableSortKey = nil }},
		{"bad field index", func(r *enginepb.SearchCandidatesResponse) { r.Hits[0].Values[0].FieldIndex = 1 }},
		{"wrong type", func(r *enginepb.SearchCandidatesResponse) { r.Hits[0].Values[0].StringValues = []string{"wrong"} }},
		{"duplicate hit", func(r *enginepb.SearchCandidatesResponse) { r.Hits = append(r.Hits, r.Hits[0]) }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := queryTestServer{search: func(*enginepb.SearchCandidatesRequest) (*enginepb.SearchCandidatesResponse, error) {
				r := &enginepb.SearchCandidatesResponse{TotalMatches: 3,
					Fields: []*resourcepb.ResourceSearchField{{Name: "paused", Type: resourcepb.ResourceSearchField_BOOLEAN}},
					Hits: []*enginepb.Hit{{Key: &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: "doc"},
						Cursor: &enginepb.Cursor{Parts: []string{"doc"}}, StableSortKey: &enginepb.StableSortKey{Value: []byte("doc")},
						Values: []*resourcepb.ResourceSearchValue{{BooleanValues: []bool{false}}}}},
				}
				tc.change(r)
				return r, nil
			}}
			backend := &QueryBackend{Client: newQueryTestClient(t, server), Scope: grpcTestScope(key)}
			result, err := backend.Search(t.Context(), enginequery.Request{Size: 3, Fields: []string{"paused"}})
			require.Equal(t, codes.Internal, status.Code(err))
			require.Empty(t, result.Hits)
		})
	}
	t.Run("native status", func(t *testing.T) {
		server := queryTestServer{search: func(*enginepb.SearchCandidatesRequest) (*enginepb.SearchCandidatesResponse, error) {
			return nil, status.Error(codes.Unavailable, "index unavailable")
		}}
		backend := &QueryBackend{Client: newQueryTestClient(t, server), Scope: grpcTestScope(key)}
		_, err := backend.Search(t.Context(), enginequery.Request{Size: 1})
		require.Equal(t, codes.Unavailable, status.Code(err))
		require.Equal(t, "index unavailable", status.Convert(err).Message())
	})
}
