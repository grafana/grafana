package schemaversion

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"
)

// testProvider tracks how many times get() is called
type testProvider struct {
	testData  any
	callCount atomic.Int64
}

func newTestProvider(testData any) *testProvider {
	return &testProvider{
		testData: testData,
	}
}

func (p *testProvider) get(_ context.Context) any {
	p.callCount.Add(1)
	return p.testData
}

func (p *testProvider) getCallCount() int64 {
	return p.callCount.Load()
}

func TestCachedProvider_CacheHit(t *testing.T) {
	datasources := []DataSourceInfo{
		{UID: "ds1", Type: "prometheus", Name: "Prometheus", Default: true},
		{UID: "ds2", Type: "loki", Name: "Loki"},
	}

	underlying := newTestProvider(datasources)
	// Test newCachedProvider directly instead of the wrapper
	cached := newCachedProvider(underlying.get, defaultCacheSize, time.Minute, log.New("test"))

	// Use "default" namespace (org 1) - this is the standard Grafana namespace format
	ctx := request.WithNamespace(context.Background(), "default")

	// First call should hit the underlying provider
	idx1 := cached.Get(ctx)
	require.NotNil(t, idx1)
	assert.Equal(t, int64(1), underlying.getCallCount(), "first call should invoke underlying provider")

	// Second call should use cache
	idx2 := cached.Get(ctx)
	require.NotNil(t, idx2)
	assert.Equal(t, int64(1), underlying.getCallCount(), "second call should use cache, not invoke underlying provider")

	// Both should return the same data
	assert.Equal(t, idx1, idx2)
}

func TestCachedProvider_NamespaceIsolation(t *testing.T) {
	datasources := []DataSourceInfo{
		{UID: "ds1", Type: "prometheus", Name: "Prometheus", Default: true},
	}

	underlying := newTestProvider(datasources)
	cached := newCachedProvider(underlying.get, defaultCacheSize, time.Minute, log.New("test"))

	// Use "default" (org 1) and "org-2" (org 2) - standard Grafana namespace formats
	ctx1 := request.WithNamespace(context.Background(), "default")
	ctx2 := request.WithNamespace(context.Background(), "org-2")

	// First call for org 1
	idx1 := cached.Get(ctx1)
	require.NotNil(t, idx1)
	assert.Equal(t, int64(1), underlying.getCallCount(), "first org-1 call should invoke underlying provider")

	// Call for org 2 should also invoke underlying provider (different namespace)
	idx2 := cached.Get(ctx2)
	require.NotNil(t, idx2)
	assert.Equal(t, int64(2), underlying.getCallCount(), "org-2 call should invoke underlying provider (separate cache)")

	// Second call for org 1 should use cache
	idx3 := cached.Get(ctx1)
	require.NotNil(t, idx3)
	assert.Equal(t, int64(2), underlying.getCallCount(), "second org-1 call should use cache")

	// Second call for org 2 should use cache
	idx4 := cached.Get(ctx2)
	require.NotNil(t, idx4)
	assert.Equal(t, int64(2), underlying.getCallCount(), "second org-2 call should use cache")
}

func TestCachedProvider_NoNamespaceFallback(t *testing.T) {
	datasources := []DataSourceInfo{
		{UID: "ds1", Type: "prometheus", Name: "Prometheus", Default: true},
	}

	underlying := newTestProvider(datasources)
	cached := newCachedProvider(underlying.get, defaultCacheSize, time.Minute, log.New("test"))

	// Context without namespace - should fall back to direct provider call
	ctx := context.Background()

	idx1 := cached.Get(ctx)
	require.NotNil(t, idx1)
	assert.Equal(t, int64(1), underlying.getCallCount())

	// Second call without namespace should also invoke underlying (no caching for unknown namespace)
	idx2 := cached.Get(ctx)
	require.NotNil(t, idx2)
	assert.Equal(t, int64(2), underlying.getCallCount(), "without namespace, each call should invoke underlying provider")
}

func TestCachedProvider_ConcurrentAccess(t *testing.T) {
	datasources := []DataSourceInfo{
		{UID: "ds1", Type: "prometheus", Name: "Prometheus", Default: true},
	}

	underlying := newTestProvider(datasources)
	cached := newCachedProvider(underlying.get, defaultCacheSize, time.Minute, log.New("test"))

	// Use "default" namespace (org 1)
	ctx := request.WithNamespace(context.Background(), "default")

	var wg sync.WaitGroup
	numGoroutines := 100

	// Launch many goroutines that all try to access the cache simultaneously
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			idx := cached.Get(ctx)
			require.NotNil(t, idx)
		}()
	}

	wg.Wait()

	// Due to double-check locking, only 1 goroutine should have actually built the cache
	// In practice, there might be a few more due to timing, but it should be much less than numGoroutines
	callCount := underlying.getCallCount()
	assert.LessOrEqual(t, callCount, int64(5), "with proper locking, very few goroutines should invoke underlying provider; got %d", callCount)
}

func TestCachedProvider_ConcurrentNamespaces(t *testing.T) {
	datasources := []DataSourceInfo{
		{UID: "ds1", Type: "prometheus", Name: "Prometheus", Default: true},
	}

	underlying := newTestProvider(datasources)
	cached := newCachedProvider(underlying.get, defaultCacheSize, time.Minute, log.New("test"))

	var wg sync.WaitGroup
	numOrgs := 10
	callsPerOrg := 20

	// Launch goroutines for multiple namespaces
	// Use valid namespace formats: "default" for org 1, "org-N" for N > 1
	namespaces := make([]string, numOrgs)
	namespaces[0] = "default"
	for i := 1; i < numOrgs; i++ {
		namespaces[i] = fmt.Sprintf("org-%d", i+1)
	}

	for _, ns := range namespaces {
		ctx := request.WithNamespace(context.Background(), ns)
		for i := 0; i < callsPerOrg; i++ {
			wg.Add(1)
			go func(ctx context.Context) {
				defer wg.Done()
				idx := cached.Get(ctx)
				require.NotNil(t, idx)
			}(ctx)
		}
	}

	wg.Wait()

	// Each org should have at most a few calls (ideally 1, but timing can cause a few more)
	callCount := underlying.getCallCount()
	// With 10 orgs, we expect around 10 calls (one per org)
	assert.LessOrEqual(t, callCount, int64(numOrgs), "expected roughly one call per org, got %d calls for %d orgs", callCount, numOrgs)
}

// Test that cache returns correct data for each namespace
func TestCachedProvider_CorrectDataPerNamespace(t *testing.T) {
	// Provider that returns different data based on namespace
	underlying := &namespaceAwareProvider{
		datasourcesByNamespace: map[string][]DataSourceInfo{
			"default": {{UID: "org1-ds", Type: "prometheus", Name: "Org1 DS", Default: true}},
			"org-2":   {{UID: "org2-ds", Type: "loki", Name: "Org2 DS", Default: true}},
		},
	}
	cached := newCachedProvider(underlying.Index, defaultCacheSize, time.Minute, log.New("test"))

	// Use valid namespace formats
	ctx1 := request.WithNamespace(context.Background(), "default")
	ctx2 := request.WithNamespace(context.Background(), "org-2")

	idx1 := cached.Get(ctx1)
	idx2 := cached.Get(ctx2)

	assert.Equal(t, "org1-ds", idx1.GetDefault().UID, "org 1 should get org-1 datasources")
	assert.Equal(t, "org2-ds", idx2.GetDefault().UID, "org 2 should get org-2 datasources")

	// Subsequent calls should still return correct data
	idx1Again := cached.Get(ctx1)
	idx2Again := cached.Get(ctx2)

	assert.Equal(t, "org1-ds", idx1Again.GetDefault().UID, "org 1 should still get org-1 datasources from cache")
	assert.Equal(t, "org2-ds", idx2Again.GetDefault().UID, "org 2 should still get org-2 datasources from cache")
}

// TestCachedProvider_PreloadMultipleNamespaces verifies preloading multiple namespaces
func TestCachedProvider_PreloadMultipleNamespaces(t *testing.T) {
	// Provider that returns different data based on namespace
	underlying := &namespaceAwareProvider{
		datasourcesByNamespace: map[string][]DataSourceInfo{
			"default": {{UID: "org1-ds", Type: "prometheus", Name: "Org1 DS", Default: true}},
			"org-2":   {{UID: "org2-ds", Type: "loki", Name: "Org2 DS", Default: true}},
			"org-3":   {{UID: "org3-ds", Type: "tempo", Name: "Org3 DS", Default: true}},
		},
	}
	cached := newCachedProvider(underlying.Index, defaultCacheSize, time.Minute, log.New("test"))

	// Preload multiple namespaces
	nsInfos := []authlib.NamespaceInfo{
		createNamespaceInfo(1, 0, "default"),
		createNamespaceInfo(2, 0, "org-2"),
		createNamespaceInfo(3, 0, "org-3"),
	}
	cached.Preload(context.Background(), nsInfos)

	// After preload, the underlying provider should have been called once per namespace
	assert.Equal(t, 3, underlying.callCount, "preload should call underlying provider once per namespace")

	// Access all namespaces - should use preloaded data and get correct data per namespace
	expectedUIDs := map[string]string{
		"default": "org1-ds",
		"org-2":   "org2-ds",
		"org-3":   "org3-ds",
	}

	for _, ns := range []string{"default", "org-2", "org-3"} {
		ctx := request.WithNamespace(context.Background(), ns)
		idx := cached.Get(ctx)
		require.NotNil(t, idx, "index for namespace %s should not be nil", ns)
		assert.Equal(t, expectedUIDs[ns], idx.GetDefault().UID, "namespace %s should get correct datasource", ns)
	}

	// The underlying provider should still have been called only 3 times (from preload)
	assert.Equal(t, 3, underlying.callCount,
		"access after preload should use cached data for all namespaces")
}

// namespaceAwareProvider returns different datasources based on namespace
type namespaceAwareProvider struct {
	datasourcesByNamespace map[string][]DataSourceInfo
	callCount              int
}

func (p *namespaceAwareProvider) Index(ctx context.Context) *DatasourceIndex {
	p.callCount++
	ns := request.NamespaceValue(ctx)
	if ds, ok := p.datasourcesByNamespace[ns]; ok {
		return NewDatasourceIndex(ds)
	}
	return NewDatasourceIndex(nil)
}

// createNamespaceInfo creates a NamespaceInfo for testing
func createNamespaceInfo(orgID, stackID int64, value string) authlib.NamespaceInfo {
	return authlib.NamespaceInfo{
		OrgID:   orgID,
		StackID: stackID,
		Value:   value,
	}
}

// Test DatasourceIndex functionality
func TestDatasourceIndex_Lookup(t *testing.T) {
	datasources := []DataSourceInfo{
		{UID: "ds-uid-1", Type: "prometheus", Name: "Prometheus DS", Default: true, APIVersion: "v1"},
		{UID: "ds-uid-2", Type: "loki", Name: "Loki DS", Default: false, APIVersion: "v1"},
	}
	idx := NewDatasourceIndex(datasources)

	t.Run("lookup by name", func(t *testing.T) {
		ds := idx.Lookup("Prometheus DS")
		require.NotNil(t, ds)
		assert.Equal(t, "ds-uid-1", ds.UID)
	})

	t.Run("lookup by UID", func(t *testing.T) {
		ds := idx.Lookup("ds-uid-2")
		require.NotNil(t, ds)
		assert.Equal(t, "Loki DS", ds.Name)
	})

	t.Run("lookup unknown returns nil", func(t *testing.T) {
		ds := idx.Lookup("unknown")
		assert.Nil(t, ds)
	})

	t.Run("get default", func(t *testing.T) {
		ds := idx.GetDefault()
		require.NotNil(t, ds)
		assert.Equal(t, "ds-uid-1", ds.UID)
	})

	t.Run("lookup by UID directly", func(t *testing.T) {
		ds := idx.LookupByUID("ds-uid-1")
		require.NotNil(t, ds)
		assert.Equal(t, "Prometheus DS", ds.Name)
	})

	t.Run("lookup by name directly", func(t *testing.T) {
		ds := idx.LookupByName("Loki DS")
		require.NotNil(t, ds)
		assert.Equal(t, "ds-uid-2", ds.UID)
	})
}

func TestDatasourceIndex_EmptyIndex(t *testing.T) {
	idx := NewDatasourceIndex(nil)

	assert.Nil(t, idx.GetDefault())
	assert.Nil(t, idx.Lookup("anything"))
	assert.Nil(t, idx.LookupByUID("anything"))
	assert.Nil(t, idx.LookupByName("anything"))
}

// TestCachedProvider_TTLExpiration verifies that cache expires after TTL
func TestCachedProvider_TTLExpiration(t *testing.T) {
	datasources := []DataSourceInfo{
		{UID: "ds1", Type: "prometheus", Name: "Prometheus", Default: true},
	}

	underlying := newTestProvider(datasources)
	// Use a very short TTL for testing
	shortTTL := 50 * time.Millisecond
	cached := newCachedProvider(underlying.get, defaultCacheSize, shortTTL, log.New("test"))

	ctx := request.WithNamespace(context.Background(), "default")

	// First call - should call underlying provider
	idx1 := cached.Get(ctx)
	require.NotNil(t, idx1)
	assert.Equal(t, int64(1), underlying.getCallCount(), "first call should invoke underlying provider")

	// Second call immediately - should use cache
	idx2 := cached.Get(ctx)
	require.NotNil(t, idx2)
	assert.Equal(t, int64(1), underlying.getCallCount(), "second call should use cache")

	// Wait for TTL to expire
	time.Sleep(shortTTL + 20*time.Millisecond)

	// Third call after TTL - should call underlying provider again
	idx3 := cached.Get(ctx)
	require.NotNil(t, idx3)
	assert.Equal(t, int64(2), underlying.getCallCount(),
		"after TTL expiration, underlying provider should be called again")
}

// TestCachedProvider_ParallelNamespacesFetch verifies that different namespaces can fetch in parallel
func TestCachedProvider_ParallelNamespacesFetch(t *testing.T) {
	// Create a blocking provider that tracks concurrent executions
	provider := &blockingProvider{
		blockDuration: 100 * time.Millisecond,
		datasources: []DataSourceInfo{
			{UID: "ds1", Type: "prometheus", Name: "Prometheus", Default: true},
		},
	}
	cached := newCachedProvider(provider.get, defaultCacheSize, time.Minute, log.New("test"))

	numNamespaces := 5
	var wg sync.WaitGroup

	// Launch fetches for different namespaces simultaneously
	startTime := time.Now()
	for i := 0; i < numNamespaces; i++ {
		wg.Add(1)
		namespace := fmt.Sprintf("org-%d", i+1)
		go func(ns string) {
			defer wg.Done()
			ctx := request.WithNamespace(context.Background(), ns)
			idx := cached.Get(ctx)
			require.NotNil(t, idx)
		}(namespace)
	}
	wg.Wait()
	elapsed := time.Since(startTime)

	// Verify that all namespaces were called
	assert.Equal(t, int64(numNamespaces), provider.callCount.Load())

	// Verify max concurrent executions shows parallelism
	maxConcurrent := provider.maxConcurrent.Load()
	assert.Equal(t, int64(numNamespaces), maxConcurrent)

	// If all namespaces had to wait sequentially, it would take numNamespaces * blockDuration
	// With parallelism, it should be much faster (close to just blockDuration)
	sequentialTime := time.Duration(numNamespaces) * provider.blockDuration
	assert.Less(t, elapsed, sequentialTime)
}

// TestCachedProvider_SameNamespaceSerialFetch verifies that the same namespace doesn't fetch concurrently
func TestCachedProvider_SameNamespaceSerialFetch(t *testing.T) {
	// Create a blocking provider that tracks concurrent executions
	provider := &blockingProvider{
		blockDuration: 100 * time.Millisecond,
		datasources: []DataSourceInfo{
			{UID: "ds1", Type: "prometheus", Name: "Prometheus", Default: true},
		},
	}
	cached := newCachedProvider(provider.get, defaultCacheSize, time.Minute, log.New("test"))

	numGoroutines := 10
	var wg sync.WaitGroup

	// Launch multiple fetches for the SAME namespace simultaneously
	ctx := request.WithNamespace(context.Background(), "default")
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			idx := cached.Get(ctx)
			require.NotNil(t, idx)
		}()
	}
	wg.Wait()

	// Max concurrent should be 1 since all goroutines are for the same namespace
	maxConcurrent := provider.maxConcurrent.Load()
	assert.Equal(t, int64(1), maxConcurrent)
}

// blockingProvider is a test provider that simulates slow fetch operations
// and tracks concurrent executions
type blockingProvider struct {
	blockDuration time.Duration
	datasources   []DataSourceInfo
	callCount     atomic.Int64
	currentActive atomic.Int64
	maxConcurrent atomic.Int64
}

func (p *blockingProvider) get(_ context.Context) any {
	p.callCount.Add(1)

	// Track concurrent executions
	current := p.currentActive.Add(1)

	// Update max concurrent if this is a new peak
	for {
		maxVal := p.maxConcurrent.Load()
		if current <= maxVal {
			break
		}
		if p.maxConcurrent.CompareAndSwap(maxVal, current) {
			break
		}
	}

	// Simulate slow operation
	time.Sleep(p.blockDuration)

	p.currentActive.Add(-1)
	return p.datasources
}
