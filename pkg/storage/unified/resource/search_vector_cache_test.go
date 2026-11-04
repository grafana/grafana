package resource

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
	counts  map[string]int64
}

func (f *fakeRateLimiter) Allow(_ context.Context, namespace string, _ time.Duration, limit int) (bool, int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	if f.err != nil {
		return false, 0, f.err
	}
	if f.counts != nil {
		f.counts[namespace]++
		return f.counts[namespace] <= int64(limit), f.counts[namespace], nil
	}
	return f.allow, f.count, nil
}

func TestVectorSearch_SharedCollectionQueryPolicyUsesCallerNamespace(t *testing.T) {
	key := validKey()
	collection := key.Group + "/" + key.Resource
	provider := &fakeTextEmbedder{dim: 4}
	backend := &fakeVectorBackend{collection: &vector.Collection{
		Group: key.Group, Resource: key.Resource, PartitionKey: "r_external", IsExternal: true, Scope: vector.ScopeShared,
	}, results: []vector.VectorSearchResult{{UID: "published", Title: "Published"}}}
	cache := newFakeQueryCache()
	limiter := &fakeRateLimiter{counts: map[string]int64{}}
	s := newTestSearchServerWithCache(newTestEmbedder(provider), backend, cache, limiter)
	s.sharedCollectionAllowlist = vector.NewCollectionAllowlist(nil, []string{collection})
	s.collectionAllowlist = vector.NewCollectionAllowlist(nil, nil)
	s.rateLimitPerTenant = 2

	search := func(namespace string) (*resourcepb.VectorSearchResponse, error) {
		ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{UserID: 1, UserUID: "reader", Namespace: namespace, Type: authlib.TypeUser})
		return s.VectorSearch(ctx, &resourcepb.VectorSearchRequest{
			Key: &resourcepb.ResourceKey{Namespace: namespace, Group: key.Group, Resource: key.Resource}, Query: "same query",
		})
	}
	for _, namespace := range []string{"tenant-a", "tenant-b"} {
		resp, err := search(namespace)
		require.NoError(t, err)
		require.Nil(t, resp.Error)
		require.Len(t, resp.Results, 1)
		assert.Equal(t, "published", resp.Results[0].Name)
		assert.Equal(t, namespace, provider.gotIn.Tenant)
		assert.Equal(t, vector.SharedNamespace, backend.gotNamespace)
	}
	assert.Equal(t, 2, cache.putCalls, "each tenant embeds and caches the same query separately")
	assert.Len(t, cache.entries, 2)

	resp, err := search("tenant-a")
	require.NoError(t, err)
	require.Nil(t, resp.Error)
	assert.Equal(t, 2, cache.putCalls, "a cached repeat does not embed again")
	resp, err = search("tenant-a")
	require.Nil(t, resp)
	require.Equal(t, codes.ResourceExhausted, status.Code(err))
	resp, err = search("tenant-b")
	require.NoError(t, err)
	require.Nil(t, resp.Error)
	assert.Equal(t, map[string]int64{"tenant-a": 3, "tenant-b": 2}, limiter.counts)
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

func TestVectorSearch_RateLimitedRunsBeforeCatalogCacheAndEmbed(t *testing.T) {
	fake := &fakeTextEmbedder{dim: 4}
	emb := newTestEmbedder(fake)
	cache := newFakeQueryCache()
	rl := &fakeRateLimiter{allow: false, count: 99}
	backend := &fakeVectorBackend{}
	s := newTestSearchServerWithCache(emb, backend, cache, rl)

	_, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.ResourceExhausted, status.Code(err))
	assert.Zero(t, backend.resolveCalls, "rejected request must not touch the catalog")
	assert.Equal(t, 0, cache.getCalls, "rejected request must not touch the cache")
	assert.Empty(t, fake.gotIn.Texts, "rejected request must not call the embedder")
}

func TestVectorSearch_UnavailableCollectionsConsumeRateLimit(t *testing.T) {
	for _, missing := range []bool{true, false} {
		name := "disallowed"
		if missing {
			name = "unknown"
		}
		t.Run(name, func(t *testing.T) {
			fake := &fakeTextEmbedder{dim: 4}
			backend := &fakeVectorBackend{resolveNotFound: missing}
			rl := &fakeRateLimiter{allow: true}
			s := newTestSearchServerWithCache(newTestEmbedder(fake), backend, nil, rl)
			s.collectionAllowlist = vector.NewCollectionAllowlist(nil, nil)

			resp, err := s.VectorSearch(authedCtx(), &resourcepb.VectorSearchRequest{Key: validKey(), Query: "q"})
			require.NoError(t, err)
			require.NotNil(t, resp.Error)
			assert.EqualValues(t, http.StatusNotFound, resp.Error.Code)
			assert.Equal(t, 1, rl.calls)
			assert.Equal(t, 1, backend.resolveCalls)
			assert.Empty(t, fake.gotIn.Texts)
		})
	}
}

func TestSha256HexStable(t *testing.T) {
	const q = "vector search of api latency"
	got := sha256Hex(q)
	assert.Len(t, got, 64)
	assert.Equal(t, got, sha256Hex(q))
	assert.NotEqual(t, got, sha256Hex(q+" "))
}
