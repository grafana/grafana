package search

import (
	"context"
	"fmt"
	"maps"
	"net"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginepb"
)

func TestGRPCSearchBackendRoutesBuildUpdateAndSearch(t *testing.T) {
	ctx, runner, _, query := newMemoryPostRankSearch(t)
	key := runner.key
	registry := resource.NewSearchFieldsRegistry(nil, nil, nil)
	_, revision, _ := registry.ForKey(key)
	scope := grpcTestScope(key)
	scope.Indexes[0].SchemaRevision = revision
	service := &grpcTestEngine{scope: scope}
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	require.NoError(t, err)
	server := grpc.NewServer()
	enginepb.RegisterSearchEngineServer(server, service)
	var wg sync.WaitGroup
	wg.Go(func() { _ = server.Serve(listener) })
	t.Cleanup(func() { server.Stop(); wg.Wait() })

	bleve, err := NewBleveBackend(BleveOptions{Root: t.TempDir(), FileThreshold: 1000, SearchFields: registry}, nil)
	require.NoError(t, err)
	conn, err := grpc.NewClient(listener.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, conn.Close()) })
	grpcBackend, err := newGRPCSearchBackend(enginepb.NewSearchEngineClient(conn), key, scope.Indexes[0].Generation, registry, PostRankAuthzConfig{MaxWindow: 2}, nil)
	require.NoError(t, err)
	var enabled atomic.Bool
	backend := &routedSearchBackend{SearchBackend: bleve, remote: grpcBackend, key: key, enabled: func(string) bool { return enabled.Load() }}
	t.Cleanup(backend.Stop)

	builder := resource.StandardDocumentBuilder(registry)
	document := func(name, title, folder string, rv int64) *resource.BulkIndexItem {
		t.Helper()
		k := &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: name}
		body := fmt.Appendf(nil, `{"apiVersion":"dashboard.grafana.app/v1","kind":"Dashboard","metadata":{"name":%q,"namespace":%q},"spec":{"title":%q}}`, name, key.Namespace, title)
		doc, err := builder.BuildDocument(ctx, k, rv, body)
		require.NoError(t, err)
		doc.Folder = folder
		return &resource.BulkIndexItem{Action: resource.ActionIndex, Doc: doc}
	}
	build := func(idx resource.ResourceIndex) (int64, error) {
		return 10, idx.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{
			document("allowed", "Shared dashboard", "team", 10), document("hidden", "Shared dashboard", "private", 9),
		}})
	}
	local, err := backend.BuildIndex(ctx, key, 2, "test", build, nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err)
	require.IsType(t, &bleveIndex{}, local)
	require.Same(t, local, backend.GetIndex(key))

	enabled.Store(true)
	var next *resource.BulkIndexItem
	var fromRV int64
	remote, err := backend.BuildIndex(ctx, key, 2, "test", build, func(_ context.Context, idx resource.ResourceIndex, from int64) (int64, int, error) {
		fromRV = from
		if next == nil {
			require.Nil(t, backend.GetIndex(key), "catch-up must finish before publication")
			return from, 0, nil
		}
		return next.Doc.RV, 1, idx.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{next}})
	}, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err)
	require.EqualValues(t, 10, fromRV)
	require.Same(t, remote, backend.GetIndex(key))
	require.NotSame(t, local, remote)
	other := key
	other.Namespace = "other-namespace"
	require.Nil(t, backend.GetIndex(other))

	query.Options = &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource}}
	query.Query, query.Fields = "Shared", []string{"title", "rv"}
	_, err = remote.Search(ctx, nil, query, nil, nil)
	require.Equal(t, codes.FailedPrecondition, status.Code(err))
	query.IsDeleted = true
	_, err = remote.Search(ctx, verbAccessClient{}, query, nil, nil)
	require.Equal(t, codes.Unimplemented, status.Code(err))
	query.IsDeleted = false
	resp, err := remote.Search(ctx, verbAccessClient{}, query, nil, nil)
	require.NoError(t, err)
	require.Len(t, resp.Rows, 1)
	require.Equal(t, "allowed", resp.Rows[0].Key.Name)

	next = document("allowed", "Renamed dashboard", "team", 11)
	rv, err := remote.UpdateIndex(ctx)
	require.NoError(t, err)
	require.EqualValues(t, 10, fromRV)
	require.EqualValues(t, 11, rv)
	query.Query = "Renamed"
	resp, err = remote.Search(ctx, verbAccessClient{}, query, nil, nil)
	require.NoError(t, err)
	require.Len(t, resp.Rows, 1)
	require.EqualValues(t, 11, resp.Rows[0].ResourceVersion)

	next.Doc.RV, next.Doc.IsDeleted = 12, new(true)
	rv, err = remote.UpdateIndex(ctx)
	require.NoError(t, err)
	require.EqualValues(t, 12, rv)
	resp, err = remote.Search(ctx, verbAccessClient{}, query, nil, nil)
	require.NoError(t, err)
	require.Empty(t, resp.Rows)

	// The timeout does not tell Grafana whether the adapter applied the batch.
	next = document("allowed", "Applied before deadline", "team", 13)
	service.failAfterWrite.Store(true)
	rv, err = remote.UpdateIndex(ctx)
	require.Equal(t, codes.DeadlineExceeded, status.Code(err))
	require.EqualValues(t, 12, rv)
	service.failAfterWrite.Store(false)
	next = document("allowed", "Must not be sent", "team", 14)
	rv, err = remote.UpdateIndex(ctx)
	require.Equal(t, codes.FailedPrecondition, status.Code(err))
	require.EqualValues(t, 12, rv)
	require.EqualValues(t, 12, fromRV)
	err = remote.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{next}})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))
	service.mu.Lock()
	applied := service.docs["allowed"].GetUpsert().GetResourceVersion()
	service.mu.Unlock()
	require.EqualValues(t, 13, applied, "the timed-out batch applied, but later writes did not")
	enabled.Store(false)
	require.Same(t, local, backend.GetIndex(key))
}

func TestGRPCSearchIndexBatchesWrites(t *testing.T) {
	key := resource.NamespacedResource{Namespace: "default", Group: dashboardGroup, Resource: dashboardResource}
	registry := resource.NewSearchFieldsRegistry(nil, nil, nil)
	_, revision, _ := registry.ForKey(key)
	scope := grpcTestScope(key)
	scope.Indexes[0].SchemaRevision = revision
	service := &grpcTestEngine{scope: scope}
	backend, err := newGRPCSearchBackend(newQueryTestClient(t, service), key, scope.Indexes[0].Generation, registry, PostRankAuthzConfig{}, nil)
	require.NoError(t, err)
	items := make([]*resource.BulkIndexItem, 1001)
	for n := range items {
		name := fmt.Sprintf("doc-%04d", n)
		items[n] = &resource.BulkIndexItem{Action: resource.ActionDelete, Key: &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: name}}
	}
	// The upsert and following delete must be sent in order in separate batches.
	repeated := items[2].Key
	items[0] = &resource.BulkIndexItem{Action: resource.ActionIndex, Doc: &resource.IndexableDocument{Key: repeated, Title: "first"}}
	_, err = backend.BuildIndex(t.Context(), key, 0, "test", func(idx resource.ResourceIndex) (int64, error) {
		return 1, idx.BulkIndex(&resource.BulkIndexRequest{Items: items})
	}, nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err)
	service.mu.Lock()
	defer service.mu.Unlock()
	require.Equal(t, []int{2, 998, 1}, service.batchSizes)
	require.Empty(t, service.docs)
}

// A small engine fixture exercises the wire contract without sharing Grafana's query or auth code.
type grpcTestEngine struct {
	enginepb.UnimplementedSearchEngineServer
	scope          *enginepb.IndexScope
	failAfterWrite atomic.Bool
	mu             sync.Mutex
	docs           map[string]*enginepb.DocumentWrite
	batchSizes     []int
}

func (e *grpcTestEngine) EnsureIndex(_ context.Context, req *enginepb.EnsureIndexRequest) (*emptypb.Empty, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if !proto.Equal(e.scope, req.IndexScope) || !req.RequireNew || e.docs != nil {
		return nil, status.Error(codes.FailedPrecondition, "expected a new index in the configured scope")
	}
	e.docs = make(map[string]*enginepb.DocumentWrite)
	return &emptypb.Empty{}, nil
}

func (e *grpcTestEngine) WriteDocuments(_ context.Context, req *enginepb.WriteDocumentsRequest) (*emptypb.Empty, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if !proto.Equal(e.scope, req.IndexScope) || e.docs == nil {
		return nil, status.Error(codes.FailedPrecondition, "index not initialized")
	}
	e.batchSizes = append(e.batchSizes, len(req.Writes))
	for _, write := range req.Writes {
		if write.GetUpsert() != nil {
			e.docs[write.Key.Name] = write
		} else {
			delete(e.docs, write.Key.Name)
		}
	}
	if e.failAfterWrite.Load() {
		return nil, status.Error(codes.DeadlineExceeded, "write applied before deadline")
	}
	return &emptypb.Empty{}, nil
}

func (e *grpcTestEngine) SearchCandidates(_ context.Context, req *enginepb.SearchCandidatesRequest) (*enginepb.SearchCandidatesResponse, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if !proto.Equal(e.scope, req.IndexScope) || len(req.Fields) != 0 || req.Reverse {
		return nil, status.Error(codes.InvalidArgument, "unexpected candidate request")
	}
	r := &enginepb.SearchCandidatesResponse{}
	after := req.GetSearchAfter().GetParts()
	for _, name := range slices.Sorted(maps.Keys(e.docs)) {
		write := e.docs[name]
		if !strings.Contains(write.GetUpsert().Title, req.Query.GetText()) {
			continue
		}
		r.TotalMatches++
		if len(after) != 0 && name <= after[0] || len(r.Hits) >= int(req.WindowSize) {
			continue
		}
		r.Hits = append(r.Hits, &enginepb.Hit{Key: write.Key, Cursor: &enginepb.Cursor{Parts: []string{name}}, StableSortKey: &enginepb.StableSortKey{Value: []byte(name)}})
	}
	return r, nil
}

func (e *grpcTestEngine) ReadDocuments(_ context.Context, req *enginepb.ReadDocumentsRequest) (*enginepb.ReadDocumentsResponse, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if !proto.Equal(e.scope, req.IndexScope) {
		return nil, status.Error(codes.InvalidArgument, "unexpected read scope")
	}
	r := &enginepb.ReadDocumentsResponse{}
	for _, f := range req.Fields {
		r.Fields = append(r.Fields, &resourcepb.ResourceSearchField{Name: f.ResponseKey, Type: resourcepb.ResourceSearchField_STRING})
	}
	for _, key := range req.Keys {
		write := e.docs[key.Name]
		doc := write.GetUpsert()
		if doc == nil || !strings.Contains(doc.Title, req.Query.GetText()) {
			continue
		}
		hit := &enginepb.Hit{Key: write.Key, ResourceVersion: new(doc.ResourceVersion), StableSortKey: &enginepb.StableSortKey{Value: []byte(key.Name)}}
		for i, f := range req.Fields {
			var value string
			switch f.Name {
			case resource.SEARCH_FIELD_FOLDER:
				value = doc.Folder
			case resource.SEARCH_FIELD_TITLE:
				value = doc.Title
			default:
				return nil, status.Errorf(codes.InvalidArgument, "unexpected read field %q", f.Name)
			}
			hit.Values = append(hit.Values, &resourcepb.ResourceSearchValue{FieldIndex: uint32(i), StringValues: []string{value}})
		}
		r.Hits = append(r.Hits, hit)
	}
	return r, nil
}
