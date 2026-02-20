package resource

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/Masterminds/semver"
	"github.com/hashicorp/golang-lru/v2/expirable"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/singleflight"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/authlib/types"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/debouncer"
)

const maxBatchSize = 1000

type NamespacedResource struct {
	Namespace string
	Group     string
	Resource  string
}

// All fields are set
func (s *NamespacedResource) Valid() bool {
	return s.Namespace != "" && s.Group != "" && s.Resource != ""
}

func (s *NamespacedResource) String() string {
	return fmt.Sprintf("%s/%s/%s", s.Namespace, s.Group, s.Resource)
}

type IndexAction int

const (
	ActionIndex IndexAction = iota
	ActionDelete
)

type BulkIndexItem struct {
	Action IndexAction
	Key    *resourcepb.ResourceKey // Only used for delete actions
	Doc    *IndexableDocument      // Only used for index actions
}

type BulkIndexRequest struct {
	Items           []*BulkIndexItem
	ResourceVersion int64
}

type IndexBuildInfo struct {
	BuildTime    time.Time       // Timestamp when the index was built. This value doesn't change on subsequent index updates.
	BuildVersion *semver.Version // Grafana version used when originally building the index. This value doesn't change on subsequent index updates.
}

type ResourceIndex interface {
	// BulkIndex allows for multiple index actions to be performed in a single call.
	// The order of the items is guaranteed to be the same as the input
	BulkIndex(req *BulkIndexRequest) error

	// Search within a namespaced resource
	// When working with federated queries, the additional indexes will be passed in explicitly
	Search(ctx context.Context, access types.AccessClient, req *resourcepb.ResourceSearchRequest, federate []ResourceIndex, stats *SearchStats) (*resourcepb.ResourceSearchResponse, error)

	// List within an response
	ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest, stats *SearchStats) (*resourcepb.ListManagedObjectsResponse, error)

	// Counts the values in a repo
	CountManagedObjects(ctx context.Context, stats *SearchStats) ([]*resourcepb.CountManagedObjectsResponse_ResourceCount, error)

	// Get the number of documents in the index
	DocCount(ctx context.Context, folder string, stats *SearchStats) (int64, error)

	// UpdateIndex updates the index with the latest data (using update function provided when index was built) to guarantee strong consistency during the search.
	// Returns RV to which index was updated.
	UpdateIndex(ctx context.Context) (int64, error)

	// BuildInfo returns build information about the index.
	BuildInfo() (IndexBuildInfo, error)
}

type BuildFn func(index ResourceIndex) (int64, error)

// UpdateFn is responsible for updating index with changes since given RV. It should return new RV (to be used as next sinceRV), number of updated documents and error, if any.
type UpdateFn func(context context.Context, index ResourceIndex, sinceRV int64) (newRV int64, updatedDocs int, _ error)

// SearchBackend contains the technology specific logic to support search
type SearchBackend interface {
	// GetIndex returns existing index, or nil.
	GetIndex(key NamespacedResource) ResourceIndex

	// BuildIndex builds an index from scratch.
	// Depending on the size, the backend may choose different options (eg: memory vs disk).
	// The last known resource version can be used to detect that nothing has changed, and existing on-disk index can be reused.
	// The builder will write all documents before returning.
	// Updater function is used to update the index before performing the search.
	// rebuild forces a full rebuild of the index, regardless of state.
	// lastImportTime is used to determine if an existing file-based index needs to be rebuilt before opening.
	BuildIndex(
		ctx context.Context,
		key NamespacedResource,
		size int64,
		nonStandardFields SearchableDocumentFields,
		indexBuildReason string,
		builder BuildFn,
		updater UpdateFn,
		rebuild bool,
		lastImportTime time.Time,
	) (ResourceIndex, error)

	// TotalDocs returns the total number of documents across all indexes.
	TotalDocs() int64

	// GetOpenIndexes returns the list of indexes that are currently open.
	GetOpenIndexes() []NamespacedResource
}

// searchServer supports indexing+search regardless of implementation.
type searchServer struct {
	log          log.Logger
	storage      StorageBackend
	search       SearchBackend
	indexMetrics *BleveIndexMetrics
	access       types.AccessClient
	builders     *builderCache
	initWorkers  int
	initMinSize  int

	ownsIndexFn func(key NamespacedResource) (bool, error)

	buildIndex singleflight.Group

	// since usage insights is not in unified storage, we need to periodically rebuild the index
	// to make sure these data points are up to date.
	dashboardIndexMaxAge time.Duration
	maxIndexAge          time.Duration
	minBuildVersion      *semver.Version

	bgTaskWg     sync.WaitGroup
	bgTaskCancel func()

	rebuildQueue   *debouncer.Queue[rebuildRequest]
	rebuildWorkers int

	backendDiagnostics resourcepb.DiagnosticsServer
}

var (
	_ resourcepb.ResourceIndexServer      = (*searchServer)(nil)
	_ resourcepb.ManagedObjectIndexServer = (*searchServer)(nil)
	_ SearchServer                        = (*searchServer)(nil)
)

// newSearchServer creates a new search server implementation.
func newSearchServer(opts SearchOptions, storage StorageBackend, access types.AccessClient, blob BlobSupport, indexMetrics *BleveIndexMetrics, ownsIndexFn func(key NamespacedResource) (bool, error)) (*searchServer, error) {
	// No backend search support
	if opts.Backend == nil {
		return nil, nil
	}

	if opts.InitWorkerThreads < 1 {
		opts.InitWorkerThreads = 1
	}

	if opts.IndexRebuildWorkers < 1 {
		opts.IndexRebuildWorkers = 1
	}

	if ownsIndexFn == nil {
		ownsIndexFn = func(key NamespacedResource) (bool, error) {
			return true, nil
		}
	}

	s := &searchServer{
		access:         access,
		storage:        storage,
		search:         opts.Backend,
		log:            log.New("resource-search"),
		initWorkers:    opts.InitWorkerThreads,
		rebuildWorkers: opts.IndexRebuildWorkers,
		initMinSize:    opts.InitMinCount,
		indexMetrics:   indexMetrics,
		ownsIndexFn:    ownsIndexFn,

		dashboardIndexMaxAge: opts.DashboardIndexMaxAge,
		maxIndexAge:          opts.MaxIndexAge,
		minBuildVersion:      opts.MinBuildVersion,
	}

	s.rebuildQueue = debouncer.NewQueue(combineRebuildRequests)

	info, err := opts.Resources.GetDocumentBuilders()
	if err != nil {
		return nil, err
	}

	s.builders, err = newBuilderCache(info, 100, time.Minute*2) // TODO? opts
	if s.builders != nil {
		s.builders.blob = blob
	}

	return s, err
}

func combineRebuildRequests(a, b rebuildRequest) (c rebuildRequest, ok bool) {
	if a.NamespacedResource != b.NamespacedResource {
		// We can only combine requests for the same keys.
		return rebuildRequest{}, false
	}

	ret := a

	// Using higher "min build version" is stricter condition, and causes more indexes to be rebuilt.
	if a.minBuildVersion == nil || (b.minBuildVersion != nil && b.minBuildVersion.GreaterThan(a.minBuildVersion)) {
		ret.minBuildVersion = b.minBuildVersion
	}

	// Using higher "min build time" is stricter condition, and causes more indexes to be rebuilt.
	if a.minBuildTime.IsZero() || (!b.minBuildTime.IsZero() && b.minBuildTime.After(a.minBuildTime)) {
		ret.minBuildTime = b.minBuildTime
	}

	// Using higher "last import time" is stricter condition, and causes more indexes to be rebuilt.
	if a.lastImportTime.IsZero() || (!b.lastImportTime.IsZero() && b.lastImportTime.After(a.lastImportTime)) {
		ret.lastImportTime = b.lastImportTime
	}

	// Combine complete channels
	ret.completeChannels = append(a.completeChannels, b.completeChannels...)

	return ret, true
}

func (s *searchServer) ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	ctx, span := tracer.Start(ctx, "resource.searchServer.ListManagedObjects")
	defer span.End()

	if req.NextPageToken != "" {
		return &resourcepb.ListManagedObjectsResponse{
			Error: NewBadRequestError("multiple pages not yet supported"),
		}, nil
	}

	rsp := &resourcepb.ListManagedObjectsResponse{}
	nsr := NamespacedResource{
		Namespace: req.Namespace,
	}
	resourceStats, err := s.storage.GetResourceStats(ctx, nsr, 0)
	if err != nil {
		rsp.Error = AsErrorResult(err)
		return rsp, nil
	}

	stats := NewSearchStats("ListManagedObjects")
	defer s.logStats(ctx, stats, span, "namespace", req.Namespace)

	for _, info := range resourceStats {
		idx, err := s.getOrCreateIndex(ctx, stats, NamespacedResource{
			Namespace: req.Namespace,
			Group:     info.Group,
			Resource:  info.Resource,
		}, "listManagedObjects")
		if err != nil {
			rsp.Error = AsErrorResult(err)
			return rsp, nil
		}

		kind, err := idx.ListManagedObjects(ctx, req, stats)
		if err != nil {
			rsp.Error = AsErrorResult(err)
			return rsp, nil
		}
		if kind.NextPageToken != "" {
			rsp.Error = &resourcepb.ErrorResult{
				Message: "Multiple pages are not yet supported",
			}
			return rsp, nil
		}
		rsp.Items = append(rsp.Items, kind.Items...)
	}

	// Sort based on path
	start := time.Now()
	slices.SortFunc(rsp.Items, func(a, b *resourcepb.ListManagedObjectsResponse_Item) int {
		return cmp.Compare(a.Path, b.Path)
	})
	stats.AddResultsConversionTime(time.Since(start))

	return rsp, nil
}

func (s *searchServer) logStats(ctx context.Context, stats *SearchStats, span trace.Span, params ...any) {
	elapsed := time.Since(stats.startTime)

	args := []any{ //nolint:prealloc
		"operation", stats.operation,
		"elapsedTime", elapsed,
		"indexBuildTime", stats.indexBuildTime,
		"indexUpdateTime", stats.indexUpdateTime,
		"requestConversionTime", stats.requestConversion,
		"searchTime", stats.searchTime,
		"totalHits", stats.totalHits,
		"returnedDocuments", stats.returnedDocuments,
		"resultsConversionTime", stats.resultsConversionTime,
	}
	args = append(args, params...)

	s.log.FromContext(ctx).Debug("Search stats", args...)

	if span != nil {
		attrs := make([]attribute.KeyValue, 0, len(args)/2)
		for i := 0; i < len(args); i += 2 {
			attrs = append(attrs, attribute.String(fmt.Sprint(args[i]), fmt.Sprint(args[i+1])))
		}
		span.AddEvent("search stats", trace.WithAttributes(attrs...))
	}
}

func (s *searchServer) CountManagedObjects(ctx context.Context, req *resourcepb.CountManagedObjectsRequest) (*resourcepb.CountManagedObjectsResponse, error) {
	ctx, span := tracer.Start(ctx, "resource.searchServer.CountManagedObjects")
	defer span.End()

	stats := NewSearchStats("CountManagedObjects")
	defer s.logStats(ctx, stats, span, "namespace", req.Namespace)

	rsp := &resourcepb.CountManagedObjectsResponse{}
	nsr := NamespacedResource{
		Namespace: req.Namespace,
	}
	resourceStats, err := s.storage.GetResourceStats(ctx, nsr, 0)
	if err != nil {
		rsp.Error = AsErrorResult(err)
		return rsp, nil
	}

	for _, info := range resourceStats {
		idx, err := s.getOrCreateIndex(ctx, stats, NamespacedResource{
			Namespace: req.Namespace,
			Group:     info.Group,
			Resource:  info.Resource,
		}, "countManagedObjects")
		if err != nil {
			rsp.Error = AsErrorResult(err)
			return rsp, nil
		}

		counts, err := idx.CountManagedObjects(ctx, stats)
		if err != nil {
			rsp.Error = AsErrorResult(err)
			return rsp, nil
		}
		if req.Id == "" {
			rsp.Items = append(rsp.Items, counts...)
		} else {
			for _, k := range counts {
				if k.Id == req.Id {
					rsp.Items = append(rsp.Items, k)
				}
			}
		}
	}

	// Sort based on manager/group/resource
	slices.SortFunc(rsp.Items, func(a, b *resourcepb.CountManagedObjectsResponse_ResourceCount) int {
		return cmp.Or(
			cmp.Compare(a.Kind, b.Kind),
			cmp.Compare(a.Id, b.Id),
			cmp.Compare(a.Group, b.Group),
			cmp.Compare(a.Resource, b.Resource),
		)
	})

	return rsp, nil
}

// Search implements ResourceIndexServer.
func (s *searchServer) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	ctx, span := tracer.Start(ctx, "resource.searchServer.Search")
	defer span.End()

	if req.Options.Key.Namespace == "" || req.Options.Key.Group == "" || req.Options.Key.Resource == "" {
		return &resourcepb.ResourceSearchResponse{
			Error: NewBadRequestError("missing namespace, group or resource"),
		}, nil
	}

	if req.Limit < 0 {
		return &resourcepb.ResourceSearchResponse{
			Error: NewBadRequestError("limit cannot be negative"),
		}, nil
	}

	if req.Offset < 0 {
		return &resourcepb.ResourceSearchResponse{
			Error: NewBadRequestError("offset cannot be negative"),
		}, nil
	}

	stats := NewSearchStats("Search")
	defer s.logStats(ctx, stats, span, "namespace", req.Options.Key.Namespace, "group", req.Options.Key.Group, "resource", req.Options.Key.Resource, "query", req.Query)

	nsr := NamespacedResource{
		Group:     req.Options.Key.Group,
		Namespace: req.Options.Key.Namespace,
		Resource:  req.Options.Key.Resource,
	}
	idx, err := s.getOrCreateIndex(ctx, stats, nsr, "search")
	if err != nil {
		return &resourcepb.ResourceSearchResponse{
			Error: AsErrorResult(err),
		}, nil
	}

	// Get the federated indexes
	federate := make([]ResourceIndex, len(req.Federated))
	for i, f := range req.Federated {
		nsr.Group = f.Group
		nsr.Resource = f.Resource
		federate[i], err = s.getOrCreateIndex(ctx, stats, nsr, "federatedSearch")
		if err != nil {
			return &resourcepb.ResourceSearchResponse{
				Error: AsErrorResult(err),
			}, nil
		}
	}

	return idx.Search(ctx, s.access, req, federate, stats)
}

// GetStats implements ResourceServer.
func (s *searchServer) GetStats(ctx context.Context, req *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
	ctx, span := tracer.Start(ctx, "resource.searchServer.GetStats")
	defer span.End()

	if req.Namespace == "" {
		return &resourcepb.ResourceStatsResponse{
			Error: NewBadRequestError("missing namespace"),
		}, nil
	}

	stats := NewSearchStats("GetStats")
	defer s.logStats(ctx, stats, span, "namespace", req.Namespace, "group", strings.Join(req.Kinds, ","), "folder", req.Folder)

	rsp := &resourcepb.ResourceStatsResponse{}

	// Explicit list of kinds
	if len(req.Kinds) > 0 {
		rsp.Stats = make([]*resourcepb.ResourceStatsResponse_Stats, len(req.Kinds))
		for i, k := range req.Kinds {
			parts := strings.SplitN(k, "/", 2)
			index, err := s.getOrCreateIndex(ctx, stats, NamespacedResource{
				Namespace: req.Namespace,
				Group:     parts[0],
				Resource:  parts[1],
			}, "getStats")
			if err != nil {
				rsp.Error = AsErrorResult(err)
				return rsp, nil
			}
			count, err := index.DocCount(ctx, req.Folder, stats)
			if err != nil {
				rsp.Error = AsErrorResult(err)
				return rsp, nil
			}
			rsp.Stats[i] = &resourcepb.ResourceStatsResponse_Stats{
				Group:    parts[0],
				Resource: parts[1],
				Count:    count,
			}
		}
		return rsp, nil
	}

	nsr := NamespacedResource{
		Namespace: req.Namespace,
	}
	resourceStats, err := s.storage.GetResourceStats(ctx, nsr, 0)
	if err != nil {
		return &resourcepb.ResourceStatsResponse{
			Error: AsErrorResult(err),
		}, nil
	}
	rsp.Stats = make([]*resourcepb.ResourceStatsResponse_Stats, len(resourceStats))

	// When not filtered by folder or repository, we can use the results directly
	if req.Folder == "" {
		for i, stat := range resourceStats {
			rsp.Stats[i] = &resourcepb.ResourceStatsResponse_Stats{
				Group:    stat.Group,
				Resource: stat.Resource,
				Count:    stat.Count,
			}
		}
		return rsp, nil
	}

	for i, stat := range resourceStats {
		index, err := s.getOrCreateIndex(ctx, stats, NamespacedResource{
			Namespace: req.Namespace,
			Group:     stat.Group,
			Resource:  stat.Resource,
		}, "getStats")
		if err != nil {
			rsp.Error = AsErrorResult(err)
			return rsp, nil
		}
		count, err := index.DocCount(ctx, req.Folder, stats)
		if err != nil {
			rsp.Error = AsErrorResult(err)
			return rsp, nil
		}
		rsp.Stats[i] = &resourcepb.ResourceStatsResponse_Stats{
			Group:    stat.Group,
			Resource: stat.Resource,
			Count:    count,
		}
	}
	return rsp, nil
}

func (s *searchServer) RebuildIndexes(ctx context.Context, req *resourcepb.RebuildIndexesRequest) (*resourcepb.RebuildIndexesResponse, error) {
	ctx, span := tracer.Start(ctx, "resource.searchServer.RebuildIndexes")
	defer span.End()

	filterKeys := make([]NamespacedResource, 0, len(req.Keys))
	for _, key := range req.Keys {
		if req.Namespace != key.Namespace {
			return &resourcepb.RebuildIndexesResponse{
				Error: NewBadRequestError("key namespace does not match request namespace"),
			}, nil
		}
		filterKeys = append(filterKeys, NamespacedResource{
			Namespace: key.Namespace,
			Group:     key.Group,
			Resource:  key.Resource,
		})
	}

	importTimes, err := s.getLastImportTimes(ctx)
	if err != nil {
		return &resourcepb.RebuildIndexesResponse{
			Error: AsErrorResult(err),
		}, nil
	}

	completeChs := s.findIndexesToRebuild(importTimes, filterKeys, time.Now())
	rebuildCount := len(completeChs)
	for _, ch := range completeChs {
		select {
		case <-ch:
			continue
		case <-ctx.Done(): // request was done before all indexes rebuilt
			return &resourcepb.RebuildIndexesResponse{
				RebuildCount: int64(rebuildCount),
				Details:      fmt.Sprintf("returning before all index rebuilds completed for %d indexes", rebuildCount),
			}, nil
		}
	}

	buildTimes := make([]*resourcepb.RebuildIndexesResponse_IndexBuildTime, 0)
	for _, key := range filterKeys {
		idx := s.search.GetIndex(key)
		if idx == nil {
			continue
		}
		bi, err := idx.BuildInfo()
		if err != nil {
			s.log.Warn("failed to get build info for index", "key", key, "error", err)
			continue
		}
		if !bi.BuildTime.IsZero() {
			buildTimes = append(buildTimes, &resourcepb.RebuildIndexesResponse_IndexBuildTime{
				Group:         key.Group,
				Resource:      key.Resource,
				BuildTimeUnix: bi.BuildTime.Unix(),
			})
		}
	}

	// All rebuilds completed successfully
	return &resourcepb.RebuildIndexesResponse{
		RebuildCount: int64(rebuildCount),
		Details:      fmt.Sprintf("completed %d index rebuilds", rebuildCount),
		BuildTimes:   buildTimes,
	}, nil
}

func (s *searchServer) buildIndexes(ctx context.Context) (int, error) {
	totalBatchesIndexed := 0
	group := errgroup.Group{}
	group.SetLimit(s.initWorkers)

	stats, err := s.storage.GetResourceStats(ctx, NamespacedResource{}, s.initMinSize)
	if err != nil {
		return 0, err
	}

	for _, info := range stats {
		own, err := s.ownsIndexFn(info.NamespacedResource)
		if err != nil {
			s.log.Warn("failed to check index ownership, building index", "namespace", info.Namespace, "group", info.Group, "resource", info.Resource, "error", err)
		} else if !own {
			s.log.Debug("skip building index", "namespace", info.Namespace, "group", info.Group, "resource", info.Resource)
			continue
		}

		group.Go(func() error {
			totalBatchesIndexed++

			s.log.Debug("building index", "namespace", info.Namespace, "group", info.Group, "resource", info.Resource)
			reason := "init"
			_, err := s.build(ctx, info.NamespacedResource, info.Count, reason, false, time.Time{})
			return err
		})
	}

	err = group.Wait()
	if err != nil {
		return totalBatchesIndexed, err
	}

	return totalBatchesIndexed, nil
}

func (s *searchServer) init(ctx context.Context) error {
	origCtx := ctx

	ctx, span := tracer.Start(ctx, "resource.searchServer.init")
	defer span.End()
	start := time.Now().Unix()

	totalBatchesIndexed, err := s.buildIndexes(ctx)
	if err != nil {
		return err
	}

	span.AddEvent("namespaces indexed", trace.WithAttributes(attribute.Int("namespaced_indexed", totalBatchesIndexed)))

	subctx, cancel := context.WithCancel(origCtx)

	s.bgTaskCancel = cancel
	for i := 0; i < s.rebuildWorkers; i++ {
		s.bgTaskWg.Add(1)
		go s.runIndexRebuilder(subctx)
	}

	s.bgTaskWg.Add(1)
	go s.runPeriodicScanForIndexesToRebuild(subctx)

	end := time.Now().Unix()
	s.log.Info("search index initialized", "duration_secs", end-start, "total_docs", s.search.TotalDocs())
	return nil
}

func (s *searchServer) stop() {
	// Stop background tasks.
	s.bgTaskCancel()
	s.bgTaskWg.Wait()
}

// Init initializes the search server.
func (s *searchServer) Init(ctx context.Context) error {
	return s.init(ctx)
}

// Stop stops the search server.
func (s *searchServer) Stop(ctx context.Context) error {
	s.stop()
	return nil
}

// IsHealthy returns the health status of the search server.
func (s *searchServer) IsHealthy(ctx context.Context, req *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	// add search-specific health checks here if needed
	if s.backendDiagnostics == nil {
		return resourcepb.UnimplementedDiagnosticsServer{}.IsHealthy(ctx, req)
	}
	return s.backendDiagnostics.IsHealthy(ctx, req)
}

func (s *searchServer) runPeriodicScanForIndexesToRebuild(ctx context.Context) {
	defer s.bgTaskWg.Done()

	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			s.log.Info("stopping periodic index rebuild due to context cancellation")
			return
		case <-ticker.C:
			importTimes, err := s.getLastImportTimes(ctx)
			if err != nil {
				s.log.Error("failed to get import times", "error", err)
			}
			s.findIndexesToRebuild(importTimes, nil, time.Now())
		}
	}
}

func (s *searchServer) findIndexesToRebuild(lastImportTimes map[NamespacedResource]time.Time, filterKeys []NamespacedResource, now time.Time) []chan struct{} {
	// Check all open indexes and see if any of them need to be rebuilt.
	// This is done periodically to make sure that the indexes are up to date.

	var keys []NamespacedResource
	if filterKeys != nil {
		keys = filterKeys
	} else {
		keys = s.search.GetOpenIndexes()
	}

	var completeChs []chan struct{}
	for _, key := range keys {
		idx := s.search.GetIndex(key)
		if idx == nil {
			// This can happen if index was closed in the meantime.
			continue
		}

		maxAge := s.maxIndexAge
		if key.Resource == dashboardv1.DASHBOARD_RESOURCE {
			maxAge = s.dashboardIndexMaxAge
		}

		var minBuildTime time.Time
		if maxAge > 0 {
			minBuildTime = now.Add(-maxAge)
		}

		lastImportTime := lastImportTimes[key] // Will be time.Time{} if not found.

		bi, err := idx.BuildInfo()
		if err != nil {
			s.log.Error("failed to get build info for index to rebuild", "key", key, "error", err)
			continue
		}

		if shouldRebuildIndex(bi, s.minBuildVersion, minBuildTime, lastImportTime, nil) {
			completeCh := make(chan struct{})
			completeChs = append(completeChs, completeCh)
			rebuildReq := newRebuildRequest(key, minBuildTime, lastImportTime, s.minBuildVersion, completeCh)
			s.rebuildQueue.Add(rebuildReq)

			if s.indexMetrics != nil {
				s.indexMetrics.RebuildQueueLength.Set(float64(s.rebuildQueue.Len()))
			}
		}
	}
	return completeChs
}

func (s *searchServer) getLastImportTimes(ctx context.Context) (map[NamespacedResource]time.Time, error) {
	result := map[NamespacedResource]time.Time{}
	for importTime, err := range s.storage.GetResourceLastImportTimes(ctx) {
		if err != nil {
			// We return times that we have collected so far, if any.
			return result, err
		}
		result[importTime.NamespacedResource] = importTime.LastImportTime
	}
	return result, nil
}

// runIndexRebuilder is a goroutine waiting for rebuild requests, and rebuilds indexes specified in those requests.
// Rebuild requests can be generated periodically (if configured), or after new documents have been imported into the storage with old RVs.
func (s *searchServer) runIndexRebuilder(ctx context.Context) {
	defer s.bgTaskWg.Done()

	for {
		req, err := s.rebuildQueue.Next(ctx)
		if err != nil {
			s.log.Info("index rebuilder stopped", "error", err)
			return
		}

		if s.indexMetrics != nil {
			s.indexMetrics.RebuildQueueLength.Set(float64(s.rebuildQueue.Len()))
		}

		s.rebuildIndex(ctx, req)
	}
}

func (s *searchServer) rebuildIndex(ctx context.Context, req rebuildRequest) {
	ctx, span := tracer.Start(ctx, "resource.searchServer.rebuildIndex")
	defer span.End()

	l := s.log.New("namespace", req.Namespace, "group", req.Group, "resource", req.Resource)

	defer func() {
		for _, ch := range req.completeChannels {
			close(ch)
		}
	}()

	idx := s.search.GetIndex(req.NamespacedResource)
	if idx == nil {
		span.AddEvent("index not found")
		l.Error("index not found")
		return
	}

	bi, err := idx.BuildInfo()
	if err != nil {
		span.RecordError(err)
		l.Error("failed to get build info for index to rebuild", "error", err)
	}

	rebuild := shouldRebuildIndex(bi, req.minBuildVersion, req.minBuildTime, req.lastImportTime, l)
	if !rebuild {
		span.AddEvent("index not rebuilt")
		l.Info("index doesn't need to be rebuilt")
		return
	}

	if req.Resource == dashboardv1.DASHBOARD_RESOURCE {
		// we need to clear the cache to make sure we get the latest usage insights data
		s.builders.clearNamespacedCache(req.NamespacedResource)
	}

	// Get the correct value of size + RV for building the index. This is important for our Bleve
	// backend to decide whether to build index in-memory or as file-based.
	nsr := NamespacedResource{
		Namespace: req.Namespace,
		Group:     req.Group,
		Resource:  req.Resource,
	}
	stats, err := s.storage.GetResourceStats(ctx, nsr, 0)
	if err != nil {
		span.RecordError(fmt.Errorf("failed to get resource stats: %w", err))
		l.Error("failed to get resource stats", "error", err)
		return
	}

	size := int64(0)
	for _, stat := range stats {
		if stat.Namespace == req.Namespace && stat.Group == req.Group && stat.Resource == req.Resource {
			size = stat.Count
			break
		}
	}

	// Pass rebuild=true to force rebuild of any existing file-based index
	_, err = s.build(ctx, req.NamespacedResource, size, "rebuild", true, time.Time{})
	if err != nil {
		span.RecordError(err)
		l.Error("failed to rebuild index", "error", err)
	}
}

func shouldRebuildIndex(buildInfo IndexBuildInfo, minBuildVersion *semver.Version, minBuildTime time.Time, lastImportTime time.Time, rebuildLogger log.Logger) bool {
	if !minBuildTime.IsZero() {
		if buildInfo.BuildTime.IsZero() || buildInfo.BuildTime.Before(minBuildTime) {
			if rebuildLogger != nil {
				rebuildLogger.Info("index build time is before minBuildTime, rebuilding the index", "indexBuildTime", buildInfo.BuildTime, "minBuildTime", minBuildTime)
			}
			return true
		}
	}

	// This is technically the same as minBuildTime, but we want to log a different message to make the rebuild reason clear.
	if !lastImportTime.IsZero() {
		if buildInfo.BuildTime.IsZero() || buildInfo.BuildTime.Before(lastImportTime) {
			if rebuildLogger != nil {
				rebuildLogger.Info("index build time is before lastImportTime, rebuilding the index", "indexBuildTime", buildInfo.BuildTime, "lastImportTime", lastImportTime)
			}
			return true
		}
	}

	if minBuildVersion != nil {
		if buildInfo.BuildVersion == nil || buildInfo.BuildVersion.Compare(minBuildVersion) < 0 {
			if rebuildLogger != nil {
				rebuildLogger.Info("index build version is before minBuildVersion, rebuilding the index", "indexBuildVersion", buildInfo.BuildVersion, "minBuildVersion", minBuildVersion)
			}
			return true
		}
	}

	return false
}

type rebuildRequest struct {
	NamespacedResource

	minBuildTime    time.Time       // if not zero, rebuild index if it has been built before this timestamp
	lastImportTime  time.Time       // if not zero, rebuild index if it has been built before this timestamp.
	minBuildVersion *semver.Version // if not nil, rebuild index with build version older than this.

	completeChannels []chan<- struct{} // signal rebuild index is complete
}

func newRebuildRequest(key NamespacedResource, minBuildTime, lastImportTime time.Time, minBuildVersion *semver.Version, completeCh chan<- struct{}) rebuildRequest {
	var completeChannels []chan<- struct{} // setup a list as requests can be combined
	if completeCh != nil {
		completeChannels = []chan<- struct{}{completeCh}
	}
	return rebuildRequest{
		NamespacedResource: key,
		minBuildTime:       minBuildTime,
		minBuildVersion:    minBuildVersion,
		lastImportTime:     lastImportTime,
		completeChannels:   completeChannels,
	}
}

func (s *searchServer) getOrCreateIndex(ctx context.Context, stats *SearchStats, key NamespacedResource, reason string) (ResourceIndex, error) {
	if s == nil || s.search == nil {
		return nil, fmt.Errorf("search is not configured properly (missing enable_search config?)")
	}

	ctx, span := tracer.Start(ctx, "resource.searchServer.getOrCreateIndex")
	defer span.End()
	span.SetAttributes(
		attribute.String("namespace", key.Namespace),
		attribute.String("group", key.Group),
		attribute.String("resource", key.Resource),
		attribute.String("namespace", key.Namespace),
	)

	idx := s.search.GetIndex(key)
	if idx == nil {
		span.AddEvent("Building index")
		buildStartTime := time.Now()
		ch := s.buildIndex.DoChan(key.String(), func() (interface{}, error) {
			// We want to finish building of the index even if original context is canceled.
			// We reuse original context without cancel to keep the tracing spans correct.
			ctx := context.WithoutCancel(ctx)

			// Recheck if some other goroutine managed to build an index in the meantime.
			// (That is, it finished running this function and stored the index into the cache)
			idx := s.search.GetIndex(key)
			if idx != nil {
				return idx, nil
			}

			// Get correct value of size + RV for building the index. This is important for our Bleve
			// backend to decide whether to build index in-memory or as file-based.
			nsr := NamespacedResource{
				Namespace: key.Namespace,
			}
			stats, err := s.storage.GetResourceStats(ctx, nsr, 0)
			if err != nil {
				return nil, fmt.Errorf("failed to get resource stats: %w", err)
			}

			size := int64(0)
			for _, stat := range stats {
				if stat.Namespace == key.Namespace && stat.Group == key.Group && stat.Resource == key.Resource {
					size = stat.Count
					break
				}
			}

			// Get last import time to pass to BuildIndex, which will check if the file-based
			// index needs to be rebuilt before opening it.
			var lastImportTime time.Time
			importTimes, err := s.getLastImportTimes(ctx)
			if err != nil {
				s.log.FromContext(ctx).Warn("failed to get last import times", "error", err)
				// Continue without import time check
			} else {
				lastImportTime = importTimes[key]
			}

			idx, err = s.build(ctx, key, size, reason, false, lastImportTime)
			if err != nil {
				return nil, fmt.Errorf("error building search index, %w", err)
			}
			if idx == nil {
				return nil, fmt.Errorf("nil index after build")
			}

			return idx, nil
		})

		select {
		case res := <-ch:
			if res.Err != nil {
				return nil, tracing.Error(span, res.Err)
			}
			stats.AddIndexBuildTime(time.Since(buildStartTime))
			idx = res.Val.(ResourceIndex)
		case <-ctx.Done():
			return nil, tracing.Error(span, fmt.Errorf("failed to get index: %w", ctx.Err()))
		}
	}

	span.AddEvent("Updating index")
	start := time.Now()
	rv, err := idx.UpdateIndex(ctx)
	if err != nil {
		return nil, tracing.Error(span, fmt.Errorf("failed to update index to guarantee strong consistency: %w", err))
	}
	elapsed := time.Since(start)
	stats.AddIndexUpdateTime(elapsed)
	if s.indexMetrics != nil {
		s.indexMetrics.SearchUpdateWaitTime.WithLabelValues(reason).Observe(elapsed.Seconds())
	}
	s.log.FromContext(ctx).Debug("Index updated before search", "namespace", key.Namespace, "group", key.Group, "resource", key.Resource, "reason", reason, "duration", elapsed, "rv", rv)
	span.AddEvent("Index updated")

	return idx, nil
}

func (s *searchServer) build(ctx context.Context, nsr NamespacedResource, size int64, indexBuildReason string, rebuild bool, lastImportTime time.Time) (ResourceIndex, error) {
	ctx, span := tracer.Start(ctx, "resource.searchServer.build")
	defer span.End()

	span.SetAttributes(
		attribute.String("namespace", nsr.Namespace),
		attribute.String("group", nsr.Group),
		attribute.String("resource", nsr.Resource),
		attribute.Int64("size", size),
	)

	logger := s.log.New("namespace", nsr.Namespace, "group", nsr.Group, "resource", nsr.Resource)

	builder, err := s.builders.get(ctx, nsr)
	if err != nil {
		return nil, err
	}
	fields := s.builders.GetFields(nsr)

	builderFn := func(index ResourceIndex) (int64, error) {
		span := trace.SpanFromContext(ctx)
		span.AddEvent("building index", trace.WithAttributes(attribute.Int64("size", size), attribute.String("reason", indexBuildReason)))

		listRV, err := s.storage.ListIterator(ctx, &resourcepb.ListRequest{
			Limit: 1000000000000, // big number
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Group:     nsr.Group,
					Resource:  nsr.Resource,
					Namespace: nsr.Namespace,
				},
			},
		}, func(iter ListIterator) error {
			// Process documents in batches to avoid memory issues
			// When dealing with large collections (e.g., 100k+ documents),
			// loading all documents into memory at once can cause OOM errors.
			items := make([]*BulkIndexItem, 0, maxBatchSize)

			for iter.Next() {
				if err = iter.Error(); err != nil {
					return err
				}

				// Update the key name
				key := &resourcepb.ResourceKey{
					Group:     nsr.Group,
					Resource:  nsr.Resource,
					Namespace: nsr.Namespace,
					Name:      iter.Name(),
				}

				span.AddEvent("building document", trace.WithAttributes(attribute.String("name", iter.Name())))
				// Convert it to an indexable document
				doc, err := builder.BuildDocument(ctx, key, iter.ResourceVersion(), iter.Value())
				if err != nil {
					span.RecordError(err)
					logger.Error("error building search document", "key", SearchID(key), "err", err)
					continue
				}

				// Add to bulk items
				items = append(items, &BulkIndexItem{
					Action: ActionIndex,
					Doc:    doc,
				})

				// When we reach the batch size, perform bulk index and reset the batch.
				if len(items) >= maxBatchSize {
					span.AddEvent("bulk indexing", trace.WithAttributes(attribute.Int("count", len(items))))
					if err = index.BulkIndex(&BulkIndexRequest{Items: items}); err != nil {
						return err
					}

					items = items[:0]
				}
			}

			// Index any remaining items in the final batch.
			if len(items) > 0 {
				span.AddEvent("bulk indexing", trace.WithAttributes(attribute.Int("count", len(items))))
				if err = index.BulkIndex(&BulkIndexRequest{Items: items}); err != nil {
					return err
				}
			}
			return iter.Error()
		})
		return listRV, err
	}

	updaterFn := func(ctx context.Context, index ResourceIndex, sinceRV int64) (int64, int, error) {
		span := trace.SpanFromContext(ctx)
		span.AddEvent("updating index", trace.WithAttributes(attribute.Int64("sinceRV", sinceRV)))

		rv, it := s.storage.ListModifiedSince(ctx, NamespacedResource{
			Group:     nsr.Group,
			Resource:  nsr.Resource,
			Namespace: nsr.Namespace,
		}, sinceRV)

		// Process documents in batches to avoid memory issues
		// When dealing with large collections (e.g., 100k+ documents),
		// loading all documents into memory at once can cause OOM errors.
		items := make([]*BulkIndexItem, 0, maxBatchSize)

		docs := 0
		for res, err := range it {
			// Finish quickly if context is done.
			if ctx.Err() != nil {
				return 0, 0, ctx.Err()
			}

			docs++

			if err != nil {
				span.RecordError(err)
				return 0, 0, err
			}

			key := &res.Key
			switch res.Action {
			case resourcepb.WatchEvent_ADDED, resourcepb.WatchEvent_MODIFIED:
				span.AddEvent("building document", trace.WithAttributes(attribute.String("name", res.Key.Name)))
				// Convert it to an indexable document
				doc, err := builder.BuildDocument(ctx, key, res.ResourceVersion, res.Value)
				if err != nil {
					span.RecordError(err)
					logger.Error("error building search document", "key", SearchID(key), "err", err)
					continue
				}

				items = append(items, &BulkIndexItem{
					Action: ActionIndex,
					Doc:    doc,
				})
			case resourcepb.WatchEvent_DELETED:
				span.AddEvent("deleting document", trace.WithAttributes(attribute.String("name", res.Key.Name)))
				items = append(items, &BulkIndexItem{
					Action: ActionDelete,
					Key:    &res.Key,
				})
			default:
				logger.Error("can't update index with item, unknown action", "action", res.Action, "key", key)
				continue
			}

			// When we reach the batch size, perform bulk index and reset the batch.
			if len(items) >= maxBatchSize {
				span.AddEvent("bulk indexing", trace.WithAttributes(attribute.Int("count", len(items))))
				if err = index.BulkIndex(&BulkIndexRequest{Items: items}); err != nil {
					return 0, 0, err
				}

				items = items[:0]
			}
		}

		// Index any remaining items in the final batch.
		if len(items) > 0 {
			span.AddEvent("bulk indexing", trace.WithAttributes(attribute.Int("count", len(items))))
			if err = index.BulkIndex(&BulkIndexRequest{Items: items}); err != nil {
				return 0, 0, err
			}
		}

		return rv, docs, nil
	}

	// If lastImportTime is set and this is a dashboard resource, clear the cache
	// to ensure we get the latest usage insights data when rebuilding
	if !lastImportTime.IsZero() && nsr.Resource == dashboardv1.DASHBOARD_RESOURCE {
		s.builders.clearNamespacedCache(nsr)
	}

	index, err := s.search.BuildIndex(ctx, nsr, size, fields, indexBuildReason, builderFn, updaterFn, rebuild, lastImportTime)

	if err != nil {
		return nil, err
	}

	// Record the number of objects indexed for the kind/resource
	// We don't pass searchStats to DocCount here, as it's not really user-initiated search. Time spent
	// here will be recorded in the index build time instead.
	docCount, err := index.DocCount(ctx, "", nil)
	if err != nil {
		logger.Warn("error getting doc count", "error", err)
	}
	if s.indexMetrics != nil {
		s.indexMetrics.IndexedKinds.WithLabelValues(nsr.Resource).Add(float64(docCount))
	}

	return index, err
}

type builderCache struct {
	// The default builder
	defaultBuilder DocumentBuilder

	// Possible blob support
	blob BlobSupport

	// searchable fields initialized once on startup
	fields map[schema.GroupResource]SearchableDocumentFields

	// lookup by group, then resource (namespace)
	// This is only modified at startup, so we do not need mutex for access
	lookup map[string]map[string]DocumentBuilderInfo

	// For namespaced based resources that require a cache
	ns *expirable.LRU[NamespacedResource, DocumentBuilder]
	mu sync.Mutex // only locked for a cache miss
}

func newBuilderCache(cfg []DocumentBuilderInfo, nsCacheSize int, ttl time.Duration) (*builderCache, error) {
	cache := &builderCache{
		fields: make(map[schema.GroupResource]SearchableDocumentFields),
		lookup: make(map[string]map[string]DocumentBuilderInfo),
		ns:     expirable.NewLRU[NamespacedResource, DocumentBuilder](nsCacheSize, nil, ttl),
	}
	if len(cfg) == 0 {
		return cache, fmt.Errorf("no builders configured")
	}

	for _, b := range cfg {
		// the default
		if b.GroupResource.Group == "" && b.GroupResource.Resource == "" {
			if b.Builder == nil {
				return cache, fmt.Errorf("default document builder is missing")
			}
			cache.defaultBuilder = b.Builder
			continue
		}
		g, ok := cache.lookup[b.GroupResource.Group]
		if !ok {
			g = make(map[string]DocumentBuilderInfo)
			cache.lookup[b.GroupResource.Group] = g
		}
		g[b.GroupResource.Resource] = b

		// Any custom fields
		cache.fields[b.GroupResource] = b.Fields
	}
	return cache, nil
}

func (s *builderCache) GetFields(key NamespacedResource) SearchableDocumentFields {
	return s.fields[schema.GroupResource{Group: key.Group, Resource: key.Resource}]
}

// context is typically background.  Holds an LRU cache for a
func (s *builderCache) get(ctx context.Context, key NamespacedResource) (DocumentBuilder, error) {
	g, ok := s.lookup[key.Group]
	if ok {
		r, ok := g[key.Resource]
		if ok {
			if r.Builder != nil {
				return r.Builder, nil
			}

			// The builder needs context
			builder, ok := s.ns.Get(key)
			if ok {
				return builder, nil
			}
			{
				s.mu.Lock()
				defer s.mu.Unlock()

				b, err := r.Namespaced(ctx, key.Namespace, s.blob)
				if err == nil {
					_ = s.ns.Add(key, b)
				}
				return b, err
			}
		}
	}
	return s.defaultBuilder, nil
}

// AsResourceKey converts the given namespace and type to a search key
func AsResourceKey(ns string, t string) (*resourcepb.ResourceKey, error) {
	if ns == "" {
		return nil, fmt.Errorf("missing namespace")
	}
	switch t {
	case "folders", "folder":
		return &resourcepb.ResourceKey{
			Namespace: ns,
			Group:     folders.GROUP,
			Resource:  folders.RESOURCE,
		}, nil
	case "dashboards", "dashboard":
		return &resourcepb.ResourceKey{
			Namespace: ns,
			Group:     dashboardv1.GROUP,
			Resource:  dashboardv1.DASHBOARD_RESOURCE,
		}, nil

	// NOT really supported in the dashboard search UI, but useful for manual testing
	case "playlist", "playlists":
		return &resourcepb.ResourceKey{
			Namespace: ns,
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
		}, nil
	}

	return nil, fmt.Errorf("unknown resource type")
}

func (s *builderCache) clearNamespacedCache(key NamespacedResource) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ns.Remove(key)
}

// Test utilities for document building

// testDocumentBuilder implements DocumentBuilder for testing
type testDocumentBuilder struct{}

func (b *testDocumentBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*IndexableDocument, error) {
	// convert value to unstructured.Unstructured
	var u unstructured.Unstructured
	if err := u.UnmarshalJSON(value); err != nil {
		return nil, fmt.Errorf("failed to unmarshal value: %w", err)
	}

	title := ""
	tags := []string{}
	val := ""

	spec, ok, _ := unstructured.NestedMap(u.Object, "spec")
	if ok {
		if v, ok := spec["title"]; ok {
			title = v.(string)
		}
		if v, ok := spec["tags"]; ok {
			if tagSlice, ok := v.([]interface{}); ok {
				tags = make([]string, len(tagSlice))
				for i, tag := range tagSlice {
					if strTag, ok := tag.(string); ok {
						tags[i] = strTag
					}
				}
			}
		}
		if v, ok := spec["value"]; ok {
			val = v.(string)
		}
	}
	return &IndexableDocument{
		Key: &resourcepb.ResourceKey{
			Namespace: key.Namespace,
			Group:     key.Group,
			Resource:  key.Resource,
			Name:      u.GetName(),
		},
		Title: title,
		Tags:  tags,
		Fields: map[string]interface{}{
			"value": val,
		},
	}, nil
}

// TestDocumentBuilderSupplier implements DocumentBuilderSupplier for testing
type TestDocumentBuilderSupplier struct {
	GroupsResources map[string]string
}

func (s *TestDocumentBuilderSupplier) GetDocumentBuilders() ([]DocumentBuilderInfo, error) {
	builders := make([]DocumentBuilderInfo, 0, len(s.GroupsResources))

	// Add builders for all possible group/resource combinations
	for group, resourceType := range s.GroupsResources {
		builders = append(builders, DocumentBuilderInfo{
			GroupResource: schema.GroupResource{
				Group:    group,
				Resource: resourceType,
			},
			Builder: &testDocumentBuilder{},
		})
	}

	return builders, nil
}
