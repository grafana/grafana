package resource

import (
	"context"
	"errors"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/dskit/instrument"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type phaseTrackingIndex struct {
	*hybridFakeIndex
	trackingMu      sync.Mutex
	enrichmentCalls int
	observerLeaked  bool
}

func (idx *phaseTrackingIndex) Search(ctx context.Context, access authlib.AccessClient, req *resourcepb.ResourceSearchRequest, indexes *SearchIndexes, stats *SearchStats) (*resourcepb.ResourceSearchResponse, error) {
	if req.Query == "" {
		idx.trackingMu.Lock()
		idx.enrichmentCalls++
		idx.observerLeaked = idx.observerLeaked || ctx.Value(hybridPhaseObserverKey{}) != nil
		idx.trackingMu.Unlock()
	}
	return idx.hybridFakeIndex.Search(ctx, access, req, indexes, stats)
}

func TestHybridSearchPhaseEnrichmentAndAuthorizationDoNotAddSamples(t *testing.T) {
	registry := prometheus.NewRegistry()
	backend := &fakeVectorBackend{results: []vector.VectorSearchResult{{UID: "semonly", Title: "Semantic Only", Content: "Content", Folder: "f1", Score: 0.1}}}
	s, idx, _ := newHybridTestServer(lexFieldValueResponse(), backend)
	s.vectorMetrics = ProvideVectorMetrics(registry)
	access := &countingAccessClient{}
	s.access = access
	idx.managedByResp = managerFieldValueResponse([3]string{"semonly", "repo", "managed"})
	idx.folderResp = lexFieldValueResponse([3]string{"f1", "Folder One", ""})
	tracked := &phaseTrackingIndex{hybridFakeIndex: idx}
	s.search = &fakeSearchBackend{idx: tracked}

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{Key: validKey(), Query: "q", SkipRerank: true})
	require.NoError(t, err)
	require.Len(t, resp.Results, 1)
	require.Equal(t, "repo", resp.Results[0].ManagedByKind)
	require.Equal(t, "Folder One", resp.Results[0].FolderTitle)
	tracked.trackingMu.Lock()
	enrichmentCalls, observerLeaked := tracked.enrichmentCalls, tracked.observerLeaked
	tracked.trackingMu.Unlock()
	require.Equal(t, 2, enrichmentCalls)
	require.False(t, observerLeaked)
	idx.mu.Lock()
	require.NotNil(t, idx.gotManagedByReq)
	require.NotNil(t, idx.gotFolderReq)
	idx.mu.Unlock()
	require.Equal(t, 1, access.batchCalls)
	require.Len(t, access.gotItems, 1)
	require.Equal(t, uint64(2), phaseCount(t, registry, "database", "ok"))
	require.Equal(t, uint64(1), phaseCount(t, registry, "embedding", "ok"))
	require.Zero(t, phaseCount(t, registry, "reranking", "ok"))
}

func TestHybridSearchPhaseSiblingFailureRecordsCanceledEmbeddingCall(t *testing.T) {
	registry := prometheus.NewRegistry()
	s, index := newHybridResourcesTestServer(nil)
	backend := &hybridResourcesTestVectorBackend{}
	client, _ := enableHybridResourcesSemantic(s, backend)
	s.vectorMetrics = ProvideVectorMetrics(registry)
	lexicalStarted := make(chan struct{}, 2)
	releaseLexical := make(chan struct{})
	index.onSearch = func(ctx context.Context) error {
		lexicalStarted <- struct{}{}
		select {
		case <-releaseLexical:
			return status.Error(codes.Unavailable, "index unavailable")
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	embeddingStarted := make(chan struct{}, 1)
	client.onEmbed = func(ctx context.Context) error {
		embeddingStarted <- struct{}{}
		<-ctx.Done()
		return ctx.Err()
	}
	ctx, cancel := context.WithTimeout(authedCtx(), 5*time.Second)
	defer cancel()
	done := make(chan error, 1)
	go func() {
		_, err := s.HybridSearch(ctx, hybridResourcesTestRequest())
		done <- err
	}()
	for _, started := range []<-chan struct{}{embeddingStarted, lexicalStarted, lexicalStarted} {
		select {
		case <-started:
		case <-ctx.Done():
			t.Fatal("embedding and both lexical legs must overlap before sibling failure")
		}
	}
	close(releaseLexical)
	err := <-done
	require.Equal(t, codes.Unavailable, status.Code(err))
	require.Equal(t, 1, client.calls)
	require.Empty(t, backend.embeddings)
	require.Equal(t, uint64(1), phaseCount(t, registry, "embedding", "error"))
	require.Zero(t, phaseCount(t, registry, "embedding", "ok"))
	require.Equal(t, uint64(2), phaseCount(t, registry, "database", "ok"))
	require.Zero(t, phaseCount(t, registry, "database", "error"))
	require.Zero(t, phaseCount(t, registry, "reranking", "ok"))
}

type slowQueryCache struct{ *fakeQueryCache }

func (c slowQueryCache) Get(ctx context.Context, namespace, model, hash string) ([]float32, bool, error) {
	time.Sleep(2 * time.Second)
	return c.fakeQueryCache.Get(ctx, namespace, model, hash)
}

type slowQueryEmbedder struct{ *fakeTextEmbedder }

func (e slowQueryEmbedder) EmbedText(ctx context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
	time.Sleep(3 * time.Second)
	return e.fakeTextEmbedder.EmbedText(ctx, input)
}

type slowRerankScorer struct{ *fakeRerankScorer }

func (s slowRerankScorer) Score(ctx context.Context, query string, texts []string) ([]float64, error) {
	time.Sleep(4 * time.Second)
	return s.fakeRerankScorer.Score(ctx, query, texts)
}

func phaseSum(t *testing.T, registry *prometheus.Registry, phase, status string) float64 {
	t.Helper()
	families, err := registry.Gather()
	require.NoError(t, err)
	for _, family := range families {
		if family.GetName() != "grafana_vector_storage_hybrid_search_phase_duration_seconds" {
			continue
		}
		for _, metric := range family.Metric {
			labels := map[string]string{}
			for _, label := range metric.Label {
				labels[label.GetName()] = label.GetValue()
			}
			if labels["phase"] == phase && labels["status"] == status {
				return metric.GetHistogram().GetSampleSum()
			}
		}
	}
	return 0
}

func TestHybridSearchPhaseProviderTimersExcludeCacheAndRerankPreparation(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		registry := prometheus.NewRegistry()
		s, _, fake := newHybridTestServer(lexFieldValueResponse([3]string{"a", "A", ""}), &fakeVectorBackend{})
		s.vectorMetrics = ProvideVectorMetrics(registry)
		s.embedder.TextEmbedder = slowQueryEmbedder{fakeTextEmbedder: fake}
		s.queryCache = slowQueryCache{fakeQueryCache: newFakeQueryCache()}
		s.queryCacheMaxPerTenant = 100
		s.reranker = rerankTestReranker(slowRerankScorer{fakeRerankScorer: &fakeRerankScorer{}}, rerank.RelevanceThresholds{})
		_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{Key: validKey(), Query: "q"})
		require.NoError(t, err)
		require.InDelta(t, 3, phaseSum(t, registry, "embedding", "ok"), 0.001)
		require.InDelta(t, 4, phaseSum(t, registry, "reranking", "ok"), 0.001)
		require.GreaterOrEqual(t, phaseSum(t, registry, "database", "ok"), 2.0)
	})
}

func TestHybridSearchPhaseClassifiesSwallowedCacheAndRerankErrors(t *testing.T) {
	registry := prometheus.NewRegistry()
	s, _, _ := newHybridTestServer(lexFieldValueResponse([3]string{"a", "A", ""}), &fakeVectorBackend{})
	s.vectorMetrics = ProvideVectorMetrics(registry)
	s.queryCache = &fakeQueryCache{entries: map[string][]float32{}, getErr: errors.New("cache unavailable"), putErr: errors.New("cache unavailable")}
	s.queryCacheMaxPerTenant = 1000
	s.reranker = rerankTestReranker(&fakeRerankScorer{err: errors.New("provider unavailable")}, rerank.RelevanceThresholds{})
	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{Key: validKey(), Query: "q"})
	require.NoError(t, err)
	require.Len(t, resp.Results, 1)
	require.Equal(t, uint64(2), phaseCount(t, registry, "database", "error"))
	require.Equal(t, uint64(3), phaseCount(t, registry, "database", "ok"))
	require.Equal(t, uint64(1), phaseCount(t, registry, "embedding", "ok"))
	require.Equal(t, uint64(1), phaseCount(t, registry, "reranking", "error"))
}

func TestHybridSearchPhaseMalformedScoresCountAsSuccessfulProviderCall(t *testing.T) {
	registry := prometheus.NewRegistry()
	s, _, _ := newHybridTestServer(lexFieldValueResponse([3]string{"a", "A", ""}), &fakeVectorBackend{})
	s.vectorMetrics = ProvideVectorMetrics(registry)
	s.reranker = rerankTestReranker(&fakeRerankScorer{scores: []float64{1, 2}}, rerank.RelevanceThresholds{})
	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{Key: validKey(), Query: "q"})
	require.NoError(t, err)
	require.Len(t, resp.Results, 1)
	require.Equal(t, uint64(1), phaseCount(t, registry, "reranking", "ok"))
	require.Zero(t, phaseCount(t, registry, "reranking", "error"))
}

func TestHybridSearchPhaseExternalLexicalAndVectorCalls(t *testing.T) {
	registry := prometheus.NewRegistry()
	s, _, _ := newHybridTestServer(lexFieldValueResponse(), externalBackend())
	s.vectorMetrics = ProvideVectorMetrics(registry)
	s.externalLexical = &fakeLexicalSearcher{hits: []vector.LexicalHit{{UID: "a", Title: "A"}}}
	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{Key: validKey(), Query: "q", SkipRerank: true})
	require.NoError(t, err)
	require.Len(t, resp.Results, 1)
	require.Equal(t, uint64(3), phaseCount(t, registry, "database", "ok"))
	require.Equal(t, uint64(1), phaseCount(t, registry, "embedding", "ok"))
}

func TestHybridSearchPhaseEarlyFailureAndVectorSearchAreIsolated(t *testing.T) {
	registry := prometheus.NewRegistry()
	s, _, _ := newHybridTestServer(lexFieldValueResponse(), &fakeVectorBackend{})
	s.vectorMetrics = ProvideVectorMetrics(registry)
	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{Key: validKey(), Query: " "})
	require.Error(t, err)
	_, err = s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{Key: validKey(), Query: "q"})
	require.NoError(t, err)
	require.Zero(t, phaseCount(t, registry, "database", "ok"))
	require.Zero(t, phaseCount(t, registry, "embedding", "ok"))
}

func TestHybridSearchPhaseMultiResourceSharesEmbedding(t *testing.T) {
	registry := prometheus.NewRegistry()
	s, _ := newHybridResourcesTestServer(nil)
	enableHybridResourcesSemantic(s, &hybridResourcesTestVectorBackend{})
	s.vectorMetrics = ProvideVectorMetrics(registry)
	req := hybridResourcesTestRequest()
	req.SkipRerank = true
	_, err := s.HybridSearch(authedCtx(), req)
	require.NoError(t, err)
	require.Equal(t, uint64(4), phaseCount(t, registry, "database", "ok"))
	require.Equal(t, uint64(1), phaseCount(t, registry, "embedding", "ok"))
}

func TestHybridSearchPhaseCacheEvictionHasItsOwnDatabaseSample(t *testing.T) {
	registry := prometheus.NewRegistry()
	s, _, _ := newHybridTestServer(lexFieldValueResponse(), &fakeVectorBackend{})
	s.vectorMetrics = ProvideVectorMetrics(registry)
	cache := newFakeQueryCache()
	cache.entries[cacheKey("ns", s.embedder.Model, "prior-query")] = []float32{1, 0, 0, 0}
	s.queryCache = cache
	s.queryCacheMaxPerTenant = 1
	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{Key: validKey(), Query: "new query", SkipRerank: true})
	require.NoError(t, err)
	require.Equal(t, uint64(6), phaseCount(t, registry, "database", "ok"))
	require.Equal(t, uint64(1), phaseCount(t, registry, "embedding", "ok"))
}

func TestHybridSearchPhaseBackendFailureIsRecordedBeforeRPCConversion(t *testing.T) {
	registry := prometheus.NewRegistry()
	backend := &fakeVectorBackend{err: errors.New("vector backend unavailable")}
	s, _, _ := newHybridTestServer(lexFieldValueResponse(), backend)
	s.vectorMetrics = ProvideVectorMetrics(registry)
	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{Key: validKey(), Query: "q"})
	require.Error(t, err)
	require.Equal(t, uint64(1), phaseCount(t, registry, "database", "error"))
	require.Equal(t, uint64(1), phaseCount(t, registry, "database", "ok"))
	require.Equal(t, uint64(1), phaseCount(t, registry, "embedding", "ok"))
}

func TestHybridSearchPhaseMissingCollectionIsSuccessfulBackendCall(t *testing.T) {
	registry := prometheus.NewRegistry()
	s, _, _ := newHybridTestServer(lexFieldValueResponse(), &fakeVectorBackend{resolveNotFound: true})
	s.vectorMetrics = ProvideVectorMetrics(registry)
	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{Key: validKey(), Query: "q"})
	require.Error(t, err)
	require.Equal(t, uint64(1), phaseCount(t, registry, "database", "ok"))
	require.Zero(t, phaseCount(t, registry, "database", "error"))
	require.Zero(t, phaseCount(t, registry, "embedding", "ok"))
}

func TestHybridSearchPhaseSkippedSemanticAndRerankingCallsHaveNoSamples(t *testing.T) {
	registry := prometheus.NewRegistry()
	s, _, _ := newHybridTestServer(lexFieldValueResponse(), &fakeVectorBackend{})
	s.vectorBackend = nil
	s.vectorMetrics = ProvideVectorMetrics(registry)
	s.reranker = rerankTestReranker(&fakeRerankScorer{}, rerank.RelevanceThresholds{})
	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{Key: validKey(), Query: "q"})
	require.NoError(t, err)
	require.Zero(t, phaseCount(t, registry, "database", "ok"))
	require.Zero(t, phaseCount(t, registry, "embedding", "ok"))
	require.Zero(t, phaseCount(t, registry, "reranking", "ok"))
}

func TestHybridSearchPhaseExternalLexicalFailureRecordsError(t *testing.T) {
	registry := prometheus.NewRegistry()
	s, _, _ := newHybridTestServer(lexFieldValueResponse(), externalBackend())
	s.vectorMetrics = ProvideVectorMetrics(registry)
	s.externalLexical = &fakeLexicalSearcher{err: errors.New("lexical unavailable")}
	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{Key: validKey(), Query: "q"})
	require.Error(t, err)
	require.Equal(t, uint64(1), phaseCount(t, registry, "database", "error"))
}

func TestHybridSearchPhaseCanceledProviderCallRecordsError(t *testing.T) {
	registry := prometheus.NewRegistry()
	s, _, _ := newHybridTestServer(lexFieldValueResponse([3]string{"a", "A", ""}), &fakeVectorBackend{})
	s.vectorMetrics = ProvideVectorMetrics(registry)
	ctx, cancel := context.WithCancel(authedCtx())
	defer cancel()
	s.reranker = rerankTestReranker(&cancelingScorer{cancel: cancel}, rerank.RelevanceThresholds{})
	_, err := s.HybridSearch(ctx, &resourcepb.HybridSearchRequest{Key: validKey(), Query: "q"})
	require.Error(t, err)
	require.Equal(t, uint64(1), phaseCount(t, registry, "reranking", "error"))
}

func phaseCount(t *testing.T, registry *prometheus.Registry, phase, status string) uint64 {
	t.Helper()
	families, err := registry.Gather()
	require.NoError(t, err)
	for _, family := range families {
		if family.GetName() != "grafana_vector_storage_hybrid_search_phase_duration_seconds" {
			continue
		}
		for _, metric := range family.Metric {
			labels := map[string]string{}
			for _, label := range metric.Label {
				labels[label.GetName()] = label.GetValue()
			}
			if labels["phase"] == phase && labels["status"] == status {
				return metric.GetHistogram().GetSampleCount()
			}
		}
	}
	return 0
}

func TestHybridSearchPhaseCountsCacheMissHitAndProviderCalls(t *testing.T) {
	registry := prometheus.NewRegistry()
	s, _, _ := newHybridTestServer(lexFieldValueResponse(), &fakeVectorBackend{})
	s.vectorMetrics = ProvideVectorMetrics(registry)
	s.queryCache = newFakeQueryCache()
	s.queryCacheMaxPerTenant = 1000
	req := &resourcepb.HybridSearchRequest{Key: validKey(), Query: "same query", SkipRerank: true}
	_, err := s.HybridSearch(authedCtx(), req)
	require.NoError(t, err)
	require.Equal(t, uint64(5), phaseCount(t, registry, "database", "ok"))
	require.Equal(t, uint64(1), phaseCount(t, registry, "embedding", "ok"))
	_, err = s.HybridSearch(authedCtx(), req)
	require.NoError(t, err)
	require.Equal(t, uint64(8), phaseCount(t, registry, "database", "ok"))
	require.Equal(t, uint64(1), phaseCount(t, registry, "embedding", "ok"))
	require.Zero(t, phaseCount(t, registry, "reranking", "ok"))
}

func TestHybridSearchPhaseCollectorRegistersWithFixedLabelsAndBuckets(t *testing.T) {
	registry := prometheus.NewRegistry()
	metrics := ProvideVectorMetrics(registry)
	metrics.HybridSearchPhaseDuration.WithLabelValues("database", "ok").Observe(0.01)

	families, err := registry.Gather()
	require.NoError(t, err)
	for _, family := range families {
		if family.GetName() != "grafana_vector_storage_hybrid_search_phase_duration_seconds" {
			continue
		}
		require.Contains(t, family.GetHelp(), "HybridSearch")
		require.Len(t, family.Metric, 1)
		labels := family.Metric[0].GetLabel()
		require.Len(t, labels, 2)
		require.Equal(t, "phase", labels[0].GetName())
		require.Equal(t, "database", labels[0].GetValue())
		require.Equal(t, "status", labels[1].GetName())
		require.Equal(t, "ok", labels[1].GetValue())
		buckets := family.Metric[0].GetHistogram().GetBucket()
		require.Len(t, buckets, len(instrument.DefBuckets))
		for i, bucket := range buckets {
			require.Equal(t, instrument.DefBuckets[i], bucket.GetUpperBound())
		}
		require.Panics(t, func() { ProvideVectorMetrics(registry) })
		require.NotNil(t, ProvideVectorMetrics(nil).HybridSearchPhaseDuration)
		return
	}
	t.Fatal("HybridSearch phase collector was not registered")
}
