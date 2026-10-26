package resource

import (
	"context"
	"fmt"
	"net"
	"os"
	"sync"
	"testing"
	"time"

	authnlib "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
)

type sharedIntegrationEmbedder struct {
	mu           sync.Mutex
	inputs       []embedder.EmbedTextInput
	firstEntered chan struct{}
	releaseFirst chan struct{}
	secondRPC    chan struct{}
}

func (e *sharedIntegrationEmbedder) EmbedText(ctx context.Context, in embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
	e.mu.Lock()
	e.inputs = append(e.inputs, in)
	first := len(e.inputs) == 1
	e.mu.Unlock()
	if first && e.firstEntered != nil {
		close(e.firstEntered)
		select {
		case <-e.releaseFirst:
		case <-ctx.Done():
			return embedder.EmbedTextOutput{}, ctx.Err()
		}
	}
	out := make([]embedder.Embedding, len(in.Texts))
	for i := range out {
		out[i] = embedder.Embedding{Dense: []float32{1, 0, 0, 0}}
	}
	return embedder.EmbedTextOutput{Embeddings: out}, nil
}

func (e *sharedIntegrationEmbedder) calls() []embedder.EmbedTextInput {
	e.mu.Lock()
	defer e.mu.Unlock()
	return append([]embedder.EmbedTextInput(nil), e.inputs...)
}

func sharedIntegrationFixture(t *testing.T) (resourcepb.VectorStoreClient, vector.VectorBackend, *xorm.Engine, *sharedIntegrationEmbedder, string, map[string]string) {
	t.Helper()
	testutil.SkipIntegrationTestInShortMode(t)
	connStr := os.Getenv("PGVECTOR_TEST_DB")
	if connStr == "" {
		t.Skip("PGVECTOR_TEST_DB not set")
	}
	engine, err := xorm.NewEngine("postgres", connStr)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, engine.Close()) })
	require.NoError(t, vector.MigrateVectorStore(t.Context(), engine, setting.NewCfg()))
	backend := vector.NewPgvectorBackend(t.Context(), dbimpl.NewDB(engine.DB().DB, engine.Dialect().DriverName()), 1000, 0, false, engine)
	provider := &sharedIntegrationEmbedder{}
	suffix := fmt.Sprintf("%d", time.Now().UnixNano())
	group := "docs-" + suffix + ".example.com"
	resources := map[string]string{}
	for _, name := range []string{"manual", "reference", "denied", "lifecycle", "concurrent"} {
		resources[name] = name + "_" + suffix
	}
	emb := &embedder.Embedder{TextEmbedder: provider, Model: "shared-integration-model", VectorType: embedder.VectorTypeDense, Metric: embedder.CosineDistance, Dimensions: 4, Normalized: true}
	server := grpc.NewServer(grpc.UnaryInterceptor(func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if write, ok := req.(*resourcepb.VectorUpsertSubresourcesRequest); ok && write.Resource == resources["concurrent"] && write.Namespace == "tenant-b" && provider.secondRPC != nil {
			close(provider.secondRPC)
		}
		md, _ := metadata.FromIncomingContext(ctx)
		ns, service := md.Get("test-namespace"), md.Get("test-service")
		if len(ns) > 0 {
			r := &identity.StaticRequester{UserID: 1, UserUID: "publisher", Namespace: ns[0], Type: authlib.TypeUser}
			if len(service) > 0 && service[0] != "" {
				r.AccessTokenClaims = &authnlib.Claims[authnlib.AccessTokenClaims]{Rest: authnlib.AccessTokenClaims{ServiceIdentity: service[0]}}
			}
			ctx = authlib.WithAuthInfo(ctx, r)
		}
		return handler(ctx, req)
	}))
	resourcepb.RegisterVectorStoreServer(server, NewVectorStoreServer(backend, emb, nil, nil,
		[]string{group + "/" + resources["manual"], group + "/" + resources["reference"], group + "/" + resources["denied"], group + "/" + resources["lifecycle"], group + "/" + resources["concurrent"]}, []string{"publisher-a", "publisher-b"}, nil))
	listener := bufconn.Listen(1 << 20)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	conn, err := grpc.NewClient("passthrough:///bufnet", grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return listener.Dial() }), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, conn.Close()) })
	return resourcepb.NewVectorStoreClient(conn), backend, engine, provider, group, resources
}

func sharedPublisherContext(t *testing.T, namespace, service string) context.Context {
	t.Helper()
	return metadata.NewOutgoingContext(t.Context(), metadata.Pairs("test-namespace", namespace, "test-service", service))
}

func TestIntegrationSharedVectorStorePublication(t *testing.T) {
	client, backend, engine, provider, group, resources := sharedIntegrationFixture(t)
	first := sharedPublisherContext(t, "tenant-a", "publisher-a")
	second := sharedPublisherContext(t, "tenant-b", "publisher-b")
	chunk := func(content, title string) *resourcepb.EmbeddingInput {
		return &resourcepb.EmbeddingInput{Subresource: "section", Content: content, Title: title, Metadata: []byte(`{"edition":"first"}`)}
	}
	publish := func(ctx context.Context, resource, content, title string) *resourcepb.VectorUpsertSubresourcesResponse {
		t.Helper()
		resp, err := client.UpsertSubresources(ctx, &resourcepb.VectorUpsertSubresourcesRequest{
			Namespace: "tenant-a", Group: group, Resource: resources[resource], Uid: "same-uid", Inputs: []*resourcepb.EmbeddingInput{chunk(content, title)},
		})
		require.NoError(t, err)
		return resp
	}
	resp := publish(first, "manual", "first content", "first title")
	require.EqualValues(t, 1, resp.Created)
	resp, err := client.UpsertSubresources(second, &resourcepb.VectorUpsertSubresourcesRequest{
		Namespace: "tenant-b", Group: group, Resource: resources["manual"], Uid: "same-uid", Inputs: []*resourcepb.EmbeddingInput{chunk("first content", "updated title")},
	})
	require.NoError(t, err)
	require.Zero(t, resp.Created+resp.Updated+resp.Deleted)
	require.Len(t, provider.calls(), 1, "unchanged publication must not re-embed")
	resp, err = client.UpsertSubresources(second, &resourcepb.VectorUpsertSubresourcesRequest{
		Namespace: "tenant-b", Group: group, Resource: resources["manual"], Uid: "same-uid", Inputs: []*resourcepb.EmbeddingInput{chunk("revised content", "updated title")},
	})
	require.NoError(t, err)
	require.EqualValues(t, 1, resp.Updated)
	require.Equal(t, "tenant-a", provider.calls()[0].Tenant)
	require.Equal(t, "tenant-b", provider.calls()[1].Tenant)
	resp = publish(first, "reference", "other collection", "reference title")
	require.EqualValues(t, 1, resp.Created)
	manual, found, err := backend.ResolveCollection(t.Context(), group, resources["manual"])
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, vector.ScopeShared, manual.Scope)
	reference, found, err := backend.ResolveCollection(t.Context(), group, resources["reference"])
	require.NoError(t, err)
	require.True(t, found)
	require.NotEqual(t, manual.PartitionKey, reference.PartitionKey)
	stored, _, err := backend.GetSubresourceContent(t.Context(), vector.SharedNamespace, embModel(), manual.PartitionKey, "same-uid")
	require.NoError(t, err)
	require.Equal(t, map[string]string{"section": "revised content"}, stored)
	stored, _, err = backend.GetSubresourceContent(t.Context(), vector.SharedNamespace, embModel(), reference.PartitionKey, "same-uid")
	require.NoError(t, err)
	require.Equal(t, map[string]string{"section": "other collection"}, stored)
	var rowCount int
	require.NoError(t, engine.DB().QueryRowContext(t.Context(), `SELECT count(*) FROM embeddings WHERE resource = $1 AND uid = 'same-uid'`, manual.PartitionKey).Scan(&rowCount))
	require.Equal(t, 1, rowCount, "two publishers must share one row set")
	updated, err := client.UpdateMetadata(second, &resourcepb.VectorUpdateMetadataRequest{
		Namespace: "tenant-b", Group: group, Resource: resources["manual"], Filter: []byte(`{"edition":"first"}`), Set: []byte(`{"edition":"revised"}`),
	})
	require.NoError(t, err)
	require.EqualValues(t, 1, updated.Updated)
	deleted, err := client.Delete(second, &resourcepb.VectorDeleteRequest{
		Namespace: "tenant-b", Group: group, Resource: resources["manual"], Selector: &resourcepb.VectorDeleteRequest_DeleteAll{DeleteAll: true},
	})
	require.NoError(t, err)
	require.EqualValues(t, 1, deleted.Deleted)
	stored, _, err = backend.GetSubresourceContent(t.Context(), vector.SharedNamespace, embModel(), reference.PartitionKey, "same-uid")
	require.NoError(t, err)
	require.Equal(t, map[string]string{"section": "other collection"}, stored, "deleting one collection must preserve the same UID in another")
}

func embModel() string { return "shared-integration-model" }

func TestIntegrationSharedVectorStoreRejectsUnauthorizedWritesWithoutProvisioning(t *testing.T) {
	client, backend, _, provider, group, resources := sharedIntegrationFixture(t)
	req := &resourcepb.VectorUpsertRequest{Namespace: "tenant-a", Group: group, Resource: resources["denied"], Inputs: []*resourcepb.EmbeddingInput{{Uid: "u", Title: "title", Content: "body"}}}
	for _, tc := range []struct {
		name string
		ctx  context.Context
		code codes.Code
	}{
		{"missing identity", t.Context(), codes.Unauthenticated},
		{"unapproved service", sharedPublisherContext(t, "tenant-a", "other"), codes.PermissionDenied},
		{"missing service", sharedPublisherContext(t, "tenant-a", ""), codes.PermissionDenied},
		{"wrong namespace", sharedPublisherContext(t, "tenant-b", "publisher-a"), codes.PermissionDenied},
		{"marker tenant", sharedPublisherContext(t, vector.SharedNamespace, "other"), codes.PermissionDenied},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request := &resourcepb.VectorUpsertRequest{Namespace: req.Namespace, Group: req.Group, Resource: req.Resource, Inputs: req.Inputs}
			if tc.name == "marker tenant" {
				request.Namespace = vector.SharedNamespace
			}
			_, err := client.Upsert(tc.ctx, request)
			require.Equal(t, tc.code, status.Code(err))
		})
	}
	req.Inputs[0].Folder = "tenant-private"
	_, err := client.Upsert(sharedPublisherContext(t, "tenant-a", "publisher-a"), req)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	_, err = client.UpsertSubresources(sharedPublisherContext(t, "tenant-a", "publisher-a"), &resourcepb.VectorUpsertSubresourcesRequest{
		Namespace: "tenant-a", Group: group, Resource: resources["denied"], Uid: "u",
		Inputs: []*resourcepb.EmbeddingInput{{Subresource: "section", Content: "body", Title: "title", Folder: "tenant-private"}},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	_, found, err := backend.ResolveCollection(t.Context(), group, resources["denied"])
	require.NoError(t, err)
	require.False(t, found)
	require.Empty(t, provider.calls())
}

func TestIntegrationSharedVectorStoreConcurrentPublishersShareContentDiff(t *testing.T) {
	client, backend, engine, provider, group, resources := sharedIntegrationFixture(t)
	provider.firstEntered = make(chan struct{})
	provider.releaseFirst = make(chan struct{})
	provider.secondRPC = make(chan struct{})
	defer func() {
		select {
		case <-provider.releaseFirst:
		default:
			close(provider.releaseFirst)
		}
	}()
	firstCtx, cancelFirst := context.WithTimeout(sharedPublisherContext(t, "tenant-a", "publisher-a"), 10*time.Second)
	defer cancelFirst()
	secondCtx, cancelSecond := context.WithTimeout(sharedPublisherContext(t, "tenant-b", "publisher-b"), 10*time.Second)
	defer cancelSecond()
	type result struct {
		response *resourcepb.VectorUpsertSubresourcesResponse
		err      error
	}
	publish := func(ctx context.Context, namespace string, resultCh chan<- result) {
		response, err := client.UpsertSubresources(ctx, &resourcepb.VectorUpsertSubresourcesRequest{
			Namespace: namespace, Group: group, Resource: resources["concurrent"], Uid: "shared-uid",
			Inputs: []*resourcepb.EmbeddingInput{{Subresource: "section", Content: "identical body", Title: "title"}},
		})
		resultCh <- result{response, err}
	}
	first := make(chan result, 1)
	second := make(chan result, 1)
	go publish(firstCtx, "tenant-a", first)
	select {
	case <-provider.firstEntered:
	case <-time.After(10 * time.Second):
		t.Fatal("first publisher did not reach embedding provider")
	}
	collection, found, err := backend.ResolveCollection(t.Context(), group, resources["concurrent"])
	require.NoError(t, err)
	require.True(t, found)
	lockName := "vectorentity|" + vector.SharedNamespace + "|" + collection.PartitionKey + "|shared-uid"
	go publish(secondCtx, "tenant-b", second)
	select {
	case <-provider.secondRPC:
	case <-time.After(10 * time.Second):
		t.Fatal("second publisher did not reach the RPC server")
	}
	require.Eventually(t, func() bool {
		var waiting bool
		err := engine.DB().QueryRowContext(t.Context(), `
			SELECT EXISTS (
				SELECT 1 FROM pg_locks
				WHERE locktype = 'advisory' AND NOT granted
					AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
					AND objsubid = 1
					AND ((classid::bigint << 32) | objid::bigint) = hashtext($1)::bigint
			)`, lockName).Scan(&waiting)
		return err == nil && waiting
	}, 2*time.Second, 10*time.Millisecond, "second publisher must wait on the first publisher's database entity lock")
	select {
	case result := <-second:
		t.Fatalf("second publisher finished before the first released its entity lock: %+v", result)
	default:
	}
	require.Len(t, provider.calls(), 1, "second publisher must wait while the first is embedding")
	close(provider.releaseFirst)
	firstResult, secondResult := <-first, <-second
	require.NoError(t, firstResult.err)
	require.NoError(t, secondResult.err)
	require.EqualValues(t, 1, firstResult.response.Created+secondResult.response.Created)
	require.Zero(t, firstResult.response.Updated+secondResult.response.Updated)
	require.Len(t, provider.calls(), 1, "the second publisher should see the stored unchanged chunk")
	stored, _, err := backend.GetSubresourceContent(t.Context(), vector.SharedNamespace, embModel(), collection.PartitionKey, "shared-uid")
	require.NoError(t, err)
	require.Equal(t, map[string]string{"section": "identical body"}, stored)
}

func TestIntegrationSharedVectorStoreDistinctCollectionsDoNotShareEntityLock(t *testing.T) {
	client, backend, _, provider, group, resources := sharedIntegrationFixture(t)
	provider.firstEntered = make(chan struct{})
	provider.releaseFirst = make(chan struct{})
	defer func() {
		select {
		case <-provider.releaseFirst:
		default:
			close(provider.releaseFirst)
		}
	}()
	firstCtx, cancelFirst := context.WithTimeout(sharedPublisherContext(t, "tenant-a", "publisher-a"), 10*time.Second)
	defer cancelFirst()
	firstDone := make(chan error, 1)
	go func() {
		_, err := client.UpsertSubresources(firstCtx, &resourcepb.VectorUpsertSubresourcesRequest{
			Namespace: "tenant-a", Group: group, Resource: resources["manual"], Uid: "same-uid",
			Inputs: []*resourcepb.EmbeddingInput{{Subresource: "section", Content: "first body", Title: "first"}},
		})
		firstDone <- err
	}()
	select {
	case <-provider.firstEntered:
	case <-time.After(10 * time.Second):
		t.Fatal("first collection did not reach the controlled embedder")
	}
	secondCtx, cancelSecond := context.WithTimeout(sharedPublisherContext(t, "tenant-b", "publisher-b"), 3*time.Second)
	defer cancelSecond()
	second, err := client.UpsertSubresources(secondCtx, &resourcepb.VectorUpsertSubresourcesRequest{
		Namespace: "tenant-b", Group: group, Resource: resources["reference"], Uid: "same-uid",
		Inputs: []*resourcepb.EmbeddingInput{{Subresource: "section", Content: "second body", Title: "second"}},
	})
	require.NoError(t, err, "different collection must progress while first collection holds its entity lock")
	require.EqualValues(t, 1, second.Created)
	select {
	case err := <-firstDone:
		t.Fatalf("first publication completed before its embedder was released: %v", err)
	default:
	}
	close(provider.releaseFirst)
	select {
	case err := <-firstDone:
		require.NoError(t, err)
	case <-firstCtx.Done():
		t.Fatal("first publication did not finish after release")
	}
	for _, tc := range []struct{ resource, content string }{
		{resources["manual"], "first body"},
		{resources["reference"], "second body"},
	} {
		collection, found, err := backend.ResolveCollection(t.Context(), group, tc.resource)
		require.NoError(t, err)
		require.True(t, found)
		stored, _, err := backend.GetSubresourceContent(t.Context(), vector.SharedNamespace, embModel(), collection.PartitionKey, "same-uid")
		require.NoError(t, err)
		require.Equal(t, map[string]string{"section": tc.content}, stored)
	}
}

func TestIntegrationSharedVectorStoreMetadataAndAllModelDelete(t *testing.T) {
	client, backend, engine, _, group, resources := sharedIntegrationFixture(t)
	ctx := sharedPublisherContext(t, "tenant-a", "publisher-a")
	missingDelete := &resourcepb.VectorDeleteRequest{Namespace: "tenant-a", Group: group, Resource: resources["lifecycle"], Selector: &resourcepb.VectorDeleteRequest_DeleteAll{DeleteAll: true}}
	_, err := client.Delete(ctx, missingDelete)
	require.Equal(t, codes.NotFound, status.Code(err))
	_, err = client.UpdateMetadata(ctx, &resourcepb.VectorUpdateMetadataRequest{Namespace: "tenant-a", Group: group, Resource: resources["lifecycle"], Filter: []byte(`{"batch":"old"}`), Set: []byte(`{"batch":"new"}`)})
	require.Equal(t, codes.NotFound, status.Code(err))
	_, found, err := backend.ResolveCollection(t.Context(), group, resources["lifecycle"])
	require.NoError(t, err)
	require.False(t, found, "delete and metadata update must not provision")
	_, err = client.Upsert(ctx, &resourcepb.VectorUpsertRequest{Namespace: "tenant-a", Group: group, Resource: resources["lifecycle"], Inputs: []*resourcepb.EmbeddingInput{
		{Uid: "one", Content: "one", Title: "one", Metadata: []byte(`{"batch":"old"}`)},
		{Uid: "two", Content: "two", Title: "two", Metadata: []byte(`{"batch":"keep"}`)},
	}})
	require.NoError(t, err)
	collection, found, err := backend.ResolveCollection(t.Context(), group, resources["lifecycle"])
	require.NoError(t, err)
	require.True(t, found)
	updated, err := client.UpdateMetadata(ctx, &resourcepb.VectorUpdateMetadataRequest{Namespace: "tenant-a", Group: group, Resource: resources["lifecycle"], Filter: []byte(`{"batch":"old"}`), Set: []byte(`{"batch":"ready"}`)})
	require.NoError(t, err)
	require.EqualValues(t, 1, updated.Updated)
	var metadata string
	require.NoError(t, engine.DB().QueryRowContext(t.Context(), `SELECT metadata::text FROM embeddings WHERE resource = $1 AND namespace = $2 AND uid = 'one'`, collection.PartitionKey, vector.SharedNamespace).Scan(&metadata))
	require.JSONEq(t, `{"batch":"ready"}`, metadata)
	deleted, err := client.Delete(ctx, &resourcepb.VectorDeleteRequest{Namespace: "tenant-a", Group: group, Resource: resources["lifecycle"], Selector: &resourcepb.VectorDeleteRequest_Filter{Filter: []byte(`{"batch":"ready"}`)}})
	require.NoError(t, err)
	require.EqualValues(t, 1, deleted.Deleted)
	// A previous embedding model can leave rows in the same collection; the RPC removes every model.
	require.NoError(t, backend.Upsert(t.Context(), []vector.Vector{{Namespace: vector.SharedNamespace, Resource: collection.PartitionKey, Model: "previous-model", UID: "two", Content: "previous version", Title: "two", Metadata: []byte(`{"batch":"keep"}`), Embedding: []float32{1, 0, 0, 0}}}))
	deleted, err = client.Delete(ctx, missingDelete)
	require.NoError(t, err)
	require.EqualValues(t, 2, deleted.Deleted)
	var remaining int
	require.NoError(t, engine.DB().QueryRowContext(t.Context(), `SELECT count(*) FROM embeddings WHERE resource = $1 AND namespace = $2`, collection.PartitionKey, vector.SharedNamespace).Scan(&remaining))
	require.Zero(t, remaining)
}
