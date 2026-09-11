package resource

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

type fakeQueryCache struct {
	mu       sync.Mutex
	entries  map[string][]float32
	getCalls int
	putCalls int
	evicted  int64
	putErr   error
	getErr   error
}

func newFakeQueryCache() *fakeQueryCache {
	return &fakeQueryCache{entries: map[string][]float32{}}
}

func cacheKey(ns, model, hash string) string { return ns + "|" + model + "|" + hash }

func (f *fakeQueryCache) Get(_ context.Context, ns, model, hash string) ([]float32, bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.getCalls++
	if f.getErr != nil {
		return nil, false, f.getErr
	}
	if v, ok := f.entries[cacheKey(ns, model, hash)]; ok {
		return v, true, nil
	}
	return nil, false, nil
}

func (f *fakeQueryCache) Put(_ context.Context, ns, model, hash string, emb []float32) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.putCalls++
	if f.putErr != nil {
		return f.putErr
	}
	f.entries[cacheKey(ns, model, hash)] = emb
	return nil
}

func (f *fakeQueryCache) Count(_ context.Context, ns string) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var n int64
	for k := range f.entries {
		// Prefix match is safe because tests use unique namespaces.
		if len(k) >= len(ns) && k[:len(ns)] == ns {
			n++
		}
	}
	return n, nil
}

func (f *fakeQueryCache) EvictOldest(_ context.Context, ns string, n int) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	deleted := int64(0)
	for k := range f.entries {
		if deleted >= int64(n) {
			break
		}
		if len(k) >= len(ns) && k[:len(ns)] == ns {
			delete(f.entries, k)
			deleted++
		}
	}
	f.evicted += deleted
	return deleted, nil
}

type fakeRateLimiter struct {
	mu      sync.Mutex
	calls   int
	count   int64
	allow   bool
	err     error
	sweeps  int
	swept   int64
	sweepEr error
}

func (f *fakeRateLimiter) Allow(_ context.Context, _ string, _ time.Duration, _ int) (bool, int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	if f.err != nil {
		return false, 0, f.err
	}
	return f.allow, f.count, nil
}

func (f *fakeRateLimiter) SweepOlderThan(_ context.Context, _ time.Time) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sweeps++
	return f.swept, f.sweepEr
}

func newTestSearchServerWithCache(emb *embedder.Embedder, backend vector.VectorBackend, cache vector.QueryEmbeddingCache, rl vector.RateLimiter) *searchServer {
	s := newTestSearchServer(emb, backend)
	s.queryCache = cache
	s.queryCacheMaxPerTenant = 1000
	s.rateLimiter = rl
	s.rateLimitPerTenant = 60
	s.rateLimitWindow = time.Minute
	return s
}

func TestVectorSearch_CacheMissThenHitSkipsEmbedder(t *testing.T) {
	fake := &fakeTextEmbedder{dim: 4}
	emb := newTestEmbedder(fake)
	backend := &fakeVectorBackend{results: []vector.VectorSearchResult{{UID: "u", Title: "t"}}}
	cache := newFakeQueryCache()
	s := newTestSearchServerWithCache(emb, backend, cache, nil)

	req := &resourcepb.VectorSearchRequest{Key: validKey(), Query: "same query", Limit: 5}

	_, err := s.VectorSearch(authedCtx(), req)
	require.NoError(t, err)
	assert.Equal(t, 1, cache.getCalls)
	assert.Equal(t, 1, cache.putCalls)
	assert.Equal(t, "same query", fake.gotIn.Texts[0])

	// Reset the captured input so the next call leaves a clear trace.
	fake.gotIn = embedder.EmbedTextInput{}

	_, err = s.VectorSearch(authedCtx(), req)
	require.NoError(t, err)
	assert.Equal(t, 2, cache.getCalls)
	assert.Equal(t, 1, cache.putCalls, "second call must not write to cache again")
	assert.Empty(t, fake.gotIn.Texts, "embedder must be skipped on cache hit")
}

func TestVectorSearch_CacheGetErrorFallsThroughToEmbed(t *testing.T) {
	fake := &fakeTextEmbedder{dim: 4}
	emb := newTestEmbedder(fake)
	backend := &fakeVectorBackend{results: []vector.VectorSearchResult{{UID: "u", Title: "t"}}}
	cache := newFakeQueryCache()
	cache.getErr = errors.New("transient db error")
	s := newTestSearchServerWithCache(emb, backend, cache, nil)

	resp, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.NotEmpty(t, fake.gotIn.Texts, "embedder must run after cache lookup error")
}

func TestVectorSearch_CachePutErrorIsNonFatal(t *testing.T) {
	fake := &fakeTextEmbedder{dim: 4}
	emb := newTestEmbedder(fake)
	backend := &fakeVectorBackend{results: []vector.VectorSearchResult{{UID: "u", Title: "t"}}}
	cache := newFakeQueryCache()
	cache.putErr = errors.New("transient write error")
	s := newTestSearchServerWithCache(emb, backend, cache, nil)

	resp, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	require.NotNil(t, resp)
	require.Len(t, resp.Results, 1)
}

func TestVectorSearch_RateLimitedReturnsResourceExhausted(t *testing.T) {
	backend := &fakeVectorBackend{}
	emb := newTestEmbedder(&fakeTextEmbedder{dim: 4})
	rl := &fakeRateLimiter{allow: false, count: 61}
	s := newTestSearchServerWithCache(emb, backend, nil, rl)

	_, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.ResourceExhausted, status.Code(err))
}

func TestVectorSearch_RateLimitErrorFailsClosedUnavailable(t *testing.T) {
	backend := &fakeVectorBackend{}
	emb := newTestEmbedder(&fakeTextEmbedder{dim: 4})
	rl := &fakeRateLimiter{err: errors.New("rate-bucket table unreachable")}
	s := newTestSearchServerWithCache(emb, backend, nil, rl)

	_, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Unavailable, status.Code(err), "limiter errors must fail closed")
}

func TestVectorSearch_RateLimitedRunsBeforeEmbedAndCache(t *testing.T) {
	fake := &fakeTextEmbedder{dim: 4}
	emb := newTestEmbedder(fake)
	cache := newFakeQueryCache()
	rl := &fakeRateLimiter{allow: false, count: 99}
	s := newTestSearchServerWithCache(emb, &fakeVectorBackend{}, cache, rl)

	_, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.ResourceExhausted, status.Code(err))
	assert.Equal(t, 0, cache.getCalls, "rejected request must not touch the cache")
	assert.Empty(t, fake.gotIn.Texts, "rejected request must not call the embedder")
}

func TestSha256HexStable(t *testing.T) {
	const q = "vector search of api latency"
	got := sha256Hex(q)
	assert.Len(t, got, 64)
	assert.Equal(t, got, sha256Hex(q))
	assert.NotEqual(t, got, sha256Hex(q+" "))
}
