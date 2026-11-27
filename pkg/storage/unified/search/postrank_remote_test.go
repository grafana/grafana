package search

import (
	"context"
	"net"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/grpcbackend"
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

func TestPostRankSearchOverGRPC(t *testing.T) {
	ctx, runner, memory, req := newMemoryPostRankSearch(t)
	scope := grpcTestScope(runner.key)
	query := &enginepb.QuerySpec{Text: "fixture", DocumentScope: &enginepb.DocumentScope{State: enginepb.DocumentState_DOCUMENT_STATE_LIVE}}
	const rv int64 = 1800000000000000001
	var dropped bool
	var pageCalls, metadataCalls int
	service := queryTestServer{
		search: func(input *enginepb.SearchCandidatesRequest) (*enginepb.SearchCandidatesResponse, error) {
			if !proto.Equal(input.IndexScope, scope) || !proto.Equal(input.Query, query) || len(input.Fields) != 0 {
				return nil, status.Error(codes.InvalidArgument, "unexpected candidate query")
			}
			pageCalls++
			result, err := memory.Search(ctx, queryRequest{Size: int(input.WindowSize), SearchAfter: input.GetSearchAfter().GetParts(), Reverse: input.Reverse})
			if err != nil {
				return nil, err
			}
			response := &enginepb.SearchCandidatesResponse{TotalMatches: result.Total}
			for _, hit := range result.Hits {
				key := &resourcepb.ResourceKey{}
				if err := resource.ReadSearchID(key, hit.ID); err != nil {
					return nil, err
				}
				response.Hits = append(response.Hits, &enginepb.Hit{Key: key, Cursor: &enginepb.Cursor{Parts: hit.Cursor}, StableSortKey: &enginepb.StableSortKey{Value: []byte(key.Name)}})
			}
			return response, nil
		},
		read: func(input *enginepb.ReadDocumentsRequest) (*enginepb.ReadDocumentsResponse, error) {
			if !proto.Equal(input.IndexScope, scope) || input.Query != nil && !proto.Equal(input.Query, query) {
				return nil, status.Error(codes.InvalidArgument, "unexpected read scope")
			}
			if input.Query == nil {
				metadataCalls++
				if len(input.Fields) != 1 || input.Fields[0].Name != resource.SEARCH_FIELD_FOLDER {
					return nil, status.Error(codes.InvalidArgument, "metadata read loaded other fields")
				}
			} else if !dropped {
				dropped = true
				memory.hits = slices.Delete(memory.hits, 0, 1)
			}
			response := &enginepb.ReadDocumentsResponse{Fields: []*resourcepb.ResourceSearchField{{Name: "folder", Type: resourcepb.ResourceSearchField_STRING}}}
			if input.Query != nil {
				response.Fields = append(response.Fields,
					&resourcepb.ResourceSearchField{Name: "tags", Type: resourcepb.ResourceSearchField_STRING, IsArray: true},
					&resourcepb.ResourceSearchField{Name: "missing", Type: resourcepb.ResourceSearchField_STRING},
					&resourcepb.ResourceSearchField{Name: "views", Type: resourcepb.ResourceSearchField_INT64})
			}
			for _, key := range input.Keys {
				id := resource.SearchID(key)
				for _, hit := range memory.hits {
					if hit.ID != id {
						continue
					}
					doc := &enginepb.Hit{Key: key, Values: []*resourcepb.ResourceSearchValue{{StringValues: []string{hit.Fields["folder"].(string)}}}}
					if input.Query != nil {
						doc.StableSortKey = &enginepb.StableSortKey{Value: []byte(key.Name)}
						doc.ResourceVersion = new(rv)
						doc.Values = append(doc.Values, &resourcepb.ResourceSearchValue{FieldIndex: 1}, &resourcepb.ResourceSearchValue{FieldIndex: 3, Int64Values: []int64{rv}})
					}
					response.Hits = append(response.Hits, doc)
				}
			}
			return response, nil
		},
	}
	client := newQueryTestClient(t, service)
	runner.backend = &grpcbackend.QueryBackend{Client: client, Scope: scope, Query: query}
	hits, err := runner.run(ctx, verbAccessClient{}, req, queryRequest{Fields: []string{"tags", "views", "missing"}}, nil, &resourcepb.ResourceSearchResponse{}, nil)
	require.NoError(t, err)
	require.Equal(t, []string{"doc-04", "doc-08", "doc-12"}, queryHitNames(hits))
	require.Greater(t, pageCalls, 1)
	require.Greater(t, metadataCalls, 1)
	for _, hit := range hits {
		require.Equal(t, []string{}, hit.Fields["tags"])
		require.NotContains(t, hit.Fields, "missing")
		require.Equal(t, rv, hit.Fields["views"])
		require.Equal(t, "1800000000000000001", hit.Fields[resource.SEARCH_FIELD_RV_STRING])
	}
}
