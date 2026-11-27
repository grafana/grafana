package elasticsearch

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/emptypb"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginequery"
	"github.com/grafana/grafana/pkg/storage/unified/search/grpcbackend"
)

func TestElasticsearchIndexThroughAdapter(t *testing.T) {
	endpoint := strings.TrimRight(os.Getenv("ELASTICSEARCH_TEST_URL"), "/")
	if endpoint == "" {
		t.Skip("ELASTICSEARCH_TEST_URL must point to a disposable Elasticsearch instance")
	}
	ctx, cancel := context.WithTimeout(t.Context(), 30*time.Second)
	defer cancel()
	index := fmt.Sprintf("grafana-search-query-test-%d", time.Now().UnixNano())
	native := &NativeBackend{Client: &http.Client{Timeout: 15 * time.Second}, Endpoint: endpoint, Index: index}
	t.Cleanup(native.Client.CloseIdleConnections)
	key := &resourcepb.ResourceKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "built"}
	indexKey := resource.NamespacedResource{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource}
	const generation, revision = "test-generation", "test-schema"
	scope := &enginepb.IndexScope{Namespace: key.Namespace, Indexes: []*enginepb.IndexReference{{Group: key.Group, Resource: key.Resource, Generation: generation, SchemaRevision: revision}}}
	provider := resource.NewMapProvider(map[schema.GroupVersionResource][]resource.SearchFieldDefinition{
		{Group: key.Group, Version: "v1", Resource: key.Resource}: {
			{Name: "views", Path: "spec.views", Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityRetrieve}},
		},
	}, nil)
	opts := ElasticsearchAdapterOptions{Endpoint: endpoint, Index: index, Key: indexKey, Generation: generation, SchemaRevision: revision, Fields: provider}
	client := startTestAdapter(t, opts)
	gr := resource.NewLowerGroupResource(key.Group, key.Resource)
	builder := resource.StandardDocumentBuilder(resource.NewSearchFieldsRegistry(nil, nil, map[resource.LowerGroupResource]resource.SearchFieldsProvider{gr: provider}))
	defs, err := resource.SearchableFieldsFromProvider(provider, key.Group, key.Resource)
	require.NoError(t, err)
	writer := grpcbackend.IndexWriter{Client: client, Scope: scope, Definitions: defs}
	id := resource.SearchID(key)
	build := func(title, release string, rv int64) *resource.BulkIndexItem {
		t.Helper()
		payload := fmt.Appendf(nil, `{"apiVersion":"dashboard.grafana.app/v1","kind":"Dashboard","metadata":{"name":"built","namespace":"default","labels":{"team":"search","team.name":"backend","grafana.app/team":"storage","release":%q}},"spec":{"title":%q,"views":%d}}`, release, title, rv)
		doc, err := builder.BuildDocument(ctx, key, rv, payload)
		require.NoError(t, err)
		return &resource.BulkIndexItem{Action: resource.ActionIndex, Doc: doc}
	}
	write := func(item *resource.BulkIndexItem) error {
		t.Helper()
		batches, err := writer.PrepareBatches([]*resource.BulkIndexItem{item})
		require.NoError(t, err)
		require.Len(t, batches, 1)
		_, err = client.WriteDocuments(ctx, batches[0])
		return err
	}
	query := func(text string) *grpcbackend.QueryBackend {
		return &grpcbackend.QueryBackend{Client: client, Scope: scope, Query: &enginepb.QuerySpec{
			Text: text, DocumentScope: &enginepb.DocumentScope{State: enginepb.DocumentState_DOCUMENT_STATE_LIVE},
		}}
	}
	find := func(text string) []*enginequery.Hit {
		t.Helper()
		result, err := query(text).Search(ctx, enginequery.Request{Size: 2, Fields: []string{"title", "views", "labels.team", "labels.team.name", "labels.grafana.app/team", "labels.release", "labels.missing"}})
		require.NoError(t, err)
		return result.Hits
	}

	const rv int64 = 1800000000000000001
	initial := build("Initial dashboard", "2026-01-01", rv)
	require.Equal(t, codes.FailedPrecondition, status.Code(write(initial)))
	_, err = client.EnsureIndex(ctx, &enginepb.EnsureIndexRequest{IndexScope: scope, RequireNew: true})
	require.NoError(t, err)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.WithoutCancel(t.Context()), 15*time.Second)
		defer cancel()
		require.NoError(t, native.JSON(ctx, http.MethodDelete, "/"+index, nil, nil))
	})
	_, err = client.EnsureIndex(ctx, &enginepb.EnsureIndexRequest{IndexScope: scope})
	require.NoError(t, err)
	_, err = client.EnsureIndex(ctx, &enginepb.EnsureIndexRequest{IndexScope: scope, RequireNew: true})
	require.Equal(t, codes.AlreadyExists, status.Code(err))
	require.Empty(t, find("Initial"))

	require.NoError(t, write(initial))
	hits := find("Initial")
	require.Len(t, hits, 1)
	require.Equal(t, id, hits[0].ID)
	require.Equal(t, "Initial dashboard", hits[0].Fields["title"])
	require.Equal(t, rv, hits[0].Fields["views"])
	require.Equal(t, "search", hits[0].Fields["labels.team"])
	require.Equal(t, "backend", hits[0].Fields["labels.team.name"])
	require.Equal(t, "storage", hits[0].Fields["labels.grafana.app/team"])
	require.Equal(t, "2026-01-01", hits[0].Fields["labels.release"])
	require.NotContains(t, hits[0].Fields, "labels.missing")
	metadata, err := query("Initial").ReadAuthzMetadata(ctx, []string{id})
	require.NoError(t, err)
	require.Contains(t, metadata.Values, id)
	require.Empty(t, metadata.Values[id].Folder)
	lookup := enginequery.LookupRequest{IDs: []string{id}, Fields: []string{"views", "labels.team", "labels.grafana.app/team", "labels.missing"}}
	loaded, err := query("Initial").Lookup(ctx, lookup)
	require.NoError(t, err)
	require.Len(t, loaded.Hits, 1)
	require.Equal(t, "", loaded.Hits[0].Fields[resource.SEARCH_FIELD_FOLDER])
	require.Equal(t, "search", loaded.Hits[0].Fields["labels.team"])
	require.Equal(t, "storage", loaded.Hits[0].Fields["labels.grafana.app/team"])
	require.NotContains(t, loaded.Hits[0].Fields, "labels.missing")
	require.Equal(t, hits[0].StableSortKey, loaded.Hits[0].StableSortKey)
	_, err = query("Renamed").Search(ctx, enginequery.Request{Size: 1, SearchAfter: hits[0].Cursor})
	require.Equal(t, codes.InvalidArgument, status.Code(err), "cursor must not be reused with a different query")

	// The request matches the second adapter's scope, but the physical index is older.
	wrongGeneration := query("Initial")
	opts.Generation = "new-generation"
	wrongGeneration.Scope = proto.CloneOf(scope)
	wrongGeneration.Scope.Indexes[0].Generation = opts.Generation
	wrongGeneration.Client = startTestAdapter(t, opts)
	_, err = wrongGeneration.Search(ctx, enginequery.Request{Size: 1})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))
	_, err = wrongGeneration.ReadAuthzMetadata(ctx, []string{id})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))
	_, err = wrongGeneration.Lookup(ctx, lookup)
	require.Equal(t, codes.FailedPrecondition, status.Code(err))

	wrong := proto.CloneOf(key)
	wrong.Namespace = "another-tenant"
	_, err = client.WriteDocuments(ctx, &enginepb.WriteDocumentsRequest{IndexScope: scope, Writes: []*enginepb.DocumentWrite{
		{Key: key, Action: &enginepb.DocumentWrite_Delete{Delete: &emptypb.Empty{}}},
		{Key: wrong, Action: &enginepb.DocumentWrite_Delete{Delete: &emptypb.Empty{}}},
	}})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	require.Len(t, find("Initial"), 1, "invalid batch must not write the valid first item")

	require.NoError(t, write(build("Renamed dashboard", "nightly", rv+1)))
	require.Empty(t, find("Initial"))
	loaded, err = query("Initial").Lookup(ctx, lookup)
	require.NoError(t, err)
	require.Empty(t, loaded.Hits, "scoped reads must recheck membership")
	hits = find("Renamed")
	require.Len(t, hits, 1)
	require.Equal(t, id, hits[0].ID)
	require.Equal(t, rv+1, hits[0].Fields["views"])
	require.Equal(t, "nightly", hits[0].Fields["labels.release"])
	filtered := query("Renamed")
	filtered.Query.Requirements = []*enginepb.Requirement{
		{Key: "labels.team", Operator: enginepb.SelectorOperator_SELECTOR_OPERATOR_EQUALS, Values: []string{"search"}},
		{Key: "labels.team.name", Operator: enginepb.SelectorOperator_SELECTOR_OPERATOR_EQUALS, Values: []string{"backend"}},
		{Key: "labels.release", Operator: enginepb.SelectorOperator_SELECTOR_OPERATOR_EQUALS, Values: []string{"nightly"}},
	}
	matches, err := filtered.Search(ctx, enginequery.Request{Size: 1})
	require.NoError(t, err)
	require.Len(t, matches.Hits, 1)
	require.Equal(t, id, matches.Hits[0].ID)

	deleteItem := &resource.BulkIndexItem{Action: resource.ActionDelete, Key: key}
	require.NoError(t, write(deleteItem))
	require.NoError(t, write(deleteItem), "already-deleted document is a no-op")
	require.Empty(t, find("Renamed"))
}

func startTestAdapter(t *testing.T, opts ElasticsearchAdapterOptions) enginepb.SearchEngineClient {
	t.Helper()
	listener, err := net.ListenTCP("tcp", &net.TCPAddr{IP: net.IPv4(127, 0, 0, 1)})
	require.NoError(t, err)
	t.Cleanup(func() { _ = listener.Close() })
	ctx, cancel := context.WithCancel(t.Context())
	stopped := make(chan error, 1)
	go func() { stopped <- ServeElasticsearchAdapter(ctx, listener, opts, false) }()
	t.Cleanup(func() {
		cancel()
		select {
		case err := <-stopped:
			require.NoError(t, err)
		case <-time.After(5 * time.Second):
			t.Error("adapter did not stop")
		}
	})
	conn, err := grpc.NewClient(listener.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, conn.Close()) })
	return enginepb.NewSearchEngineClient(conn)
}
