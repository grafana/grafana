package resource

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"maps"
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
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ ResourceIndex = (*MockResourceIndex)(nil)

// Mock implementations
type MockResourceIndex struct {
	updateIndexError error

	updateIndexMu    sync.Mutex
	updateIndexCalls int

	buildInfo        IndexBuildInfo
	docCount         int64
	fieldDefinitions []SearchFieldDefinition

	// Types recorded through RecordCompletedTypeBuild, and an error to fail
	// reading them with.
	completedTypeBuilds    map[schema.GroupResource]TypeBuild
	completedTypeBuildsErr error

	// What the index reports holding, for reconciliation tests.
	documentRefs    map[schema.GroupResource][]DocumentRef
	documentRefsErr error

	// Types recorded as written, as the real index records them in BulkIndex
	// and forgets them in ForgetType.
	documentTypes map[schema.GroupResource]struct{}

	// When the index was last compared with storage, through RecordReconciledAt.
	reconciledAt time.Time

	// Items passed to BulkIndex, and how many writes carried them, guarded by
	// updateIndexMu.
	bulkItems []*BulkIndexItem
	bulkCalls int
	// Fails BulkIndex from this call on, counting from 1, when not zero.
	failBulkFromCall int

	// Optional configured results for the managed-object RPCs. When nil the
	// methods return an error, matching the default "not expected" behaviour.
	managedObjects *resourcepb.ListManagedObjectsResponse
	managedCounts  []*resourcepb.CountManagedObjectsResponse_ResourceCount
}

func (m *MockResourceIndex) BuildInfo() (IndexBuildInfo, error) {
	bi := m.buildInfo
	// The mock stands for an index this binary built, so it maps the current
	// features and the standard fields' hash unless a test sets them. A test that wants an older index sets them
	// to an empty (non-nil) slice.
	if bi.SearchFieldsHash == "" {
		bi.SearchFieldsHash = StandardSearchFieldsHash()
	}
	if bi.Features == nil {
		bi.Features = CurrentIndexFeatures()
	}
	return bi, nil
}

func (m *MockResourceIndex) BulkIndex(req *BulkIndexRequest) error {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	m.bulkCalls++
	if m.failBulkFromCall > 0 && m.bulkCalls >= m.failBulkFromCall {
		return fmt.Errorf("bulk index failed")
	}
	m.bulkItems = append(m.bulkItems, req.Items...)
	for _, item := range req.Items {
		if item.Action == ActionIndex && item.Doc != nil && item.Doc.Key != nil {
			if m.documentTypes == nil {
				m.documentTypes = map[schema.GroupResource]struct{}{}
			}
			m.documentTypes[schema.GroupResource{Group: item.Doc.Key.Group, Resource: item.Doc.Key.Resource}] = struct{}{}
		}
	}
	return nil
}

// indexedItems returns the items passed to BulkIndex so far.
func (m *MockResourceIndex) indexedItems() []*BulkIndexItem {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	return slices.Clone(m.bulkItems)
}

func (m *MockResourceIndex) SearchFieldDefinitions() []SearchFieldDefinition {
	if m.fieldDefinitions != nil {
		return m.fieldDefinitions
	}
	return StandardSearchFieldDefinitions()
}

func (m *MockResourceIndex) Search(_ context.Context, _ types.AccessClient, _ *resourcepb.ResourceSearchRequest, _ *SearchIndexes, _ *SearchStats) (*resourcepb.ResourceSearchResponse, error) {
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

func (m *MockResourceIndex) CompletedTypeBuilds() (map[schema.GroupResource]TypeBuild, error) {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	if m.completedTypeBuildsErr != nil {
		return nil, m.completedTypeBuildsErr
	}
	return maps.Clone(m.completedTypeBuilds), nil
}

func (m *MockResourceIndex) RecordCompletedTypeBuild(gr schema.GroupResource, build TypeBuild) error {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	if m.completedTypeBuilds == nil {
		m.completedTypeBuilds = map[schema.GroupResource]TypeBuild{}
	}
	m.completedTypeBuilds[gr] = build
	return nil
}

// DocumentTypes answers with the types recorded as written, and the types a
// test set up documentRefs for, which stand for documents written before it.
func (m *MockResourceIndex) DocumentTypes() ([]schema.GroupResource, error) {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	types := maps.Clone(m.documentTypes)
	if types == nil {
		types = map[schema.GroupResource]struct{}{}
	}
	for gr, refs := range m.documentRefs {
		if len(refs) > 0 {
			types[gr] = struct{}{}
		}
	}
	return slices.Collect(maps.Keys(types)), nil
}

func (m *MockResourceIndex) ReconciledAt() (time.Time, error) {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	return m.reconciledAt, nil
}

func (m *MockResourceIndex) RecordReconciledAt(t time.Time) error {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	m.reconciledAt = t
	return nil
}

// ForgetType forgets both records, and the documents a test set up, which the
// caller has removed by now.
func (m *MockResourceIndex) ForgetType(gr schema.GroupResource) error {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	delete(m.completedTypeBuilds, gr)
	delete(m.documentTypes, gr)
	delete(m.documentRefs, gr)
	return nil
}

// documentRefs is what ListDocumentRefs answers with, by resource type.
func (m *MockResourceIndex) ListDocumentRefs(_ context.Context, gr schema.GroupResource) iter.Seq2[DocumentRef, error] {
	// One ref at a time, as the real index pages, so a document written while a
	// caller is part way through is seen once the caller gets to it.
	return func(yield func(DocumentRef, error) bool) {
		m.updateIndexMu.Lock()
		err := m.documentRefsErr
		m.updateIndexMu.Unlock()
		if err != nil {
			yield(DocumentRef{}, err)
			return
		}
		for i := 0; ; i++ {
			m.updateIndexMu.Lock()
			refs := m.documentRefs[gr]
			if i >= len(refs) {
				m.updateIndexMu.Unlock()
				return
			}
			ref := refs[i]
			m.updateIndexMu.Unlock()
			if !yield(ref, nil) {
				return
			}
		}
	}
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
	resourceStats       []ResourceStats
	statsErr            error
	beforeStats         func(context.Context, NamespacedResource, int, int) error
	lastImportTimes     []ResourceLastImportTime
	statsCalls          atomic.Int32
	listStoredCalls     atomic.Int32
	listStoredErr       error
	lastCountLimit      atomic.Int64
	lastImportTimeCalls atomic.Int32
}

func (m *mockStorageBackend) GetResourceStats(ctx context.Context, nsr NamespacedResource, minCount int) ([]ResourceStats, error) {
	m.statsCalls.Add(1)
	var result []ResourceStats
	for _, stat := range m.resourceStats {
		if (nsr.Namespace != "" && stat.Namespace != nsr.Namespace) ||
			(nsr.Group != "" && stat.Group != nsr.Group) ||
			(nsr.Resource != "" && stat.Resource != nsr.Resource) {
			continue
		}
		// Apply the minCount filter like the real implementation does
		if stat.Count > int64(minCount) {
			result = append(result, stat)
		}
	}
	return result, m.statsErr
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
	if m.beforeStats != nil {
		if err := m.beforeStats(ctx, nsr, minCount, countLimit); err != nil {
			return nil, err
		}
	}
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

func (m *mockStorageBackend) GetResourceLastImportTime(ctx context.Context, nsr NamespacedResource) (time.Time, error) {
	m.lastImportTimeCalls.Add(1)
	for _, importTime := range m.lastImportTimes {
		if importTime.NamespacedResource == nsr {
			return importTime.LastImportTime, nil
		}
	}
	return time.Time{}, nil
}

func (m *mockStorageBackend) ListResourceLastImportTimes(context.Context) (map[NamespacedResource]time.Time, error) {
	result := make(map[NamespacedResource]time.Time)
	for _, entry := range m.lastImportTimes {
		result[entry.NamespacedResource] = entry.LastImportTime
	}
	return result, nil
}

// featuresForTestIndex describes an index that does or does not keep deleted
// documents. Only a new index keeps them, so the false case stands in for an index
// built before that was the case.
func featuresForTestIndex(keepsDeletedDocuments bool) []IndexFeature {
	features := CurrentIndexFeatures()
	if keepsDeletedDocuments {
		return features
	}
	return slices.DeleteFunc(features, func(f IndexFeature) bool {
		return f == IndexFeatureHoldsDeletedDocuments
	})
}

// mockSearchBackend implements SearchBackend for testing with tracking capabilities
type mockSearchBackend struct {
	openIndexes []NamespacedResource
	// What the previous run left recorded as open, returned by LoadOpenIndexStats.
	openIndexStats    []ResourceStats
	openIndexStatsErr error

	// Recorded on every index this backend builds, standing in for the decision the
	// real backend makes from its options at creation.
	keepsDeletedDocuments bool

	// Skips the build function, as for an index reused from disk.
	reusesFromDisk bool

	mu                sync.Mutex
	buildIndexCalls   []buildIndexCall
	cache             map[NamespacedResource]ResourceIndex
	stopCalls         atomic.Int32
	getIndexCalls     int
	snapshotThreshold int64
	// Updater from the most recent BuildIndex, so a test can drive it.
	lastUpdater UpdateFn
}

func (m *mockSearchBackend) SnapshotCountThreshold() int64 {
	return m.snapshotThreshold
}

func (m *mockSearchBackend) RemoveExpiredTrash(context.Context) {}

type buildIndexCall struct {
	key  NamespacedResource
	size int64
}

func (m *mockSearchBackend) LoadOpenIndexStats(_ time.Time, _ time.Duration) ([]ResourceStats, error) {
	return m.openIndexStats, m.openIndexStatsErr
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

// Saved indexes are used as they are: nothing asks storage which namespaces
// could have a global index.
func TestStartupIndexStatsUsesSavedIndexesWithoutDiscovery(t *testing.T) {
	for _, tc := range []struct {
		name          string
		globalEnabled bool
		startupBuild  bool
	}{
		{name: "global disabled"},
		{name: "global disabled with foreground setting", startupBuild: true},
		{name: "background global builds", globalEnabled: true},
		{name: "foreground global builds", globalEnabled: true, startupBuild: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			openStats := []ResourceStats{{NamespacedResource: dashboardType("known"), Count: 1}}
			storage := &mockStorageBackend{statsErr: errors.New("discovery unavailable")}
			server, err := newSearchServer(SearchOptions{
				Backend:                 &mockSearchBackend{openIndexStats: openStats},
				Resources:               &TestDocumentBuilderSupplier{GroupsResources: map[string]string{"dashboard.grafana.app": "dashboards"}},
				GlobalIndexEnabled:      tc.globalEnabled,
				GlobalIndexStartupBuild: tc.startupBuild,
			}, storage, nil, nil, nil, nil, nil, nil, nil, nil)
			require.NoError(t, err)
			stats, err := server.startupIndexStats(t.Context())
			require.NoError(t, err)
			require.Equal(t, openStats, stats)
			require.Zero(t, storage.statsCalls.Load())
		})
	}
}

func (m *mockSearchBackend) WriteOpenIndexStats(_ time.Time) error {
	return nil
}

func (m *mockSearchBackend) GetIndex(key NamespacedResource) ResourceIndex {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.getIndexCalls++
	return m.cache[key]
}

func (m *mockSearchBackend) PeekIndex(key NamespacedResource) ResourceIndex {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.cache[key]
}

func (m *mockSearchBackend) BuildIndex(ctx context.Context, key NamespacedResource, size int64, reason string, builder BuildFn, updater UpdateFn, rebuild bool, lastImportTime time.Time, _ time.Duration, _ BuildIndexOptions) (ResourceIndex, error) {
	index := &MockResourceIndex{buildInfo: IndexBuildInfo{Features: featuresForTestIndex(m.keepsDeletedDocuments)}}
	m.mu.Lock()
	m.lastUpdater = updater
	m.mu.Unlock()

	// Call the builder function (required by the contract), unless standing in
	// for an index reused from disk, which is not built again.
	if !m.reusesFromDisk {
		_, err := builder(index)
		if err != nil {
			return nil, err
		}
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

type initialBuildTestBackend struct {
	mockSearchBackend
	beforeBuild      func(context.Context, NamespacedResource, BuildIndexOptions) error
	reusedIndex      *MockResourceIndex
	buildImportTimes map[NamespacedResource][]time.Time
}

func (b *initialBuildTestBackend) BuildIndex(ctx context.Context, key NamespacedResource, size int64, reason string, builder BuildFn, updater UpdateFn, rebuild bool, lastImportTime time.Time, maxFreshSnapshotAge time.Duration, options BuildIndexOptions) (ResourceIndex, error) {
	b.mu.Lock()
	if b.buildImportTimes == nil {
		b.buildImportTimes = make(map[NamespacedResource][]time.Time)
	}
	b.buildImportTimes[key] = append(b.buildImportTimes[key], lastImportTime)
	b.mu.Unlock()
	if err := b.beforeBuild(ctx, key, options); err != nil {
		return nil, err
	}
	index := b.reusedIndex
	if index == nil {
		index = &MockResourceIndex{buildInfo: IndexBuildInfo{BuildTime: time.Now(), Features: CurrentIndexFeatures()}}
		if key.IsGlobal() {
			index.buildInfo.SearchFieldsHash = GlobalSearchFieldsHash()
		}
		if _, err := builder(index); err != nil {
			return nil, err
		}
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.cache == nil {
		b.cache = make(map[NamespacedResource]ResourceIndex)
	}
	b.cache[key] = index
	b.buildIndexCalls = append(b.buildIndexCalls, buildIndexCall{key: key, size: size})
	return index, nil
}

func newInitialBuildTestServer(t *testing.T, backend *initialBuildTestBackend, stats []ResourceStats, workers int) *searchServer {
	t.Helper()
	server, err := newSearchServer(SearchOptions{
		Backend: backend,
		Resources: &TestDocumentBuilderSupplier{GroupsResources: map[string]string{
			"dashboard.grafana.app": "dashboards",
			"folder.grafana.app":    "folders",
		}},
		InitWorkerThreads:       workers,
		GlobalIndexEnabled:      true,
		GlobalIndexStartupBuild: true,
	}, &mockStorageBackend{resourceStats: stats}, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	server.initRetryInterval = 10 * time.Millisecond
	t.Cleanup(func() {
		if backend.stopCalls.Load() == 0 {
			server.stop()
		}
	})
	return server
}

func TestStartupBuildsDeferHeldLocksWithoutOccupyingWorker(t *testing.T) {
	stats := make([]ResourceStats, 3)
	for i := range stats {
		stats[i] = ResourceStats{NamespacedResource: dashboardType(fmt.Sprintf("ns-%d", i)), Count: 1}
	}
	attempts := make(chan NamespacedResource, 10)
	var leaderFinished atomic.Bool
	var blocked NamespacedResource
	backend := &initialBuildTestBackend{beforeBuild: func(ctx context.Context, key NamespacedResource, options BuildIndexOptions) error {
		if key.IsGlobal() {
			return nil
		}
		if !options.SkipIfBuilding {
			return fmt.Errorf("startup build must not wait for the leader")
		}
		if blocked.Namespace == "" {
			blocked = key
		}
		select {
		case attempts <- key:
		case <-ctx.Done():
			return ctx.Err()
		}
		if key == blocked && !leaderFinished.Load() {
			return ErrIndexBuildInProgress
		}
		return nil
	}}
	server := newInitialBuildTestServer(t, backend, stats, 1)
	server.initRetryInterval = 100 * time.Millisecond
	done := make(chan error, 1)
	go func() { done <- server.init(t.Context()) }()

	seen := make(map[NamespacedResource]bool)
	for range len(stats) {
		select {
		case key := <-attempts:
			require.False(t, seen[key], "the held lock must not stop attempts for other indexes")
			seen[key] = true
		case <-time.After(5 * time.Second):
			t.Fatal("worker did not try the remaining indexes")
		}
	}
	select {
	case err := <-done:
		t.Fatalf("startup finished before the leader: %v", err)
	default:
	}

	leaderFinished.Store(true)
	select {
	case err := <-done:
		require.NoError(t, err)
	case <-time.After(5 * time.Second):
		t.Fatal("startup did not retry the deferred index")
	}
	for _, info := range stats {
		require.NotNil(t, backend.GetIndex(info.NamespacedResource))
	}
}

func TestStartupReadsImportTimesOnceAcrossBuildsAndRetries(t *testing.T) {
	for _, tc := range []struct {
		name           string
		readFails      bool
		failBeforeRead bool
	}{
		{name: "successful lookup"},
		{name: "failed lookup", readFails: true, failBeforeRead: true},
		{name: "partial lookup failure", readFails: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			backend := setupTestStorageBackend(t)
			importTimes := map[NamespacedResource]time.Time{
				dashboardType("default"): time.Now().UTC().Truncate(time.Second).Add(-time.Hour),
				folderType("default"):    time.Now().UTC().Truncate(time.Second).Add(-2 * time.Hour),
			}
			for key, importedAt := range importTimes {
				require.NoError(t, backend.lastImportStore.Save(t.Context(), ResourceLastImportTime{
					NamespacedResource: key, LastImportTime: importedAt,
				}))
			}
			storage := &countingImportTimeBackend{StorageBackend: backend, failBeforeRead: tc.failBeforeRead}
			if tc.readFails {
				storage.readErr = errors.New("import times unavailable")
			}
			stats := []ResourceStats{
				{NamespacedResource: dashboardType("default"), Count: 2},
				{NamespacedResource: folderType("default"), Count: 2},
				{NamespacedResource: dashboardType("stacks-1"), Count: 2},
			}
			var attempts atomic.Int32
			search := &initialBuildTestBackend{beforeBuild: func(_ context.Context, key NamespacedResource, _ BuildIndexOptions) error {
				if key == dashboardType("default") && attempts.Add(1) <= 2 {
					return ErrIndexBuildInProgress
				}
				return nil
			}}
			search.openIndexStats = stats
			server, err := newSearchServer(SearchOptions{
				Backend: search,
				Resources: &TestDocumentBuilderSupplier{GroupsResources: map[string]string{
					"dashboard.grafana.app": "dashboards",
					"folder.grafana.app":    "folders",
				}},
				InitWorkerThreads: 3,
			}, storage, nil, nil, nil, nil, nil, nil, nil, nil)
			require.NoError(t, err)
			server.initRetryInterval = time.Millisecond
			built, err := server.buildIndexes(t.Context())
			require.NoError(t, err)
			require.Equal(t, len(stats), built)
			require.Equal(t, 1, storage.listCalls)
			require.Zero(t, storage.singleCalls, "startup retries must not issue per-key import-time reads")
			require.Equal(t, int32(3), attempts.Load())
			for _, info := range stats {
				want := importTimes[info.NamespacedResource]
				if tc.failBeforeRead {
					want = time.Time{}
				}
				got := search.buildImportTimes[info.NamespacedResource]
				require.NotEmpty(t, got)
				for _, importedAt := range got {
					require.Equal(t, want, importedAt, "timestamp for %s", info.String())
				}
			}
		})
	}
}

func TestStartupWaitsForGlobalBuild(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	backend := &initialBuildTestBackend{beforeBuild: func(ctx context.Context, key NamespacedResource, _ BuildIndexOptions) error {
		if !key.IsGlobal() {
			return nil
		}
		close(started)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-release:
			return nil
		}
	}}
	// Only a global index open before the restart is built at startup.
	backend.openIndexStats = []ResourceStats{
		{NamespacedResource: dashboardType("ns"), Count: 1},
		{NamespacedResource: folderType("ns"), Count: 1},
		{NamespacedResource: GlobalSearchKey("ns"), Count: 2},
	}
	server := newInitialBuildTestServer(t, backend, nil, 1)
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- server.init(ctx) }()
	select {
	case <-started:
	case <-ctx.Done():
		t.Fatal("global build did not start")
	}
	select {
	case err := <-done:
		t.Fatalf("startup finished before the global build: %v", err)
	default:
	}
	close(release)
	require.NoError(t, <-done)
	require.NotNil(t, backend.GetIndex(GlobalSearchKey("ns")))
	require.NotNil(t, backend.GetIndex(dashboardType("ns")))
	require.NotNil(t, backend.GetIndex(folderType("ns")))
}

func TestBackgroundGlobalBuildsStartAfterBlockingIndexes(t *testing.T) {
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	resourceStarted := make(chan struct{})
	releaseResource := make(chan struct{})
	globalStarted := make(chan NamespacedResource, 2)
	releaseGlobals := make(chan struct{})
	backend := &initialBuildTestBackend{beforeBuild: func(ctx context.Context, key NamespacedResource, options BuildIndexOptions) error {
		if !options.SkipIfBuilding {
			return fmt.Errorf("initial builds must not wait for the leader")
		}
		var release <-chan struct{}
		if key.IsGlobal() {
			globalStarted <- key
			release = releaseGlobals
		} else {
			close(resourceStarted)
			release = releaseResource
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-release:
			return nil
		}
	}}
	backend.openIndexStats = []ResourceStats{
		{NamespacedResource: dashboardType("large"), Count: 6},
		{NamespacedResource: GlobalSearchKey("previously-open"), Count: 1},
		{NamespacedResource: GlobalSearchKey("previously-open"), Count: 1},
	}
	server := newInitialBuildTestServer(t, backend, []ResourceStats{
		{NamespacedResource: dashboardType("large"), Count: 6},
		{NamespacedResource: folderType("large"), Count: 5},
		{NamespacedResource: dashboardType("previously-open"), Count: 1},
	}, 1)
	server.globalIndexStartupBuild = false
	server.initMinSize = 10
	done := make(chan error, 1)
	go func() { done <- server.init(ctx) }()
	select {
	case <-resourceStarted:
	case <-ctx.Done():
		t.Fatal("per-resource build did not start")
	}
	select {
	case <-globalStarted:
		t.Fatal("global build started before per-resource initialization finished")
	case err := <-done:
		t.Fatalf("startup finished before the per-resource build: %v", err)
	default:
	}
	close(releaseResource)
	select {
	case err := <-done:
		require.NoError(t, err)
	case <-ctx.Done():
		t.Fatal("startup waited for background global builds")
	}
	select {
	case <-globalStarted:
	case <-ctx.Done():
		t.Fatal("background global build did not start")
	}
	require.NotNil(t, backend.GetIndex(dashboardType("large")))
	for _, namespace := range []string{"previously-open"} {
		rsp, err := server.Search(ctx, &resourcepb.ResourceSearchRequest{
			Options:      &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{Namespace: namespace, Group: GlobalSearchGroup, Resource: GlobalSearchResource}},
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		})
		require.NoError(t, err)
		require.Equal(t, NewServiceUnavailableError("the global search index for this namespace is still being built"), rsp.Error,
			"both queued and active global builds must return 503 without waiting")
	}
	close(releaseGlobals)
	require.Eventually(t, func() bool {
		server.backgroundGlobalBuildsMu.RLock()
		defer server.backgroundGlobalBuildsMu.RUnlock()
		return len(server.backgroundGlobalBuilds) == 0
	}, 5*time.Second, time.Millisecond)
	idx, err := server.getOrCreateIndex(ctx, nil, GlobalSearchKey("previously-open"), "test")
	require.NoError(t, err)
	require.Same(t, backend.GetIndex(GlobalSearchKey("previously-open")), idx)
	backend.mu.Lock()
	calls := slices.Clone(backend.buildIndexCalls)
	backend.mu.Unlock()
	require.ElementsMatch(t, []buildIndexCall{
		{key: dashboardType("large"), size: 6},
		{key: GlobalSearchKey("previously-open"), size: 1},
	}, calls, "only the global index that was open before the restart is built")
	require.Zero(t, server.storage.(*mockStorageBackend).statsCalls.Load(), "saved indexes need no storage stats")
}

// A global index that was not open before the restart costs nothing until it
// is searched: startup neither discovers nor builds it, and its first search
// builds it.
func TestStartupBuildsOnlySavedGlobalIndexes(t *testing.T) {
	for _, tc := range []struct {
		name      string
		openStats []ResourceStats
		want      []buildIndexCall
	}{
		{
			name:      "saved indexes",
			openStats: []ResourceStats{{NamespacedResource: GlobalSearchKey("searched"), Count: 3}},
			want:      []buildIndexCall{{key: GlobalSearchKey("searched"), size: 3}},
		},
		{
			name: "no saved indexes",
			want: []buildIndexCall{{key: dashboardType("searched"), size: 20}, {key: dashboardType("idle"), size: 20}},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			backend := &initialBuildTestBackend{beforeBuild: func(context.Context, NamespacedResource, BuildIndexOptions) error { return nil }}
			backend.openIndexStats = tc.openStats
			server := newInitialBuildTestServer(t, backend, []ResourceStats{
				{NamespacedResource: dashboardType("searched"), Count: 20},
				{NamespacedResource: folderType("searched"), Count: 5},
				{NamespacedResource: dashboardType("idle"), Count: 20},
				{NamespacedResource: folderType("idle"), Count: 5},
			}, 1)
			server.globalIndexStartupBuild = false
			server.initMinSize = 10
			require.NoError(t, server.init(ctx))
			require.Eventually(t, func() bool {
				server.backgroundGlobalBuildsMu.RLock()
				defer server.backgroundGlobalBuildsMu.RUnlock()
				return len(server.backgroundGlobalBuilds) == 0
			}, 5*time.Second, time.Millisecond)

			backend.mu.Lock()
			calls := slices.Clone(backend.buildIndexCalls)
			backend.mu.Unlock()
			require.ElementsMatch(t, tc.want, calls)
			require.Nil(t, backend.GetIndex(GlobalSearchKey("idle")))

			_, err := server.getOrCreateIndex(ctx, nil, GlobalSearchKey("idle"), "test")
			require.NoError(t, err, "the first search builds it, it is not left returning 503")
			require.NotNil(t, backend.GetIndex(GlobalSearchKey("idle")))
		})
	}
}

func TestStartupWaitsForStorageStatsWithoutSavedIndexes(t *testing.T) {
	for _, tc := range []struct {
		name         string
		openStats    []ResourceStats
		loadErr      error
		startupBuild bool
	}{
		{name: "no saved indexes"},
		{name: "invalid saved indexes", openStats: []ResourceStats{{NamespacedResource: dashboardType("known"), Count: 1}}, loadErr: errors.New("invalid saved index list")},
		{name: "foreground mode without saved indexes", startupBuild: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			started := make(chan struct{})
			backend := &initialBuildTestBackend{beforeBuild: func(context.Context, NamespacedResource, BuildIndexOptions) error { return nil }}
			backend.openIndexStats = tc.openStats
			backend.openIndexStatsErr = tc.loadErr
			server := newInitialBuildTestServer(t, backend, nil, 1)
			server.globalIndexStartupBuild = tc.startupBuild
			server.storage.(*mockStorageBackend).beforeStats = func(ctx context.Context, filter NamespacedResource, _, _ int) error {
				close(started)
				<-ctx.Done()
				return ctx.Err()
			}
			done := make(chan error, 1)
			go func() { done <- server.init(ctx) }()
			select {
			case <-started:
			case <-ctx.Done():
				t.Fatal("startup discovery did not start")
			}
			select {
			case err := <-done:
				t.Fatalf("startup finished before required discovery: %v", err)
			default:
			}
			cancel()
			require.ErrorIs(t, <-done, context.Canceled)
		})
	}
}

func TestBackgroundGlobalBuildsRetryWithoutOccupyingWorker(t *testing.T) {
	for _, failure := range []error{ErrIndexBuildInProgress, errors.New("storage unavailable")} {
		t.Run(failure.Error(), func(t *testing.T) {
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			release := make(chan struct{})
			var attempts atomic.Int32
			backend := &initialBuildTestBackend{beforeBuild: func(ctx context.Context, key NamespacedResource, _ BuildIndexOptions) error {
				if key.Namespace != "retry" {
					return nil
				}
				if attempts.Add(1) <= 2 {
					return failure
				}
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-release:
					return nil
				}
			}}
			server := newInitialBuildTestServer(t, backend, []ResourceStats{
				{NamespacedResource: GlobalSearchKey("retry"), Count: 20},
				{NamespacedResource: GlobalSearchKey("other"), Count: 10},
			}, 1)
			server.globalIndexStartupBuild = false
			importedAt := time.Now().Add(-time.Hour)
			server.storage.(*mockStorageBackend).lastImportTimes = []ResourceLastImportTime{{NamespacedResource: GlobalSearchKey("retry"), LastImportTime: importedAt}}
			require.NoError(t, server.init(ctx))
			require.Eventually(t, func() bool {
				return attempts.Load() == 3 && backend.GetIndex(GlobalSearchKey("other")) != nil
			}, 5*time.Second, time.Millisecond)
			_, err := server.getOrCreateIndex(ctx, nil, GlobalSearchKey("retry"), "test")
			require.Equal(t, NewServiceUnavailableError("the global search index for this namespace is still being built"), AsErrorResult(err))
			close(release)
			require.Eventually(t, func() bool {
				return backend.GetIndex(GlobalSearchKey("retry")) != nil
			}, 5*time.Second, time.Millisecond)
			backend.mu.Lock()
			times := slices.Clone(backend.buildImportTimes[GlobalSearchKey("retry")])
			backend.mu.Unlock()
			require.Equal(t, []time.Time{importedAt, importedAt, importedAt}, times)
		})
	}
}

func TestBackgroundGlobalBuildsStopBeforeClosingBackend(t *testing.T) {
	for _, tc := range []struct {
		name    string
		failure error
	}{
		{name: "active build"},
		{name: "held lock", failure: ErrIndexBuildInProgress},
		{name: "failed build", failure: errors.New("storage unavailable")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			started := make(chan struct{})
			var attempts atomic.Int32
			var closedTooEarly atomic.Bool
			backend := &initialBuildTestBackend{}
			backend.beforeBuild = func(ctx context.Context, _ NamespacedResource, _ BuildIndexOptions) error {
				if attempts.Add(1) == 1 {
					close(started)
				}
				if tc.failure != nil {
					return tc.failure
				}
				<-ctx.Done()
				closedTooEarly.Store(backend.stopCalls.Load() != 0)
				return ctx.Err()
			}
			server := newInitialBuildTestServer(t, backend, []ResourceStats{{NamespacedResource: GlobalSearchKey("ns"), Count: 1}}, 1)
			server.globalIndexStartupBuild = false
			server.initRetryInterval = time.Hour
			require.NoError(t, server.init(t.Context()))
			select {
			case <-started:
			case <-time.After(5 * time.Second):
				t.Fatal("background build did not start")
			}
			stopped := make(chan error, 1)
			go func() { stopped <- server.Stop(t.Context()) }()
			select {
			case err := <-stopped:
				require.NoError(t, err)
			case <-time.After(5 * time.Second):
				t.Fatal("shutdown did not cancel background builds and delayed retries")
			}
			require.False(t, closedTooEarly.Load())
			require.Equal(t, int32(1), attempts.Load())
			require.Equal(t, int32(1), backend.stopCalls.Load())
		})
	}
}

func TestSmallGlobalIndexRequestsWaitForSharedBuild(t *testing.T) {
	for _, startupBuild := range []bool{false, true} {
		t.Run(fmt.Sprint(startupBuild), func(t *testing.T) {
			started := make(chan struct{})
			release := make(chan struct{})
			var releaseOnce sync.Once
			var calls atomic.Int32
			backend := &initialBuildTestBackend{beforeBuild: func(_ context.Context, _ NamespacedResource, _ BuildIndexOptions) error {
				if calls.Add(1) == 1 {
					close(started)
				}
				<-release
				return nil
			}}
			server := newInitialBuildTestServer(t, backend, []ResourceStats{
				{NamespacedResource: dashboardType("small"), Count: 1},
				{NamespacedResource: folderType("small"), Count: 1},
			}, 1)
			server.initMinSize = 10
			server.globalIndexStartupBuild = startupBuild
			require.NoError(t, server.init(t.Context()))
			require.Zero(t, calls.Load(), "small indexes should not be prebuilt")

			type result struct {
				index ResourceIndex
				err   error
			}
			results := make(chan result, 10)
			var requests sync.WaitGroup
			t.Cleanup(func() {
				releaseOnce.Do(func() { close(release) })
				requests.Wait()
			})
			for range 10 {
				requests.Go(func() {
					index, err := server.getOrCreateIndex(t.Context(), nil, GlobalSearchKey("small"), "test")
					results <- result{index: index, err: err}
				})
			}
			select {
			case <-started:
			case <-time.After(5 * time.Second):
				t.Fatal("request did not start global initialization")
			}
			select {
			case got := <-results:
				t.Fatalf("request returned before the shared build finished: %v", got.err)
			default:
			}
			releaseOnce.Do(func() { close(release) })
			requests.Wait()
			for range 10 {
				got := <-results
				require.NoError(t, got.err)
				require.Same(t, backend.GetIndex(GlobalSearchKey("small")), got.index)
			}
			require.Equal(t, int32(1), calls.Load())
			require.Equal(t, int32(1), server.storage.(*mockStorageBackend).statsCalls.Load(), "only startup should read resource stats")
		})
	}
}

// A search waits only so long for a global index to be built, then gets 503
// while the build carries on for the next search. Per-resource builds are
// waited for as before.
func TestGlobalIndexBuildWaitIsBounded(t *testing.T) {
	release := make(chan struct{})
	var releaseOnce sync.Once
	t.Cleanup(func() { releaseOnce.Do(func() { close(release) }) })
	var calls atomic.Int32
	backend := &initialBuildTestBackend{beforeBuild: func(_ context.Context, key NamespacedResource, _ BuildIndexOptions) error {
		if key.IsGlobal() {
			calls.Add(1)
			<-release
		}
		return nil
	}}
	server := newInitialBuildTestServer(t, backend, nil, 1)
	server.globalIndexBuildWait = 20 * time.Millisecond
	require.NoError(t, server.init(t.Context()))

	_, err := server.getOrCreateIndex(t.Context(), nil, GlobalSearchKey("large"), "test")
	require.Equal(t, NewServiceUnavailableError("the global search index for this namespace is still being built"), AsErrorResult(err))
	_, err = server.getOrCreateIndex(t.Context(), nil, GlobalSearchKey("large"), "test")
	require.Equal(t, NewServiceUnavailableError("the global search index for this namespace is still being built"), AsErrorResult(err))
	require.Equal(t, int32(1), calls.Load(), "a search that gives up must not start another build")

	releaseOnce.Do(func() { close(release) })
	require.Eventually(t, func() bool { return backend.GetIndex(GlobalSearchKey("large")) != nil }, 5*time.Second, time.Millisecond,
		"the build finishes without the search that started it")
	idx, err := server.getOrCreateIndex(t.Context(), nil, GlobalSearchKey("large"), "test")
	require.NoError(t, err)
	require.Same(t, backend.GetIndex(GlobalSearchKey("large")), idx)

	_, err = server.getOrCreateIndex(t.Context(), nil, dashboardType("large"), "test")
	require.NoError(t, err)
}

// A build a search gave up on keeps running, but not past shutdown: stopping
// the server cancels it and waits for it before closing the backend.
func TestStopEndsBuildsStartedBySearchesBeforeClosingBackend(t *testing.T) {
	started := make(chan struct{})
	var closedTooEarly atomic.Bool
	backend := &initialBuildTestBackend{}
	backend.beforeBuild = func(ctx context.Context, key NamespacedResource, _ BuildIndexOptions) error {
		if !key.IsGlobal() {
			return nil
		}
		close(started)
		<-ctx.Done()
		closedTooEarly.Store(backend.stopCalls.Load() != 0)
		return ctx.Err()
	}
	server := newInitialBuildTestServer(t, backend, nil, 1)
	server.globalIndexBuildWait = 10 * time.Millisecond
	require.NoError(t, server.init(t.Context()))

	_, err := server.getOrCreateIndex(t.Context(), nil, GlobalSearchKey("ns"), "test")
	require.Equal(t, NewServiceUnavailableError("the global search index for this namespace is still being built"), AsErrorResult(err))
	select {
	case <-started:
	case <-time.After(5 * time.Second):
		t.Fatal("the search did not start a build")
	}

	stopped := make(chan error, 1)
	go func() { stopped <- server.Stop(t.Context()) }()
	select {
	case err := <-stopped:
		require.NoError(t, err)
	case <-time.After(5 * time.Second):
		t.Fatal("shutdown did not end the build")
	}
	require.False(t, closedTooEarly.Load(), "the backend was closed while the build was still running")
	require.Equal(t, int32(1), backend.stopCalls.Load())

	_, err = server.getOrCreateIndex(t.Context(), nil, GlobalSearchKey("other"), "test")
	require.Error(t, err, "no build starts once the server is stopping")
}

func TestStartupReportsGlobalBuildErrors(t *testing.T) {
	failure := errors.New("cannot build global index")
	backend := &initialBuildTestBackend{beforeBuild: func(_ context.Context, _ NamespacedResource, _ BuildIndexOptions) error {
		return failure
	}}
	server := newInitialBuildTestServer(t, backend, []ResourceStats{{NamespacedResource: GlobalSearchKey("ns"), Count: 1}}, 1)
	require.ErrorIs(t, server.init(t.Context()), failure)
}

func TestStartupCancellationFinishesBeforeClosingBackend(t *testing.T) {
	started := make(chan struct{})
	var closedTooEarly atomic.Bool
	backend := &initialBuildTestBackend{}
	backend.beforeBuild = func(ctx context.Context, _ NamespacedResource, _ BuildIndexOptions) error {
		close(started)
		<-ctx.Done()
		closedTooEarly.Store(backend.stopCalls.Load() != 0)
		return ctx.Err()
	}
	server := newInitialBuildTestServer(t, backend, []ResourceStats{{NamespacedResource: GlobalSearchKey("ns"), Count: 1}}, 1)
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- server.init(ctx) }()
	select {
	case <-started:
	case <-time.After(5 * time.Second):
		t.Fatal("global build did not start")
	}
	cancel()
	require.ErrorIs(t, <-done, context.Canceled)
	require.NoError(t, server.Stop(t.Context()))
	require.False(t, closedTooEarly.Load())
	require.Equal(t, int32(1), backend.stopCalls.Load())
}

func TestInitialIndexBuildsRespectConcurrencyLimit(t *testing.T) {
	for _, startupBuild := range []bool{false, true} {
		t.Run(fmt.Sprint(startupBuild), func(t *testing.T) {
			started := make(chan struct{}, 5)
			release := make(chan struct{})
			backend := &initialBuildTestBackend{beforeBuild: func(ctx context.Context, _ NamespacedResource, _ BuildIndexOptions) error {
				started <- struct{}{}
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-release:
					return nil
				}
			}}
			stats := make([]ResourceStats, 5)
			for i := range stats {
				stats[i] = ResourceStats{NamespacedResource: GlobalSearchKey(fmt.Sprintf("ns-%d", i)), Count: 1}
			}
			server := newInitialBuildTestServer(t, backend, stats, 2)
			server.globalIndexStartupBuild = startupBuild
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			done := make(chan error, 1)
			go func() { done <- server.init(ctx) }()
			for range 2 {
				select {
				case <-started:
				case <-ctx.Done():
					t.Fatal("initial build workers did not start")
				}
			}
			select {
			case <-started:
				t.Fatal("more than two builds started at once")
			case <-time.After(25 * time.Millisecond):
			}
			close(release)
			require.NoError(t, <-done)
			require.Eventually(t, func() bool {
				return !slices.ContainsFunc(stats, func(info ResourceStats) bool {
					return backend.GetIndex(info.NamespacedResource) == nil
				})
			}, 5*time.Second, time.Millisecond)
		})
	}
}

func TestStartupCancellationWhileWaitingForLeader(t *testing.T) {
	attempted := make(chan struct{})
	var once sync.Once
	backend := &initialBuildTestBackend{beforeBuild: func(_ context.Context, _ NamespacedResource, _ BuildIndexOptions) error {
		once.Do(func() { close(attempted) })
		return ErrIndexBuildInProgress
	}}
	server := newInitialBuildTestServer(t, backend, []ResourceStats{{NamespacedResource: dashboardType("ns"), Count: 1}}, 1)
	server.initRetryInterval = time.Hour
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- server.init(ctx) }()
	select {
	case <-attempted:
	case <-time.After(5 * time.Second):
		t.Fatal("startup did not try to acquire the build lock")
	}
	cancel()
	select {
	case err := <-done:
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(5 * time.Second):
		t.Fatal("startup did not cancel its delayed retry")
	}
}

func TestStartupStillReportsPerResourceBuildErrors(t *testing.T) {
	failure := errors.New("cannot build resource index")
	backend := &initialBuildTestBackend{beforeBuild: func(_ context.Context, _ NamespacedResource, _ BuildIndexOptions) error {
		return failure
	}}
	server := newInitialBuildTestServer(t, backend, []ResourceStats{{NamespacedResource: dashboardType("ns"), Count: 1}}, 1)
	require.ErrorIs(t, server.init(t.Context()), failure)
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

func TestBuildIndexesWhenResourceStatsFail(t *testing.T) {
	openStats := []ResourceStats{
		{NamespacedResource: dashboardType("ns"), Count: 5},
		{NamespacedResource: GlobalSearchKey("ns"), Count: 5},
	}
	for _, tc := range []struct {
		name      string
		openStats []ResourceStats
		loadErr   error
		wantErr   bool
	}{
		{name: "restore local indexes", openStats: openStats},
		{name: "no local indexes", wantErr: true},
		{name: "local stats failed", openStats: openStats, loadErr: errors.New("open index stats unavailable"), wantErr: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			failure := errors.New("resource stats unavailable")
			storage := &mockStorageBackend{statsErr: failure}
			search := &manifestSearchBackend{
				mockSearchBackend: mockSearchBackend{reusesFromDisk: true},
				stats:             tc.openStats,
				ok:                true,
				loadErr:           tc.loadErr,
			}
			server, err := newSearchServer(SearchOptions{
				Backend: search,
				Resources: &TestDocumentBuilderSupplier{GroupsResources: map[string]string{
					"dashboard.grafana.app": "dashboards",
				}},
				InitMinCount:            10,
				GlobalIndexEnabled:      true,
				GlobalIndexStartupBuild: true,
			}, storage, nil, nil, nil, nil, nil, nil, nil, nil)
			require.NoError(t, err)

			built, err := server.buildIndexes(t.Context())
			require.Equal(t, int32(1), search.loadCall.Load())
			if tc.wantErr {
				require.Equal(t, int32(1), storage.statsCalls.Load())
				require.ErrorIs(t, err, failure)
				require.Zero(t, built)
				require.Empty(t, search.buildIndexCalls)
				return
			}
			require.NoError(t, err)
			require.Zero(t, storage.statsCalls.Load(), "saved indexes need no storage stats")
			require.Equal(t, len(tc.openStats), built)
			want := make([]buildIndexCall, 0, len(tc.openStats))
			for _, info := range tc.openStats {
				want = append(want, buildIndexCall{key: info.NamespacedResource, size: info.Count})
				require.NotNil(t, search.GetIndex(info.NamespacedResource))
			}
			require.ElementsMatch(t, want, search.buildIndexCalls)
		})
	}
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
	for range concurrency {
		wg.Go(func() {
			<-start
			_, _ = support.getOrCreateIndex(context.Background(), nil, NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}, "test")
		})
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
	require.Equal(t, int32(1), storage.lastImportTimeCalls.Load())
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

func TestSortableTrashResourceVersionIsRecordedButNotRequired(t *testing.T) {
	require.Contains(t, CurrentIndexFeatures(), IndexFeatureSortableTrashResourceVersion)
	require.NotContains(t, TrashIndexFeatures(), IndexFeatureSortableTrashResourceVersion)
	for _, postRankAuthz := range []bool{false, true} {
		require.NotContains(t, RequiredIndexFeatures(postRankAuthz), IndexFeatureSortableTrashResourceVersion)
	}
}

// Every index built now keeps deleted documents, and records it, so a reader can
// tell it from an older index that keeps none.
func TestCurrentIndexFeaturesHoldDeletedDocuments(t *testing.T) {
	require.Contains(t, CurrentIndexFeatures(), IndexFeatureHoldsDeletedDocuments)
	require.Contains(t, IndexReaderRequirements(), IndexFeatureHoldsDeletedDocuments)
}

// Anything this binary builds with, it must also know how to read, or it would
// refuse its own indexes.
func TestKnownIndexFeaturesCoverCurrent(t *testing.T) {
	for _, current := range CurrentIndexFeatures() {
		require.Contains(t, knownIndexFeatures, current)
	}
}

// Declaring a requirement this binary cannot read would reject every index it
// builds.
func TestReaderRequiredFeaturesAreKnown(t *testing.T) {
	require.Empty(t, UnknownIndexRequirements(IndexReaderRequirements()))
}

func TestUnknownIndexRequirements(t *testing.T) {
	// An index built before requirements were recorded.
	require.Empty(t, UnknownIndexRequirements(nil))

	// Refused by name, so an older instance needs no knowledge of the feature.
	require.Equal(t, []IndexFeature{"feature-from-the-future"},
		UnknownIndexRequirements([]IndexFeature{IndexFeatureDeletedMarker, "feature-from-the-future"}))
}

// TestRequiredIndexFeaturesStoredFacets covers the gating that keeps the stored
// facet mapping from rebuilding indexes where post-rank authorization is off.
func TestRequiredIndexFeaturesStoredFacets(t *testing.T) {
	require.NotContains(t, RequiredIndexFeatures(false), IndexFeatureStoredFacets)
	require.Contains(t, RequiredIndexFeatures(true), IndexFeatureStoredFacets)

	// An index built before the stored facet mapping is reused with the option
	// off, and rebuilt once it is on.
	buildInfo := IndexBuildInfo{Features: slices.Concat(TrashIndexFeatures(), []IndexFeature{IndexFeatureHoldsDeletedDocuments})}
	require.Empty(t, MissingIndexFeatures(buildInfo, RequiredIndexFeatures(false)))
	require.Equal(t, []IndexFeature{IndexFeatureStoredFacets}, MissingIndexFeatures(buildInfo, RequiredIndexFeatures(true)))
}

// An index missing the trash mappings must be rebuilt rather than serve an empty
// trash, whatever the facet option is set to.
func TestTrashIndexFeaturesAreRequired(t *testing.T) {
	buildInfo := IndexBuildInfo{Features: []IndexFeature{IndexFeatureStoredFacets}}
	want := slices.Sorted(slices.Values(slices.Concat(TrashIndexFeatures(), []IndexFeature{IndexFeatureHoldsDeletedDocuments})))
	for _, postRankAuthz := range []bool{false, true} {
		require.Equal(t, want, MissingIndexFeatures(buildInfo, RequiredIndexFeatures(postRankAuthz)))
	}
}

// An index that maps the trash fields but was built before deleted documents were kept
// holds none, so it has to rebuild rather than report an empty trash.
func TestHoldingDeletedDocumentsIsRequired(t *testing.T) {
	buildInfo := IndexBuildInfo{Features: TrashIndexFeatures()}
	require.Equal(t,
		[]IndexFeature{IndexFeatureHoldsDeletedDocuments},
		MissingIndexFeatures(buildInfo, RequiredIndexFeatures(false)))
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
		"build time equal to last import time": {
			buildInfo:       IndexBuildInfo{BuildTime: now},
			lastImportTime:  now,
			expectedRebuild: true,
		},
		"build and import in the same second": {
			buildInfo:       IndexBuildInfo{BuildTime: now.Truncate(time.Second)},
			lastImportTime:  now.Truncate(time.Second).Add(500 * time.Millisecond),
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

type countingImportTimeBackend struct {
	StorageBackend
	listCalls      int
	singleCalls    int
	readErr        error
	failBeforeRead bool
}

func (b *countingImportTimeBackend) ListResourceLastImportTimes(ctx context.Context) (map[NamespacedResource]time.Time, error) {
	b.listCalls++
	if b.failBeforeRead {
		return nil, b.readErr
	}
	times, err := b.StorageBackend.ListResourceLastImportTimes(ctx)
	if err != nil {
		return times, err
	}
	return times, b.readErr
}

func (b *countingImportTimeBackend) GetResourceLastImportTime(ctx context.Context, key NamespacedResource) (time.Time, error) {
	b.singleCalls++
	return b.StorageBackend.GetResourceLastImportTime(ctx, key)
}

func TestScanForIndexesToRebuildReadsImportTimesOnce(t *testing.T) {
	for _, namespaces := range []int{0, 1, 840} {
		t.Run(fmt.Sprintf("%d namespaces", namespaces), func(t *testing.T) {
			backend := setupTestStorageBackend(t)
			storage := &countingImportTimeBackend{StorageBackend: backend}
			now := time.Now().UTC().Truncate(time.Second)
			importTime := now.Add(-time.Minute)
			require.NoError(t, backend.lastImportStore.Save(t.Context(), ResourceLastImportTime{
				NamespacedResource: dashboardType("ns-0"), LastImportTime: importTime,
			}))
			require.NoError(t, backend.lastImportStore.Save(t.Context(), ResourceLastImportTime{
				NamespacedResource: folderType("ns-0"), LastImportTime: now.Add(-10 * time.Minute),
			}))
			search := &mockSearchBackend{cache: make(map[NamespacedResource]ResourceIndex)}
			server := globalTestServer(t, storage, search)
			for i := range namespaces {
				ns := fmt.Sprintf("ns-%d", i)
				for _, key := range []NamespacedResource{dashboardType(ns), GlobalSearchKey(ns)} {
					fields, hash, _ := server.searchFields.ForKey(key)
					idx := &MockResourceIndex{
						buildInfo:           IndexBuildInfo{BuildTime: now.Add(-5 * time.Minute), SelectableFields: fields, SearchFieldsHash: hash},
						completedTypeBuilds: heldAt(time.Time{}, time.Time{}),
						reconciledAt:        now,
					}
					if i == 0 {
						idx.completedTypeBuilds = heldAt(now.Add(-10*time.Minute), now.Add(-10*time.Minute))
					}
					search.openIndexes = append(search.openIndexes, key)
					search.cache[key] = idx
				}
			}

			server.scanForIndexesToRebuild(t.Context(), true)
			server.scanForIndexesToRebuild(t.Context(), true)

			require.Zero(t, search.getIndexCalls, "background scans must not refresh index idle timestamps")
			require.Equal(t, 2, storage.listCalls)
			require.Zero(t, storage.singleCalls)
			queued := server.rebuildQueue.Elements()
			if namespaces == 0 {
				require.Empty(t, queued)
				return
			}
			require.Len(t, queued, 2)
			for _, req := range queued {
				if req.IsGlobal() {
					require.Equal(t, GlobalSearchKey("ns-0"), req.NamespacedResource)
					require.Equal(t, []schema.GroupResource{dashboardsGroupResource}, req.staleTypes)
				} else {
					require.Equal(t, dashboardType("ns-0"), req.NamespacedResource)
					require.Equal(t, importTime, req.lastImportTime)
				}
			}
		})
	}
}

func TestScanForIndexesToRebuildContinuesAfterImportTimeReadError(t *testing.T) {
	for _, failBeforeRead := range []bool{false, true} {
		t.Run(fmt.Sprintf("fail before read=%t", failBeforeRead), func(t *testing.T) {
			backend := setupTestStorageBackend(t)
			now := time.Now().UTC().Truncate(time.Second)
			require.NoError(t, backend.lastImportStore.Save(t.Context(), ResourceLastImportTime{
				NamespacedResource: dashboardType("namespace"), LastImportTime: now,
			}))
			storage := &countingImportTimeBackend{
				StorageBackend: backend, readErr: errors.New("storage unavailable"), failBeforeRead: failBeforeRead,
			}
			search := &mockSearchBackend{cache: make(map[NamespacedResource]ResourceIndex)}
			server := globalTestServer(t, storage, search)
			server.maxIndexAge = time.Hour
			for _, key := range []NamespacedResource{dashboardType("namespace"), GlobalSearchKey("namespace"), folderType("namespace")} {
				fields, hash, _ := server.searchFields.ForKey(key)
				search.openIndexes = append(search.openIndexes, key)
				search.cache[key] = &MockResourceIndex{
					buildInfo:           IndexBuildInfo{BuildTime: now.Add(-2 * time.Hour), SelectableFields: fields, SearchFieldsHash: hash},
					completedTypeBuilds: heldAt(time.Time{}, time.Time{}),
					reconciledAt:        now,
				}
			}

			server.scanForIndexesToRebuild(t.Context(), true)

			require.Equal(t, 1, storage.listCalls)
			require.Zero(t, storage.singleCalls, "a failed batch must not cause per-type reads")
			queued := server.rebuildQueue.Elements()
			if failBeforeRead {
				require.Len(t, queued, 1, "age-based rebuilds still run without import times")
				require.Equal(t, folderType("namespace"), queued[0].NamespacedResource)
			} else {
				require.Len(t, queued, 3, "available import times still trigger both kinds of index rebuild")
			}
		})
	}
}

func TestStartupScanDoesNotQueueFullRebuilds(t *testing.T) {
	storage := &mockStorageBackend{lastImportTimes: importedAt(importTuesday, importMonday)}
	search := &mockSearchBackend{
		openIndexes: []NamespacedResource{dashboardType("ns"), GlobalSearchKey("ns")},
		cache: map[NamespacedResource]ResourceIndex{
			dashboardType("ns"): &MockResourceIndex{buildInfo: IndexBuildInfo{BuildTime: importMonday}},
			GlobalSearchKey("ns"): &MockResourceIndex{
				buildInfo:           IndexBuildInfo{BuildTime: importMonday},
				completedTypeBuilds: heldAt(importMonday, importMonday),
				reconciledAt:        time.Now(),
			},
		},
	}
	server := globalTestServer(t, storage, search)

	server.scanForIndexesToRebuild(t.Context(), false)

	queued := server.rebuildQueue.Elements()
	require.Len(t, queued, 1)
	require.Equal(t, GlobalSearchKey("ns"), queued[0].NamespacedResource)
	require.Equal(t, []schema.GroupResource{dashboardsGroupResource}, queued[0].staleTypes)
	require.True(t, queued[0].lastImportTime.IsZero(), "only the imported type is queued, not a full rebuild")
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
			// to GetOpenIndexes and the call to PeekIndex.
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
	require.Zero(t, search.getIndexCalls, "rebuild inspection must not refresh index idle timestamps")
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
	// None of these kinds declares fields, so the standard fields' hash is expected.
	for i := range expected {
		expected[i].expectedSearchFieldsHash = StandardSearchFieldsHash()
	}
	if diff := cmp.Diff(expected, vals, cmpopts.IgnoreFields(rebuildRequest{}, "completeChannels"), cmp.AllowUnexported(rebuildRequest{})); diff != "" {
		t.Errorf("rebuildQueue mismatch (-want +got):\n%s", diff)
	}
}

func TestRebuildIndexesIgnoresUnrelatedInvalidImportTime(t *testing.T) {
	backend := setupTestStorageBackend(t)
	storage := &countingImportTimeBackend{StorageBackend: backend}
	now := time.Now().UTC().Truncate(time.Second)
	importTime := now.Add(-time.Minute)
	require.NoError(t, backend.lastImportStore.Save(t.Context(), ResourceLastImportTime{
		NamespacedResource: dashboardType("namespace"), LastImportTime: importTime,
	}))
	writer, err := backend.kv.Save(t.Context(), lastImportTimesSection, "unrelated~invalid-key")
	require.NoError(t, err)
	_, err = writer.Write([]byte{1})
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	_, err = backend.ListResourceLastImportTimes(t.Context())
	require.Error(t, err, "a whole-store read fails on the unrelated record")

	search := &mockSearchBackend{cache: make(map[NamespacedResource]ResourceIndex)}
	server := globalTestServer(t, storage, search)
	keys := make([]*resourcepb.ResourceKey, 0, 2)
	for _, key := range []NamespacedResource{dashboardType("namespace"), GlobalSearchKey("namespace")} {
		fields, hash, _ := server.searchFields.ForKey(key)
		search.cache[key] = &MockResourceIndex{
			buildInfo:           IndexBuildInfo{BuildTime: now, SelectableFields: fields, SearchFieldsHash: hash},
			completedTypeBuilds: heldAt(importTime, time.Time{}),
		}
		keys = append(keys, &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource})
	}

	response, err := server.RebuildIndexes(t.Context(), &resourcepb.RebuildIndexesRequest{
		Namespace: "namespace", Keys: keys,
	})

	require.NoError(t, err)
	require.Nil(t, response.Error)
	require.Zero(t, response.RebuildCount, "both requested indexes have caught up with their imports")
	require.Len(t, response.BuildTimes, len(keys))
	require.Zero(t, storage.listCalls, "explicit rebuilds must not read unrelated records")
	require.Equal(t, len(keys)+len(GlobalSearchResourceTypes()), storage.singleCalls)
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

type failingRebuildSearchBackend struct {
	mockSearchBackend
	buildCalls atomic.Int32
}

func (m *failingRebuildSearchBackend) BuildIndex(context.Context, NamespacedResource, int64, string, BuildFn, UpdateFn, bool, time.Time, time.Duration, BuildIndexOptions) (ResourceIndex, error) {
	m.buildCalls.Add(1)
	return nil, fmt.Errorf("index rebuild failed")
}

func TestRebuildIndexesRejectsStaleIndexAfterFailedRebuild(t *testing.T) {
	key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}
	importTime := time.Unix(1_700_000_000, 0)
	storage := &mockStorageBackend{
		lastImportTimes: []ResourceLastImportTime{{NamespacedResource: key, LastImportTime: importTime}},
	}
	search := &failingRebuildSearchBackend{mockSearchBackend: mockSearchBackend{
		cache: map[NamespacedResource]ResourceIndex{
			key: &MockResourceIndex{buildInfo: IndexBuildInfo{BuildTime: importTime}},
		},
	}}
	support, err := newSearchServer(SearchOptions{
		Backend:   search,
		Resources: &TestDocumentBuilderSupplier{GroupsResources: map[string]string{"group": "resource"}},
	}, storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NoError(t, support.init(t.Context()))
	defer support.stop()

	request := &resourcepb.RebuildIndexesRequest{
		Namespace: key.Namespace,
		Keys:      []*resourcepb.ResourceKey{{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource}},
	}
	rsp, err := support.RebuildIndexes(t.Context(), request)
	require.NoError(t, err)
	require.Equal(t, int64(1), rsp.RebuildCount)
	require.Equal(t, int32(1), search.buildCalls.Load())
	require.Empty(t, rsp.BuildTimes)
	require.ErrorContains(t, ErrorFromResponse(rsp.GetError(), nil), "not built after last import")
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
		for range 1000 {
			require.NoError(t, s.maybeInjectFailure())
		}
	})

	t.Run("always fails when percent is 100", func(t *testing.T) {
		s := &searchServer{injectFailuresPercent: 100}
		for range 100 {
			err := s.maybeInjectFailure()
			require.Error(t, err)
			require.Equal(t, "injected search failure", err.Error())
		}
	})
}

func TestSearchRejectsNonFieldValueResultFormats(t *testing.T) {
	s := &searchServer{}
	for _, format := range []resourcepb.ResourceSearchRequest_ResultFormat{
		resourcepb.ResourceSearchRequest_UNSPECIFIED,
		resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
		resourcepb.ResourceSearchRequest_ResultFormat(99),
	} {
		t.Run(format.String(), func(t *testing.T) {
			response, err := s.Search(t.Context(), &resourcepb.ResourceSearchRequest{ResultFormat: format})
			require.Nil(t, response)
			require.Equal(t, codes.InvalidArgument, status.Code(err))
			require.ErrorContains(t, err, "search result format must be FIELD_VALUES")
		})
	}
}

func TestSearchUsesRequestScopedFolderIndex(t *testing.T) {
	folderKey := NamespacedResource{Namespace: "default", Group: "folder.grafana.app", Resource: "folders"}
	dashKey := NamespacedResource{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"}
	for _, tc := range []struct {
		name         string
		primary      NamespacedResource
		recursive    bool
		federated    bool
		refreshError bool
		wantFolder   bool
	}{
		{name: "non-recursive", primary: dashKey},
		{name: "recursive", primary: dashKey, recursive: true, wantFolder: true},
		{name: "folder search", primary: folderKey, recursive: true},
		{name: "federated folder search", primary: dashKey, recursive: true, federated: true, wantFolder: true},
		{name: "global search", primary: GlobalSearchKey("default"), recursive: true},
		{name: "folder refresh failure", primary: dashKey, recursive: true, refreshError: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			primary := &recordingIndex{MockResourceIndex: &MockResourceIndex{}}
			folderIndex := ResourceIndex(&MockResourceIndex{})
			if tc.primary == folderKey {
				folderIndex = primary
			}
			if tc.refreshError {
				folderIndex.(*MockResourceIndex).updateIndexError = errors.New("folder refresh failed")
			}
			backend := &mockSearchBackend{cache: map[NamespacedResource]ResourceIndex{folderKey: folderIndex, tc.primary: primary}}
			s := &searchServer{search: backend, globalIndexEnabled: true, indexMetrics: ProvideIndexMetrics(nil), log: log.NewNopLogger()}
			field := SEARCH_FIELD_FOLDER
			if tc.recursive {
				field = SEARCH_FIELD_FOLDER_TREE
			}
			req := &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: tc.primary.Namespace, Group: tc.primary.Group, Resource: tc.primary.Resource},
				Fields: []*resourcepb.Requirement{{Key: field, Operator: "in", Values: []string{"top"}}},
			}}
			if tc.federated {
				req.Federated = []*resourcepb.ResourceKey{{Namespace: folderKey.Namespace, Group: folderKey.Group, Resource: folderKey.Resource}}
			}
			rsp, err := s.searchIndex(t.Context(), NewSearchStats("test"), req, tc.primary, nil)
			require.NoError(t, err)
			if tc.refreshError {
				require.NotNil(t, rsp.Error)
				require.Contains(t, rsp.Error.Message, "folder refresh failed")
				require.Nil(t, primary.req, "a failed folder refresh must prevent searching")
				return
			}
			require.Nil(t, rsp.Error)
			require.Same(t, req, primary.req)
			if tc.wantFolder {
				require.Same(t, folderIndex, primary.indexes.Folders)
			} else {
				require.Nil(t, primary.indexes.Folders)
			}
			wantUpdates := 1
			if tc.primary.IsGlobal() {
				wantUpdates = 0
			}
			require.Equal(t, wantUpdates, primary.updateIndexCalls)
			if folders, ok := folderIndex.(*MockResourceIndex); ok {
				wantFolderUpdates := 0
				if tc.wantFolder {
					wantFolderUpdates = 1
				}
				require.Equal(t, wantFolderUpdates, folders.updateIndexCalls)
			}
			if tc.federated {
				require.Equal(t, []ResourceIndex{folderIndex}, primary.indexes.Federated)
			} else {
				require.Empty(t, primary.indexes.Federated, "the helper must not add folders to the results")
			}
		})
	}
}

func TestSearchResolvesReplacementFolderIndex(t *testing.T) {
	folderKey := NamespacedResource{Namespace: "default", Group: "folder.grafana.app", Resource: "folders"}
	dashKey := NamespacedResource{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"}
	primary := &recordingIndex{MockResourceIndex: &MockResourceIndex{}}
	oldFolders, newFolders := &MockResourceIndex{}, &MockResourceIndex{}
	backend := &mockSearchBackend{cache: map[NamespacedResource]ResourceIndex{dashKey: primary, folderKey: oldFolders}}
	s := &searchServer{search: backend, indexMetrics: ProvideIndexMetrics(nil), log: log.NewNopLogger()}
	req := &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{
		Key:    &resourcepb.ResourceKey{Namespace: dashKey.Namespace, Group: dashKey.Group, Resource: dashKey.Resource},
		Fields: []*resourcepb.Requirement{{Key: SEARCH_FIELD_FOLDER_TREE, Operator: "in", Values: []string{"top"}}},
	}}
	for _, folders := range []*MockResourceIndex{oldFolders, newFolders} {
		backend.cache[folderKey] = folders
		rsp, err := s.searchIndex(t.Context(), NewSearchStats("test"), req, dashKey, nil)
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		require.Same(t, folders, primary.indexes.Folders)
	}
	require.Equal(t, 1, oldFolders.updateIndexCalls)
	require.Equal(t, 1, newFolders.updateIndexCalls)
}

func TestSearchRejectsInvalidFolderTreeBeforeResolvingIndexes(t *testing.T) {
	for _, tc := range []struct {
		name     string
		operator string
		values   []string
		deleted  bool
	}{
		{name: "unsupported operator", operator: "notin", values: []string{"top"}},
		{name: "multiple equality values", operator: "=", values: []string{"top", "other"}},
		{name: "trash", operator: "in", values: []string{"top"}, deleted: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			backend := &mockSearchBackend{}
			s := &searchServer{search: backend}
			rsp, err := s.Search(t.Context(), &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"},
					Fields: []*resourcepb.Requirement{{Key: SEARCH_FIELD_FOLDER_TREE, Operator: tc.operator, Values: tc.values}},
				},
				IsDeleted:    tc.deleted,
				ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			})
			require.NoError(t, err)
			require.NotNil(t, rsp.Error)
			require.Equal(t, int32(http.StatusBadRequest), rsp.Error.Code)
			require.Zero(t, backend.getIndexCalls)
			require.Empty(t, backend.buildIndexCalls)
		})
	}
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
			Limit:        -100,
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
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
			Limit:        10,
			Offset:       -50,
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
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
		Limit:        10,
		IsDeleted:    true,
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
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
		for i := range 100 {
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
	for i := range numIndexes {
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

func (b *blockingSearchBackend) BuildIndex(ctx context.Context, key NamespacedResource, size int64, reason string, builder BuildFn, updater UpdateFn, rebuild bool, lastImportTime time.Time, maxFreshSnapshotAge time.Duration, options BuildIndexOptions) (ResourceIndex, error) {
	b.buildCalls.Add(1)
	b.startedOnce.Do(func() { close(b.onStarted) })
	<-b.proceed
	return b.mockSearchBackend.BuildIndex(ctx, key, size, reason, builder, updater, rebuild, lastImportTime, maxFreshSnapshotAge, options)
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
		indexMetrics:  ProvideIndexMetrics(nil),
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

	require.Equal(t, 1, testutil.CollectAndCount(m.SearchDuration, "grafana_vector_storage_search_duration_seconds"))
}

// TestSearchServer_HybridSearch_ObservesDuration mirrors the VectorSearch
// test above: the Unimplemented path confirms the histogram wiring.
func TestSearchServer_HybridSearch_ObservesDuration(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := ProvideVectorMetrics(reg)
	s := &searchServer{
		log:           log.New("test-hybrid-search"),
		vectorMetrics: m,
		indexMetrics:  ProvideIndexMetrics(nil),
	}

	_, err := s.HybridSearch(context.Background(), &resourcepb.HybridSearchRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: "stack-1",
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
		},
		Query: "test",
	})
	require.Error(t, err)
	require.Equal(t, codes.Unimplemented, status.Code(err))

	require.Equal(t, 1, testutil.CollectAndCount(m.HybridSearchDuration, "grafana_vector_storage_hybrid_search_duration_seconds"))
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
	return fmt.Appendf(nil, `{"apiVersion":"group/v1","kind":"Thing","metadata":{"name":%q},"spec":{"title":%q,"tags":["tag-a"]}}`, name, title)
}

// testDeletedObjectJSON is what storage holds after a delete: the deletion marker
// records who deleted the object as its last updater, and when (see server.go).
func testDeletedObjectJSON(name, title, deletedBy string, deletedAt time.Time) []byte {
	return fmt.Appendf(nil,
		`{"apiVersion":"group/v1","kind":"Thing","metadata":{"name":%q,"deletionTimestamp":%q,"annotations":{%q:%q}},"spec":{"title":%q}}`,
		name, deletedAt.UTC().Format(time.RFC3339), utils.AnnoKeyUpdatedBy, deletedBy, title)
}

func testProvisionedObjectJSON(name, title string) []byte {
	return fmt.Appendf(nil, `{"apiVersion":"group/v1","kind":"Thing","metadata":{"name":%q,"annotations":{%q:"repo"}},"spec":{"title":%q}}`,
		name, utils.AnnoKeyManagerKind, title)
}

// trashSearchOptions returns search options with deleted objects kept in the
// index, which is off by default.
func trashSearchOptions(backend *mockSearchBackend) SearchOptions {
	backend.keepsDeletedDocuments = true
	return SearchOptions{
		Backend:   backend,
		Resources: &TestDocumentBuilderSupplier{GroupsResources: map[string]string{"group": "resource"}},
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

	// The index records the decision, so a test driving indexTrash states it.
	index := &MockResourceIndex{buildInfo: IndexBuildInfo{Features: CurrentIndexFeatures()}}
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

	index := &MockResourceIndex{buildInfo: IndexBuildInfo{Features: CurrentIndexFeatures()}}
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

// On an index built before deleted documents were kept, a delete has to behave as
// it did then: the document is removed and no trash is listed.
func TestDeletedDocumentsAreRemovedOnAnOlderIndex(t *testing.T) {
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
	search.keepsDeletedDocuments = false
	server, err := newSearchServer(options, storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	built, err := server.build(t.Context(), key, 1, "test", false, time.Time{})
	require.NoError(t, err)
	require.Empty(t, built.(*MockResourceIndex).indexedItems(), "no trash should be listed or indexed")
	require.Empty(t, storage.trashReqs)

	search.mu.Lock()
	updater := search.lastUpdater
	search.mu.Unlock()

	index := &MockResourceIndex{buildInfo: IndexBuildInfo{Features: featuresForTestIndex(false)}}
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
	require.Empty(t, doc.Fields)
	require.Empty(t, doc.Labels)
	require.Empty(t, doc.References)
	require.Empty(t, doc.Description)
	require.Nil(t, doc.Manager)
}

// Tags survive a delete, so trash can show them. They are read from the marker's
// spec, the same place live search reads them, and the marker is the whole object
// as it was, so this costs no extra read.
func TestBuildDeletedDocumentKeepsTags(t *testing.T) {
	key := &resourcepb.ResourceKey{Namespace: "ns", Group: "group", Resource: "resource", Name: "gone"}

	// Trash and live search must report the same tags for the same object.
	live, err := (&testDocumentBuilder{}).BuildDocument(t.Context(), key, 10, testObjectJSON("gone", "Gone"))
	require.NoError(t, err)
	require.NotEmpty(t, live.Tags)

	doc, err := buildDeletedDocument(key, 10, testObjectJSON("gone", "Gone"))
	require.NoError(t, err)
	require.Equal(t, live.Tags, doc.Tags)

	// An object with no usable tags is indexed without the field rather than with an
	// empty list, so trash documents are shaped like live ones.
	for name, body := range map[string]string{
		"no tags":         `{"apiVersion":"group/v1","kind":"Thing","metadata":{"name":"gone"},"spec":{"title":"Gone"}}`,
		"empty list":      `{"apiVersion":"group/v1","kind":"Thing","metadata":{"name":"gone"},"spec":{"tags":[]}}`,
		"tags not a list": `{"apiVersion":"group/v1","kind":"Thing","metadata":{"name":"gone"},"spec":{"tags":"prod"}}`,
		"no spec at all":  `{"apiVersion":"group/v1","kind":"Thing","metadata":{"name":"gone"}}`,
	} {
		t.Run(name, func(t *testing.T) {
			doc, err := buildDeletedDocument(key, 10, []byte(body))
			require.NoError(t, err)
			require.Nil(t, doc.Tags)
		})
	}

	// A malformed entry is skipped rather than failing the document, so one bad tag
	// cannot keep a deleted object out of trash.
	t.Run("non-string entries are skipped", func(t *testing.T) {
		body := []byte(`{"apiVersion":"group/v1","kind":"Thing","metadata":{"name":"gone"},"spec":{"title":"Gone","tags":["a",1,null,"b"]}}`)
		doc, err := buildDeletedDocument(key, 10, body)
		require.NoError(t, err)
		require.Equal(t, []string{"a", "b"}, doc.Tags)
	})
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
	require.False(t, server.keepsDeletedDocuments(key, older, log.NewNopLogger()))

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
		require.False(t, server.keepsDeletedDocuments(key, index, log.NewNopLogger()))
	})
}

// Counts builder resolutions, the step that reads usage insights data for real
// dashboards. Only namespaced builders go through it.
type countingBuilderSupplier struct {
	resolved atomic.Int32
}

func (s *countingBuilderSupplier) GetDocumentBuilders(_ *SearchFieldsRegistry) ([]DocumentBuilderInfo, error) {
	return []DocumentBuilderInfo{{
		GroupResource: schema.GroupResource{Group: "group", Resource: "resource"},
		Namespaced: func(_ context.Context, _ string, _ BlobSupport) (DocumentBuilder, error) {
			s.resolved.Add(1)
			return &testDocumentBuilder{}, nil
		},
	}}, nil
}

// Stands in for an index served from a remote snapshot: ready without either
// callback running.
type snapshotSearchBackend struct {
	mockSearchBackend
}

func (m *snapshotSearchBackend) BuildIndex(_ context.Context, key NamespacedResource, size int64, _ string, _ BuildFn, updater UpdateFn, _ bool, _ time.Time, _ time.Duration, _ BuildIndexOptions) (ResourceIndex, error) {
	index := &MockResourceIndex{buildInfo: IndexBuildInfo{Features: featuresForTestIndex(m.keepsDeletedDocuments)}}

	m.mu.Lock()
	defer m.mu.Unlock()
	m.lastUpdater = updater
	if m.cache == nil {
		m.cache = make(map[NamespacedResource]ResourceIndex)
	}
	m.cache[key] = index
	m.buildIndexCalls = append(m.buildIndexCalls, buildIndexCall{key: key, size: size})

	return index, nil
}

// Resolving a builder is expensive, so a build must not do it until something
// actually needs to index documents.
func TestBuildResolvesDocumentBuilderOnFirstUse(t *testing.T) {
	key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}

	t.Run("an index served from a snapshot never resolves the builder", func(t *testing.T) {
		supplier := &countingBuilderSupplier{}
		search := &snapshotSearchBackend{}
		server, err := newSearchServer(SearchOptions{
			Backend:   search,
			Resources: supplier,
		}, &mockStorageBackend{}, nil, nil, nil, nil, nil, nil, nil, nil)
		require.NoError(t, err)

		_, err = server.build(t.Context(), key, 1, "test", false, time.Time{})
		require.NoError(t, err)

		require.Len(t, search.buildIndexCalls, 1, "the index should still have been built")
		require.Zero(t, supplier.resolved.Load(), "no callback ran, so the builder should never have been resolved")
	})

	t.Run("a build that indexes documents resolves the builder", func(t *testing.T) {
		supplier := &countingBuilderSupplier{}
		search := &mockSearchBackend{keepsDeletedDocuments: true}
		storage := &trashStorageBackend{trash: []trashEntry{
			{name: "gone", rv: 10, value: testObjectJSON("gone", "Gone")},
		}}
		server, err := newSearchServer(SearchOptions{
			Backend:   search,
			Resources: supplier,
		}, storage, nil, nil, nil, nil, nil, nil, nil, nil)
		require.NoError(t, err)

		built, err := server.build(t.Context(), key, 1, "test", false, time.Time{})
		require.NoError(t, err)

		require.Len(t, built.(*MockResourceIndex).indexedItems(), 1)
		require.Equal(t, int32(1), supplier.resolved.Load(), "the build callback needs a builder")
	})

	// The cache entry expires while the updater keeps running, so resolving per
	// call would re-read the insights data on most updates.
	t.Run("the builder is resolved once for a build and every later update", func(t *testing.T) {
		supplier := &countingBuilderSupplier{}
		search := &mockSearchBackend{keepsDeletedDocuments: true}
		storage := &trashStorageBackend{
			trash:    []trashEntry{{name: "gone", rv: 10, value: testObjectJSON("gone", "Gone")}},
			modified: []*ModifiedResource{{Action: resourcepb.WatchEvent_ADDED, Key: resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: "added"}, ResourceVersion: 11, Value: testObjectJSON("added", "Added")}},
		}
		server, err := newSearchServer(SearchOptions{
			Backend:   search,
			Resources: supplier,
		}, storage, nil, nil, nil, nil, nil, nil, nil, nil)
		require.NoError(t, err)

		_, err = server.build(t.Context(), key, 1, "test", false, time.Time{})
		require.NoError(t, err)

		search.mu.Lock()
		updater := search.lastUpdater
		search.mu.Unlock()
		require.NotNil(t, updater)

		for i := range 3 {
			index := &MockResourceIndex{buildInfo: IndexBuildInfo{Features: CurrentIndexFeatures()}}
			_, docs, err := updater(t.Context(), index, int64(11+i))
			require.NoError(t, err)
			require.Equal(t, 1, docs)
		}

		require.Equal(t, int32(1), supplier.resolved.Load(), "the builder resolved for the build should be reused by every update")
	})
}

// decodeForTrash skips most of an object, so for any object the trash document has
// to come out as from a full decode, failures included. If the document starts
// reading a field decodeForTrash drops, the first case below fails.
func TestBuildDeletedDocumentMatchesAFullDecode(t *testing.T) {
	key := &resourcepb.ResourceKey{Namespace: "ns", Group: "group", Resource: "resource", Name: "gone"}
	const head = `"apiVersion":"group/v1","kind":"Thing"`

	for name, body := range map[string]string{
		// Fields the document does not read hold values, so reading one shows up.
		"every kind of field": `{` + head + `,
			"metadata":{"name":"gone","labels":{"team":"a"},"deletionTimestamp":"2026-10-01T10:00:00Z",
				"annotations":{"grafana.app/folder":"f1","grafana.app/updatedBy":"user:alice","grafana.app/managedBy":"repo"}},
			"spec":{"title":"Gone","name":"n","tags":["a",1,"b"],"description":"d","panels":[{"id":1,"targets":[{"expr":"up"}]}],"ratio":0.5,"enabled":true,"empty":null},
			"status":{"phase":"ready"}}`,
		"title falls back to name":    `{` + head + `,"spec":{"title":"","name":"Named"}}`,
		"title not a string":          `{` + head + `,"spec":{"title":{"x":1},"name":5}}`,
		"spec null":                   `{` + head + `,"spec":null}`,
		"no metadata":                 `{` + head + `,"spec":{"title":"Gone"}}`,
		"null annotation value":       `{` + head + `,"metadata":{"annotations":{"grafana.app/folder":null,"grafana.app/updatedBy":"user:bob"}}}`,
		"non-string annotation value": `{` + head + `,"metadata":{"annotations":{"grafana.app/updatedBy":7},"deletionTimestamp":"2026-10-01T10:00:00Z"}}`,
		"deletion time unparseable":   `{` + head + `,"metadata":{"deletionTimestamp":"yesterday"}}`,
		"not an object":               `["gone"]`,
		"invalid json":                `{"kind":"Thing",`,
	} {
		t.Run(name, func(t *testing.T) {
			var whole unstructured.Unstructured
			var want *IndexableDocument
			wantErr := whole.UnmarshalJSON([]byte(body))
			if wantErr == nil {
				want, wantErr = deletedDocumentFrom(key, 42, &whole)
			}
			got, err := buildDeletedDocument(key, 42, []byte(body))
			if wantErr != nil {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, want, got)
		})
	}
}
