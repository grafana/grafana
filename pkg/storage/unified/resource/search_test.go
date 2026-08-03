package resource

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"net/http"
	"slices"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ ResourceIndex = &MockResourceIndex{}

// Mock implementations
type MockResourceIndex struct {
	updateIndexError error

	updateIndexMu    sync.Mutex
	updateIndexCalls int

	buildInfo IndexBuildInfo
	docCount  int64

	// Items passed to BulkIndex, guarded by updateIndexMu.
	bulkItems []*BulkIndexItem

	// Optional configured results for the managed-object RPCs. When nil the
	// methods return an error, matching the default "not expected" behaviour.
	managedObjects *resourcepb.ListManagedObjectsResponse
	managedCounts  []*resourcepb.CountManagedObjectsResponse_ResourceCount
}

func (m *MockResourceIndex) BuildInfo() (IndexBuildInfo, error) {
	bi := m.buildInfo
	// The mock stands for an index this binary built, so it maps the current
	// features unless a test sets them. A test that wants an older index sets them
	// to an empty (non-nil) slice.
	if bi.Features == nil {
		bi.Features = CurrentIndexFeatures()
	}
	return bi, nil
}

func (m *MockResourceIndex) BulkIndex(req *BulkIndexRequest) error {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	m.bulkItems = append(m.bulkItems, req.Items...)
	return nil
}

// indexedItems returns the items passed to BulkIndex so far.
func (m *MockResourceIndex) indexedItems() []*BulkIndexItem {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	return slices.Clone(m.bulkItems)
}

func (m *MockResourceIndex) Search(_ context.Context, _ types.AccessClient, _ *resourcepb.ResourceSearchRequest, _ []ResourceIndex, _ *SearchStats) (*resourcepb.ResourceSearchResponse, error) {
	return nil, fmt.Errorf("not expected")
}

func (m *MockResourceIndex) CountManagedObjects(_ context.Context, _ *SearchStats) ([]*resourcepb.CountManagedObjectsResponse_ResourceCount, error) {
	if m.managedCounts != nil {
		return m.managedCounts, nil
	}
	return nil, fmt.Errorf("not expected")
}

func (m *MockResourceIndex) DocCount(_ context.Context, _ string, _ *SearchStats) (int64, error) {
	return m.docCount, nil
}

func (m *MockResourceIndex) ListManagedObjects(_ context.Context, _ *resourcepb.ListManagedObjectsRequest, _ *SearchStats) (*resourcepb.ListManagedObjectsResponse, error) {
	if m.managedObjects != nil {
		return m.managedObjects, nil
	}
	return nil, fmt.Errorf("not expected")
}

func (m *MockResourceIndex) UpdateIndex(_ context.Context) (int64, error) {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()

	m.updateIndexCalls++
	return 0, m.updateIndexError
}

// fakeDocumentBuilder implements DocumentBuilder for testing.
// BuildDocument is never called in these tests — the struct is only used as a cache entry.
type fakeDocumentBuilder struct{}

func (f *fakeDocumentBuilder) BuildDocument(_ context.Context, _ *resourcepb.ResourceKey, _ int64, _ []byte) (*IndexableDocument, error) {
	return nil, fmt.Errorf("not expected")
}

// mockStorageBackend implements StorageBackend for testing
type mockStorageBackend struct {
	UnimplementedStorageBackend
	resourceStats   []ResourceStats
	lastImportTimes []ResourceLastImportTime
	statsCalls      atomic.Int32
	listStoredCalls atomic.Int32
	listStoredErr   error
	lastCountLimit  atomic.Int64
}

func (m *mockStorageBackend) GetResourceStats(ctx context.Context, nsr NamespacedResource, minCount int) ([]ResourceStats, error) {
	m.statsCalls.Add(1)
	var result []ResourceStats
	for _, stat := range m.resourceStats {
		// Apply the minCount filter like the real implementation does
		if stat.Count > int64(minCount) {
			result = append(result, stat)
		}
	}
	return result, nil
}

// ListStoredResources reports the distinct group/resource identities in the
// namespace, derived from the configured resourceStats. It is the discovery
// primitive the search server uses instead of counting via GetResourceStats.
func (m *mockStorageBackend) ListStoredResources(_ context.Context, filter NamespacedResource) ([]NamespacedResource, error) {
	m.listStoredCalls.Add(1)
	if m.listStoredErr != nil {
		return nil, m.listStoredErr
	}
	if filter.Namespace == "" {
		return nil, fmt.Errorf("namespace is required")
	}
	var result []NamespacedResource
	for _, stat := range m.resourceStats {
		if stat.Namespace != filter.Namespace {
			continue
		}
		if filter.Group != "" && stat.Group != filter.Group {
			continue
		}
		if filter.Resource != "" && stat.Resource != filter.Resource {
			continue
		}
		result = append(result, stat.NamespacedResource)
	}
	return result, nil
}

func (m *mockStorageBackend) GetResourceStatsWithLimit(ctx context.Context, nsr NamespacedResource, minCount, countLimit int) ([]ResourceStats, error) {
	m.lastCountLimit.Store(int64(countLimit))
	return m.GetResourceStats(ctx, nsr, minCount)
}

func (m *mockStorageBackend) WriteEvent(ctx context.Context, event WriteEvent) (int64, error) {
	return 0, nil
}

func (m *mockStorageBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	return nil
}

func (m *mockStorageBackend) WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error) {
	ch := make(chan *WrittenEvent)
	context.AfterFunc(ctx, func() { close(ch) })
	return ch, nil
}

func (m *mockStorageBackend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, callback func(ListIterator) error) (int64, error) {
	return 0, nil
}

func (m *mockStorageBackend) ListHistory(ctx context.Context, req *resourcepb.ListRequest, callback func(ListIterator) error) (int64, error) {
	return 0, nil
}

func (m *mockStorageBackend) ListModifiedSince(ctx context.Context, key NamespacedResource, sinceRv int64, _ *time.Time) (int64, iter.Seq2[*ModifiedResource, error]) {
	return 0, func(yield func(*ModifiedResource, error) bool) {
		yield(nil, errors.New("not implemented"))
	}
}

func (m *mockStorageBackend) GetResourceLastImportTimes(ctx context.Context) iter.Seq2[ResourceLastImportTime, error] {
	return func(yield func(ResourceLastImportTime, error) bool) {
		for _, ti := range m.lastImportTimes {
			if !yield(ti, nil) {
				return
			}
		}
	}
}

// mockSearchBackend implements SearchBackend for testing with tracking capabilities
type mockSearchBackend struct {
	openIndexes []NamespacedResource

	mu                sync.Mutex
	buildIndexCalls   []buildIndexCall
	cache             map[NamespacedResource]ResourceIndex
	stopCalls         atomic.Int32
	snapshotThreshold int64
	// Updater from the most recent BuildIndex, so a test can drive it.
	lastUpdater UpdateFn
}

func (m *mockSearchBackend) SnapshotCountThreshold() int64 {
	return m.snapshotThreshold
}

type buildIndexCall struct {
	key  NamespacedResource
	size int64
}

func (m *mockSearchBackend) LoadOpenIndexStats(_ time.Time, _ time.Duration) ([]ResourceStats, error) {
	return nil, nil
}

// TestStartupIndexStatsCountLimit checks the cap the startup prebuild passes to
// the backend: init min size + 1, raised to the snapshot threshold + 1 when
// snapshots are enabled.
func TestStartupIndexStatsCountLimit(t *testing.T) {
	cases := []struct {
		name              string
		initMinCount      int
		snapshotThreshold int64 // 0 means no active snapshot store
		wantLimit         int64
	}{
		{"no snapshot store", 5, 0, 6},
		{"snapshot threshold higher", 5, 100, 101},
		{"init min higher", 50, 10, 51},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			storage := &mockStorageBackend{}
			server, err := newSearchServer(SearchOptions{
				Backend:      &mockSearchBackend{snapshotThreshold: tc.snapshotThreshold},
				Resources:    &TestDocumentBuilderSupplier{GroupsResources: map[string]string{"group": "resource"}},
				InitMinCount: tc.initMinCount,
			}, storage, nil, nil, nil, nil, nil, nil, nil, nil)
			require.NoError(t, err)

			_, err = server.startupIndexStats(t.Context())
			require.NoError(t, err)
			require.Equal(t, tc.wantLimit, storage.lastCountLimit.Load())
		})
	}
}

func (m *mockSearchBackend) WriteOpenIndexStats(_ time.Time) error {
	return nil
}

func (m *mockSearchBackend) GetIndex(key NamespacedResource) ResourceIndex {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.cache[key]
}

func (m *mockSearchBackend) BuildIndex(ctx context.Context, key NamespacedResource, size int64, reason string, builder BuildFn, updater UpdateFn, rebuild bool, lastImportTime time.Time, _ time.Duration) (ResourceIndex, error) {
	index := &MockResourceIndex{}
	m.mu.Lock()
	m.lastUpdater = updater
	m.mu.Unlock()

	// Call the builder function (required by the contract)
	_, err := builder(index)
	if err != nil {
		return nil, err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if m.cache == nil {
		m.cache = make(map[NamespacedResource]ResourceIndex)
	}
	m.cache[key] = index

	// Determine if this is an empty index based on size
	// Empty indexes are characterized by size == 0
	m.buildIndexCalls = append(m.buildIndexCalls, buildIndexCall{
		key:  key,
		size: size,
	})

	return index, nil
}

func (m *mockSearchBackend) TotalDocs() int64 {
	return 0
}

func (m *mockSearchBackend) GetOpenIndexes() []NamespacedResource {
	return m.openIndexes
}

func (m *mockSearchBackend) Stop() {
	m.stopCalls.Add(1)
}

type manifestSearchBackend struct {
	mockSearchBackend

	stats    []ResourceStats
	ok       bool
	loadErr  error
	loadCall atomic.Int32
}

func (m *manifestSearchBackend) LoadOpenIndexStats(_ time.Time, _ time.Duration) ([]ResourceStats, error) {
	m.loadCall.Add(1)
	if !m.ok {
		return nil, m.loadErr
	}
	return append([]ResourceStats(nil), m.stats...), m.loadErr
}

func TestBuildIndexesUsesOpenIndexStats(t *testing.T) {
	key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}
	storage := &mockStorageBackend{
		resourceStats: []ResourceStats{{NamespacedResource: NamespacedResource{Namespace: "fallback", Group: "group", Resource: "resource"}, Count: 50}},
	}
	search := &manifestSearchBackend{
		stats: []ResourceStats{{NamespacedResource: key, Count: 5}},
		ok:    true,
	}
	supplier := &TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{"group": "resource"},
	}

	support, err := newSearchServer(SearchOptions{
		Backend:      search,
		Resources:    supplier,
		InitMinCount: 10,
	}, storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	built, err := support.buildIndexes(t.Context())
	require.NoError(t, err)
	require.Equal(t, 1, built)
	require.Equal(t, int32(1), search.loadCall.Load())
	require.Zero(t, storage.statsCalls.Load())
	require.Len(t, search.buildIndexCalls, 1)
	require.Equal(t, key, search.buildIndexCalls[0].key)
	require.Equal(t, int64(5), search.buildIndexCalls[0].size)
}

func TestBuildIndexesFallsBackToResourceStats(t *testing.T) {
	key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}
	storage := &mockStorageBackend{
		resourceStats: []ResourceStats{{NamespacedResource: key, Count: 50}},
	}
	search := &manifestSearchBackend{ok: false}
	supplier := &TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{"group": "resource"},
	}

	support, err := newSearchServer(SearchOptions{
		Backend:      search,
		Resources:    supplier,
		InitMinCount: 10,
	}, storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	built, err := support.buildIndexes(t.Context())
	require.NoError(t, err)
	require.Equal(t, 1, built)
	require.Equal(t, int32(1), search.loadCall.Load())
	require.Equal(t, int32(1), storage.statsCalls.Load())
	require.Len(t, search.buildIndexCalls, 1)
	require.Equal(t, key, search.buildIndexCalls[0].key)
	require.Equal(t, int64(50), search.buildIndexCalls[0].size)
}

func TestBuildIndexesAppliesOwnershipToOpenIndexStats(t *testing.T) {
	owned := NamespacedResource{Namespace: "owned", Group: "group", Resource: "resource"}
	unowned := NamespacedResource{Namespace: "unowned", Group: "group", Resource: "resource"}
	storage := &mockStorageBackend{}
	search := &manifestSearchBackend{
		stats: []ResourceStats{
			{NamespacedResource: owned, Count: 10},
			{NamespacedResource: unowned, Count: 10},
		},
		ok: true,
	}
	supplier := &TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{"group": "resource"},
	}
	ownsIndexFn := func(key NamespacedResource) (bool, error) {
		return key != unowned, nil
	}

	support, err := newSearchServer(SearchOptions{
		Backend:   search,
		Resources: supplier,
	}, storage, nil, nil, nil, nil, nil, nil, nil, ownsIndexFn)
	require.NoError(t, err)

	built, err := support.buildIndexes(t.Context())
	require.NoError(t, err)
	require.Equal(t, 1, built)
	require.Zero(t, storage.statsCalls.Load())
	require.Len(t, search.buildIndexCalls, 1)
	require.Equal(t, owned, search.buildIndexCalls[0].key)
}

func TestSearchServerStopStopsBackend(t *testing.T) {
	search := &mockSearchBackend{}
	supplier := &TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{"group": "resource"},
	}

	support, err := newSearchServer(SearchOptions{
		Backend:   search,
		Resources: supplier,
	}, &mockStorageBackend{}, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	support.bgTaskCancel = func() {}

	support.stop()
	require.Equal(t, int32(1), search.stopCalls.Load())
}

func TestSearchGetOrCreateIndex(t *testing.T) {
	// Setup mock implementations
	storage := &mockStorageBackend{
		resourceStats: []ResourceStats{
			{NamespacedResource: NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}, Count: 50, ResourceVersion: 11111111},
		},
	}
	search := &mockSearchBackend{}
	supplier := &TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{
			"group": "resource",
		},
	}

	opts := SearchOptions{
		Backend:      search,
		Resources:    supplier,
		InitMinCount: 1, // set min count to default for this test
	}

	support, err := newSearchServer(opts, storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, support)

	start := make(chan struct{})

	const concurrency = 100
	wg := sync.WaitGroup{}
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			_, _ = support.getOrCreateIndex(context.Background(), nil, NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}, "test")
		}()
	}

	// Wait a bit for goroutines to start (hopefully)
	time.Sleep(10 * time.Millisecond)
	// Unblock all goroutines.
	close(start)
	wg.Wait()

	require.NotEmpty(t, search.buildIndexCalls)
	require.Less(t, len(search.buildIndexCalls), concurrency, "Should not have built index more than a few times (ideally once)")
	require.Equal(t, unknownBuildSize, search.buildIndexCalls[0].size)
	require.Zero(t, storage.statsCalls.Load(), "lazy index build should not call GetResourceStats for a size hint")
}

func TestSearchGetOrCreateIndexWithIndexUpdate(t *testing.T) {
	// Setup mock implementations
	storage := &mockStorageBackend{
		resourceStats: []ResourceStats{
			{NamespacedResource: NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}, Count: 50, ResourceVersion: 11111111},
		},
	}
	failedErr := fmt.Errorf("failed to update index")
	search := &mockSearchBackend{
		cache: map[NamespacedResource]ResourceIndex{
			{Namespace: "ns", Group: "group", Resource: "bad"}: &MockResourceIndex{
				updateIndexError: failedErr,
			},
		},
	}
	supplier := &TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{
			"group": "resource",
		},
	}

	opts := SearchOptions{
		Backend:      search,
		Resources:    supplier,
		InitMinCount: 1, // set min count to default for this test
	}

	// Enable searchAfterWrite
	support, err := newSearchServer(opts, storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, support)

	idx, err := support.getOrCreateIndex(context.Background(), nil, NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}, "initial call")
	require.NoError(t, err)
	require.NotNil(t, idx)
	checkMockIndexUpdateCalls(t, idx, 1)

	idx, err = support.getOrCreateIndex(context.Background(), nil, NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}, "second call")
	require.NoError(t, err)
	require.NotNil(t, idx)
	checkMockIndexUpdateCalls(t, idx, 2)

	idx, err = support.getOrCreateIndex(context.Background(), nil, NamespacedResource{Namespace: "ns", Group: "group", Resource: "bad"}, "call to bad index")
	require.ErrorIs(t, err, failedErr)
	require.Nil(t, idx)
}

func checkMockIndexUpdateCalls(t *testing.T, idx ResourceIndex, calls int) {
	mi, ok := idx.(*MockResourceIndex)
	require.True(t, ok)
	mi.updateIndexMu.Lock()
	defer mi.updateIndexMu.Unlock()
	require.Equal(t, calls, mi.updateIndexCalls)
}

func TestSearchGetOrCreateIndexWithCancellation(t *testing.T) {
	// Setup mock implementations
	storage := &mockStorageBackend{
		resourceStats: []ResourceStats{
			{NamespacedResource: NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}, Count: 50, ResourceVersion: 11111111},
		},
	}
	search := newBlockingSearchBackend(nil)

	supplier := &TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{
			"group": "resource",
		},
	}

	opts := SearchOptions{
		Backend:      search,
		Resources:    supplier,
		InitMinCount: 1, // set min count to default for this test
	}

	support, err := newSearchServer(opts, storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, support)

	key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	_, err = support.getOrCreateIndex(ctx, nil, key, "test")
	// Make sure we get context deadline error.
	require.ErrorIs(t, err, context.DeadlineExceeded)

	// BuildIndex started despite the cancellation: getOrCreateIndex's singleflight
	// uses context.WithoutCancel so the underlying build runs to completion.
	select {
	case <-search.onStarted:
	case <-time.After(2 * time.Second):
		t.Fatal("BuildIndex never started")
	}

	// Release the in-flight build; the index should land in the cache.
	close(search.proceed)
	require.Eventually(t, func() bool {
		return support.search.GetIndex(key) != nil
	}, 1*time.Second, 100*time.Millisecond, "index not cached after build finished")

	// Second call to getOrCreateIndex returns the cached index immediately, even
	// though ctx is already done.
	_, err = support.getOrCreateIndex(ctx, nil, key, "test")
	require.NoError(t, err)
}

func TestCombineBuildRequests(t *testing.T) {
	type testcase struct {
		a, b  rebuildRequest
		exp   rebuildRequest
		expOK bool
	}

	now := time.Now()
	for name, tc := range map[string]testcase{
		"mismatched resource": {
			a:     rebuildRequest{NamespacedResource: NamespacedResource{Namespace: "a", Group: "a", Resource: "a"}},
			b:     rebuildRequest{NamespacedResource: NamespacedResource{Namespace: "b", Group: "b", Resource: "b"}},
			expOK: false,
		},
		"equal values": {
			a:     rebuildRequest{minBuildTime: now, minBuildVersion: semver.MustParse("10.15.20")},
			b:     rebuildRequest{minBuildTime: now, minBuildVersion: semver.MustParse("10.15.20")},
			expOK: true,
			exp:   rebuildRequest{minBuildTime: now, minBuildVersion: semver.MustParse("10.15.20")},
		},
		"empty field": {
			a:     rebuildRequest{minBuildTime: now},
			b:     rebuildRequest{minBuildVersion: semver.MustParse("10.15.20")},
			expOK: true,
			exp:   rebuildRequest{minBuildTime: now, minBuildVersion: semver.MustParse("10.15.20")},
		},
		"use max build time": {
			a:     rebuildRequest{minBuildTime: now.Add(2 * time.Hour)},
			b:     rebuildRequest{minBuildTime: now.Add(-time.Hour)},
			expOK: true,
			exp:   rebuildRequest{minBuildTime: now.Add(2 * time.Hour)},
		},
		"use max version": {
			a:     rebuildRequest{minBuildVersion: semver.MustParse("12.10.99")},
			b:     rebuildRequest{minBuildVersion: semver.MustParse("10.15.20")},
			expOK: true,
			exp:   rebuildRequest{minBuildVersion: semver.MustParse("12.10.99")},
		},
		"both fields": {
			a:     rebuildRequest{minBuildTime: now.Add(2 * time.Hour), minBuildVersion: semver.MustParse("12.10.99")},
			b:     rebuildRequest{minBuildTime: now.Add(-time.Hour), minBuildVersion: semver.MustParse("10.15.20")},
			expOK: true,
			exp:   rebuildRequest{minBuildTime: now.Add(2 * time.Hour), minBuildVersion: semver.MustParse("12.10.99")},
		},
		"merge selectable fields": {
			a:     rebuildRequest{selectableFields: []string{"team", "title"}},
			b:     rebuildRequest{selectableFields: []string{"folder", "team"}},
			expOK: true,
			exp:   rebuildRequest{selectableFields: []string{"folder", "team", "title"}},
		},
	} {
		t.Run(name, func(t *testing.T) {
			res1, ok := combineRebuildRequests(tc.a, tc.b)
			require.Equal(t, tc.expOK, ok)
			if ok {
				require.Equal(t, tc.exp, res1)
			}

			// commutativity
			res2, ok := combineRebuildRequests(tc.b, tc.a)
			require.Equal(t, tc.expOK, ok)
			if ok {
				require.Equal(t, tc.exp, res2)
			}
		})
	}
}

// TestRequiredIndexFeaturesAreCurrent guards the invariant that makes required
// features safe: requiring a feature this binary never records would rebuild
// every index on every check, forever.
func TestRequiredIndexFeaturesAreCurrent(t *testing.T) {
	for _, postRankAuthz := range []bool{false, true} {
		for _, required := range RequiredIndexFeatures(postRankAuthz) {
			require.Contains(t, CurrentIndexFeatures(), required)
		}
	}
}

// TestRequiredIndexFeaturesStoredFacets covers the gating that keeps the stored
// facet mapping from rebuilding indexes where post-rank authorization is off.
func TestRequiredIndexFeaturesStoredFacets(t *testing.T) {
	require.NotContains(t, RequiredIndexFeatures(false), IndexFeatureStoredFacets)
	require.Contains(t, RequiredIndexFeatures(true), IndexFeatureStoredFacets)

	// An index built before the stored facet mapping is reused with the option
	// off, and rebuilt once it is on.
	buildInfo := IndexBuildInfo{Features: []IndexFeature{IndexFeatureDeletedMarker}}
	require.Empty(t, MissingIndexFeatures(buildInfo, RequiredIndexFeatures(false)))
	require.Equal(t, []IndexFeature{IndexFeatureStoredFacets}, MissingIndexFeatures(buildInfo, RequiredIndexFeatures(true)))
}

func TestShouldRebuildIndex(t *testing.T) {
	type testcase struct {
		buildInfo                IndexBuildInfo
		minTime                  time.Time
		lastImportTime           time.Time
		minBuildVersion          *semver.Version
		maxBuildVersion          *semver.Version
		selectableFields         []string
		expectedSearchFieldsHash string
		requiredFeatures         []IndexFeature

		expectedRebuild bool
	}

	now := time.Now()

	for name, tc := range map[string]testcase{
		"empty build info, with no rebuild conditions": {
			buildInfo:       IndexBuildInfo{},
			expectedRebuild: false,
		},
		"empty build info, with minTime": {
			buildInfo:       IndexBuildInfo{},
			minTime:         now,
			expectedRebuild: true,
		},
		"empty build info, with lastImportTime": {
			buildInfo:       IndexBuildInfo{},
			lastImportTime:  now,
			expectedRebuild: true,
		},
		"empty build info, with minVersion": {
			buildInfo:       IndexBuildInfo{},
			minBuildVersion: semver.MustParse("10.15.20"),
			expectedRebuild: true,
		},
		"build time before min time": {
			buildInfo:       IndexBuildInfo{BuildTime: now.Add(-2 * time.Hour)},
			minTime:         now,
			expectedRebuild: true,
		},
		"build time after min time": {
			buildInfo:       IndexBuildInfo{BuildTime: now.Add(2 * time.Hour)},
			minTime:         now,
			expectedRebuild: false,
		},
		"build time before last import time": {
			buildInfo:       IndexBuildInfo{BuildTime: now.Add(-2 * time.Hour)},
			lastImportTime:  now,
			expectedRebuild: true,
		},
		"build time after last import time": {
			buildInfo:       IndexBuildInfo{BuildTime: now.Add(2 * time.Hour)},
			lastImportTime:  now,
			expectedRebuild: false,
		},
		"build version before min version": {
			buildInfo:       IndexBuildInfo{BuildVersion: semver.MustParse("10.15.19")},
			minBuildVersion: semver.MustParse("10.15.20"),
			expectedRebuild: true,
		},
		"build version after min version": {
			buildInfo:       IndexBuildInfo{BuildVersion: semver.MustParse("11.0.0")},
			minBuildVersion: semver.MustParse("10.15.20"),
			expectedRebuild: false,
		},
		"build version newer than running version": {
			buildInfo:       IndexBuildInfo{BuildVersion: semver.MustParse("12.0.0")},
			maxBuildVersion: semver.MustParse("11.0.0"),
			expectedRebuild: true,
		},
		"build version same as running version": {
			buildInfo:       IndexBuildInfo{BuildVersion: semver.MustParse("11.0.0")},
			maxBuildVersion: semver.MustParse("11.0.0"),
			expectedRebuild: false,
		},
		"build version older than running version": {
			buildInfo:       IndexBuildInfo{BuildVersion: semver.MustParse("10.0.0")},
			maxBuildVersion: semver.MustParse("11.0.0"),
			expectedRebuild: false,
		},
		"no index build version with maxBuildVersion set": {
			buildInfo:       IndexBuildInfo{},
			maxBuildVersion: semver.MustParse("11.0.0"),
			expectedRebuild: false,
		},
		"index with no previous selectable fields, and no new selectable fields": {
			buildInfo:        IndexBuildInfo{},
			selectableFields: nil,
			expectedRebuild:  false,
		},
		"index with no previous selectable fields, with new selectable fields": {
			buildInfo:        IndexBuildInfo{},
			selectableFields: []string{"title"},
			expectedRebuild:  true,
		},
		"index with existing fields, and no new selectable fields": {
			buildInfo:        IndexBuildInfo{SelectableFields: []string{"title", "team"}},
			selectableFields: nil,
			expectedRebuild:  false,
		},
		"index with existing fields, and subset of fields": {
			buildInfo:        IndexBuildInfo{SelectableFields: []string{"title", "team"}},
			selectableFields: []string{"title"},
			expectedRebuild:  false,
		},
		"index with existing fields, and same selectable fields": {
			buildInfo:        IndexBuildInfo{SelectableFields: []string{"title", "team"}},
			selectableFields: []string{"title", "team"},
			expectedRebuild:  false,
		},
		"index with existing fields, and different selectable fields": {
			buildInfo:        IndexBuildInfo{SelectableFields: []string{"title", "team"}},
			selectableFields: []string{"new.title", "new.team"},
			expectedRebuild:  true,
		},
		"index with existing fields, and additional selectable fields": {
			buildInfo:        IndexBuildInfo{SelectableFields: []string{"title", "team"}},
			selectableFields: []string{"title", "team", "new.field"},
			expectedRebuild:  true,
		},
		"no expected hash, no stored hash": {
			buildInfo:       IndexBuildInfo{},
			expectedRebuild: false,
		},
		"no expected hash, stored hash present": {
			buildInfo:                IndexBuildInfo{SearchFieldsHash: "abc"},
			expectedSearchFieldsHash: "",
			expectedRebuild:          false,
		},
		"expected hash present, no stored hash": {
			buildInfo:                IndexBuildInfo{},
			expectedSearchFieldsHash: "abc",
			expectedRebuild:          true,
		},
		"expected hash matches stored hash": {
			buildInfo:                IndexBuildInfo{SearchFieldsHash: "abc"},
			expectedSearchFieldsHash: "abc",
			expectedRebuild:          false,
		},
		"expected hash differs from stored hash": {
			buildInfo:                IndexBuildInfo{SearchFieldsHash: "abc"},
			expectedSearchFieldsHash: "def",
			expectedRebuild:          true,
		},
		"no features on the index, none required": {
			buildInfo:       IndexBuildInfo{},
			expectedRebuild: false,
		},
		"index has the required feature": {
			buildInfo:        IndexBuildInfo{Features: []IndexFeature{"alpha"}},
			requiredFeatures: []IndexFeature{"alpha"},
			expectedRebuild:  false,
		},
		"index is missing a required feature": {
			buildInfo:        IndexBuildInfo{Features: []IndexFeature{"alpha"}},
			requiredFeatures: []IndexFeature{"alpha", "beta"},
			expectedRebuild:  true,
		},
		// An index from a newer binary has features this one does not know. That is
		// the build version check's business, not this one's.
		"index has a feature this binary does not require": {
			buildInfo:       IndexBuildInfo{Features: []IndexFeature{"alpha", "beta"}},
			expectedRebuild: false,
		},
		"index built before features existed, one required": {
			buildInfo:        IndexBuildInfo{},
			requiredFeatures: []IndexFeature{"alpha"},
			expectedRebuild:  true,
		},
	} {
		t.Run(name, func(t *testing.T) {
			res := shouldRebuildIndex(tc.buildInfo, tc.minBuildVersion, tc.maxBuildVersion, tc.minTime, tc.lastImportTime, tc.selectableFields, tc.expectedSearchFieldsHash, tc.requiredFeatures, nil)
			require.Equal(t, tc.expectedRebuild, res)
		})
	}
}

func TestFindIndexesForRebuild(t *testing.T) {
	storage := &mockStorageBackend{
		resourceStats: []ResourceStats{
			{NamespacedResource: NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}, Count: 50, ResourceVersion: 11111111},
		},
	}

	now := time.Now().UTC()

	search := &mockSearchBackend{
		openIndexes: []NamespacedResource{
			{Namespace: "resource-2h-v5", Group: "group", Resource: "folder"},
			{Namespace: "resource-2h-v6", Group: "group", Resource: "folder"},
			{Namespace: "resource-10h-v5", Group: "group", Resource: "folder"},
			{Namespace: "resource-10h-v6", Group: "group", Resource: "folder"},
			{Namespace: "resource-v5", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE},
			{Namespace: "resource-v6", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE},
			{Namespace: "resource-2h-v5", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE},
			{Namespace: "resource-2h-v6", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE},
			{Namespace: "resource-recently-imported", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE},
			{Namespace: "resource-newer-version", Group: "group", Resource: "folder"},

			// We report this index as open, but it's really not. This can happen if index expires between the call
			// to GetOpenIndexes and the call to GetIndex.
			{Namespace: "ns", Group: "group", Resource: "missing"},
		},

		cache: map[NamespacedResource]ResourceIndex{
			// To be rebuilt because of minVersion
			{Namespace: "resource-2h-v5", Group: "group", Resource: "folder"}: &MockResourceIndex{
				buildInfo: IndexBuildInfo{BuildTime: now.Add(-2 * time.Hour), BuildVersion: semver.MustParse("5.0.0")},
			},

			// Not rebuilt
			{Namespace: "resource-2h-v6", Group: "group", Resource: "folder"}: &MockResourceIndex{
				buildInfo: IndexBuildInfo{BuildTime: now.Add(-2 * time.Hour), BuildVersion: semver.MustParse("6.0.0")},
			},

			// To be rebuilt because of minTime
			{Namespace: "resource-10h-v5", Group: "group", Resource: "folder"}: &MockResourceIndex{
				buildInfo: IndexBuildInfo{BuildTime: now.Add(-10 * time.Hour), BuildVersion: semver.MustParse("5.0.0")},
			},

			// To be rebuilt because of minTime
			{Namespace: "resource-10h-v6", Group: "group", Resource: "folder"}: &MockResourceIndex{
				buildInfo: IndexBuildInfo{BuildTime: now.Add(-10 * time.Hour), BuildVersion: semver.MustParse("6.0.0")},
			},

			// To be rebuilt because of minVersion
			{Namespace: "resource-v5", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}: &MockResourceIndex{
				buildInfo: IndexBuildInfo{BuildTime: now, BuildVersion: semver.MustParse("5.0.0")},
			},

			// Not rebuilt
			{Namespace: "resource-v6", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}: &MockResourceIndex{
				buildInfo: IndexBuildInfo{BuildTime: now, BuildVersion: semver.MustParse("6.0.0")},
			},

			// To be rebuilt because of minTime (1h for dashboards)
			{Namespace: "resource-2h-v5", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}: &MockResourceIndex{
				buildInfo: IndexBuildInfo{BuildTime: now.Add(-2 * time.Hour), BuildVersion: semver.MustParse("5.0.0")},
			},

			// To be rebuilt because of minTime (1h for dashboards)
			{Namespace: "resource-2h-v6", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}: &MockResourceIndex{
				buildInfo: IndexBuildInfo{BuildTime: now.Add(-2 * time.Hour), BuildVersion: semver.MustParse("6.0.0")},
			},

			// Built recently, to be rebuilt because of last import time
			{Namespace: "resource-recently-imported", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}: &MockResourceIndex{
				buildInfo: IndexBuildInfo{BuildTime: now.Add(-30 * time.Minute), BuildVersion: semver.MustParse("6.0.0")},
			},

			// To be rebuilt because of version newer than running (7.0.0 > 6.5.0)
			{Namespace: "resource-newer-version", Group: "group", Resource: "folder"}: &MockResourceIndex{
				buildInfo: IndexBuildInfo{BuildTime: now, BuildVersion: semver.MustParse("7.0.0")},
			},
		},
	}

	supplier := &TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{
			"group": "resource",
		},
	}

	opts := SearchOptions{
		Backend:   search,
		Resources: supplier,

		DashboardIndexMaxAge: 1 * time.Hour,
		MaxIndexAge:          5 * time.Hour,
		MinBuildVersion:      semver.MustParse("5.5.5"),
		BuildVersion:         semver.MustParse("6.5.0"), // Running version
	}

	support, err := newSearchServer(opts, storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, support)

	lastImportTime := now.Add(-10 * time.Minute)
	importTimes := map[NamespacedResource]time.Time{
		{Namespace: "resource-recently-imported", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}: lastImportTime,

		// This index was "just" built, and should not be rebuilt.
		{Namespace: "resource-v6", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}: lastImportTime,
	}

	support.findIndexesToRebuild(importTimes, nil, now, false)
	require.Equal(t, 8, support.rebuildQueue.Len())

	now5m := now.Add(5 * time.Minute)

	// Running findIndexesToRebuild again should not add any new indexes to the rebuild queue, and all existing
	// ones should be "combined" with new ones (this will "bump" minBuildTime)
	support.findIndexesToRebuild(importTimes, nil, now5m, false)
	require.Equal(t, 8, support.rebuildQueue.Len())

	// Values that we expect to find in rebuild requests.
	minBuildVersion := semver.MustParse("5.5.5")
	minBuildTime := now5m.Add(-5 * time.Hour)
	minBuildTimeDashboard := now5m.Add(-1 * time.Hour)

	vals := support.rebuildQueue.Elements()
	expected := []rebuildRequest{
		{NamespacedResource: NamespacedResource{Namespace: "resource-2h-v5", Group: "group", Resource: "folder"}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTime},
		{NamespacedResource: NamespacedResource{Namespace: "resource-10h-v5", Group: "group", Resource: "folder"}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTime},
		{NamespacedResource: NamespacedResource{Namespace: "resource-10h-v6", Group: "group", Resource: "folder"}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTime},

		{NamespacedResource: NamespacedResource{Namespace: "resource-v5", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTimeDashboard},
		{NamespacedResource: NamespacedResource{Namespace: "resource-2h-v5", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTimeDashboard},
		{NamespacedResource: NamespacedResource{Namespace: "resource-2h-v6", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTimeDashboard},

		{NamespacedResource: NamespacedResource{Namespace: "resource-recently-imported", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTimeDashboard, lastImportTime: lastImportTime},

		// Index built by newer version than running (7.0.0 > 6.5.0)
		{NamespacedResource: NamespacedResource{Namespace: "resource-newer-version", Group: "group", Resource: "folder"}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTime},
	}
	if diff := cmp.Diff(expected, vals, cmpopts.IgnoreFields(rebuildRequest{}, "completeChannels"), cmp.AllowUnexported(rebuildRequest{})); diff != "" {
		t.Errorf("rebuildQueue mismatch (-want +got):\n%s", diff)
	}
}

func TestRebuildIndexes(t *testing.T) {
	storage := &mockStorageBackend{}

	now := time.Now()

	search := &mockSearchBackend{
		cache: map[NamespacedResource]ResourceIndex{
			{Namespace: "idx1", Group: "group", Resource: "res"}: &MockResourceIndex{
				buildInfo: IndexBuildInfo{BuildVersion: semver.MustParse("5.0.0")},
			},

			{Namespace: "idx2", Group: "group", Resource: "res"}: &MockResourceIndex{
				buildInfo: IndexBuildInfo{BuildTime: now.Add(-2 * time.Hour)},
			},

			{Namespace: "idx3", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}: &MockResourceIndex{},
		},
	}

	supplier := &TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{
			"group": "resource",
		},
	}

	opts := SearchOptions{
		Backend:   search,
		Resources: supplier,
	}

	support, err := newSearchServer(opts, storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, support)

	// Note: we can only rebuild each index once, after that it "loses" it's build info.

	t.Run("Don't rebuild if min build version is old", func(t *testing.T) {
		checkRebuildIndex(t, support, rebuildRequest{
			NamespacedResource: NamespacedResource{Namespace: "idx1", Group: "group", Resource: "res"},
			minBuildVersion:    semver.MustParse("4.5"),
		}, true, false)
	})

	t.Run("Rebuild if min build version is more recent", func(t *testing.T) {
		checkRebuildIndex(t, support, rebuildRequest{
			NamespacedResource: NamespacedResource{Namespace: "idx1", Group: "group", Resource: "res"},
			minBuildVersion:    semver.MustParse("5.5.5"),
		}, true, true)
	})

	t.Run("Don't rebuild if min build time is very old", func(t *testing.T) {
		checkRebuildIndex(t, support, rebuildRequest{
			NamespacedResource: NamespacedResource{Namespace: "idx2", Group: "group", Resource: "res"},
			minBuildTime:       now.Add(-5 * time.Hour),
		}, true, false)
	})

	t.Run("Rebuild if min build time is more recent", func(t *testing.T) {
		checkRebuildIndex(t, support, rebuildRequest{
			NamespacedResource: NamespacedResource{Namespace: "idx2", Group: "group", Resource: "res"},
			minBuildTime:       now.Add(-1 * time.Hour),
		}, true, true)
	})

	t.Run("Don't rebuild if index doesn't exist.", func(t *testing.T) {
		checkRebuildIndex(t, support, rebuildRequest{
			NamespacedResource: NamespacedResource{Namespace: "unknown", Group: "group", Resource: "res"},
			minBuildTime:       now.Add(-5 * time.Hour),
		}, false, true)
	})

	t.Run("Rebuild dashboard index (it has no build info), verify that builders cache was emptied.", func(t *testing.T) {
		dashKey := NamespacedResource{Namespace: "idx3", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}

		support.builders.ns.Add(dashKey, &fakeDocumentBuilder{})
		_, ok := support.builders.ns.Get(dashKey)
		require.True(t, ok)

		checkRebuildIndex(t, support, rebuildRequest{
			NamespacedResource: dashKey,
			minBuildTime:       now,
		}, true, true)

		// Verify that builders cache was emptied.
		_, ok = support.builders.ns.Get(dashKey)
		require.False(t, ok)
	})

	t.Run("BuildTimes collection from open indexes", func(t *testing.T) {
		key1 := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource1"}
		key2 := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource2"}
		key3 := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource3"}

		buildTime1 := time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC)
		buildTime2 := time.Date(2026, 1, 16, 11, 0, 0, 0, time.UTC)

		storage := &mockStorageBackend{
			resourceStats: []ResourceStats{
				{NamespacedResource: key1, Count: 50, ResourceVersion: 11111111},
				{NamespacedResource: key2, Count: 50, ResourceVersion: 11111112},
				{NamespacedResource: key3, Count: 50, ResourceVersion: 11111113},
			},
			// No recent import times - so no rebuilds will be triggered
			lastImportTimes: []ResourceLastImportTime{},
		}

		search := &mockSearchBackend{
			cache: make(map[NamespacedResource]ResourceIndex),
		}

		supplier := &TestDocumentBuilderSupplier{
			GroupsResources: map[string]string{
				"group": "resource",
			},
		}

		opts := SearchOptions{
			Backend:      search,
			Resources:    supplier,
			InitMinCount: 1,
		}

		support, err := newSearchServer(opts, storage, nil, nil, nil, nil, nil, nil, nil, nil)
		require.NoError(t, err)
		require.NotNil(t, support)

		err = support.init(context.Background())
		require.NoError(t, err)
		defer support.stop()

		// Set up indexes with build times in cache after init() completes
		idx1 := &MockResourceIndex{
			buildInfo: IndexBuildInfo{BuildTime: buildTime1, BuildVersion: semver.MustParse("6.0.0")},
		}
		idx2 := &MockResourceIndex{
			buildInfo: IndexBuildInfo{BuildTime: buildTime2, BuildVersion: semver.MustParse("6.0.0")},
		}
		idx3 := &MockResourceIndex{
			buildInfo: IndexBuildInfo{BuildTime: time.Time{}, BuildVersion: semver.MustParse("6.0.0")},
		}

		search.mu.Lock()
		search.cache[key1] = idx1
		search.cache[key2] = idx2
		search.cache[key3] = idx3
		search.openIndexes = []NamespacedResource{key1, key2, key3}
		search.mu.Unlock()

		rebuildReq := &resourcepb.RebuildIndexesRequest{
			Namespace: "ns",
			// Explicitly specify keys to check - no rebuild conditions, so nothing will be rebuilt
			Keys: []*resourcepb.ResourceKey{
				{Namespace: key1.Namespace, Group: key1.Group, Resource: key1.Resource},
				{Namespace: key2.Namespace, Group: key2.Group, Resource: key2.Resource},
				{Namespace: key3.Namespace, Group: key3.Group, Resource: key3.Resource},
			},
		}

		rsp, err := support.RebuildIndexes(context.Background(), rebuildReq)
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		require.Equal(t, int64(0), rsp.RebuildCount, "no rebuilds should be triggered")

		// Verify BuildTimes contains entries for key1 and key2, but not key3 (zero time)
		require.Len(t, rsp.BuildTimes, 2, "should have 2 build times (key3 has zero time)")

		// Find the build times in the response
		var found1, found2 bool
		for _, bt := range rsp.BuildTimes {
			if bt.Group == key1.Group && bt.Resource == key1.Resource {
				require.Equal(t, buildTime1.Unix(), bt.BuildTimeUnix)
				found1 = true
			}
			if bt.Group == key2.Group && bt.Resource == key2.Resource {
				require.Equal(t, buildTime2.Unix(), bt.BuildTimeUnix)
				found2 = true
			}
		}
		require.True(t, found1, "should have build time for key1")
		require.True(t, found2, "should have build time for key2")
	})
}

func checkRebuildIndex(t *testing.T, support *searchServer, req rebuildRequest, indexExists, expectedRebuild bool) {
	ctx := context.Background()

	idxBefore := support.search.GetIndex(req.NamespacedResource)
	if indexExists {
		require.NotNil(t, idxBefore, "index should exist before rebuildIndex")
	} else {
		require.Nil(t, idxBefore, "index should not exist before rebuildIndex")
	}

	support.rebuildIndex(ctx, req)

	idxAfter := support.search.GetIndex(req.NamespacedResource)

	if indexExists {
		require.NotNil(t, idxAfter, "index should exist after rebuildIndex")
		if expectedRebuild {
			require.NotSame(t, idxBefore, idxAfter, "index should be rebuilt")
		} else {
			require.Same(t, idxBefore, idxAfter, "index should not be rebuilt")
		}
	} else {
		require.Nil(t, idxAfter, "index should not exist after rebuildIndex")
	}
}

func TestRebuildIndexesForResource(t *testing.T) {
	key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}

	storage := &mockStorageBackend{
		resourceStats: []ResourceStats{
			{NamespacedResource: key, Count: 50, ResourceVersion: 11111111},
		},
		lastImportTimes: []ResourceLastImportTime{{
			NamespacedResource: key,
			LastImportTime:     time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC),
		}},
	}

	search := &mockSearchBackend{}
	supplier := &TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{
			"group": "resource",
		},
	}

	opts := SearchOptions{
		Backend:      search,
		Resources:    supplier,
		InitMinCount: 1,
	}

	support, err := newSearchServer(opts, storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, support)

	err = support.init(t.Context())
	require.NoError(t, err)

	require.Equal(t, 0, support.rebuildQueue.Len())

	// invalid request
	rebuildReq := &resourcepb.RebuildIndexesRequest{
		Namespace: "some-other-namespace",
		Keys: []*resourcepb.ResourceKey{{
			Namespace: key.Namespace,
			Group:     key.Group,
			Resource:  key.Resource,
		}}}
	rsp, err := support.RebuildIndexes(t.Context(), rebuildReq)
	require.NoError(t, err)
	require.Equal(t, "key namespace does not match request namespace", rsp.Error.Message)

	rebuildReq.Namespace = key.Namespace

	// cached index info
	search.cache[key] = &MockResourceIndex{
		buildInfo: IndexBuildInfo{BuildVersion: semver.MustParse("5.0.0"), BuildTime: time.Date(2025, 1, 1, 12, 0, 0, 0, time.UTC)},
	}

	// old import time will not be rebuilt
	storage.lastImportTimes = []ResourceLastImportTime{{
		NamespacedResource: key,
		LastImportTime:     time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
	}}
	rsp, err = support.RebuildIndexes(t.Context(), rebuildReq)
	require.NoError(t, err)
	require.Equal(t, int64(0), rsp.RebuildCount)
	require.Equal(t, 0, support.rebuildQueue.Len())

	// recent import time gets added to rebuild queue and processed
	storage.lastImportTimes = []ResourceLastImportTime{{
		NamespacedResource: key,
		LastImportTime:     time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC),
	}}

	rsp, err = support.RebuildIndexes(t.Context(), rebuildReq)
	require.NoError(t, err)
	require.Equal(t, int64(1), rsp.RebuildCount)

	// rebuild waited for rebuild queue to process
	require.Equal(t, 0, support.rebuildQueue.Len())
}

func TestMaybeInjectFailure(t *testing.T) {
	t.Run("disabled when percent is 0", func(t *testing.T) {
		s := &searchServer{injectFailuresPercent: 0}
		for i := 0; i < 1000; i++ {
			require.NoError(t, s.maybeInjectFailure())
		}
	})

	t.Run("always fails when percent is 100", func(t *testing.T) {
		s := &searchServer{injectFailuresPercent: 100}
		for i := 0; i < 100; i++ {
			err := s.maybeInjectFailure()
			require.Error(t, err)
			require.Equal(t, "injected search failure", err.Error())
		}
	})
}

func TestSearchValidatesNegativeLimitAndOffset(t *testing.T) {
	opts := SearchOptions{
		Backend: &mockSearchBackend{},
		Resources: &TestDocumentBuilderSupplier{
			GroupsResources: map[string]string{
				"group": "resource",
			},
		},
		InitMinCount: 1,
	}

	support, err := newSearchServer(opts, nil, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, support)

	t.Run("negative limit returns error", func(t *testing.T) {
		req := &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "ns",
					Group:     "group",
					Resource:  "resource",
				},
			},
			Limit: -100,
		}
		rsp, err := support.Search(context.Background(), req)
		require.NoError(t, err)
		require.NotNil(t, rsp.Error)
		require.Equal(t, http.StatusBadRequest, int(rsp.Error.Code))
		require.Equal(t, "limit cannot be negative", rsp.Error.Message)
	})

	t.Run("negative offset returns error", func(t *testing.T) {
		req := &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "ns",
					Group:     "group",
					Resource:  "resource",
				},
			},
			Limit:  10,
			Offset: -50,
		}
		rsp, err := support.Search(context.Background(), req)
		require.NoError(t, err)
		require.NotNil(t, rsp.Error)
		require.Equal(t, http.StatusBadRequest, int(rsp.Error.Code))
		require.Equal(t, "offset cannot be negative", rsp.Error.Message)
	})
}

// Trash authorizes each hit against one index's group and resource, so a federated
// trash search has no correct answer and is refused. The refusal has to come
// before the federated indexes are resolved, because resolving one can build an
// index -- hence the assertion on BuildIndex.
func TestSearchRejectsFederatedTrashQueries(t *testing.T) {
	backend := &mockSearchBackend{}
	opts := SearchOptions{
		Backend: backend,
		Resources: &TestDocumentBuilderSupplier{
			GroupsResources: map[string]string{
				"group": "resource",
			},
		},
		InitMinCount: 1,
	}

	support, err := newSearchServer(opts, nil, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, support)

	req := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: "ns",
				Group:     "group",
				Resource:  "resource",
			},
		},
		Federated: []*resourcepb.ResourceKey{{
			Namespace: "ns",
			Group:     "group",
			Resource:  "resource",
		}},
		Limit:     10,
		IsDeleted: true,
	}

	rsp, err := support.Search(context.Background(), req)
	require.NoError(t, err)
	require.NotNil(t, rsp.Error)
	require.Equal(t, http.StatusBadRequest, int(rsp.Error.Code))
	require.Equal(t, "searching deleted resources does not support federated queries", rsp.Error.Message)

	backend.mu.Lock()
	defer backend.mu.Unlock()
	require.Empty(t, backend.buildIndexCalls, "the request must be refused before any index is resolved")
}

func TestJitterForKey(t *testing.T) {
	maxAge := 24 * time.Hour

	t.Run("deterministic", func(t *testing.T) {
		key := NamespacedResource{Namespace: "ns1", Group: "g1", Resource: "r1"}
		j1 := jitterForKey(key, maxAge)
		j2 := jitterForKey(key, maxAge)
		require.Equal(t, j1, j2)
	})

	t.Run("zero maxAge returns zero", func(t *testing.T) {
		key := NamespacedResource{Namespace: "ns1", Group: "g1", Resource: "r1"}
		require.Equal(t, time.Duration(0), jitterForKey(key, 0))
	})

	t.Run("bounded to maxAge/2", func(t *testing.T) {
		for i := 0; i < 100; i++ {
			key := NamespacedResource{Namespace: fmt.Sprintf("ns%d", i), Group: "g", Resource: "r"}
			j := jitterForKey(key, maxAge)
			require.GreaterOrEqual(t, j, time.Duration(0))
			require.Less(t, j, maxAge/2)
		}
	})

	t.Run("different keys produce different values", func(t *testing.T) {
		k1 := NamespacedResource{Namespace: "ns1", Group: "g", Resource: "r"}
		k2 := NamespacedResource{Namespace: "ns2", Group: "g", Resource: "r"}
		// Technically could collide, but FNV-1a on different short strings won't.
		require.NotEqual(t, jitterForKey(k1, maxAge), jitterForKey(k2, maxAge))
	})
}

func TestFindIndexesToRebuildWithJitter(t *testing.T) {
	storage := &mockStorageBackend{}

	now := time.Now()
	maxAge := 5 * time.Hour

	// Create indexes that are all barely past maxAge (built 5h1m ago).
	// Without jitter, all should be queued. With jitter, some will have
	// their minBuildTime pushed back enough that they won't be queued.
	numIndexes := 20
	openIndexes := make([]NamespacedResource, numIndexes)
	cache := make(map[NamespacedResource]ResourceIndex, numIndexes)
	for i := 0; i < numIndexes; i++ {
		key := NamespacedResource{Namespace: fmt.Sprintf("ns%d", i), Group: "group", Resource: "folder"}
		openIndexes[i] = key
		cache[key] = &MockResourceIndex{
			buildInfo: IndexBuildInfo{
				BuildTime:    now.Add(-(maxAge + 30*time.Minute)),
				BuildVersion: semver.MustParse("6.0.0"),
			},
		}
	}

	search := &mockSearchBackend{openIndexes: openIndexes, cache: cache}
	supplier := &TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{"group": "resource"},
	}

	opts := SearchOptions{
		Backend:         search,
		Resources:       supplier,
		MaxIndexAge:     maxAge,
		MinBuildVersion: semver.MustParse("5.0.0"),
	}

	support, err := newSearchServer(opts, storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, support)

	importTimes := map[NamespacedResource]time.Time{}

	// Without jitter: all indexes are stale and should be queued.
	chsNoJitter := support.findIndexesToRebuild(importTimes, nil, now, false)
	require.Equal(t, numIndexes, len(chsNoJitter))

	// Create a second server with the same config to get a fresh rebuild queue.
	support2, err := newSearchServer(opts, storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	// With jitter: some indexes get extra tolerance, so fewer should be queued.
	chsWithJitter := support2.findIndexesToRebuild(importTimes, nil, now, true)
	require.Less(t, len(chsWithJitter), numIndexes, "jitter should cause some indexes to not be queued yet")
	require.Greater(t, len(chsWithJitter), 0, "at least some indexes should still be queued")
}

// blockingSearchBackend wraps mockSearchBackend so a test can pause inside
// BuildIndex. onStarted is closed when the first build enters; the test
// closes proceed to release any blocked builds.
type blockingSearchBackend struct {
	mockSearchBackend

	onStarted chan struct{}
	proceed   chan struct{}

	startedOnce sync.Once
	buildCalls  atomic.Int32
}

func newBlockingSearchBackend(cache map[NamespacedResource]ResourceIndex) *blockingSearchBackend {
	return &blockingSearchBackend{
		mockSearchBackend: mockSearchBackend{cache: cache},
		onStarted:         make(chan struct{}),
		proceed:           make(chan struct{}),
	}
}

func (b *blockingSearchBackend) BuildIndex(ctx context.Context, key NamespacedResource, size int64, reason string, builder BuildFn, updater UpdateFn, rebuild bool, lastImportTime time.Time, maxFreshSnapshotAge time.Duration) (ResourceIndex, error) {
	b.buildCalls.Add(1)
	b.startedOnce.Do(func() { close(b.onStarted) })
	<-b.proceed
	return b.mockSearchBackend.BuildIndex(ctx, key, size, reason, builder, updater, rebuild, lastImportTime, maxFreshSnapshotAge)
}

// TestRebuildIndexConcurrentRebuildsForSameKeyAreDeduplicated verifies the
// in-flight tracker added by rebuildIndex: while a rebuild is running for a
// key, additional rebuild requests for the same key do not call BuildIndex
// and instead get stashed as a single follow-up that is re-enqueued when the
// in-flight rebuild finishes.
func TestRebuildIndexConcurrentRebuildsForSameKeyAreDeduplicated(t *testing.T) {
	key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "res"}

	initialBuildTime := time.Now().Add(-2 * time.Hour)
	search := newBlockingSearchBackend(map[NamespacedResource]ResourceIndex{
		key: &MockResourceIndex{buildInfo: IndexBuildInfo{BuildTime: initialBuildTime}},
	})

	storage := &mockStorageBackend{
		resourceStats: []ResourceStats{
			{NamespacedResource: key, Count: 50, ResourceVersion: 11111111},
		},
	}
	supplier := &TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{"group": "res"},
	}

	opts := SearchOptions{Backend: search, Resources: supplier}
	support, err := newSearchServer(opts, storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	// Fire the first rebuild. It will claim the in-flight slot and block
	// inside BuildIndex.
	firstDone := make(chan struct{})
	firstReq := rebuildRequest{
		NamespacedResource: key,
		minBuildTime:       time.Now().Add(-1 * time.Hour),
		completeChannels:   []chan<- struct{}{firstDone},
	}
	firstReturned := make(chan struct{})
	go func() {
		defer close(firstReturned)
		support.rebuildIndex(t.Context(), firstReq)
	}()

	// Wait for the first rebuild to be in flight.
	select {
	case <-search.onStarted:
	case <-time.After(2 * time.Second):
		t.Fatal("first rebuild did not enter BuildIndex")
	}

	support.inFlightRebuildsMu.Lock()
	_, inFlight := support.inFlightRebuilds[key]
	support.inFlightRebuildsMu.Unlock()
	require.True(t, inFlight, "rebuild for key should be marked in flight")

	// Fire 4 more rebuild requests for the same key with varying conditions.
	// Each should return promptly (deferred) without calling BuildIndex; the
	// strictest minBuildTime should win when the requests get merged.
	latestMinBuildTime := time.Now() // strictest condition
	laterTimes := []time.Time{
		time.Now().Add(-50 * time.Minute),
		latestMinBuildTime,
		time.Now().Add(-40 * time.Minute),
		time.Now().Add(-30 * time.Minute),
	}
	deferredChans := make([]chan struct{}, len(laterTimes))
	for i, mbt := range laterTimes {
		deferredChans[i] = make(chan struct{})
		req := rebuildRequest{
			NamespacedResource: key,
			minBuildTime:       mbt,
			completeChannels:   []chan<- struct{}{deferredChans[i]},
		}
		returned := make(chan struct{})
		go func() {
			defer close(returned)
			support.rebuildIndex(t.Context(), req)
		}()
		select {
		case <-returned:
		case <-time.After(2 * time.Second):
			t.Fatalf("rebuildIndex %d did not return; expected to be deferred", i)
		}
	}

	// None of the deferred completion channels should be closed yet — they
	// are owned by the follow-up rebuild that hasn't run.
	for i, ch := range deferredChans {
		select {
		case <-ch:
			t.Fatalf("deferred completion channel %d closed prematurely", i)
		default:
		}
	}

	// Queue is empty: deferred requests live on rebuildState.deferred until
	// the in-flight rebuild's defer re-enqueues them.
	require.Equal(t, 0, support.rebuildQueue.Len())

	// Only one BuildIndex call should be in progress so far.
	require.Equal(t, int32(1), search.buildCalls.Load())

	// Release the first rebuild and wait for it to finish.
	close(search.proceed)
	select {
	case <-firstReturned:
	case <-time.After(2 * time.Second):
		t.Fatal("first rebuildIndex did not return after unblocking")
	}
	select {
	case <-firstDone:
	case <-time.After(2 * time.Second):
		t.Fatal("first rebuild's completion channel was not closed")
	}

	// In-flight tracker should be cleared.
	support.inFlightRebuildsMu.Lock()
	_, stillInFlight := support.inFlightRebuilds[key]
	support.inFlightRebuildsMu.Unlock()
	require.False(t, stillInFlight, "in-flight tracker should be cleared after rebuild finishes")

	// The deferred follow-up should have been re-enqueued as a single item
	// carrying all 4 deferred completion channels and the strictest
	// minBuildTime among the deferred requests.
	require.Equal(t, 1, support.rebuildQueue.Len())
	items := support.rebuildQueue.Elements()
	require.Len(t, items, 1)
	req := items[0]
	require.Equal(t, key, req.NamespacedResource)
	require.Len(t, req.completeChannels, len(deferredChans))
	require.True(t, req.minBuildTime.Equal(latestMinBuildTime),
		"follow-up should carry the strictest minBuildTime; got %v want %v",
		req.minBuildTime, latestMinBuildTime)

	// Still only one BuildIndex call: the deferred follow-up has been
	// enqueued but no worker is running in this test to pick it up.
	require.Equal(t, int32(1), search.buildCalls.Load())
}

// TestRebuildIndexNoFollowUpWhenNotInFlight verifies the happy path: a single
// rebuild request for a key runs to completion, clears the in-flight tracker,
// and does not re-enqueue anything.
func TestRebuildIndexNoFollowUpWhenNotInFlight(t *testing.T) {
	key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "res"}

	search := &mockSearchBackend{
		cache: map[NamespacedResource]ResourceIndex{
			key: &MockResourceIndex{buildInfo: IndexBuildInfo{BuildTime: time.Now().Add(-2 * time.Hour)}, docCount: 50},
		},
	}
	storage := &mockStorageBackend{
		resourceStats: []ResourceStats{
			{NamespacedResource: key, Count: 50, ResourceVersion: 11111111},
		},
	}
	supplier := &TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{"group": "res"},
	}
	opts := SearchOptions{Backend: search, Resources: supplier}
	support, err := newSearchServer(opts, storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	done := make(chan struct{})
	support.rebuildIndex(t.Context(), rebuildRequest{
		NamespacedResource: key,
		minBuildTime:       time.Now().Add(-1 * time.Hour),
		completeChannels:   []chan<- struct{}{done},
	})

	select {
	case <-done:
	default:
		t.Fatal("completion channel should be closed after rebuildIndex returns")
	}

	support.inFlightRebuildsMu.Lock()
	_, inFlight := support.inFlightRebuilds[key]
	support.inFlightRebuildsMu.Unlock()
	require.False(t, inFlight, "in-flight tracker should be cleared")
	require.Equal(t, 0, support.rebuildQueue.Len(), "no follow-up should be re-enqueued")
	require.Len(t, search.buildIndexCalls, 1)
	require.Equal(t, int64(50), search.buildIndexCalls[0].size)
	require.Zero(t, storage.statsCalls.Load(), "rebuild should use the current index doc count instead of GetResourceStats")
}

// TestSearchServer_VectorSearch_ObservesDuration verifies the RPC histogram
// fires when VectorSearch returns. The Unimplemented path is the cheapest
// reachable code path (no embedder/vectorBackend needed), and is enough to
// confirm the wiring between VectorSearch and VectorMetrics is intact.
func TestSearchServer_VectorSearch_ObservesDuration(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := ProvideVectorMetrics(reg)
	s := &searchServer{
		log:           log.New("test-vector-search"),
		vectorMetrics: m,
	}

	_, err := s.VectorSearch(context.Background(), &resourcepb.VectorSearchRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: "stack-1",
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
		},
		Query: "test",
	})
	require.Error(t, err)
	require.Equal(t, codes.Unimplemented, status.Code(err))

	require.Equal(t, 1, testutil.CollectAndCount(m.SearchDuration, "vector_storage_search_duration_seconds"))
}

func TestFolderFilterSet(t *testing.T) {
	cases := []struct {
		name     string
		req      *resourcepb.ResourceStatsRequest
		expected []string
	}{
		{
			name:     "no filter",
			req:      &resourcepb.ResourceStatsRequest{},
			expected: nil,
		},
		{
			name:     "single folder",
			req:      &resourcepb.ResourceStatsRequest{Folder: []string{"root"}},
			expected: []string{"root"},
		},
		{
			name:     "multiple folders",
			req:      &resourcepb.ResourceStatsRequest{Folder: []string{"a", "b"}},
			expected: []string{"a", "b"},
		},
		{
			name:     "dedupes overlap and drops empties",
			req:      &resourcepb.ResourceStatsRequest{Folder: []string{"a", "", "b", "b", "a"}},
			expected: []string{"a", "b"},
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, folderFilterSet(tt.req))
		})
	}
}

// countingIndex records each DocCount call for use by TestSumDocCount.
type countingIndex struct {
	MockResourceIndex
	counts map[string]int64
	calls  []string
}

func (c *countingIndex) DocCount(_ context.Context, folder string, _ *SearchStats) (int64, error) {
	c.calls = append(c.calls, folder)
	return c.counts[folder], nil
}

func TestSumDocCount(t *testing.T) {
	idx := &countingIndex{counts: map[string]int64{
		"":     7, // total of the index when no filter applied
		"root": 3,
		"a":    5,
		"b":    2,
	}}

	// Empty folder set means "count the whole index".
	got, err := sumDocCount(t.Context(), idx, nil, nil)
	require.NoError(t, err)
	require.Equal(t, int64(7), got)
	require.Equal(t, []string{""}, idx.calls)

	idx.calls = nil
	got, err = sumDocCount(t.Context(), idx, []string{"root", "a", "b"}, nil)
	require.NoError(t, err)
	require.Equal(t, int64(10), got)
	require.Equal(t, []string{"root", "a", "b"}, idx.calls)
}

// trashStorageBackend serves a fixed set of trash entries from ListHistory and a
// fixed set of modifications from ListModifiedSince.
type trashStorageBackend struct {
	mockStorageBackend

	trash     []trashEntry
	modified  []*ModifiedResource
	trashReqs []*resourcepb.ListRequest
}

type trashEntry struct {
	name  string
	rv    int64
	value []byte
}

func (m *trashStorageBackend) ListHistory(_ context.Context, req *resourcepb.ListRequest, callback func(ListIterator) error) (int64, error) {
	m.trashReqs = append(m.trashReqs, req)
	return 1, callback(&trashIterator{entries: m.trash, pos: -1})
}

func (m *trashStorageBackend) ListModifiedSince(_ context.Context, _ NamespacedResource, _ int64, _ *time.Time) (int64, iter.Seq2[*ModifiedResource, error]) {
	return 2, func(yield func(*ModifiedResource, error) bool) {
		for _, res := range m.modified {
			if !yield(res, nil) {
				return
			}
		}
	}
}

type trashIterator struct {
	entries []trashEntry
	pos     int
}

func (i *trashIterator) Next() bool             { i.pos++; return i.pos < len(i.entries) }
func (i *trashIterator) Error() error           { return nil }
func (i *trashIterator) ContinueToken() string  { return "" }
func (i *trashIterator) ResourceVersion() int64 { return i.entries[i.pos].rv }
func (i *trashIterator) Namespace() string      { return "ns" }
func (i *trashIterator) Name() string           { return i.entries[i.pos].name }
func (i *trashIterator) Folder() string         { return "" }
func (i *trashIterator) Value() []byte          { return i.entries[i.pos].value }

func testObjectJSON(name, title string) []byte {
	return []byte(fmt.Sprintf(`{"apiVersion":"group/v1","kind":"Thing","metadata":{"name":%q},"spec":{"title":%q,"tags":["tag-a"]}}`, name, title))
}

// testDeletedObjectJSON is what storage holds after a delete: the deletion marker
// records who deleted the object as its last updater, and when (see server.go).
func testDeletedObjectJSON(name, title, deletedBy string, deletedAt time.Time) []byte {
	return []byte(fmt.Sprintf(
		`{"apiVersion":"group/v1","kind":"Thing","metadata":{"name":%q,"deletionTimestamp":%q,"annotations":{%q:%q}},"spec":{"title":%q}}`,
		name, deletedAt.UTC().Format(time.RFC3339), utils.AnnoKeyUpdatedBy, deletedBy, title))
}

func testProvisionedObjectJSON(name, title string) []byte {
	return []byte(fmt.Sprintf(`{"apiVersion":"group/v1","kind":"Thing","metadata":{"name":%q,"annotations":{%q:"repo"}},"spec":{"title":%q}}`,
		name, utils.AnnoKeyManagerKind, title))
}

// trashSearchOptions returns search options with deleted objects kept in the
// index, which is off by default.
func trashSearchOptions(backend SearchBackend) SearchOptions {
	return SearchOptions{
		Backend:               backend,
		Resources:             &TestDocumentBuilderSupplier{GroupsResources: map[string]string{"group": "resource"}},
		IndexDeletedDocuments: true,
	}
}

// A full build has to list trash itself: deleted objects are absent from the live
// listing and nothing re-announces them, so without this a rebuild would drop
// every deleted document for the resource.
func TestIndexTrash(t *testing.T) {
	key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}
	storage := &trashStorageBackend{trash: []trashEntry{
		{name: "gone-1", rv: 10, value: testObjectJSON("gone-1", "Gone one")},
		{name: "gone-2", rv: 11, value: testObjectJSON("gone-2", "Gone two")},
	}}

	server, err := newSearchServer(trashSearchOptions(&mockSearchBackend{}), storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	index := &MockResourceIndex{}
	require.NoError(t, server.indexTrash(t.Context(), key, index, log.NewNopLogger()))

	items := index.indexedItems()
	require.Len(t, items, 2)
	for i, name := range []string{"gone-1", "gone-2"} {
		require.Equal(t, ActionIndex, items[i].Action)
		require.Equal(t, name, items[i].Doc.Key.Name)
		require.NotNil(t, items[i].Doc.IsDeleted, "document should carry the deleted marker")
		require.True(t, *items[i].Doc.IsDeleted)
	}

	require.Len(t, storage.trashReqs, 1)
	require.Equal(t, resourcepb.ListRequest_TRASH, storage.trashReqs[0].Source)

	// A backend that serves one resource from legacy storage has no history to
	// list, and no trash either, so the build must not fail on it.
	t.Run("a backend without history support builds anyway", func(t *testing.T) {
		server, err := newSearchServer(trashSearchOptions(&mockSearchBackend{}), &noHistoryStorageBackend{}, nil, nil, nil, nil, nil, nil, nil, nil)
		require.NoError(t, err)

		index := &MockResourceIndex{}
		require.NoError(t, server.indexTrash(t.Context(), key, index, log.NewNopLogger()))
		require.Empty(t, index.indexedItems())
	})

	// The full build has to run that pass, not just be able to.
	t.Run("a full build indexes trash", func(t *testing.T) {
		search := &mockSearchBackend{}
		server, err := newSearchServer(trashSearchOptions(search), storage, nil, nil, nil, nil, nil, nil, nil, nil)
		require.NoError(t, err)

		built, err := server.build(t.Context(), key, 1, "test", false, time.Time{})
		require.NoError(t, err)

		items := built.(*MockResourceIndex).indexedItems()
		require.Len(t, items, 2, "the two deleted objects should have been indexed")
		for _, item := range items {
			require.Equal(t, ActionIndex, item.Action)
			require.NotNil(t, item.Doc.IsDeleted)
			require.True(t, *item.Doc.IsDeleted)
		}
	})
}

// A delete event carries the object as it was, so the updater can mark it instead
// of removing it. Without a usable body there is nothing to index and removal is
// all that is left.
func TestUpdaterMarksDeletedDocuments(t *testing.T) {
	key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}
	// Built in place: a ResourceKey carries a lock, so copying one trips vet.
	deleted := func(name string, value []byte, rv int64) *ModifiedResource {
		return &ModifiedResource{
			Action:          resourcepb.WatchEvent_DELETED,
			Key:             resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: name},
			ResourceVersion: rv,
			Value:           value,
		}
	}

	storage := &trashStorageBackend{modified: []*ModifiedResource{
		deleted("gone", testObjectJSON("gone", "Gone"), 10),
		deleted("broken", []byte("not json"), 11),
	}}

	search := &mockSearchBackend{}
	server, err := newSearchServer(trashSearchOptions(search), storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	_, err = server.build(t.Context(), key, 1, "test", false, time.Time{})
	require.NoError(t, err)

	search.mu.Lock()
	updater := search.lastUpdater
	search.mu.Unlock()
	require.NotNil(t, updater)

	index := &MockResourceIndex{}
	_, docs, err := updater(t.Context(), index, 1)
	require.NoError(t, err)
	require.Equal(t, 2, docs)

	items := index.indexedItems()
	require.Len(t, items, 2)

	require.Equal(t, ActionIndex, items[0].Action)
	require.Equal(t, "gone", items[0].Doc.Key.Name)
	require.NotNil(t, items[0].Doc.IsDeleted)
	require.True(t, *items[0].Doc.IsDeleted)

	require.Equal(t, ActionDelete, items[1].Action, "an unusable body leaves nothing to index")
	require.Equal(t, "broken", items[1].Key.Name)
}

// The option is off by default, and with it off a delete has to behave exactly as
// it did before deleted objects were kept: the document is removed and no trash is
// listed.
func TestDeletedDocumentsAreRemovedWhenTheOptionIsOff(t *testing.T) {
	key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}
	storage := &trashStorageBackend{
		trash: []trashEntry{{name: "gone-1", rv: 10, value: testObjectJSON("gone-1", "Gone one")}},
		modified: []*ModifiedResource{{
			Action:          resourcepb.WatchEvent_DELETED,
			Key:             resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: "gone-2"},
			ResourceVersion: 11,
			Value:           testObjectJSON("gone-2", "Gone two"),
		}},
	}

	search := &mockSearchBackend{}
	options := trashSearchOptions(search)
	options.IndexDeletedDocuments = false
	server, err := newSearchServer(options, storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	built, err := server.build(t.Context(), key, 1, "test", false, time.Time{})
	require.NoError(t, err)
	require.Empty(t, built.(*MockResourceIndex).indexedItems(), "no trash should be listed or indexed")
	require.Empty(t, storage.trashReqs)

	search.mu.Lock()
	updater := search.lastUpdater
	search.mu.Unlock()

	index := &MockResourceIndex{}
	_, _, err = updater(t.Context(), index, 1)
	require.NoError(t, err)

	items := index.indexedItems()
	require.Len(t, items, 1)
	require.Equal(t, ActionDelete, items[0].Action)
	require.Equal(t, "gone-2", items[0].Key.Name)
}

// noHistoryStorageBackend stands for a backend that serves a single resource from
// legacy storage: everything outside that is unimplemented.
type noHistoryStorageBackend struct {
	UnimplementedStorageBackend
}

// Trash serves a fixed field set, so a deleted document keeps only those fields.
// Anything a kind declares is live-only: keeping it would grow the index and move
// term statistics for live searches.
func TestBuildDeletedDocumentKeepsOnlyTrashFields(t *testing.T) {
	key := &resourcepb.ResourceKey{Namespace: "ns", Group: "group", Resource: "resource", Name: "gone"}

	// The same object indexed as live carries kind fields, or this test proves
	// nothing.
	live, err := (&testDocumentBuilder{}).BuildDocument(t.Context(), key, 10, testObjectJSON("gone", "Gone"))
	require.NoError(t, err)
	require.NotEmpty(t, live.Tags)
	require.NotEmpty(t, live.Fields)

	doc, err := buildDeletedDocument(key, 10, testObjectJSON("gone", "Gone"))
	require.NoError(t, err)

	require.Equal(t, "Gone", doc.Title)
	require.Equal(t, "gone", doc.Key.Name)
	require.Equal(t, "gone", doc.Name, "searches tie-break on name")
	require.Equal(t, int64(10), doc.RV)
	require.NotNil(t, doc.IsDeleted)
	require.True(t, *doc.IsDeleted)

	require.Nil(t, doc.IsProvisioned, "the object was not provisioned")
	require.Empty(t, doc.Tags)
	require.Empty(t, doc.Fields)
	require.Empty(t, doc.Labels)
	require.Empty(t, doc.References)
	require.Empty(t, doc.Description)
	require.Nil(t, doc.Manager)
}

// The three fields /trash serves beyond title and folder. All of them come from
// the object storage already holds, so building one costs no extra read.
func TestBuildDeletedDocumentRecordsWhoDeletedItAndWhen(t *testing.T) {
	key := &resourcepb.ResourceKey{Namespace: "ns", Group: "group", Resource: "resource", Name: "gone"}
	deletedAt := time.Now().Truncate(time.Second)

	doc, err := buildDeletedDocument(key, 42, testDeletedObjectJSON("gone", "Gone", "user:alice", deletedAt))
	require.NoError(t, err)

	require.NotNil(t, doc.DeletedBy)
	require.Equal(t, "user:alice", *doc.DeletedBy)
	require.NotNil(t, doc.DeletionTime)
	require.Equal(t, deletedAt.UnixMilli(), *doc.DeletionTime)
	require.NotNil(t, doc.DeletedRV)
	require.Equal(t, "42", *doc.DeletedRV, "the resource version of the delete, not of the last update")

	// A snowflake resource version from the KV backend. Kept as a string because a
	// float64 cannot represent one exactly, and restore submits this value back.
	t.Run("a large resource version keeps every digit", func(t *testing.T) {
		const rv int64 = 1856241819843796993
		doc, err := buildDeletedDocument(key, rv, testDeletedObjectJSON("gone", "Gone", "user:alice", deletedAt))
		require.NoError(t, err)
		require.Equal(t, "1856241819843796993", *doc.DeletedRV)
	})

	// An object deleted by a process with no user attached, or written before the
	// marker recorded one. Left unset rather than stored empty, so live and deleted
	// documents are indexed the same way.
	t.Run("an unknown deleter is left unset", func(t *testing.T) {
		doc, err := buildDeletedDocument(key, 42, testObjectJSON("gone", "Gone"))
		require.NoError(t, err)
		require.Nil(t, doc.DeletedBy)
		require.Nil(t, doc.DeletionTime)
		require.NotNil(t, doc.DeletedRV, "the delete always has a resource version")
	})
}

// Trash never returns an object that was provisioned when it was deleted, and a
// trimmed document keeps no manager fields to work that out later, so it is
// captured at delete time.
func TestBuildDeletedDocumentMarksProvisionedObjects(t *testing.T) {
	key := &resourcepb.ResourceKey{Namespace: "ns", Group: "group", Resource: "resource", Name: "gone"}

	doc, err := buildDeletedDocument(key, 10, testProvisionedObjectJSON("gone", "Gone"))
	require.NoError(t, err)
	require.NotNil(t, doc.IsProvisioned)
	require.True(t, *doc.IsProvisioned)
}

// An index built before the markers were mapped drops them, which would serve a
// deleted document as live. The producer checks first, so the documents are not
// even built, and the index gets a removal exactly as it did before.
func TestDeletedDocumentsAreRemovedWhenIndexCannotHoldMarkers(t *testing.T) {
	key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}
	storage := &trashStorageBackend{
		trash: []trashEntry{{name: "gone-1", rv: 10, value: testObjectJSON("gone-1", "Gone one")}},
		modified: []*ModifiedResource{{
			Action:          resourcepb.WatchEvent_DELETED,
			Key:             resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: "gone-2"},
			ResourceVersion: 11,
			Value:           testObjectJSON("gone-2", "Gone two"),
		}},
	}

	search := &mockSearchBackend{}
	server, err := newSearchServer(trashSearchOptions(search), storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	// An index reporting no features: what a binary from before the mapping built.
	older := &MockResourceIndex{buildInfo: IndexBuildInfo{Features: []IndexFeature{}}}
	require.False(t, server.keepsDeletedDocuments(older, log.NewNopLogger()))

	require.NoError(t, server.indexTrash(t.Context(), key, older, log.NewNopLogger()))
	require.Empty(t, older.indexedItems(), "trash listing should be skipped entirely")

	_, err = server.build(t.Context(), key, 1, "test", false, time.Time{})
	require.NoError(t, err)
	search.mu.Lock()
	updater := search.lastUpdater
	search.mu.Unlock()

	_, _, err = updater(t.Context(), older, 1)
	require.NoError(t, err)

	items := older.indexedItems()
	require.Len(t, items, 1)
	require.Equal(t, ActionDelete, items[0].Action)
	require.Equal(t, "gone-2", items[0].Key.Name)

	// An index that maps the markers but not the trash fields would hold a deleted
	// document whose sort field is missing, so /trash would return it in arbitrary
	// order. Treated the same as no markers at all: wait for the rebuild.
	t.Run("an index with the markers but not the trash fields", func(t *testing.T) {
		index := &MockResourceIndex{buildInfo: IndexBuildInfo{Features: []IndexFeature{IndexFeatureDeletedMarker}}}
		require.False(t, server.keepsDeletedDocuments(index, log.NewNopLogger()))
	})
}
