package resource

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"sync"
	"testing"
	"time"

	"github.com/Masterminds/semver"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ ResourceIndex = &MockResourceIndex{}

// Mock implementations
type MockResourceIndex struct {
	mock.Mock

	updateIndexError error

	updateIndexMu    sync.Mutex
	updateIndexCalls int

	buildInfo IndexBuildInfo
}

func (m *MockResourceIndex) BuildInfo() (IndexBuildInfo, error) {
	return m.buildInfo, nil
}

func (m *MockResourceIndex) BulkIndex(req *BulkIndexRequest) error {
	args := m.Called(req)
	return args.Error(0)
}

func (m *MockResourceIndex) Search(ctx context.Context, access types.AccessClient, req *resourcepb.ResourceSearchRequest, federate []ResourceIndex) (*resourcepb.ResourceSearchResponse, error) {
	args := m.Called(ctx, access, req, federate)
	return args.Get(0).(*resourcepb.ResourceSearchResponse), args.Error(1)
}

func (m *MockResourceIndex) CountManagedObjects(ctx context.Context) ([]*resourcepb.CountManagedObjectsResponse_ResourceCount, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*resourcepb.CountManagedObjectsResponse_ResourceCount), args.Error(1)
}

func (m *MockResourceIndex) DocCount(ctx context.Context, folder string) (int64, error) {
	args := m.Called(ctx, folder)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockResourceIndex) ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	args := m.Called(ctx, req)
	return args.Get(0).(*resourcepb.ListManagedObjectsResponse), args.Error(1)
}

func (m *MockResourceIndex) UpdateIndex(_ context.Context) (int64, error) {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()

	m.updateIndexCalls++
	return 0, m.updateIndexError
}

var _ DocumentBuilder = &MockDocumentBuilder{}

type MockDocumentBuilder struct {
	mock.Mock
}

func (m *MockDocumentBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, resourceVersion int64, value []byte) (*IndexableDocument, error) {
	args := m.Called(ctx, key, resourceVersion, value)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*IndexableDocument), nil
}

// mockStorageBackend implements StorageBackend for testing
type mockStorageBackend struct {
	resourceStats   []ResourceStats
	lastImportTimes []ResourceLastImportTime
}

func (m *mockStorageBackend) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]ResourceStats, error) {
	var result []ResourceStats
	for _, stat := range m.resourceStats {
		// Apply the minCount filter like the real implementation does
		if stat.Count > int64(minCount) {
			result = append(result, stat)
		}
	}
	return result, nil
}

func (m *mockStorageBackend) WriteEvent(ctx context.Context, event WriteEvent) (int64, error) {
	return 0, nil
}

func (m *mockStorageBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	return nil
}

func (m *mockStorageBackend) WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error) {
	return nil, nil
}

func (m *mockStorageBackend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, callback func(ListIterator) error) (int64, error) {
	return 0, nil
}

func (m *mockStorageBackend) ListHistory(ctx context.Context, req *resourcepb.ListRequest, callback func(ListIterator) error) (int64, error) {
	return 0, nil
}

func (m *mockStorageBackend) ListModifiedSince(ctx context.Context, key NamespacedResource, sinceRv int64) (int64, iter.Seq2[*ModifiedResource, error]) {
	return 0, func(yield func(*ModifiedResource, error) bool) {
		yield(nil, errors.New("not implemented"))
	}
}

func (m *mockStorageBackend) GetResourceLastImportTimes(ctx context.Context, filterKeys []NamespacedResource) iter.Seq2[ResourceLastImportTime, error] {
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

	mu              sync.Mutex
	buildIndexCalls []buildIndexCall
	cache           map[NamespacedResource]ResourceIndex
}

type buildIndexCall struct {
	key    NamespacedResource
	size   int64
	fields SearchableDocumentFields
}

func (m *mockSearchBackend) GetIndex(key NamespacedResource) ResourceIndex {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.cache[key]
}

func (m *mockSearchBackend) BuildIndex(ctx context.Context, key NamespacedResource, size int64, fields SearchableDocumentFields, reason string, builder BuildFn, updater UpdateFn, rebuild bool) (ResourceIndex, error) {
	index := &MockResourceIndex{}
	index.On("BulkIndex", mock.Anything).Return(nil).Maybe()
	index.On("DocCount", mock.Anything, mock.Anything).Return(int64(0), nil).Maybe()

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
		key:    key,
		size:   size,
		fields: fields,
	})

	return index, nil
}

func (m *mockSearchBackend) TotalDocs() int64 {
	return 0
}

func (m *mockSearchBackend) GetOpenIndexes() []NamespacedResource {
	return m.openIndexes
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

	support, err := newSearchSupport(opts, storage, nil, nil, nil, nil)
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
			_, _ = support.getOrCreateIndex(context.Background(), NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}, "test")
		}()
	}

	// Wait a bit for goroutines to start (hopefully)
	time.Sleep(10 * time.Millisecond)
	// Unblock all goroutines.
	close(start)
	wg.Wait()

	require.NotEmpty(t, search.buildIndexCalls)
	require.Less(t, len(search.buildIndexCalls), concurrency, "Should not have built index more than a few times (ideally once)")
	require.Equal(t, int64(50), search.buildIndexCalls[0].size)
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
	support, err := newSearchSupport(opts, storage, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, support)

	idx, err := support.getOrCreateIndex(context.Background(), NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}, "initial call")
	require.NoError(t, err)
	require.NotNil(t, idx)
	checkMockIndexUpdateCalls(t, idx, 1)

	idx, err = support.getOrCreateIndex(context.Background(), NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}, "second call")
	require.NoError(t, err)
	require.NotNil(t, idx)
	checkMockIndexUpdateCalls(t, idx, 2)

	idx, err = support.getOrCreateIndex(context.Background(), NamespacedResource{Namespace: "ns", Group: "group", Resource: "bad"}, "call to bad index")
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
	search := &slowSearchBackendWithCache{
		mockSearchBackend: mockSearchBackend{},
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

	support, err := newSearchSupport(opts, storage, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, support)

	key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	_, err = support.getOrCreateIndex(ctx, key, "test")
	// Make sure we get context deadline error
	require.ErrorIs(t, err, context.DeadlineExceeded)

	// Wait until indexing is finished.
	search.wg.Wait()

	require.NotEmpty(t, search.buildIndexCalls)

	// Wait until new index is put into cache.
	require.Eventually(t, func() bool {
		idx := support.search.GetIndex(key)
		return idx != nil
	}, 1*time.Second, 100*time.Millisecond, "Indexing finishes despite context cancellation")

	// Second call to getOrCreateIndex returns index immediately, even if context is canceled, as the index is now ready and cached.
	_, err = support.getOrCreateIndex(ctx, key, "test")
	require.NoError(t, err)
}

type slowSearchBackendWithCache struct {
	mockSearchBackend
	wg sync.WaitGroup
}

func (m *slowSearchBackendWithCache) GetIndex(key NamespacedResource) ResourceIndex {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.cache[key]
}

func (m *slowSearchBackendWithCache) BuildIndex(ctx context.Context, key NamespacedResource, size int64, fields SearchableDocumentFields, reason string, builder BuildFn, updater UpdateFn, rebuild bool) (ResourceIndex, error) {
	m.wg.Add(1)
	defer m.wg.Done()

	time.Sleep(1 * time.Second)

	// Simulate erroring out when context is cancelled.
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	idx, err := m.mockSearchBackend.BuildIndex(ctx, key, size, fields, reason, builder, updater, rebuild)
	if err != nil {
		return nil, err
	}
	return idx, nil
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

func TestShouldRebuildIndex(t *testing.T) {
	type testcase struct {
		buildInfo       IndexBuildInfo
		minTime         time.Time
		lastImportTime  time.Time
		minBuildVersion *semver.Version

		expected bool
	}

	now := time.Now()

	for name, tc := range map[string]testcase{
		"empty build info, with no rebuild conditions": {
			buildInfo: IndexBuildInfo{},
			expected:  false,
		},
		"empty build info, with minTime": {
			buildInfo: IndexBuildInfo{},
			minTime:   now,
			expected:  true,
		},
		"empty build info, with lastImportTime": {
			buildInfo:      IndexBuildInfo{},
			lastImportTime: now,
			expected:       true,
		},
		"empty build info, with minVersion": {
			buildInfo:       IndexBuildInfo{},
			minBuildVersion: semver.MustParse("10.15.20"),
			expected:        true,
		},
		"build time before min time": {
			buildInfo: IndexBuildInfo{BuildTime: now.Add(-2 * time.Hour)},
			minTime:   now,
			expected:  true,
		},
		"build time after min time": {
			buildInfo: IndexBuildInfo{BuildTime: now.Add(2 * time.Hour)},
			minTime:   now,
			expected:  false,
		},
		"build time before last import time": {
			buildInfo:      IndexBuildInfo{BuildTime: now.Add(-2 * time.Hour)},
			lastImportTime: now,
			expected:       true,
		},
		"build time after last import time": {
			buildInfo:      IndexBuildInfo{BuildTime: now.Add(2 * time.Hour)},
			lastImportTime: now,
			expected:       false,
		},
		"build version before min version": {
			buildInfo:       IndexBuildInfo{BuildVersion: semver.MustParse("10.15.19")},
			minBuildVersion: semver.MustParse("10.15.20"),
			expected:        true,
		},
		"build version after min version": {
			buildInfo:       IndexBuildInfo{BuildVersion: semver.MustParse("11.0.0")},
			minBuildVersion: semver.MustParse("10.15.20"),
			expected:        false,
		},
	} {
		t.Run(name, func(t *testing.T) {
			res := shouldRebuildIndex(tc.buildInfo, tc.minBuildVersion, tc.minTime, tc.lastImportTime, nil)
			require.Equal(t, tc.expected, res)
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
	}

	support, err := newSearchSupport(opts, storage, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, support)

	lastImportTime := now.Add(-10 * time.Minute)
	importTimes := map[NamespacedResource]time.Time{
		{Namespace: "resource-recently-imported", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}: lastImportTime,

		// This index was "just" built, and should not be rebuilt.
		{Namespace: "resource-v6", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}: lastImportTime,
	}

	support.findIndexesToRebuild(importTimes, nil, now)
	require.Equal(t, 7, support.rebuildQueue.Len())

	now5m := now.Add(5 * time.Minute)

	// Running findIndexesToRebuild again should not add any new indexes to the rebuild queue, and all existing
	// ones should be "combined" with new ones (this will "bump" minBuildTime)
	support.findIndexesToRebuild(importTimes, nil, now5m)
	require.Equal(t, 7, support.rebuildQueue.Len())

	// Values that we expect to find in rebuild requests.
	minBuildVersion := semver.MustParse("5.5.5")
	minBuildTime := now5m.Add(-5 * time.Hour)
	minBuildTimeDashboard := now5m.Add(-1 * time.Hour)

	vals := support.rebuildQueue.Elements()
	require.ElementsMatch(t, vals, []rebuildRequest{
		{NamespacedResource: NamespacedResource{Namespace: "resource-2h-v5", Group: "group", Resource: "folder"}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTime},
		{NamespacedResource: NamespacedResource{Namespace: "resource-10h-v5", Group: "group", Resource: "folder"}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTime},
		{NamespacedResource: NamespacedResource{Namespace: "resource-10h-v6", Group: "group", Resource: "folder"}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTime},

		{NamespacedResource: NamespacedResource{Namespace: "resource-v5", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTimeDashboard},
		{NamespacedResource: NamespacedResource{Namespace: "resource-2h-v5", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTimeDashboard},
		{NamespacedResource: NamespacedResource{Namespace: "resource-2h-v6", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTimeDashboard},

		{NamespacedResource: NamespacedResource{Namespace: "resource-recently-imported", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTimeDashboard, lastImportTime: lastImportTime},
	})
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

	support, err := newSearchSupport(opts, storage, nil, nil, nil, nil)
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

		support.builders.ns.Add(dashKey, &MockDocumentBuilder{})
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
}

func checkRebuildIndex(t *testing.T, support *searchSupport, req rebuildRequest, indexExists, expectedRebuild bool) {
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

	search := &mockSearchBackend{
		cache: map[NamespacedResource]ResourceIndex{
			key: &MockResourceIndex{
				buildInfo: IndexBuildInfo{BuildVersion: semver.MustParse("5.0.0"), BuildTime: time.Date(2025, 1, 1, 12, 0, 0, 0, time.UTC)},
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
		InitMinCount: 1,
	}

	support, err := newSearchSupport(opts, storage, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, support)

	require.Equal(t, 0, support.rebuildQueue.Len())

	rebuildReq := &resourcepb.RebuildIndexesRequest{
		Namespace: key.Namespace,
		Keys: []*resourcepb.ResourceKey{{
			Namespace: key.Namespace,
			Group:     key.Group,
			Resource:  key.Resource,
		}}}

	// old import time will not be rebuilt
	storage.lastImportTimes = []ResourceLastImportTime{{
		NamespacedResource: key,
		LastImportTime:     time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
	}}
	rsp, err := support.RebuildIndexes(t.Context(), rebuildReq)
	require.NoError(t, err)
	require.Equal(t, int64(0), rsp.RebuiltCount)
	require.Equal(t, 0, support.rebuildQueue.Len())

	// recent import time gets added to rebuild queue
	storage.lastImportTimes = []ResourceLastImportTime{{
		NamespacedResource: key,
		LastImportTime:     time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC),
	}}
	rsp, err = support.RebuildIndexes(t.Context(), rebuildReq)
	require.NoError(t, err)
	require.Equal(t, int64(1), rsp.RebuiltCount)
	require.Equal(t, 1, support.rebuildQueue.Len())
}
