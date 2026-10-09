package service

import (
	"cmp"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"hash/fnv"
	"math/rand"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Masterminds/semver/v3"
	resource "github.com/grafana/grafana/pkg/storage/unified/resource"
	resourcecontract "github.com/grafana/grafana/pkg/storage/unified/resource/contract"
	searchmetrics "github.com/grafana/grafana/pkg/storage/unified/search/metrics"
	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"
	"github.com/hashicorp/golang-lru/v2/expirable"

	gocache "github.com/patrickmn/go-cache"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/authlib/types"
	otelcodes "go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/singleflight"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
	"github.com/grafana/grafana/pkg/util/debouncer"
)

const maxBatchSize = 1000

// listEverything is the limit an index build passes to say "no limit". Backends
// take req.Limit+1 to spot a next page, so MaxInt64 would overflow; this is far
// past any real resource count.
const listEverything = 1000000000000

// openIndexStatsMaxAge is how far back startup accepts the local open index list.
const openIndexStatsMaxAge = time.Hour

// unknownBuildSize is passed when the caller does not have a cheap size hint.
// Backends should treat it as unknown, not as an empty resource.
const unknownBuildSize int64 = -1

const (
	defaultVectorSearchLimit = 50
	maxVectorSearchLimit     = 200
	// authz BatchCheck enforces a per-request cap; chunk to stay under it.
	batchCheckChunkSize = 50
)

// globalIndexReconcileInterval is how often a global index is compared with
// storage, which repairs what replaying changes cannot. See
// reconcileGlobalIndex.
const globalIndexReconcileInterval = time.Hour

// globalReconcileWorkers is how many global index reconciles run at once. They
// have their own workers, so the burst after a restart, when every reopened
// index is reconciled, does not hold up rebuilds.
const globalReconcileWorkers = 2

// searchServer supports indexing+search regardless of implementation.
type searchServer struct {
	log           log.Logger
	storage       resource.StorageReader
	vectorBackend vector.VectorBackend
	// Lexical leg for external collections (internal use bleve); nil = unsupported.
	// Interim until bleve indexes external kinds — then external routes down
	// the existing bleve leg and this field (and the FTS impl) gets deleted.
	externalLexical vector.LexicalSearcher
	embedder        *embedder.Embedder
	reranker        *rerank.Reranker
	search          searchmodel.SearchBackend
	indexMetrics    *searchmetrics.ServiceMetrics
	vectorMetrics   *searchmetrics.VectorMetrics
	access          types.AccessClient
	builders        *builderCache
	initWorkers     int
	initMinSize     int

	queryCache             vector.QueryEmbeddingCache
	queryCacheMaxPerTenant int
	rateLimiter            vector.RateLimiter
	rateLimitPerTenant     int
	rateLimitWindow        time.Duration
	collectionAllowlist    vector.CollectionAllowlist
	embeddingBuilders      embed.BuilderProvider

	ownsIndexFn func(key resourcecontract.NamespacedResource) (bool, error)

	buildIndex singleflight.Group

	// since usage insights is not in unified storage, we need to periodically rebuild the index
	// to make sure these data points are up to date.
	dashboardIndexMaxAge time.Duration
	maxIndexAge          time.Duration
	minBuildVersion      *semver.Version
	buildVersion         *semver.Version
	searchFields         *searchmodel.SearchFieldsRegistry
	requiredFeatures     []searchmodel.IndexFeature

	bgTaskWg     sync.WaitGroup
	bgTaskCancel func()

	rebuildQueue   *debouncer.Queue[rebuildRequest]
	rebuildWorkers int
	// reconcileQueue holds global index reconciles, run by their own workers.
	reconcileQueue *debouncer.Queue[rebuildRequest]

	// inFlightRebuilds tracks rebuilds currently being executed by a worker.
	// Presence of a key means a worker is rebuilding the index for that key,
	// so other workers that pick up requests for the same key should defer
	// their work to a follow-up rebuild rather than running concurrently.
	// Concurrent rebuilds for the same key would corrupt each other's on-disk
	// index directories via cleanOldIndexes.
	inFlightRebuildsMu sync.Mutex
	inFlightRebuilds   map[resourcecontract.NamespacedResource]*rebuildState

	injectFailuresPercent     int
	indexModificationCacheTTL time.Duration
	globalIndexEnabled        bool

	backendDiagnostics resourcepb.DiagnosticsServer //nolint:staticcheck
}

// getIndexMaxAge returns the configured rebuild interval for the given
// resource: dashboards use IndexRebuildInterval (cfg.IndexRebuildInterval),
// other resources use MaxFileIndexAge. Zero means "no age-based rebuild".
//
// A namespace-wide index holds dashboards too, and it is the more expensive one
// to rebuild, so it follows the dashboard interval rather than the default.
func (s *searchServer) getIndexMaxAge(key resourcecontract.NamespacedResource) time.Duration {
	if key.Resource == dashboardv1.DASHBOARD_RESOURCE || key.IsGlobal() {
		return s.dashboardIndexMaxAge
	}
	return s.maxIndexAge
}

// maybeInjectFailure returns an error for a configured percentage of calls.
// Returns nil when failure injection is disabled or the call is not selected.
func (s *searchServer) maybeInjectFailure() error {
	if s.injectFailuresPercent > 0 && rand.Intn(100) < s.injectFailuresPercent {
		return fmt.Errorf("injected search failure")
	}
	return nil
}

var (
	_ resourcepb.ResourceIndexServer      = (*searchServer)(nil)
	_ resourcepb.ManagedObjectIndexServer = (*searchServer)(nil)
	_ searchmodel.SearchServer            = (*searchServer)(nil)
)

// newSearchServer creates a new search server implementation.
func newSearchServer(opts searchmodel.SearchOptions, storage resource.StorageReader, vectorBackend vector.VectorBackend, embedder *embedder.Embedder, reranker *rerank.Reranker, access types.AccessClient, blob resourcecontract.BlobSupport, indexMetrics *searchmetrics.ServiceMetrics, vectorMetrics *searchmetrics.VectorMetrics, ownsIndexFn func(key resourcecontract.NamespacedResource) (bool, error)) (*searchServer, error) {
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
		ownsIndexFn = func(key resourcecontract.NamespacedResource) (bool, error) {
			return true, nil
		}
	}

	searchFields := opts.SearchFields
	if searchFields == nil {
		searchFields = searchmodel.NewSearchFieldsRegistry(nil, nil, nil)
	}

	// Recording sites should not have to check for nil.
	if indexMetrics == nil {
		indexMetrics = searchmetrics.ProvideServiceMetrics(nil, nil)
	}
	if vectorMetrics == nil {
		vectorMetrics = searchmetrics.ProvideVectorMetrics(nil)
	}

	s := &searchServer{
		access:         access,
		storage:        storage,
		vectorBackend:  vectorBackend,
		embedder:       embedder,
		reranker:       reranker,
		search:         opts.Backend,
		log:            log.New("resource-search"),
		initWorkers:    opts.InitWorkerThreads,
		rebuildWorkers: opts.IndexRebuildWorkers,
		initMinSize:    opts.InitMinCount,
		indexMetrics:   indexMetrics,
		vectorMetrics:  vectorMetrics,
		ownsIndexFn:    ownsIndexFn,

		dashboardIndexMaxAge:      opts.DashboardIndexMaxAge,
		maxIndexAge:               opts.MaxIndexAge,
		minBuildVersion:           opts.MinBuildVersion,
		buildVersion:              opts.BuildVersion,
		searchFields:              searchFields,
		requiredFeatures:          searchmodel.RequiredIndexFeatures(opts.PostRankAuthzEnabled),
		injectFailuresPercent:     opts.InjectFailuresPercent,
		globalIndexEnabled:        opts.GlobalIndexEnabled,
		indexModificationCacheTTL: opts.IndexModificationCacheTTL,

		queryCache:             opts.QueryCache,
		queryCacheMaxPerTenant: opts.QueryCacheMaxPerTenant,
		rateLimiter:            opts.RateLimiter,
		rateLimitPerTenant:     opts.RateLimitPerTenant,
		rateLimitWindow:        opts.RateLimitWindow,
		collectionAllowlist:    vector.NewCollectionAllowlist(opts.AllowedInternalCollections, opts.AllowedExternalCollections),
		embeddingBuilders:      opts.EmbeddingBuilders,
	}

	// pgvector doubles as the FTS lexical searcher.
	if lex, ok := vectorBackend.(vector.LexicalSearcher); ok {
		s.externalLexical = lex
	}

	s.rebuildQueue = debouncer.NewQueue(combineRebuildRequests)
	s.reconcileQueue = debouncer.NewQueue(combineRebuildRequests)
	s.inFlightRebuilds = map[resourcecontract.NamespacedResource]*rebuildState{}

	info, err := opts.Resources.GetDocumentBuilders(searchFields)
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

	for _, gr := range b.staleTypes {
		if !slices.Contains(ret.staleTypes, gr) {
			ret.staleTypes = append(ret.staleTypes, gr)
		}
	}
	ret.reconcile = a.reconcile || b.reconcile

	// Using higher "last import time" is stricter condition, and causes more indexes to be rebuilt.
	if a.lastImportTime.IsZero() || (!b.lastImportTime.IsZero() && b.lastImportTime.After(a.lastImportTime)) {
		ret.lastImportTime = b.lastImportTime
	}

	ret.selectableFields = mergeSelectableFields(a.selectableFields, b.selectableFields)

	// Both requests should carry the same expected hash because it is derived
	// per (group, resource). Prefer the non-empty value; if both are non-empty
	// and differ, take b’s as the more recent observation.
	ret.expectedSearchFieldsHash = b.expectedSearchFieldsHash
	if ret.expectedSearchFieldsHash == "" {
		ret.expectedSearchFieldsHash = a.expectedSearchFieldsHash
	}

	// Combine complete channels
	ret.completeChannels = append(a.completeChannels, b.completeChannels...)

	return ret, true
}

func mergeSelectableFields(a, b []string) []string {
	if len(a) == 0 && len(b) == 0 {
		return nil
	}

	merged := append(slices.Clone(a), b...)
	slices.Sort(merged)
	return slices.Compact(merged)
}

func (s *searchServer) ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	ctx, span := tracer.Start(ctx, "resource.searchServer.ListManagedObjects")
	defer span.End()

	if err := s.maybeInjectFailure(); err != nil {
		return nil, err
	}

	if req.NextPageToken != "" {
		return &resourcepb.ListManagedObjectsResponse{
			Error: resource.NewBadRequestError("multiple pages not yet supported"),
		}, nil
	}

	rsp := &resourcepb.ListManagedObjectsResponse{}
	if req.Namespace == "" {
		rsp.Error = resource.NewBadRequestError("missing namespace")
		return rsp, nil
	}
	nsr := resourcecontract.NamespacedResource{
		Namespace: req.Namespace,
	}
	// Discover which resource types exist in the namespace, then query each
	// managed-object index. Discovery avoids the cost of counting via stats.
	stored, err := s.storage.ListStoredResources(ctx, nsr)
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
		return rsp, nil
	}

	stats := searchmodel.NewSearchStats("ListManagedObjects")
	defer s.logStats(ctx, stats, span, "namespace", req.Namespace)

	for _, info := range stored {
		idx, err := s.getOrCreateIndex(ctx, stats, resourcecontract.NamespacedResource{
			Namespace: req.Namespace,
			Group:     info.Group,
			Resource:  info.Resource,
		}, "listManagedObjects")
		if err != nil {
			rsp.Error = resource.AsErrorResult(err)
			return rsp, nil
		}

		kind, err := idx.ListManagedObjects(ctx, req, stats)
		if err != nil {
			rsp.Error = resource.AsErrorResult(err)
			return rsp, nil
		}
		if kind.NextPageToken != "" {
			rsp.Error = &resourcepb.ErrorResult{
				Code:    http.StatusNotImplemented,
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

func (s *searchServer) logStats(ctx context.Context, stats *searchmodel.SearchStats, span trace.Span, params ...any) {
	args := stats.LogFields()
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

	if err := s.maybeInjectFailure(); err != nil {
		return nil, err
	}

	stats := searchmodel.NewSearchStats("CountManagedObjects")
	defer s.logStats(ctx, stats, span, "namespace", req.Namespace)

	rsp := &resourcepb.CountManagedObjectsResponse{}
	if req.Namespace == "" {
		rsp.Error = resource.NewBadRequestError("missing namespace")
		return rsp, nil
	}
	nsr := resourcecontract.NamespacedResource{
		Namespace: req.Namespace,
	}
	// Discover which resource types exist in the namespace, then count
	// managed objects from each index. Discovery avoids the cost of counting via stats.
	stored, err := s.storage.ListStoredResources(ctx, nsr)
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
		return rsp, nil
	}

	for _, info := range stored {
		idx, err := s.getOrCreateIndex(ctx, stats, resourcecontract.NamespacedResource{
			Namespace: req.Namespace,
			Group:     info.Group,
			Resource:  info.Resource,
		}, "countManagedObjects")
		if err != nil {
			rsp.Error = resource.AsErrorResult(err)
			return rsp, nil
		}

		counts, err := idx.CountManagedObjects(ctx, stats)
		if err != nil {
			rsp.Error = resource.AsErrorResult(err)
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

	if err := s.maybeInjectFailure(); err != nil {
		return nil, err
	}

	if req.Options.Key.Namespace == "" || req.Options.Key.Group == "" || req.Options.Key.Resource == "" {
		return &resourcepb.ResourceSearchResponse{
			Error: resource.NewBadRequestError("missing namespace, group or resource"),
		}, nil
	}

	if req.Limit < 0 {
		return &resourcepb.ResourceSearchResponse{
			Error: resource.NewBadRequestError("limit cannot be negative"),
		}, nil
	}

	if req.Offset < 0 {
		return &resourcepb.ResourceSearchResponse{
			Error: resource.NewBadRequestError("offset cannot be negative"),
		}, nil
	}

	// Trash authorizes each hit against one index's group and resource, so hits
	// federated in from another index would be checked against the wrong one.
	// Refused here rather than further in because resolving a federated index below
	// can build one.
	if req.IsDeleted && len(req.Federated) > 0 {
		return &resourcepb.ResourceSearchResponse{
			Error: resource.NewBadRequestError("searching deleted resources does not support federated queries"),
		}, nil
	}

	stats := searchmodel.NewSearchStats("Search")
	defer s.logStats(ctx, stats, span, "namespace", req.Options.Key.Namespace, "group", req.Options.Key.Group, "resource", req.Options.Key.Resource, "query", req.Query)

	if err := s.checkSearchServicePermissions(ctx, req); err != nil {
		span.SetStatus(otelcodes.Error, err.Error())
		span.RecordError(err)
		return &resourcepb.ResourceSearchResponse{Error: resource.AsErrorResult(err)}, nil
	}

	nsr := resourcecontract.NamespacedResource{
		Group:     req.Options.Key.Group,
		Namespace: req.Options.Key.Namespace,
		Resource:  req.Options.Key.Resource,
	}
	// Unavailable rather than failed: the API that serves this search is enabled
	// separately, and may be on before this server builds the index.
	if nsr.IsGlobal() && !s.globalIndexEnabled {
		return &resourcepb.ResourceSearchResponse{
			Error: resource.NewServiceUnavailableError("the global search index is not enabled (global_search_index_enabled)"),
		}, nil
	}
	idx, err := s.getOrCreateIndex(ctx, stats, nsr, "search")
	if err != nil {
		return &resourcepb.ResourceSearchResponse{
			Error: resource.AsErrorResult(err),
		}, nil
	}

	// Get the federated indexes
	federate := make([]searchmodel.ResourceIndex, len(req.Federated))
	for i, f := range req.Federated {
		nsr.Group = f.Group
		nsr.Resource = f.Resource
		federate[i], err = s.getOrCreateIndex(ctx, stats, nsr, "federatedSearch")
		if err != nil {
			return &resourcepb.ResourceSearchResponse{
				Error: resource.AsErrorResult(err),
			}, nil
		}
	}

	return idx.Search(ctx, s.access, req, federate, stats)
}

// VectorSearch implements ResourceIndexServer. Embeds the query string with
// the configured embedding model, runs a nearest-neighbor search against
// the vector backend, and returns results in ascending-distance order
// (lower score = closer match — passes through pgvector's <=> output).
//
// Returns Unimplemented when no embedding provider or vector backend is configured
func (s *searchServer) VectorSearch(ctx context.Context, req *resourcepb.VectorSearchRequest) (resp *resourcepb.VectorSearchResponse, retErr error) {
	ctx, span := tracer.Start(ctx, "resource.searchServer.VectorSearch")
	defer span.End()

	start := time.Now()
	// Default labels are "unknown"; refined once we read the request key.
	// We capture them before validation so the histogram is labeled even
	// for the missing-key early return.
	group, resourceName := "unknown", "unknown"
	if req != nil && req.Key != nil {
		if g := req.Key.GetGroup(); g != "" {
			group = g
		}
		if r := req.Key.GetResource(); r != "" {
			resourceName = r
		}
	}

	// record metrics at the end
	defer func() {
		code := codes.OK
		if retErr != nil {
			code = status.Code(retErr)
		} else if resp != nil {
			code = resource.GRPCCodeFromErrorResult(resp.Error)
		}
		metricutil.ObserveWithExemplar(ctx,
			s.vectorMetrics.SearchDuration.WithLabelValues(group, resourceName, code.String()),
			time.Since(start).Seconds(),
		)
	}()

	if s.embedder == nil || s.vectorBackend == nil {
		return nil, status.Error(codes.Unimplemented, "vector search not configured")
	}

	if errResp := validateVectorSearchRequest(req); errResp != nil {
		return errResp, nil
	}

	if errRes := resource.RequireUserNamespace(ctx, req.Key.Namespace); errRes != nil {
		return &resourcepb.VectorSearchResponse{Error: errRes}, nil
	}

	limit := int(req.Limit)
	switch {
	case limit <= 0:
		limit = defaultVectorSearchLimit
	case limit > maxVectorSearchLimit:
		limit = maxVectorSearchLimit
	}

	span.SetAttributes(
		attribute.String("namespace", req.Key.Namespace),
		attribute.String("group", req.Key.Group),
		attribute.String("resource", req.Key.Resource),
		attribute.Int("limit", limit),
	)

	if err := s.checkVectorSearchRateLimit(ctx, req.Key.Namespace); err != nil {
		return nil, err
	}

	// An unprovisioned (group, resource) pair — no catalog row, so no
	// partition to search — is NOT_FOUND before we spend an embedding on
	// the query.
	coll, collAllowed, err := s.resolveAllowedCollection(ctx, req.Key.Group, req.Key.Resource)
	if err != nil {
		return nil, s.grpcStatusError(ctx, "vector search: resolve collection", err)
	}
	if !collAllowed {
		return &resourcepb.VectorSearchResponse{Error: resource.NewNotFoundError(req.Key)}, nil
	}

	dense, err := s.embedVectorSearchQuery(ctx, req.Key.Namespace, req.Query)
	if err != nil {
		return nil, err
	}

	results, err := s.vectorBackend.Search(ctx,
		req.Key.Namespace, s.embedder.Model, coll.PartitionKey,
		dense, limit, translateVectorSearchFilters(req.Filters)...)
	if err != nil {
		if ctx.Err() != nil {
			return nil, status.FromContextError(ctx.Err()).Err()
		}
		s.log.Error("vector search: backend", "err", err)
		return nil, status.Error(codes.Internal, "vector search backend")
	}

	// Using authz post-filtering for now
	// Downside is that the results could be lower than expected
	// For example: VectorSearch returns 10 results, user has access to 3 items, we would only return 3 items
	user, ok := types.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return nil, status.Error(codes.Unauthenticated, "no user in context")
	}

	allowed, err := s.batchCheckVectorSearchResults(ctx, user, req.Key, results)
	if err != nil {
		if ctx.Err() != nil {
			return nil, status.FromContextError(ctx.Err()).Err()
		}
		s.log.Error("vector search: authz batch check", "err", err)
		return nil, status.Error(codes.Internal, "authz batch check")
	}

	resp = &resourcepb.VectorSearchResponse{
		Results: make([]*resourcepb.VectorSearchResult, 0, len(results)),
	}
	for _, r := range results {
		if !allowed[vectorAuthzKey{r.UID, r.Folder}] {
			continue
		}
		resp.Results = append(resp.Results, &resourcepb.VectorSearchResult{
			Name:        r.UID,
			Title:       r.Title,
			Subresource: r.Subresource,
			Content:     r.Content,
			Score:       r.Score, // raw cosine distance — pass-through
			Folder:      r.Folder,
			Metadata:    r.Metadata,
		})
	}
	return resp, nil
}

// validateVectorSearchRequest returns a non-nil response with a
// BadRequestError when the request fails validation; nil means valid.
// Pulled out of VectorSearch to keep that function under the cyclomatic
// complexity threshold.
func validateVectorSearchRequest(req *resourcepb.VectorSearchRequest) *resourcepb.VectorSearchResponse {
	if req.Key == nil || req.Key.Namespace == "" || req.Key.Group == "" || req.Key.Resource == "" {
		return &resourcepb.VectorSearchResponse{
			Error: resource.NewBadRequestError("missing namespace, group or resource"),
		}
	}
	if strings.TrimSpace(req.Query) == "" {
		return &resourcepb.VectorSearchResponse{
			Error: resource.NewBadRequestError("query must not be empty"),
		}
	}
	// TODO decide on appropriate max query length. Using 1k for now.
	if len(req.Query) > 1000 {
		return &resourcepb.VectorSearchResponse{
			Error: resource.NewBadRequestError("query exceeds maximum length of 1000 bytes"),
		}
	}
	return nil
}

// checkVectorSearchRateLimit returns a gRPC status error when the
// request must be rejected (over quota or limiter unreachable), nil
// when it should proceed.
func (s *searchServer) checkVectorSearchRateLimit(ctx context.Context, namespace string) error {
	if s.rateLimiter == nil {
		return nil
	}
	allowed, count, err := s.rateLimiter.Allow(ctx, namespace, s.rateLimitWindow, s.rateLimitPerTenant)
	if err != nil {
		s.log.Error("vector search: rate-limit check failed, fail-closed", "err", err, "namespace", namespace)
		s.vectorMetrics.RateLimiterErrorsTotal.Inc()
		return status.Error(codes.Unavailable, "rate limiter unavailable")
	}
	if !allowed {
		s.vectorMetrics.RateLimitedRequestsTotal.Inc()
		return status.Errorf(codes.ResourceExhausted, "tenant rate limit exceeded: %d requests in window", count)
	}
	return nil
}

// embedVectorSearchQuery returns the query embedding, fetching it from
// the cache on hit or calling the embedder on miss (and best-effort
// writing back into the cache, enforcing the per-tenant cap).
func (s *searchServer) embedVectorSearchQuery(ctx context.Context, namespace, query string) ([]float32, error) {
	queryHash := sha256Hex(query)
	if dense, ok := s.lookupCachedQueryEmbedding(ctx, namespace, queryHash); ok {
		return dense, nil
	}

	// Embed the query as a retrieval *query* (different task hint than
	// the retrieval *document* hint used at index time — providers tune
	// projections per side of the retrieval pair).
	out, err := s.embedder.EmbedText(ctx, embedder.EmbedTextInput{
		Texts:     []string{query},
		Normalize: s.embedder.ShouldNormalize(),
		Task:      embedder.TaskRetrievalQuery,
	})
	if err != nil {
		// Client disconnects/timeouts must map to Canceled/DeadlineExceeded
		// per the gRPC spec — reporting Internal here trips error SLOs.
		if ctx.Err() != nil {
			return nil, status.FromContextError(ctx.Err()).Err()
		}
		s.log.Error("vector search: embed query", "err", err)
		return nil, status.Error(codes.Internal, "embed query")
	}
	if len(out.Embeddings) != 1 || len(out.Embeddings[0].Dense) == 0 {
		s.log.Error("vector search: embedder returned no vectors")
		return nil, status.Error(codes.Internal, "embed query: empty result")
	}
	dense := out.Embeddings[0].Dense
	s.vectorMetrics.QueryCacheMissesTotal.WithLabelValues(s.embedder.Model).Inc()
	s.storeCachedQueryEmbedding(ctx, namespace, queryHash, dense)
	return dense, nil
}

// lookupCachedQueryEmbedding returns (embedding, true) on hit; (nil,
// false) on miss or any error (cache failures must not fail the search).
func (s *searchServer) lookupCachedQueryEmbedding(ctx context.Context, namespace, queryHash string) ([]float32, bool) {
	if s.queryCache == nil {
		return nil, false
	}
	emb, hit, err := s.queryCache.Get(ctx, namespace, s.embedder.Model, queryHash)
	if err != nil {
		s.log.Warn("vector search: cache lookup failed, falling through", "err", err)
		return nil, false
	}
	if !hit {
		return nil, false
	}
	s.vectorMetrics.QueryCacheHitsTotal.WithLabelValues(s.embedder.Model).Inc()
	return emb, true
}

// vectorQueryCacheEvictTargetFraction is how full the cache is left
// after an eviction round runs.
const vectorQueryCacheEvictTargetFraction = 0.8

// storeCachedQueryEmbedding writes the freshly-embedded vector into the
// cache (best-effort). When the tenant is at or above the cap, eviction
// trims down to vectorQueryCacheEvictTargetFraction of the cap in one
// pass so we don't run a DELETE on every cache miss at steady state.
func (s *searchServer) storeCachedQueryEmbedding(ctx context.Context, namespace, queryHash string, dense []float32) {
	if s.queryCache == nil || s.queryCacheMaxPerTenant <= 0 {
		return
	}
	if n, err := s.queryCache.Count(ctx, namespace); err == nil && int(n) >= s.queryCacheMaxPerTenant {
		target := int(float64(s.queryCacheMaxPerTenant) * vectorQueryCacheEvictTargetFraction)
		evictN := int(n) - target
		if deleted, err := s.queryCache.EvictOldest(ctx, namespace, evictN); err != nil {
			s.log.Warn("vector search: cache evict failed", "err", err)
		} else if deleted > 0 {
			s.vectorMetrics.QueryCacheEvictionsTotal.Add(float64(deleted))
		}
	}
	if err := s.queryCache.Put(ctx, namespace, s.embedder.Model, queryHash, dense); err != nil {
		s.log.Warn("vector search: cache put failed", "err", err)
	}
}

// vectorAuthzKey de-dupes (UID, Folder) so sub-resources of the same
// parent (e.g. dashboard panels) share a single batch-check entry.
type vectorAuthzKey struct{ uid, folder string }

// batchCheckVectorSearchResults runs authz checks in chunks of
// batchCheckChunkSize over the unique (UID, Folder) pairs in `results`
// and returns the set of pairs the user is allowed to read.
func (s *searchServer) batchCheckVectorSearchResults(
	ctx context.Context,
	user types.AuthInfo,
	key *resourcepb.ResourceKey,
	results []vector.VectorSearchResult,
) (map[vectorAuthzKey]bool, error) {
	// seen de-dupes per (UID, Folder) so sub-resources share one entry.
	// correlation maps the batch-check correlation ID back to its pair.
	seen := make(map[vectorAuthzKey]struct{}, len(results))
	correlation := make(map[string]vectorAuthzKey, len(results))
	checks := make([]types.BatchCheckItem, 0, len(results))
	for _, r := range results {
		k := vectorAuthzKey{r.UID, r.Folder}
		if _, dup := seen[k]; dup {
			continue
		}
		seen[k] = struct{}{}
		id := fmt.Sprintf("%d", len(checks))
		correlation[id] = k
		checks = append(checks, types.BatchCheckItem{
			CorrelationID: id,
			Verb:          utils.VerbGet,
			Group:         key.Group,
			Resource:      key.Resource,
			Name:          r.UID,
			Folder:        r.Folder,
		})
	}

	allowed := make(map[vectorAuthzKey]bool, len(checks))
	for start := 0; start < len(checks); start += batchCheckChunkSize {
		end := min(start+batchCheckChunkSize, len(checks))
		batchResp, err := s.access.BatchCheck(ctx, user, types.BatchCheckRequest{
			Namespace: key.Namespace,
			Checks:    checks[start:end],
		})
		if err != nil {
			return nil, err
		}
		for id, result := range batchResp.Results {
			if result.Allowed {
				allowed[correlation[id]] = true
			}
		}
	}
	return allowed, nil
}

// translateVectorSearchFilters maps the proto Requirement shape into the
// vector backend's SearchFilter shape. The backend recognizes "uid" and
// "folder" as first-class columns; any other key is treated as a JSONB
// metadata containment filter.
func translateVectorSearchFilters(reqs []*resourcepb.Requirement) []vector.SearchFilter {
	if len(reqs) == 0 {
		return nil
	}
	out := make([]vector.SearchFilter, 0, len(reqs))
	for _, r := range reqs {
		if r == nil || r.Key == "" {
			continue
		}
		out = append(out, vector.SearchFilter{
			Field:  r.Key,
			Values: r.Values,
		})
	}
	return out
}

// GetStats implements ResourceServer.
func (s *searchServer) GetStats(ctx context.Context, req *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
	ctx, span := tracer.Start(ctx, "resource.searchServer.GetStats")
	defer span.End()

	if err := s.maybeInjectFailure(); err != nil {
		return nil, err
	}

	if req.Namespace == "" {
		return &resourcepb.ResourceStatsResponse{
			Error: resource.NewBadRequestError("missing namespace"),
		}, nil
	}

	stats := searchmodel.NewSearchStats("GetStats")
	defer s.logStats(ctx, stats, span, "namespace", req.Namespace, "group", strings.Join(req.Kinds, ","), "folder", strings.Join(req.Folder, ","))

	rsp := &resourcepb.ResourceStatsResponse{}
	folderSet := folderFilterSet(req)

	// Explicit list of kinds
	if len(req.Kinds) > 0 {
		rsp.Stats = make([]*resourcepb.ResourceStatsResponse_Stats, len(req.Kinds))
		for i, k := range req.Kinds {
			parts := strings.SplitN(k, "/", 2)
			index, err := s.getOrCreateIndex(ctx, stats, resourcecontract.NamespacedResource{
				Namespace: req.Namespace,
				Group:     parts[0],
				Resource:  parts[1],
			}, "getStats")
			if err != nil {
				rsp.Error = resource.AsErrorResult(err)
				return rsp, nil
			}
			count, err := sumDocCount(ctx, index, folderSet, stats)
			if err != nil {
				rsp.Error = resource.AsErrorResult(err)
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

	nsr := resourcecontract.NamespacedResource{
		Namespace: req.Namespace,
	}
	resourceStats, err := s.storage.GetResourceStats(ctx, nsr, 0)
	if err != nil {
		return &resourcepb.ResourceStatsResponse{
			Error: resource.AsErrorResult(err),
		}, nil
	}
	rsp.Stats = make([]*resourcepb.ResourceStatsResponse_Stats, len(resourceStats))

	// When not filtered by folder, we can use the results directly
	if len(folderSet) == 0 {
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
		index, err := s.getOrCreateIndex(ctx, stats, resourcecontract.NamespacedResource{
			Namespace: req.Namespace,
			Group:     stat.Group,
			Resource:  stat.Resource,
		}, "getStats")
		if err != nil {
			rsp.Error = resource.AsErrorResult(err)
			return rsp, nil
		}
		count, err := sumDocCount(ctx, index, folderSet, stats)
		if err != nil {
			rsp.Error = resource.AsErrorResult(err)
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

// folderFilterSet returns req.Folder de-duplicated, with empty entries dropped.
// Returns nil when no folder filter is set, which means "count everything in
// the namespace".
func folderFilterSet(req *resourcepb.ResourceStatsRequest) []string {
	if len(req.Folder) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(req.Folder))
	out := make([]string, 0, len(req.Folder))
	for _, f := range req.Folder {
		if f == "" {
			continue
		}
		if _, ok := seen[f]; ok {
			continue
		}
		seen[f] = struct{}{}
		out = append(out, f)
	}
	return out
}

// sumDocCount returns the document count across the given folders. When
// folders is empty it returns the total document count of the index. Bleve
// has no native multi-folder count, so we issue one DocCount per folder and
// sum — fine for the move/delete confirmation flow which only spans a
// folder subtree.
func sumDocCount(ctx context.Context, index searchmodel.ResourceIndex, folders []string, stats *searchmodel.SearchStats) (int64, error) {
	if len(folders) == 0 {
		return index.DocCount(ctx, "", stats)
	}
	var total int64
	for _, f := range folders {
		c, err := index.DocCount(ctx, f, stats)
		if err != nil {
			return 0, err
		}
		total += c
	}
	return total, nil
}

func (s *searchServer) RebuildIndexes(ctx context.Context, req *resourcepb.RebuildIndexesRequest) (*resourcepb.RebuildIndexesResponse, error) {
	ctx, span := tracer.Start(ctx, "resource.searchServer.RebuildIndexes")
	defer span.End()

	filterKeys := make([]resourcecontract.NamespacedResource, 0, len(req.Keys))
	for _, key := range req.Keys {
		if req.Namespace != key.Namespace {
			return &resourcepb.RebuildIndexesResponse{
				Error: resource.NewBadRequestError("key namespace does not match request namespace"),
			}, nil
		}
		filterKeys = append(filterKeys, resourcecontract.NamespacedResource{
			Namespace: key.Namespace,
			Group:     key.Group,
			Resource:  key.Resource,
		})
	}

	importTimes, err := s.getLastImportTimes(ctx, filterKeys)
	if err != nil {
		return &resourcepb.RebuildIndexesResponse{
			Error: resource.AsErrorResult(err),
		}, nil
	}

	completeChs := s.findIndexesToRebuild(importTimes, filterKeys, time.Now(), false)
	// A global index is never imported itself; its covered types are, and only
	// those are rebuilt.
	syncChs, err := s.queueTypeSyncs(ctx, filterKeys, nil)
	if err != nil {
		return &resourcepb.RebuildIndexesResponse{Error: resource.AsErrorResult(err)}, nil
	}
	completeChs = append(completeChs, syncChs...)
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
		if lastImportTime := importTimes[key]; !lastImportTime.IsZero() && !bi.BuildTime.After(lastImportTime) {
			return &resourcepb.RebuildIndexesResponse{
				RebuildCount: int64(rebuildCount),
				Error:        resource.AsErrorResult(fmt.Errorf("index for %s was not built after last import (%s)", key, lastImportTime)),
			}, nil
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

func (s *searchServer) startupIndexStats(ctx context.Context) ([]resourcecontract.ResourceStats, error) {
	stats, err := s.search.LoadOpenIndexStats(time.Now(), openIndexStatsMaxAge)
	if err != nil {
		s.log.FromContext(ctx).Warn("failed to load open index stats, falling back to resource stats", "error", err)
	} else if len(stats) > 0 {
		// Do not apply initMinSize here: open index stats restore indexes that were recently open on this node,
		// rather than discovering resources from storage.
		s.log.FromContext(ctx).Info("using open index stats", "indexes", len(stats))
		return stats, nil
	} else {
		s.log.FromContext(ctx).Debug("open index stats unavailable, falling back to resource stats")
	}

	// The prebuild only compares counts against thresholds, so cap counting above
	// the highest one that consumes the count: init min size, plus the snapshot
	// threshold when a snapshot store is active.
	limit := s.initMinSize
	if t := int(s.search.SnapshotCountThreshold()); t > limit {
		limit = t
	}
	limit++

	start := time.Now()
	stats, err = s.storage.GetResourceStatsWithLimit(ctx, resourcecontract.NamespacedResource{}, s.initMinSize, limit)
	s.log.Debug("startupIndexStats: got resource stats from storage", "elapsed", time.Since(start).String(), "stats", len(stats), "err", err, "countLimit", limit)
	return stats, err
}

// globalIndexStats returns the namespace-wide index to build for every namespace
// present in stats, sized by the counts of the resource types it covers. The
// index is not a stored resource, so storage never reports it and it has to be
// added here.
//
// It sees only what the startup build was already going to build, so a namespace
// whose covered types are all below the startup size threshold gets no index
// built here. That is the same as for per-resource indexes: a small index is
// built the first time it is searched.
func (s *searchServer) globalIndexStats(stats []resourcecontract.ResourceStats) []resourcecontract.ResourceStats {
	if !s.globalIndexEnabled {
		return nil
	}

	covered := map[resourcecontract.NamespacedResource]bool{}
	for _, gr := range searchmodel.GlobalSearchResourceTypes() {
		covered[resourcecontract.NamespacedResource{Group: gr.Group, Resource: gr.Resource}] = true
	}

	sizes := map[string]int64{}
	// Restored open-index stats already name the namespace-wide index, so adding it
	// again would build it twice.
	present := map[string]bool{}
	for _, info := range stats {
		if info.IsGlobal() {
			present[info.Namespace] = true
			continue
		}
		if covered[resourcecontract.NamespacedResource{Group: info.Group, Resource: info.Resource}] {
			sizes[info.Namespace] += info.Count
		}
	}
	for namespace := range present {
		delete(sizes, namespace)
	}

	out := make([]resourcecontract.ResourceStats, 0, len(sizes))
	for namespace, count := range sizes {
		out = append(out, resourcecontract.ResourceStats{
			NamespacedResource: resourcecontract.GlobalSearchKey(namespace),
			Count:              count,
		})
	}
	// Storage returns stats in a stable order and the build workers log per key, so
	// keep this predictable too.
	slices.SortFunc(out, func(a, b resourcecontract.ResourceStats) int {
		return strings.Compare(a.Namespace, b.Namespace)
	})
	return out
}

func (s *searchServer) buildIndexes(ctx context.Context) (int, error) {
	totalBatchesIndexed := 0
	group := errgroup.Group{}
	group.SetLimit(s.initWorkers)

	stats, err := s.startupIndexStats(ctx)
	if err != nil {
		return 0, err
	}
	if s.globalIndexEnabled {
		stats = append(stats, s.globalIndexStats(stats)...)
	} else {
		// Open-index stats restored from a run with the index switched on can still
		// name one, and it must not be built with the index switched off.
		stats = slices.DeleteFunc(stats, func(info resourcecontract.ResourceStats) bool { return info.IsGlobal() })
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
	if s.embeddingBuilders != nil {
		if err := s.embeddingBuilders.Validate(); err != nil {
			return fmt.Errorf("embedding enrollment: %w", err)
		}
	}
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

	s.bgTaskWg.Go(func() { s.runPeriodicTrashCleanup(subctx) })

	if s.globalIndexEnabled {
		for range globalReconcileWorkers {
			s.bgTaskWg.Go(func() { s.runGlobalIndexReconciler(subctx) })
		}
		s.bgTaskWg.Go(func() { s.runGlobalIndexWatch(subctx) })
	}

	s.startRateBucketSweeper(subctx)

	end := time.Now().Unix()
	s.log.Info("search index initialized", "duration_secs", end-start, "total_docs", s.search.TotalDocs())
	return nil
}

func (s *searchServer) stop() {
	// This stops search-server tasks only: rebuild workers, rebuild scans, and rate-limit sweeping.
	// Initialization can fail before background tasks are started.
	if s.bgTaskCancel != nil {
		s.bgTaskCancel()
		s.bgTaskWg.Wait()
	}

	// Stop the backend after search-server workers so no rebuild can race with closing indexes.
	s.search.Stop()
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
	return s.backendDiagnostics.IsHealthy(ctx, req) //nolint:staticcheck
}

func (s *searchServer) runPeriodicScanForIndexesToRebuild(ctx context.Context) {
	defer s.bgTaskWg.Done()

	// A global index reused at startup may predate a type being added or
	// dropped, so that is checked now rather than at the first tick.
	s.scanForIndexesToRebuild(ctx, false)

	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			s.log.Info("stopping periodic index rebuild due to context cancellation")
			return
		case <-ticker.C:
			s.scanForIndexesToRebuild(ctx, true)
		}
	}
}

func (s *searchServer) scanForIndexesToRebuild(ctx context.Context, checkFullRebuilds bool) {
	keys := s.search.GetOpenIndexes()
	importTimes, err := s.storage.ListResourceLastImportTimes(ctx)
	if err != nil {
		s.log.Error("failed to get import times", "error", err)
	}
	if importTimes == nil {
		// An empty map prevents per-type fallback reads after a failed scan.
		importTimes = make(map[resourcecontract.NamespacedResource]time.Time)
	}
	if checkFullRebuilds {
		s.findIndexesToRebuild(importTimes, keys, time.Now(), true)
	}
	if _, err := s.queueTypeSyncs(ctx, keys, importTimes); err != nil {
		s.log.Warn("failed to check which resource types of global search indexes are out of date", "error", err)
	}
	s.queueDueReconciles(keys, time.Now())
}

// Reads already hide expired trash, so this only reclaims space and can run
// rarely. It gets its own goroutine because draining a large backlog would
// otherwise hold up the rebuild scan.
func (s *searchServer) runPeriodicTrashCleanup(ctx context.Context) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.search.RemoveExpiredTrash(ctx)
		}
	}
}

func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// Old buckets never affect Allow() — sweeping is purely housekeeping.
func (s *searchServer) startRateBucketSweeper(ctx context.Context) {
	if s.rateLimiter == nil || s.rateLimitWindow <= 0 {
		return
	}
	s.bgTaskWg.Go(func() {
		interval := max(s.rateLimitWindow/2, time.Minute)
		t := time.NewTicker(interval)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				cutoff := time.Now().Add(-2 * s.rateLimitWindow)
				deleted, err := s.rateLimiter.SweepOlderThan(ctx, cutoff)
				if err != nil {
					s.log.Warn("rate-bucket sweep failed", "err", err)
					continue
				}
				if deleted > 0 {
					s.log.Debug("rate-bucket sweep", "deleted", deleted, "cutoff", cutoff)
				}
			}
		}
	})
}

// jitterForKey returns a deterministic jitter duration for the given key,
// bounded to [0, maxAge/2). This spreads index rebuilds across scan intervals
// to avoid thundering herd CPU spikes when many indexes become stale at once.
func jitterForKey(key resourcecontract.NamespacedResource, maxAge time.Duration) time.Duration {
	if maxAge <= 0 {
		return 0
	}
	h := fnv.New64a()
	_, _ = h.Write([]byte(key.String()))
	jitterRange := uint64(maxAge / 2)
	if jitterRange == 0 {
		return 0
	}
	return time.Duration(h.Sum64() % jitterRange)
}

func (s *searchServer) findIndexesToRebuild(lastImportTimes map[resourcecontract.NamespacedResource]time.Time, filterKeys []resourcecontract.NamespacedResource, now time.Time, applyJitter bool) []chan struct{} {
	// Check all open indexes and see if any of them need to be rebuilt.
	// This is done periodically to make sure that the indexes are up to date.

	var keys []resourcecontract.NamespacedResource
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

		maxAge := s.getIndexMaxAge(key)

		var minBuildTime time.Time
		if maxAge > 0 {
			minBuildTime = now.Add(-maxAge)
		}

		if applyJitter {
			minBuildTime = minBuildTime.Add(-jitterForKey(key, maxAge))
		}

		lastImportTime := lastImportTimes[key] // Will be time.Time{} if not found.

		bi, err := idx.BuildInfo()
		if err != nil {
			s.log.Error("failed to get build info for index to rebuild", "key", key, "error", err)
			continue
		}

		sfields, expectedSearchFieldsHash, _ := s.searchFields.ForKey(key)

		if shouldRebuildIndex(bi, s.minBuildVersion, s.buildVersion, minBuildTime, lastImportTime, sfields, expectedSearchFieldsHash, s.requiredFeatures, nil) {
			completeCh := make(chan struct{})
			completeChs = append(completeChs, completeCh)
			rebuildReq := newRebuildRequest(key, minBuildTime, lastImportTime, s.minBuildVersion, sfields, expectedSearchFieldsHash, completeCh)
			s.rebuildQueue.Add(rebuildReq)

			s.indexMetrics.RebuildQueueLength.Set(float64(s.rebuildQueue.Len()))
		}
	}
	return completeChs
}

func (s *searchServer) getLastImportTimes(ctx context.Context, keys []resourcecontract.NamespacedResource) (map[resourcecontract.NamespacedResource]time.Time, error) {
	result := make(map[resourcecontract.NamespacedResource]time.Time, len(keys))
	for _, key := range keys {
		lastImportTime, err := s.storage.GetResourceLastImportTime(ctx, key)
		if err != nil {
			return result, err
		}
		result[key] = lastImportTime
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

		s.indexMetrics.RebuildQueueLength.Set(float64(s.rebuildQueue.Len()))

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

	rebuild := shouldRebuildIndex(bi, req.minBuildVersion, s.buildVersion, req.minBuildTime, req.lastImportTime, req.selectableFields, req.expectedSearchFieldsHash, s.requiredFeatures, l)
	// A full rebuild writes a new index of every covered type, so it covers any
	// stale ones, and leaves nothing to reconcile.
	repairTypes := !rebuild && (len(req.staleTypes) > 0 || req.reconcile)
	if !rebuild && !repairTypes {
		span.AddEvent("index not rebuilt")
		l.Info("index doesn't need to be rebuilt")
		return
	}

	// Coordinate with any other worker that is already rebuilding this key.
	// Concurrent rebuilds for the same key would race in cleanOldIndexes and
	// delete each other's on-disk directories.
	s.inFlightRebuildsMu.Lock()
	if state, inFlight := s.inFlightRebuilds[req.NamespacedResource]; inFlight {
		// Another worker is already rebuilding. Stash this request as a follow-up
		// so its conditions (e.g. a newer lastImportTime) are re-evaluated against
		// the just-built index when the in-flight rebuild finishes.
		if state.deferred == nil {
			// new(req), not &req: we mutate req.completeChannels = nil below,
			// and state.deferred must observe the values seen here, not those.
			state.deferred = new(req)
		} else {
			merged, _ := combineRebuildRequests(*state.deferred, req)
			state.deferred = &merged
		}
		// The follow-up rebuild will close these completion channels (or close
		// them as a no-op via the recheck path); clear them here so the top-level
		// defer in this function does not close them prematurely.
		req.completeChannels = nil
		s.inFlightRebuildsMu.Unlock()
		span.AddEvent("rebuild already in flight, deferring as follow-up")
		l.Info("rebuild already in flight for key, deferring as follow-up")
		return
	}
	state := &rebuildState{}
	s.inFlightRebuilds[req.NamespacedResource] = state
	s.inFlightRebuildsMu.Unlock()

	defer s.finishRebuild(req.NamespacedResource, state)

	// Past the in-flight check, so this never overlaps a full rebuild of the same
	// index. Rechecked type by type: a request deferred behind a full rebuild
	// finds that the rebuild already caught up.
	if repairTypes {
		if len(req.staleTypes) > 0 {
			if err := s.syncTypes(ctx, req.NamespacedResource, req.staleTypes); err != nil {
				span.RecordError(err)
				l.Warn("failed to sync resource types of the global search index", "error", err)
			}
		}
		if req.reconcile {
			if _, err := s.reconcileGlobalIndex(ctx, req.NamespacedResource); err != nil {
				span.RecordError(err)
				l.Warn("failed to reconcile the global search index", "error", err)
			}
		}
		return
	}

	if req.Resource == dashboardv1.DASHBOARD_RESOURCE {
		// we need to clear the cache to make sure we get the latest usage insights data
		s.builders.clearNamespacedCache(req.NamespacedResource)
	}

	size, err := idx.DocCount(ctx, "", nil)
	if err != nil {
		span.RecordError(fmt.Errorf("failed to get current index doc count: %w", err))
		l.Warn("failed to get current index doc count, using unknown size", "error", err)
		size = unknownBuildSize
	}

	// Pass rebuild=true to force rebuild of any existing file-based index.
	_, err = s.build(ctx, req.NamespacedResource, size, "rebuild", true, time.Time{})
	if err != nil {
		span.RecordError(err)
		l.Error("failed to rebuild index", "error", err)
	}
}

func shouldRebuildIndex(buildInfo searchmodel.IndexBuildInfo, minBuildVersion, maxBuildVersion *semver.Version, minBuildTime time.Time, lastImportTime time.Time, selectableFields []string, expectedSearchFieldsHash string, requiredFeatures []searchmodel.IndexFeature, rebuildLogger log.Logger) bool {
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
		if !buildInfo.BuildTime.After(lastImportTime) {
			if rebuildLogger != nil {
				rebuildLogger.Info("index build time is not after lastImportTime, rebuilding the index", "indexBuildTime", buildInfo.BuildTime, "lastImportTime", lastImportTime)
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

	// If index was built by a newer Grafana version than currently running, rebuild to ensure compatibility.
	if maxBuildVersion != nil && buildInfo.BuildVersion != nil {
		if buildInfo.BuildVersion.Compare(maxBuildVersion) > 0 {
			if rebuildLogger != nil {
				rebuildLogger.Info("index build version is after maxBuildVersion (running version), rebuilding the index", "indexBuildVersion", buildInfo.BuildVersion, "maxBuildVersion", maxBuildVersion)
			}
			return true
		}
	}

	// It's OK if extra fields were indexed before, but if new selectable fields should now be indexed, we need to reindex.
	if newSelectableFieldsAdded(buildInfo.SelectableFields, selectableFields) {
		if rebuildLogger != nil {
			rebuildLogger.Info("new selectable fields were added for the kind, rebuilding the index", "indexSelectableFields", buildInfo.BuildVersion, "selectableFields", minBuildVersion)
		}
		return true
	}

	// Search-field metadata that affects what gets indexed (paths, types,
	// capabilities, EmitZeroIfAbsent) has changed since the index was built.
	// Rebuild so documents are re-extracted with the new declarations.
	//
	// An empty expected hash means "no opinion" for this kind: either no
	// SearchFieldsProvider is registered today, or the running binary doesn't
	// supply hashes yet. In that case we leave the stored hash alone (mirrors
	// the SelectableFields semantics, which only triggers a rebuild on added
	// fields). The stored hash gets refreshed naturally on the next rebuild
	// triggered by another condition.
	if expectedSearchFieldsHash != "" && expectedSearchFieldsHash != buildInfo.SearchFieldsHash {
		if rebuildLogger != nil {
			rebuildLogger.Info("search field metadata changed since the index was built, rebuilding the index")
		}
		return true
	}

	if missing := searchmodel.MissingIndexFeatures(buildInfo, requiredFeatures); len(missing) > 0 {
		if rebuildLogger != nil {
			rebuildLogger.Info("index is missing required features, rebuilding the index", "features", missing)
		}
		return true
	}

	return false
}

func newSelectableFieldsAdded(indexSelectableFields, selectableFields []string) bool {
	// If index has no selectable fields yet, it's easy...
	if len(indexSelectableFields) == 0 {
		return len(selectableFields) > 0
	}

	for _, sf := range selectableFields {
		if !slices.Contains(indexSelectableFields, sf) {
			return true
		}
	}
	return false
}

// rebuildState tracks an in-flight rebuild for a single key. The deferred
// field accumulates requests that arrived while this rebuild was running, so
// they can be re-enqueued as a follow-up once it finishes.
type rebuildState struct {
	deferred *rebuildRequest
}

type rebuildRequest struct {
	resourcecontract.NamespacedResource

	minBuildTime             time.Time       // if not zero, rebuild index if it has been built before this timestamp
	lastImportTime           time.Time       // if not zero, rebuild index unless it was built after this timestamp.
	minBuildVersion          *semver.Version // if not nil, rebuild index with build version older than this.
	selectableFields         []string        // rebuild index which is missing some of these selectable fields.
	expectedSearchFieldsHash string          // if non-empty, rebuild index whose stored SearchFieldsHash differs from this value.

	// staleTypes, for a global index, are resource types it is out of date for:
	// imported since it caught up, or added to or dropped from what it covers.
	// Only those types are synced, unless a full rebuild is due anyway.
	staleTypes []schema.GroupResource

	// reconcile, for a global index, compares it with storage and repairs what
	// differs, unless a full rebuild is due anyway.
	reconcile bool

	completeChannels []chan<- struct{} // signal rebuild index is complete
}

// finishRebuild marks a rebuild or reconcile of key as no longer in flight, and
// queues again a request that arrived meanwhile.
func (s *searchServer) finishRebuild(key resourcecontract.NamespacedResource, state *rebuildState) {
	s.inFlightRebuildsMu.Lock()
	deferred := state.deferred
	delete(s.inFlightRebuilds, key)
	s.inFlightRebuildsMu.Unlock()

	if deferred == nil {
		return
	}
	// Re-enqueue the follow-up. The worker that picks it up will re-check
	// shouldRebuildIndex against the just-built BuildTime and either run
	// another rebuild or close the deferred completion channels as a no-op.
	// A follow-up that is only a reconcile goes back to the reconcile workers,
	// so it does not take a rebuild worker.
	if deferred.onlyReconcile() {
		s.queueReconcile(deferred.NamespacedResource)
		return
	}
	s.rebuildQueue.Add(*deferred)
	s.indexMetrics.RebuildQueueLength.Set(float64(s.rebuildQueue.Len()))
}

// onlyReconcile reports whether the request asks for nothing but a reconcile,
// as queueReconcile makes them.
func (r rebuildRequest) onlyReconcile() bool {
	return r.reconcile && len(r.staleTypes) == 0 && len(r.completeChannels) == 0 &&
		r.minBuildTime.IsZero() && r.lastImportTime.IsZero() && r.minBuildVersion == nil &&
		len(r.selectableFields) == 0 && r.expectedSearchFieldsHash == ""
}

func newRebuildRequest(key resourcecontract.NamespacedResource, minBuildTime, lastImportTime time.Time, minBuildVersion *semver.Version, selectableFields []string, expectedSearchFieldsHash string, completeCh chan<- struct{}) rebuildRequest {
	var completeChannels []chan<- struct{} // setup a list as requests can be combined
	if completeCh != nil {
		completeChannels = []chan<- struct{}{completeCh}
	}
	return rebuildRequest{
		NamespacedResource:       key,
		minBuildTime:             minBuildTime,
		minBuildVersion:          minBuildVersion,
		lastImportTime:           lastImportTime,
		selectableFields:         selectableFields,
		expectedSearchFieldsHash: expectedSearchFieldsHash,
		completeChannels:         completeChannels,
	}
}

func (s *searchServer) getOrCreateIndex(ctx context.Context, stats *searchmodel.SearchStats, key resourcecontract.NamespacedResource, reason string) (searchmodel.ResourceIndex, error) {
	if s == nil || s.search == nil {
		return nil, fmt.Errorf("search is not configured properly (missing enable_search config?)")
	}
	// Refused rather than built on demand, so switching the index off stops it
	// being kept whatever asks for it.
	if key.IsGlobal() && !s.globalIndexEnabled {
		return nil, fmt.Errorf("the namespace-wide search index is not enabled (global_search_index_enabled)")
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

			// Get last import time to pass to BuildIndex, which will check if the file-based
			// index needs to be rebuilt before opening it.
			lastImportTime, err := s.storage.GetResourceLastImportTime(ctx, key)
			if err != nil {
				s.log.FromContext(ctx).Warn("failed to get last import time", "error", err)
				// Continue without import time check
			}

			idx, err = s.build(ctx, key, unknownBuildSize, reason, false, lastImportTime)
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
			idx = res.Val.(searchmodel.ResourceIndex)
		case <-ctx.Done():
			return nil, tracing.Error(span, fmt.Errorf("failed to get index: %w", ctx.Err()))
		}
	}

	// A global index is kept current from notifications and repaired by
	// reconcile, so a search reads whatever it holds. It replays no events: one
	// reopened or restored is reconciled instead, see build.
	if key.IsGlobal() {
		return idx, nil
	}

	span.AddEvent("Updating index")
	start := time.Now()
	rv, err := idx.UpdateIndex(ctx)
	if err != nil {
		return nil, tracing.Error(span, fmt.Errorf("failed to update index to guarantee strong consistency: %w", err))
	}
	elapsed := time.Since(start)
	stats.AddIndexUpdateTime(elapsed)
	s.indexMetrics.SearchUpdateWaitTime.WithLabelValues(reason).Observe(elapsed.Seconds())
	s.log.FromContext(ctx).Debug("Index updated before search", "namespace", key.Namespace, "group", key.Group, "resource", key.Resource, "reason", reason, "duration", elapsed, "rv", rv)
	span.AddEvent("Index updated")

	return idx, nil
}

// bulkIndexBatcher hands documents to an index in batches, so building an index
// for a large resource does not hold every document in memory at once.
type bulkIndexBatcher struct {
	index searchmodel.ResourceIndex
	span  trace.Span
	items []*searchmodel.BulkIndexItem
	total int
	// Flushed with each batch, so counters move during a long build rather than
	// only at the end.
	phases *buildPhaseRecorder
}

func newBulkIndexBatcher(index searchmodel.ResourceIndex, span trace.Span, phases *buildPhaseRecorder) *bulkIndexBatcher {
	return &bulkIndexBatcher{index: index, span: span, items: make([]*searchmodel.BulkIndexItem, 0, maxBatchSize), phases: phases}
}

func (b *bulkIndexBatcher) add(item *searchmodel.BulkIndexItem) error {
	b.items = append(b.items, item)
	if len(b.items) < maxBatchSize {
		return nil
	}
	return b.flush()
}

func (b *bulkIndexBatcher) flush() error {
	if len(b.items) == 0 {
		return nil
	}
	b.span.AddEvent("bulk indexing", trace.WithAttributes(attribute.Int("count", len(b.items))))
	if err := b.index.BulkIndex(&searchmodel.BulkIndexRequest{Items: b.items, Path: b.phases.path}); err != nil {
		return err
	}
	b.total += len(b.items)
	b.phases.flush()
	b.items = b.items[:0]
	return nil
}

// indexed returns how many documents have been handed to the index.
func (b *bulkIndexBatcher) indexed() int { return b.total }

//nolint:gocyclo
func (s *searchServer) build(ctx context.Context, nsr resourcecontract.NamespacedResource, size int64, indexBuildReason string, rebuild bool, lastImportTime time.Time) (searchmodel.ResourceIndex, error) {
	ctx, span := tracer.Start(ctx, "resource.searchServer.build")
	defer span.End()

	span.SetAttributes(
		attribute.String("namespace", nsr.Namespace),
		attribute.String("group", nsr.Group),
		attribute.String("resource", nsr.Resource),
		attribute.Int64("size", size),
	)

	logger := s.log.New("namespace", nsr.Namespace, "group", nsr.Group, "resource", nsr.Resource)

	// For dashboards this reads the namespace's usage insights data, and an index
	// served from a snapshot never calls the callbacks that need it. Kept once
	// resolved: the cache entry expires while updaterFn keeps running, so asking
	// again would re-read the insights data.
	var builderMu sync.Mutex
	builders := map[resourcecontract.NamespacedResource]searchmodel.DocumentBuilder{}
	getBuilder := func(ctx context.Context, src resourcecontract.NamespacedResource) (searchmodel.DocumentBuilder, error) {
		builderMu.Lock()
		defer builderMu.Unlock()
		if b, ok := builders[src]; ok {
			return b, nil
		}
		b, err := s.builders.get(ctx, src)
		if err != nil {
			return nil, err
		}
		builders[src] = b
		return b, nil
	}

	// A namespace-wide index draws from several resource types; every other index
	// draws from its own. Documents of a namespace-wide index keep the standard
	// fields only, because it declares no others.
	sources := indexSources(nsr)
	standardFieldsOnly := nsr.IsGlobal()

	builderFn := func(index searchmodel.ResourceIndex) (int64, error) {
		span := trace.SpanFromContext(ctx)
		span.AddEvent("building index", trace.WithAttributes(attribute.Int64("size", size), attribute.String("reason", indexBuildReason)))

		phases := newBuildPhaseRecorder(s.indexMetrics, searchmetrics.IndexPathBuild, nsr)
		// Report whatever was accumulated even when the build gives up early, and
		// even when storage fails before handing over the iterator.
		defer phases.flush()

		// indexSource indexes every live object of one resource type, and returns
		// the resource version the listing was taken at, even when it fails.
		// How many documents each type contributed, logged once the build is done,
		// so the cost of a build can be read against the size of what it built.
		indexedDocs := map[string]int{}

		indexSource := func(src resourcecontract.NamespacedResource) (int64, error) {
			builder, err := getBuilder(ctx, src)
			if err != nil {
				return 0, err
			}

			// Storage does some of its work before handing over the iterator, so the
			// fetch phase starts here rather than at the first document. When storage
			// fails before handing it over there is no callback to charge that time to,
			// so it is charged once the call returns.
			listStart := time.Now()
			gotIterator := false
			listRV, err := s.storage.ListIterator(ctx, &resourcepb.ListRequest{
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{
						Group:     src.Group,
						Resource:  src.Resource,
						Namespace: src.Namespace,
					},
				},
			}, func(iter resourcecontract.ListIterator) error {
				gotIterator = true
				phases.recordFetchWithNoValue(time.Since(listStart))
				batch := newBulkIndexBatcher(index, span, phases)

				for {
					fetchStart := time.Now()
					hasNext := iter.Next()
					fetchElapsed := time.Since(fetchStart)
					if !hasNext {
						phases.recordFetchWithNoValue(fetchElapsed)
						break
					}
					if err := iter.Error(); err != nil {
						return err
					}

					// Update the key name
					key := &resourcepb.ResourceKey{
						Group:     src.Group,
						Resource:  src.Resource,
						Namespace: src.Namespace,
						Name:      iter.Name(),
					}

					value := iter.Value()
					phases.recordFetch(fetchElapsed, len(value))

					span.AddEvent("building document", trace.WithAttributes(attribute.String("name", iter.Name())))
					// Convert it to an indexable document
					convertStart := time.Now()
					doc, err := builder.BuildDocument(ctx, key, iter.ResourceVersion(), value)
					phases.recordConvert(time.Since(convertStart), err == nil)
					if err != nil {
						span.RecordError(err)
						logger.Error("error building search document", "key", resourcecontract.SearchID(key), "err", err)
						continue
					}
					if standardFieldsOnly {
						doc = keepStandardFieldsOnly(doc)
					}

					if err := batch.add(&searchmodel.BulkIndexItem{Action: searchmodel.ActionIndex, Doc: doc}); err != nil {
						return err
					}
					indexedDocs[src.GroupResource()]++
				}

				if err := batch.flush(); err != nil {
					return err
				}
				return iter.Error()
			})
			if !gotIterator {
				phases.recordFetchWithNoValue(time.Since(listStart))
			}
			return listRV, err
		}

		// A build lists everything, which is as good as comparing with storage.
		listedAt := time.Now()

		// The oldest resource version of the listings, so a change made while a
		// later listing ran is replayed by the updater rather than missed.
		indexRV := int64(0)
		for _, src := range sources {
			// Read before the listing: an import that lands during it then looks
			// newer than what is recorded, and the type is resynced.
			var importedAt time.Time
			if nsr.IsGlobal() {
				var err error
				if importedAt, err = s.storage.GetResourceLastImportTime(ctx, src); err != nil {
					return indexRV, err
				}
			}

			listRV, err := indexSource(src)
			if indexRV == 0 || (listRV > 0 && listRV < indexRV) {
				indexRV = listRV
			}
			if err != nil {
				return indexRV, err
			}

			// Recorded even with no import, because the record also says which
			// types the index has written in full.
			if nsr.IsGlobal() {
				if err := index.RecordCompletedTypeBuild(groupResourceOf(src), searchmodel.TypeBuild{StorageImportTime: importedAt}); err != nil {
					return indexRV, err
				}
			}
		}

		logger.Info("Listed documents for index", "documents", indexedDocs)

		// A namespace-wide index holds only live documents, so it has no trash to
		// restore.
		if nsr.IsGlobal() {
			return indexRV, index.RecordReconciledAt(listedAt)
		}

		// Deleted objects are not on the list above, and nothing will re-announce
		// them: an object is deleted once. Without this pass every rebuild would
		// drop the whole trash for this resource.
		//
		// The resource version stays the one from the live pass, which is the older
		// of the two, so anything that changed while this pass ran is replayed by
		// the updater rather than missed.
		if err := s.indexTrash(ctx, nsr, index, logger); err != nil {
			return indexRV, err
		}
		return indexRV, nil
	}

	var dedupCache *gocache.Cache
	if s.indexModificationCacheTTL > 0 {
		dedupCache = gocache.New(s.indexModificationCacheTTL, time.Minute)
	}

	addToDedupCache := func(pendingKeys []string) {
		if dedupCache != nil {
			for _, k := range pendingKeys {
				dedupCache.SetDefault(k, struct{}{})
			}
		}
	}

	var lastSinceRV int64
	var lastCalledAt *time.Time

	updaterFn := func(ctx context.Context, index searchmodel.ResourceIndex, sinceRV int64) (int64, int, error) {
		span := trace.SpanFromContext(ctx)
		span.AddEvent("updating index", trace.WithAttributes(attribute.Int64("sinceRV", sinceRV)))

		// If we're calling with the same sinceRV as last time, pass the timestamp
		// of our last call so the backend can skip the lookback window when safe.
		var calledAt *time.Time
		if lastSinceRV > 0 && sinceRV == lastSinceRV {
			calledAt = lastCalledAt
		}

		keepDeleted := s.keepsDeletedDocuments(nsr, index, logger)

		phases := newBuildPhaseRecorder(s.indexMetrics, searchmetrics.IndexPathUpdate, nsr)
		// Report whatever was accumulated even when the update gives up early, so a
		// failed run is not missing from the metrics.
		defer phases.flush()

		// updateSource applies what one resource type changed since sinceRV, and
		// returns the version storage answered with and how many changes it saw.
		updateSource := func(src resourcecontract.NamespacedResource) (int64, int, error) {
			builder, err := getBuilder(ctx, src)
			if err != nil {
				return 0, 0, err
			}

			// Storage queries for the latest resource version before returning the
			// sequence, which for an update with no changes is nearly all of the
			// fetching, so the phase starts here.
			listStart := time.Now()
			rv, it := s.storage.ListModifiedSince(ctx, src, sinceRV, calledAt)
			phases.recordFetchWithNoValue(time.Since(listStart))

			// Process documents in batches to avoid memory issues
			// When dealing with large collections (e.g., 100k+ documents),
			// loading all documents into memory at once can cause OOM errors.
			items := make([]*searchmodel.BulkIndexItem, 0, maxBatchSize)
			pendingKeys := make([]string, 0, maxBatchSize)

			docs := 0
			for res, err := range phases.timeModifiedResources(it) {
				// Finish quickly if context is done.
				if ctx.Err() != nil {
					return 0, 0, ctx.Err()
				}

				if err != nil {
					span.RecordError(err)
					return 0, 0, err
				}

				// Skip events we've already processed when the dedupCache is enabled.
				// The underlying ListModifiedSince implementation may return events
				// prior to sinceRV, and the cache lets us skip the extra work.
				//
				// Keyed by the whole object key: a global index shares one cache across
				// resource types, and two objects can share a name and a version.
				cacheKey := fmt.Sprintf("%s~%d", resourcecontract.SearchID(&res.Key), res.ResourceVersion)
				if dedupCache != nil {
					if _, found := dedupCache.Get(cacheKey); found {
						// Already processed, so there is nothing to convert and nothing lost.
						phases.recordConvertNotNeeded()
						continue
					}
				}

				docs++

				item := updateItem(ctx, builder, res, keepDeleted, phases, span, logger)
				if item == nil {
					// Logged already. Not remembered as processed, so a later update
					// tries it again.
					continue
				}
				if standardFieldsOnly && item.Doc != nil {
					item.Doc = keepStandardFieldsOnly(item.Doc)
				}
				items = append(items, item)

				pendingKeys = append(pendingKeys, cacheKey)

				// When we reach the batch size, perform bulk index and reset the batch.
				if len(items) >= maxBatchSize {
					span.AddEvent("bulk indexing", trace.WithAttributes(attribute.Int("count", len(items))))
					if err = index.BulkIndex(&searchmodel.BulkIndexRequest{Items: items, Path: searchmetrics.IndexPathUpdate}); err != nil {
						return 0, 0, err
					}

					addToDedupCache(pendingKeys)
					phases.flush()
					items = items[:0]
					pendingKeys = pendingKeys[:0]
				}
			}

			// Index any remaining items in the final batch.
			if len(items) > 0 {
				span.AddEvent("bulk indexing", trace.WithAttributes(attribute.Int("count", len(items))))
				if err := index.BulkIndex(&searchmodel.BulkIndexRequest{Items: items, Path: searchmetrics.IndexPathUpdate}); err != nil {
					return 0, 0, err
				}

				addToDedupCache(pendingKeys)
			}
			return rv, docs, nil
		}

		// Every source is asked for changes since the same point, and how far the
		// index has got is the oldest of their answers, so nothing newer than that
		// is skipped next time. Only a global index has more than one source, and
		// it gets no updater, so in practice there is one.
		listModifiedTime := time.Now()
		newRV := int64(0)
		totalDocs := 0
		for _, src := range sources {
			rv, docs, err := updateSource(src)
			if err != nil {
				return 0, 0, err
			}
			if newRV == 0 || (rv > 0 && rv < newRV) {
				newRV = rv
			}
			totalDocs += docs
		}

		// Update timestamp of calling the given `sinceRV` to be used the next
		// time this function is called.
		lastSinceRV = sinceRV
		lastCalledAt = &listModifiedTime

		return newRV, totalDocs, nil
	}

	// If lastImportTime is set and this is a dashboard resource, clear the cache
	// to ensure we get the latest usage insights data when rebuilding
	if !lastImportTime.IsZero() && nsr.Resource == dashboardv1.DASHBOARD_RESOURCE {
		s.builders.clearNamespacedCache(nsr)
	}

	// On the rebuild path, prefer downloading a fresh same-version remote
	// snapshot over rebuilding from scratch when one exists with BuildTime
	// within ~10% of the per-resource rebuild interval.
	maxFreshSnapshotAge := s.getIndexMaxAge(nsr) / 10

	// A global index replays no events, so it gets no updater.
	var updater searchmodel.UpdateFn = updaterFn
	if nsr.IsGlobal() {
		updater = nil
	}

	index, err := s.search.BuildIndex(ctx, nsr, size, indexBuildReason, builderFn, updater, rebuild, lastImportTime, maxFreshSnapshotAge)

	if err != nil {
		return nil, err
	}

	// A global index replays no events, so whatever it missed is repaired by
	// comparing it with storage, at once rather than at its next slot. One reused
	// from disk or restored from a snapshot missed what changed while it was
	// closed. One just built missed what changed after its listing: until it is
	// published, notifications go to the index it replaces, or nowhere.
	if nsr.IsGlobal() {
		s.queueReconcile(nsr)
	}

	// The indexed kinds metric is not recorded here: the search backend refreshes it
	// from the open indexes, so it also follows incremental updates and it is not
	// added up over repeated rebuilds.
	return index, nil
}

// updateItem turns one change storage reported into the item that brings an
// index in line with it. It returns nil for a change that cannot be applied,
// after logging why.
func updateItem(
	ctx context.Context,
	builder searchmodel.DocumentBuilder,
	res *resourcecontract.ModifiedResource,
	keepDeleted bool,
	phases *buildPhaseRecorder,
	span trace.Span,
	logger log.Logger,
) *searchmodel.BulkIndexItem {
	key := &res.Key
	switch res.Action {
	case resourcepb.WatchEvent_ADDED, resourcepb.WatchEvent_MODIFIED:
		span.AddEvent("building document", trace.WithAttributes(attribute.String("name", res.Key.Name)))
		// Convert it to an indexable document
		convertStart := time.Now()
		doc, err := builder.BuildDocument(ctx, key, res.ResourceVersion, res.Value)
		phases.recordConvert(time.Since(convertStart), err == nil)
		if err != nil {
			span.RecordError(err)
			logger.Error("error building search document", "key", resourcecontract.SearchID(key), "err", err)
			return nil
		}
		return &searchmodel.BulkIndexItem{Action: searchmodel.ActionIndex, Doc: doc}

	case resourcepb.WatchEvent_DELETED:
		// The delete event carries the object as it was, so trash searches can
		// find it. Two things send it to the index as a removal instead: an
		// index that cannot hold the markers, and a body we cannot read.
		var doc *searchmodel.IndexableDocument
		if keepDeleted {
			convertStart := time.Now()
			var err error
			doc, err = buildDeletedDocument(key, res.ResourceVersion, res.Value)
			// A failure here still leaves the removal below to give the index, so
			// nothing is lost and this is not counted as producing nothing. The
			// marker that could not be built is logged.
			phases.recordConvert(time.Since(convertStart), true)
			if err != nil {
				span.RecordError(err)
				logger.Warn("error building search document for deleted resource, removing it from the index instead", "key", resourcecontract.SearchID(key), "err", err)
			}
		} else {
			// The document is removed rather than converted, so it produced
			// something for the index all the same.
			phases.recordConvertNotNeeded()
		}
		if doc == nil {
			span.AddEvent("deleting document", trace.WithAttributes(attribute.String("name", res.Key.Name)))
			return &searchmodel.BulkIndexItem{Action: searchmodel.ActionDelete, Key: &res.Key}
		}
		span.AddEvent("marking document deleted", trace.WithAttributes(attribute.String("name", res.Key.Name)))
		return &searchmodel.BulkIndexItem{Action: searchmodel.ActionIndex, Doc: doc}

	default:
		logger.Error("can't update index with item, unknown action", "action", res.Action, "key", key)
		return nil
	}
}

// keepsDeletedDocuments reports whether deleted objects should stay in this
// index. They do not when the feature is switched off, or when the index predates
// the marker mappings and would serve a marked document as live. Either way the
// document is removed instead, as it was before trash search existed.
// keepsDeletedDocuments reads the decision recorded when the index was built, not
// the current setting, so a change takes effect on the next rebuild. Consulting the
// setting per write would leave trash missing what was deleted while it was off.
func (s *searchServer) keepsDeletedDocuments(key resourcecontract.NamespacedResource, index searchmodel.ResourceIndex, logger log.Logger) bool {
	// A namespace-wide index holds only live documents: a delete removes the
	// document, and trash is served from the per-resource index.
	if key.IsGlobal() {
		return false
	}

	info, err := index.BuildInfo()
	if err != nil {
		logger.Warn("cannot read index features, removing deleted documents instead of keeping them", "err", err)
		return false
	}
	if !slices.Contains(info.Features, searchmodel.IndexFeatureHoldsDeletedDocuments) {
		return false
	}
	missing := searchmodel.MissingIndexFeatures(info, searchmodel.TrashIndexFeatures())
	if len(missing) > 0 {
		logger.Debug("index does not map the markers on deleted documents, removing them until it is rebuilt", "missing", missing)
		return false
	}
	return true
}

// indexTrash adds the currently-deleted objects of a resource to the index,
// marked so only trash searches find them. Deleted objects are absent from the
// live listing the build runs, so this is the only thing that puts them back
// after a rebuild.
func (s *searchServer) indexTrash(ctx context.Context, nsr resourcecontract.NamespacedResource, index searchmodel.ResourceIndex, logger log.Logger) error {
	ctx, span := tracer.Start(ctx, "resource.searchServer.indexTrash")
	defer span.End()

	// Nothing to do when deleted objects are not kept: listing trash and building
	// documents that get dropped would be wasted work.
	if !s.keepsDeletedDocuments(nsr, index, logger) {
		return nil
	}

	req := &resourcepb.ListRequest{
		Limit:  listEverything,
		Source: resourcepb.ListRequest_TRASH,
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     nsr.Group,
				Resource:  nsr.Resource,
				Namespace: nsr.Namespace,
			},
		},
	}

	phases := newBuildPhaseRecorder(s.indexMetrics, searchmetrics.IndexPathTrash, nsr)
	// Report whatever was accumulated even when the pass gives up early.
	defer phases.flush()
	batch := newBulkIndexBatcher(index, span, phases)

	// Listing trash scans the history for deleted objects before handing over the
	// iterator, and for a resource with a lot of history that scan is most of the
	// fetching, so the phase starts here. A failure before the iterator arrives
	// has no callback to charge that time to, so it is charged once the call
	// returns.
	listStart := time.Now()
	gotIterator := false
	_, err := s.storage.ListHistory(ctx, req, func(iter resourcecontract.ListIterator) error {
		gotIterator = true
		phases.recordFetchWithNoValue(time.Since(listStart))
		for {
			fetchStart := time.Now()
			hasNext := iter.Next()
			fetchElapsed := time.Since(fetchStart)
			if !hasNext {
				phases.recordFetchWithNoValue(fetchElapsed)
				break
			}
			if err := iter.Error(); err != nil {
				return err
			}

			key := &resourcepb.ResourceKey{
				Group:     nsr.Group,
				Resource:  nsr.Resource,
				Namespace: nsr.Namespace,
				Name:      iter.Name(),
			}

			value := iter.Value()
			phases.recordFetch(fetchElapsed, len(value))

			convertStart := time.Now()
			doc, err := buildDeletedDocument(key, iter.ResourceVersion(), value)
			phases.recordConvert(time.Since(convertStart), err == nil)
			if err != nil {
				span.RecordError(err)
				logger.Error("error building search document for deleted resource", "key", resourcecontract.SearchID(key), "err", err)
				continue
			}

			if err := batch.add(&searchmodel.BulkIndexItem{Action: searchmodel.ActionIndex, Doc: doc}); err != nil {
				return err
			}
		}

		if err := batch.flush(); err != nil {
			return err
		}
		return iter.Error()
	})
	if !gotIterator {
		phases.recordFetchWithNoValue(time.Since(listStart))
	}
	if errors.Is(err, resource.ErrUnimplemented) {
		// The IAM backends (resourcepermission, noopstorage) embed
		// UnimplementedStorageBackend and serve their resource from legacy SQL, so
		// they have no history to list, and no trash to index either.
		logger.Debug("storage backend does not support listing trash, skipping deleted resources")
		return nil
	}
	if err != nil {
		return err
	}

	span.SetAttributes(attribute.Int("documents", batch.indexed()))
	if batch.indexed() > 0 {
		logger.Debug("indexed deleted resources", "documents", batch.indexed())
	}
	return nil
}

// buildDeletedDocument builds the document for an object that is in the trash.
// Trash serves a fixed field set, so the kind's builder is skipped: it would only
// add live-only fields, at about twice the cost. Title and tags come from the same
// place live search reads them, so the two agree.
//
// Fields are listed rather than cleared, so a field added to IndexableDocument
// later cannot reach trash documents by accident.
func buildDeletedDocument(key *resourcepb.ResourceKey, rv int64, value []byte) (*searchmodel.IndexableDocument, error) {
	var u unstructured.Unstructured
	if err := u.UnmarshalJSON(value); err != nil {
		return nil, fmt.Errorf("failed to unmarshal deleted object: %w", err)
	}
	obj, err := utils.MetaAccessor(&u)
	if err != nil {
		return nil, err
	}

	doc := &searchmodel.IndexableDocument{
		Key: key,
		// Searches sort on name as the final tie-breaker, so it has to be set.
		Name:   key.Name,
		RV:     rv,
		Title:  obj.FindTitle(key.Name),
		Folder: obj.GetFolder(),

		IsDeleted: new(true),
		DeletedRV: new(strconv.FormatInt(rv, 10)),
	}
	// Tags come from the marker's spec, which is the whole object as it was, so this
	// costs no extra read. A spec that is missing or not an object leaves them unset,
	// exactly as it leaves the title falling back to the name.
	if spec, err := obj.GetSpec(); err == nil {
		if specValue, ok := spec.(map[string]any); ok {
			doc.Tags = searchmodel.SpecTags(specValue["tags"])
		}
	}
	// The deletion marker records the deleting user as the last updater, which is
	// also what listFromTrash reads, so both trash views name the same user.
	if by := obj.GetUpdatedBy(); by != "" {
		doc.DeletedBy = &by
	}
	if ts := obj.GetDeletionTimestamp(); ts != nil {
		doc.DeletionTime = new(ts.UnixMilli())
	}
	// Only provisioned documents carry the marker, so absent means "not
	// provisioned", matching how the deleted marker works.
	if obj.GetAnnotation(utils.AnnoKeyManagerKind) != "" {
		doc.IsProvisioned = new(true)
	}
	return doc, nil
}

type builderCache struct {
	// The default builder
	defaultBuilder searchmodel.DocumentBuilder

	// Possible blob support
	blob resourcecontract.BlobSupport

	// lookup by group, then resource (namespace)
	// This is only modified at startup, so we do not need mutex for access
	lookup map[string]map[string]searchmodel.DocumentBuilderInfo

	// For namespaced based resources that require a cache
	ns *expirable.LRU[resourcecontract.NamespacedResource, searchmodel.DocumentBuilder]
	mu sync.Mutex // only locked for a cache miss
}

func newBuilderCache(cfg []searchmodel.DocumentBuilderInfo, nsCacheSize int, ttl time.Duration) (*builderCache, error) {
	cache := &builderCache{
		lookup: make(map[string]map[string]searchmodel.DocumentBuilderInfo),
		ns:     expirable.NewLRU[resourcecontract.NamespacedResource, searchmodel.DocumentBuilder](nsCacheSize, nil, ttl),
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
			g = make(map[string]searchmodel.DocumentBuilderInfo)
			cache.lookup[b.GroupResource.Group] = g
		}
		g[b.GroupResource.Resource] = b
	}
	return cache, nil
}

// context is typically background.  Holds an LRU cache for a
func (s *builderCache) get(ctx context.Context, key resourcecontract.NamespacedResource) (searchmodel.DocumentBuilder, error) {
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

func (s *builderCache) clearNamespacedCache(key resourcecontract.NamespacedResource) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ns.Remove(key)
}
