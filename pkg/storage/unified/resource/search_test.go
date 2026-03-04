package resource

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Masterminds/semver"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/authlib/types"
	gocache "github.com/patrickmn/go-cache"
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

func (m *MockResourceIndex) Search(ctx context.Context, access types.AccessClient, req *resourcepb.ResourceSearchRequest, federate []ResourceIndex, stats *SearchStats) (*resourcepb.ResourceSearchResponse, error) {
	args := m.Called(ctx, access, req, federate)
	return args.Get(0).(*resourcepb.ResourceSearchResponse), args.Error(1)
}

func (m *MockResourceIndex) CountManagedObjects(ctx context.Context, stats *SearchStats) ([]*resourcepb.CountManagedObjectsResponse_ResourceCount, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*resourcepb.CountManagedObjectsResponse_ResourceCount), args.Error(1)
}

func (m *MockResourceIndex) DocCount(ctx context.Context, folder string, stats *SearchStats) (int64, error) {
	args := m.Called(ctx, folder)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockResourceIndex) ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest, stats *SearchStats) (*resourcepb.ListManagedObjectsResponse, error) {
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

func (m *mockStorageBackend) GetResourceStats(ctx context.Context, nsr NamespacedResource, minCount int) ([]ResourceStats, error) {
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

func (m *mockSearchBackend) BuildIndex(ctx context.Context, key NamespacedResource, size int64, fields SearchableDocumentFields, reason string, builder BuildFn, updater UpdateFn, rebuild bool, lastImportTime time.Time) (ResourceIndex, error) {
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

	support, err := newSearchServer(opts, storage, nil, nil, nil, nil)
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
	support, err := newSearchServer(opts, storage, nil, nil, nil, nil)
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

	support, err := newSearchServer(opts, storage, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, support)

	key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	_, err = support.getOrCreateIndex(ctx, nil, key, "test")
	// Make sure we get context deadline error
	require.ErrorIs(t, err, context.DeadlineExceeded)

	// Wait until indexing is finished. We need to wait 2 seconds here,
	// because BuildIndex simulates a 1 second build time, and we want
	// to be sure it has started before we check the calls.
	require.Eventually(t, func() bool {
		return search.slowBuildCalls.Load() > 0
	}, 2*time.Second, 100*time.Millisecond, "BuildIndex never started")

	require.NotEmpty(t, search.buildIndexCalls)

	// Wait until new index is put into cache.
	require.Eventually(t, func() bool {
		idx := support.search.GetIndex(key)
		return idx != nil
	}, 1*time.Second, 100*time.Millisecond, "Indexing finishes despite context cancellation")

	// Second call to getOrCreateIndex returns index immediately, even if context is canceled, as the index is now ready and cached.
	_, err = support.getOrCreateIndex(ctx, nil, key, "test")
	require.NoError(t, err)
}

type slowSearchBackendWithCache struct {
	mockSearchBackend
	slowBuildCalls atomic.Int64
}

func (m *slowSearchBackendWithCache) GetIndex(key NamespacedResource) ResourceIndex {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.cache[key]
}

func (m *slowSearchBackendWithCache) BuildIndex(ctx context.Context, key NamespacedResource, size int64, fields SearchableDocumentFields, reason string, builder BuildFn, updater UpdateFn, rebuild bool, lastImportTime time.Time) (ResourceIndex, error) {
	defer m.slowBuildCalls.Add(1)

	time.Sleep(1 * time.Second)

	// Simulate erroring out when context is cancelled.
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	idx, err := m.mockSearchBackend.BuildIndex(ctx, key, size, fields, reason, builder, updater, rebuild, lastImportTime)
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

	support, err := newSearchServer(opts, storage, nil, nil, nil, nil)
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
	expected := []rebuildRequest{
		{NamespacedResource: NamespacedResource{Namespace: "resource-2h-v5", Group: "group", Resource: "folder"}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTime},
		{NamespacedResource: NamespacedResource{Namespace: "resource-10h-v5", Group: "group", Resource: "folder"}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTime},
		{NamespacedResource: NamespacedResource{Namespace: "resource-10h-v6", Group: "group", Resource: "folder"}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTime},

		{NamespacedResource: NamespacedResource{Namespace: "resource-v5", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTimeDashboard},
		{NamespacedResource: NamespacedResource{Namespace: "resource-2h-v5", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTimeDashboard},
		{NamespacedResource: NamespacedResource{Namespace: "resource-2h-v6", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTimeDashboard},

		{NamespacedResource: NamespacedResource{Namespace: "resource-recently-imported", Group: "group", Resource: dashboardv1.DASHBOARD_RESOURCE}, minBuildVersion: minBuildVersion, minBuildTime: minBuildTimeDashboard, lastImportTime: lastImportTime},
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

	support, err := newSearchServer(opts, storage, nil, nil, nil, nil)
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

		support, err := newSearchServer(opts, storage, nil, nil, nil, nil)
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

	support, err := newSearchServer(opts, storage, nil, nil, nil, nil)
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

func TestListerWithLookback(t *testing.T) {
	nsr := NamespacedResource{Namespace: "ns", Group: "g", Resource: "r"}
	nsr2 := NamespacedResource{Namespace: "ns", Group: "g", Resource: "r2"}
	baseRV := snowflakeFromTime(time.Now())

	// Helper to create a listerWithLookback with a recording func.
	// The func records every sinceRV it receives and returns the given resources.
	newTestLister := func(lookback time.Duration, maxUnchanged int, resources []*ModifiedResource) (*listerWithLookback, *[]int64) {
		var receivedRVs []int64
		l := &listerWithLookback{
			listModifiedSinceFunc: func(_ context.Context, _ NamespacedResource, sinceRV int64) (int64, iter.Seq2[*ModifiedResource, error]) {
				receivedRVs = append(receivedRVs, sinceRV)
				return baseRV, func(yield func(*ModifiedResource, error) bool) {
					for _, r := range resources {
						if !yield(r, nil) {
							return
						}
					}
				}
			},
			lookback:       lookback,
			processed:      gocache.New(2*lookback, time.Minute),
			unchangedCount: make(map[NamespacedResource]int),
			lastRV:         make(map[NamespacedResource]int64),
			maxUnchanged:   maxUnchanged,
		}
		return l, &receivedRVs
	}

	// Helper to collect all resources from an iterator.
	collect := func(it iter.Seq2[*ModifiedResource, error]) []*ModifiedResource {
		var result []*ModifiedResource
		for r, err := range it {
			require.NoError(t, err)
			result = append(result, r)
		}
		return result
	}

	t.Run("applies lookback on first call", func(t *testing.T) {
		lookback := 5 * time.Minute
		l, receivedRVs := newTestLister(lookback, 10, nil)

		l.ListModifiedSince(t.Context(), nsr, baseRV)

		expected := subtractDurationFromSnowflake(baseRV, lookback)
		require.Len(t, *receivedRVs, 1)
		require.Equal(t, expected, (*receivedRVs)[0], "first call should apply lookback")
	})

	t.Run("applies lookback for up to maxUnchanged calls with same sinceRV", func(t *testing.T) {
		lookback := 5 * time.Minute
		maxUnchanged := 3
		l, receivedRVs := newTestLister(lookback, maxUnchanged, nil)
		expected := subtractDurationFromSnowflake(baseRV, lookback)

		for range maxUnchanged {
			l.ListModifiedSince(t.Context(), nsr, baseRV)
		}

		require.Len(t, *receivedRVs, maxUnchanged)
		for j := range maxUnchanged {
			require.Equal(t, expected, (*receivedRVs)[j], "call %d should apply lookback", j)
		}
	})

	t.Run("stops applying lookback after maxUnchanged calls with same sinceRV", func(t *testing.T) {
		lookback := 5 * time.Minute
		maxUnchanged := 3
		l, receivedRVs := newTestLister(lookback, maxUnchanged, nil)

		// Make maxUnchanged calls to exhaust the counter.
		for range maxUnchanged {
			l.ListModifiedSince(t.Context(), nsr, baseRV)
		}

		// The next call should pass sinceRV through without lookback.
		l.ListModifiedSince(t.Context(), nsr, baseRV)

		require.Len(t, *receivedRVs, maxUnchanged+1)
		require.Equal(t, baseRV, (*receivedRVs)[maxUnchanged], "after maxUnchanged calls, lookback should not apply")
	})

	t.Run("lookback stays disabled for continued unchanged calls", func(t *testing.T) {
		lookback := 5 * time.Minute
		maxUnchanged := 2
		l, receivedRVs := newTestLister(lookback, maxUnchanged, nil)

		// Exhaust the counter.
		for range maxUnchanged {
			l.ListModifiedSince(t.Context(), nsr, baseRV)
		}

		// Several more calls should all pass sinceRV through unchanged.
		for range 5 {
			l.ListModifiedSince(t.Context(), nsr, baseRV)
		}

		total := maxUnchanged + 5
		require.Len(t, *receivedRVs, total)
		for i := maxUnchanged; i < total; i++ {
			require.Equal(t, baseRV, (*receivedRVs)[i], "call %d should not apply lookback", i)
		}
	})

	t.Run("counter resets when sinceRV changes", func(t *testing.T) {
		lookback := 5 * time.Minute
		maxUnchanged := 2
		l, receivedRVs := newTestLister(lookback, maxUnchanged, nil)

		// Exhaust the counter.
		for range maxUnchanged {
			l.ListModifiedSince(t.Context(), nsr, baseRV)
		}

		// Verify lookback is now disabled.
		l.ListModifiedSince(t.Context(), nsr, baseRV)
		require.Equal(t, baseRV, (*receivedRVs)[maxUnchanged])

		// Change sinceRV — counter should reset and lookback should apply again.
		newRV := baseRV + 1000
		l.ListModifiedSince(t.Context(), nsr, newRV)

		last := (*receivedRVs)[len(*receivedRVs)-1]
		expected := subtractDurationFromSnowflake(newRV, lookback)
		require.Equal(t, expected, last, "after RV change, lookback should apply again")
	})

	t.Run("different NamespacedResources are tracked independently", func(t *testing.T) {
		lookback := 5 * time.Minute
		maxUnchanged := 2
		l, receivedRVs := newTestLister(lookback, maxUnchanged, nil)

		// Exhaust counter for nsr.
		for range maxUnchanged {
			l.ListModifiedSince(t.Context(), nsr, baseRV)
		}
		// nsr lookback should now be disabled.
		l.ListModifiedSince(t.Context(), nsr, baseRV)
		nsr1AfterExhaust := (*receivedRVs)[maxUnchanged]
		require.Equal(t, baseRV, nsr1AfterExhaust, "nsr lookback should be disabled")

		// First call for nsr2 should still have lookback applied.
		l.ListModifiedSince(t.Context(), nsr2, baseRV)
		nsr2First := (*receivedRVs)[len(*receivedRVs)-1]
		expected := subtractDurationFromSnowflake(baseRV, lookback)
		require.Equal(t, expected, nsr2First, "nsr2 should still have lookback applied")
	})

	t.Run("deduplicates resources via ProcessedBatch", func(t *testing.T) {
		res1 := &ModifiedResource{Key: resourcepb.ResourceKey{Group: "g", Resource: "r", Namespace: "ns", Name: "a"}, ResourceVersion: 1}
		res2 := &ModifiedResource{Key: resourcepb.ResourceKey{Group: "g", Resource: "r", Namespace: "ns", Name: "b"}, ResourceVersion: 2}
		res3 := &ModifiedResource{Key: resourcepb.ResourceKey{Group: "g", Resource: "r", Namespace: "ns", Name: "c"}, ResourceVersion: 3}

		l, _ := newTestLister(5*time.Minute, 10, []*ModifiedResource{res1, res2, res3})

		// First call — all resources should be yielded.
		_, it := l.ListModifiedSince(t.Context(), nsr, baseRV)
		got := collect(it)
		require.Len(t, got, 3)

		// Mark res1 and res2 as processed.
		l.ProcessedBatch([]*ModifiedResource{res1, res2})

		// Second call — only res3 should be yielded (res1 and res2 are deduplicated).
		_, it = l.ListModifiedSince(t.Context(), nsr, baseRV)
		got = collect(it)
		require.Len(t, got, 1)
		require.Equal(t, "c", got[0].Key.Name)
	})

	t.Run("propagates errors from underlying storage implementation", func(t *testing.T) {
		expectedErr := errors.New("storage failure")
		l := &listerWithLookback{
			listModifiedSinceFunc: func(_ context.Context, _ NamespacedResource, _ int64) (int64, iter.Seq2[*ModifiedResource, error]) {
				return 0, func(yield func(*ModifiedResource, error) bool) {
					yield(nil, expectedErr)
				}
			},
			lookback:       5 * time.Minute,
			processed:      gocache.New(10*time.Minute, time.Minute),
			unchangedCount: make(map[NamespacedResource]int),
			lastRV:         make(map[NamespacedResource]int64),
			maxUnchanged:   10,
		}

		_, it := l.ListModifiedSince(t.Context(), nsr, baseRV)
		for _, err := range it {
			require.ErrorIs(t, err, expectedErr)
			return
		}
		t.Fatal("expected error from iterator")
	})

	t.Run("returns newRV from underlying storage implementation", func(t *testing.T) {
		expectedRV := int64(999999)
		l := &listerWithLookback{
			listModifiedSinceFunc: func(_ context.Context, _ NamespacedResource, _ int64) (int64, iter.Seq2[*ModifiedResource, error]) {
				return expectedRV, func(yield func(*ModifiedResource, error) bool) {}
			},
			lookback:       5 * time.Minute,
			processed:      gocache.New(10*time.Minute, time.Minute),
			unchangedCount: make(map[NamespacedResource]int),
			lastRV:         make(map[NamespacedResource]int64),
			maxUnchanged:   10,
		}

		rv, _ := l.ListModifiedSince(t.Context(), nsr, baseRV)
		require.Equal(t, expectedRV, rv)
	})
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

	support, err := newSearchServer(opts, &mockStorageBackend{}, nil, nil, nil, nil)
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
