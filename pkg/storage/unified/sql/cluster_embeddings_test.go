package sql

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/dgraph-io/badger/v4"
	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/utils/ptr"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/backfill"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/reconciler"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func TestIntegrationClusterEmbeddingLifecycle(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	dsn := os.Getenv("PGVECTOR_TEST_DB")
	if dsn == "" {
		t.Skip("PGVECTOR_TEST_DB is required")
	}
	const group, plural, version = "catalog.example.test", "systemschemas", "v1alpha1"
	const model = "test/system-schema"
	const interval = 25 * time.Millisecond
	ctx := types.WithAuthInfo(t.Context(), &identity.StaticRequester{
		Type: types.TypeAccessPolicy, Namespace: "*",
		AccessToken: "verified",
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{
			Permissions: []string{group + "/" + plural + ":*"},
		}},
	})
	engine := isolatedClusterEmbeddingDB(t, dsn)
	cfg := setting.NewCfg()
	require.NoError(t, vector.MigrateVectorStore(ctx, engine, cfg))
	vectors := vector.NewPgvectorBackend(ctx, dbimpl.NewDB(engine.DB().DB, engine.Dialect().DriverName()), 1000, 0, false, engine)
	db, err := badger.Open(badger.DefaultOptions("").WithInMemory(true).WithLogger(nil))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	store, err := resource.NewKVStorageBackend(resource.KVBackendOptions{KvStore: resource.NewBadgerKV(db)})
	require.NoError(t, err)
	writer, err := resource.NewResourceServer(resource.ResourceServerOptions{Backend: store, AccessClient: types.FixedAccessClient(true)})
	require.NoError(t, err)
	t.Cleanup(func() { _ = writer.Stop(context.Background()) })

	value := func(name, namespace, description, summary string) []byte {
		body, err := json.Marshal(map[string]any{
			"apiVersion": group + "/" + version, "kind": "SystemSchema",
			"metadata": map[string]string{"name": name, "namespace": namespace},
			"spec":     map[string]string{"description": description, "summary": summary},
		})
		require.NoError(t, err)
		return body
	}
	clusterKey := &resourcepb.ResourceKey{Group: group, Resource: plural, Name: "database"}
	created, err := writer.Create(ctx, &resourcepb.CreateRequest{Key: clusterKey, Value: value("database", "", "connection pooling", "pool saturation")})
	require.NoError(t, err)
	_, err = writer.Create(ctx, &resourcepb.CreateRequest{
		Key:   &resourcepb.ResourceKey{Group: group, Resource: plural, Name: "database", Namespace: "stacks-1"},
		Value: value("database", "stacks-1", "private tenant text", ""),
	})
	require.NoError(t, err)
	// An established reconciler has already passed these writes.
	checkpoint, err := store.ListIterator(ctx, &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{Group: group, Resource: plural}},
	}, func(resource.ListIterator) error { return nil })
	require.NoError(t, err)
	require.NoError(t, vectors.SetLatestRV(ctx, checkpoint))

	cfg.EnableSearch = true
	cfg.VectorAllowedInternalCollections = []string{group + "/" + plural}
	cfg.IndexPath = t.TempDir()
	indexMetrics := resource.ProvideIndexMetrics(prometheus.NewRegistry())
	searchOpts, err := search.NewSearchOptions(cfg, &search.StandardDocumentBuilders{}, indexMetrics, nil, nil)
	require.NoError(t, err)
	options := resource.ResourceServerOptions{VectorMetrics: resource.ProvideVectorMetrics(nil)}
	require.NoError(t, withSearch(&ServerOptions{Cfg: cfg, VectorBackend: vectors, SearchOptions: searchOpts}, &options))
	manifest := func(revision int, field string) *app.ManifestData {
		return &app.ManifestData{
			Group: group, Embed: map[string]app.ManifestResourceEmbed{plural: {ReembedVersion: revision}},
			Versions: []app.ManifestVersion{{Name: version, Served: true, Kinds: []app.ManifestVersionKind{{
				Kind: "SystemSchema", Resource: plural, Scope: "Cluster",
				Search: &app.ManifestVersionKindSearch{Hybrid: ptr.To(true)},
				Embed:  &app.ManifestVersionKindEmbed{Fields: []app.ManifestVersionKindEmbedField{{Name: field, Path: "spec." + field}}},
			}}}},
		}
	}
	require.NoError(t, options.Search.ReloadManifests([]*app.ManifestData{manifest(1, "description")}))
	options.Backend, options.VectorBackend, options.IndexMetrics = store, vectors, indexMetrics
	blocked, unblock := make(chan struct{}), make(chan struct{})
	signalBlocked := sync.OnceFunc(func() { close(blocked) })
	release := sync.OnceFunc(func() { close(unblock) })
	embedderFixture := schemaEmbeddingFixture{beforeEmbed: func(ctx context.Context, text string) error {
		if text != "description: blocked update" {
			return nil
		}
		signalBlocked()
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-unblock:
			return nil
		}
	}}
	options.Embedder = &embedder.Embedder{TextEmbedder: embedderFixture, Model: model}
	batch := embedder.NewBatchEmbedder(*options.Embedder)
	backfiller, err := backfill.NewVectorBackfiller(backfill.Options{
		Storage: store, VectorBackend: vectors, BatchEmbedder: batch, BuilderProvider: options.Search.EmbeddingBuilders, Interval: interval, PageSize: 1,
	})
	require.NoError(t, err)
	options.VectorReconciler, err = reconciler.New(reconciler.Options{
		Storage: store, VectorBackend: vectors, BatchEmbedder: batch, BuilderProvider: options.Search.EmbeddingBuilders, Interval: interval, Backfiller: backfiller,
	})
	require.NoError(t, err)
	server, err := resource.NewResourceServer(options)
	require.NoError(t, err)
	t.Cleanup(func() { _ = server.Stop(context.Background()) })
	t.Cleanup(release)

	query := func() (*resourcepb.HybridSearchResponse, error) {
		return server.HybridSearch(ctx, &resourcepb.HybridSearchRequest{
			Resources: []*resourcepb.HybridSearchRequest_Resource{{Group: group, Resource: plural}},
			Query:     "database connectivity",
		})
	}
	waitFor := func(text string) {
		t.Helper()
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			results, err := query()
			if !assert.NoError(c, err) || !assert.Len(c, results.GetResults(), 1) {
				return
			}
			hit := results.GetResults()[0]
			assert.Equal(c, "SystemSchema", results.GetKinds()[group+"/"+plural])
			assert.Equal(c, "database", hit.GetKey().GetName())
			assert.Empty(c, hit.GetKey().GetNamespace())
			if assert.Len(c, hit.GetChunks(), 1) {
				assert.Equal(c, text, hit.GetChunks()[0].GetContent())
			}
		}, 10*time.Second, interval)
	}
	waitFor("description: connection pooling")
	fts, err := vectors.LexicalSearch(ctx, vector.LexicalQuery{
		Resource: plural, Namespace: resource.ClusterNamespace, Model: model, Query: "pooling", Limit: 5,
	})
	require.NoError(t, err)
	require.Len(t, fts, 1)
	require.Equal(t, "database", fts[0].UID)

	_, err = vectors.DeleteNamespace(ctx, resource.ClusterNamespace)
	require.NoError(t, err)
	waitFor("description: connection pooling")
	updated, err := writer.Update(ctx, &resourcepb.UpdateRequest{Key: clusterKey, ResourceVersion: created.ResourceVersion, Value: value("database", "", "connection reuse", "pool saturation")})
	require.NoError(t, err)
	waitFor("description: connection reuse")

	updated, err = writer.Update(ctx, &resourcepb.UpdateRequest{Key: clusterKey, ResourceVersion: updated.ResourceVersion, Value: value("database", "", "blocked update", "pool saturation")})
	require.NoError(t, err)
	select {
	case <-blocked:
	case <-time.After(10 * time.Second):
		t.Fatal("revision one sweep did not start embedding the update")
	}
	require.NoError(t, options.Search.ReloadManifests([]*app.ManifestData{manifest(2, "summary")}))
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		var waiting bool
		err := engine.DB().QueryRowContext(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM pg_locks
				WHERE locktype = 'advisory' AND NOT granted
				AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
			)`).Scan(&waiting)
		assert.NoError(c, err)
		assert.True(c, waiting, "the new backfill revision must wait for the old sweep")
	}, 10*time.Second, interval)
	release()
	waitFor("summary: pool saturation")
	deleted, err := writer.Delete(ctx, &resourcepb.DeleteRequest{Key: clusterKey, ResourceVersion: updated.ResourceVersion})
	require.NoError(t, err)
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		rv, err := vectors.GetLatestRV(ctx)
		assert.NoError(c, err)
		assert.GreaterOrEqual(c, rv, deleted.GetResourceVersion())
		results, err := query()
		assert.NoError(c, err)
		assert.Empty(c, results.GetResults())
	}, 10*time.Second, interval)
}

// A private database keeps this test's vector checkpoints and migrations
// independent of the other suites that use PGVECTOR_TEST_DB.
func isolatedClusterEmbeddingDB(t *testing.T, dsn string) *xorm.Engine {
	t.Helper()
	admin, err := xorm.NewEngine("postgres", dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = admin.Close() })
	name := fmt.Sprintf("grafana_cluster_embedding_%x", rand.Uint64())
	_, err = admin.DB().ExecContext(t.Context(), "CREATE DATABASE "+name)
	require.NoError(t, err)
	t.Cleanup(func() {
		_, err := admin.DB().ExecContext(context.Background(), "DROP DATABASE "+name)
		if err != nil {
			t.Error(err)
		}
	})
	if strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://") {
		dsn, err = pq.ParseURL(dsn) //nolint:staticcheck
		require.NoError(t, err)
	}
	dsn += " dbname=" + name
	engine, err := xorm.NewEngine("postgres", dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = engine.Close() })
	return engine
}

type schemaEmbeddingFixture struct {
	beforeEmbed func(context.Context, string) error
}

func (f schemaEmbeddingFixture) EmbedText(ctx context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
	output := embedder.EmbedTextOutput{Embeddings: make([]embedder.Embedding, len(input.Texts))}
	for i, text := range input.Texts {
		if err := f.beforeEmbed(ctx, text); err != nil {
			return embedder.EmbedTextOutput{}, err
		}
		embedding := []float32{0, 1}
		if input.Task == embedder.TaskRetrievalQuery || strings.Contains(text, "connection") || strings.Contains(text, "pool") {
			embedding = []float32{1, 0}
		}
		output.Embeddings[i] = embedder.Embedding{Dense: embedding}
	}
	return output, nil
}
