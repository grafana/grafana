package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/structpb"
	"k8s.io/apimachinery/pkg/selection"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	"github.com/grafana/grafana/pkg/storage/unified/resourceclient/resourceutil"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

// HybridSearch implements ResourceIndexServer. Runs the lexical and
// semantic legs concurrently, each filtered and authz-checked, then
// fuses each resource's rankings with RRF and interleaves resource types.
// When a reranker is configured, the combined
// pool (top maxRerankCandidates) is re-scored by a cross-encoder and
// results below the requested min_relevance threshold are dropped. Both
// legs fetch 2x the requested limit so near-miss overlaps can still fuse
// into the top results.
//
// Without an embedding provider or vector backend, searches the regular
// resource index using only the lexical leg.
func (s *searchServer) HybridSearch(ctx context.Context, req *resourcepb.HybridSearchRequest) (resp *resourcepb.HybridSearchResponse, retErr error) {
	ctx, span := tracer.Start(ctx, "resource.searchServer.HybridSearch")
	defer span.End()

	start := time.Now()
	// Labels captured before validation so the missing-key early returns
	// still observe a labeled sample, mirroring VectorSearch.
	group, resource := "unknown", "unknown"
	//nolint:staticcheck // Continue accepting requests from older clients.
	if req != nil && req.Key != nil {
		if g := req.Key.GetGroup(); g != "" {
			group = g
		}
		if r := req.Key.GetResource(); r != "" {
			resource = r
		}
	}
	defer func() {
		metricutil.ObserveWithExemplar(ctx,
			s.vectorMetrics.HybridSearchDuration.WithLabelValues(group, resource, status.Code(retErr).String()),
			time.Since(start).Seconds(),
		)
	}()

	if s.search == nil {
		return nil, status.Error(codes.Unimplemented, "search index not configured")
	}
	keys, err := parseHybridSearchRequest(req)
	if err != nil {
		return nil, err
	}
	namespace := keys[0].Namespace
	// Global callers can supply arbitrary resource names, including rejected targets.
	if req.RequireHybridEnabled || len(keys) > 1 {
		group, resource = GlobalSearchGroup, GlobalSearchResource
	} else {
		group, resource = keys[0].Group, keys[0].Resource
	}
	limit := min(int(req.Limit), maxVectorSearchLimit)
	if limit <= 0 {
		limit = defaultVectorSearchLimit
	}
	semanticQuery := req.Query
	if req.SemanticQuery != "" {
		semanticQuery = req.SemanticQuery
	}
	span.SetAttributes(
		attribute.String("namespace", namespace),
		attribute.String("group", group),
		attribute.String("resource", resource),
		attribute.Int("resource_count", len(keys)),
		attribute.Int("limit", limit),
	)

	// Reject unauthenticated and cross-tenant requests before spending quota.
	user, ok := types.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return nil, status.Error(codes.Unauthenticated, "no user in context")
	}
	if !types.NamespaceMatches(user.GetNamespace(), namespace) {
		return nil, status.Error(codes.PermissionDenied, "namespace mismatch")
	}
	for _, key := range keys {
		if err := s.checkAllowedReadService(user, key.Group, key.Resource); err != nil {
			return nil, err
		}
	}
	targets, err := s.prepareHybridTargets(ctx, req, keys)
	if err != nil {
		return nil, err
	}
	semanticEnabled := s.embedder != nil && s.vectorBackend != nil
	if semanticEnabled {
		if err := s.checkVectorSearchRateLimit(ctx, namespace); err != nil {
			return nil, err
		}
	}
	candidates, err := s.hybridSearchCandidates(ctx, user, req, targets, semanticQuery, hybridFetchDepth(limit))
	if err != nil {
		return nil, err
	}
	results := candidates[0].results
	if len(candidates) > 1 {
		results = interleaveHybridCandidates(candidates)
	}
	if !req.SkipRerank {
		results, err = s.rerankHybridResults(ctx, semanticQuery, results, req.MinRelevance)
		if err != nil {
			return nil, err
		}
	}
	span.SetAttributes(attribute.Int("results_truncated", max(0, len(results)-limit)))
	if len(results) > limit {
		results = results[:limit]
	}
	s.enrichHybridResults(ctx, namespace, candidates, results)
	kinds := make(map[string]string, len(targets))
	for _, target := range targets {
		if target.kind != "" {
			kinds[target.key.Group+"/"+target.key.Resource] = target.kind
		}
	}
	return &resourcepb.HybridSearchResponse{Results: results, Kinds: kinds}, nil
}

func (s *searchServer) checkAllowedReadService(user types.AuthInfo, group, resource string) error {
	allowed, restricted := s.allowedReadServices[group+"/"+resource]
	if !restricted {
		return nil
	}
	identities := user.GetExtra()[authnlib.ServiceIdentityKey]
	if user.GetIdentityType() != types.TypeAccessPolicy || len(identities) != 1 || !slices.Contains(allowed, identities[0]) {
		return status.Error(codes.PermissionDenied, "service identity not allowed to read collection")
	}
	return nil
}

type hybridTarget struct {
	key              *resourcepb.ResourceKey
	collection       vector.Collection
	storageNamespace string
	shared           bool
	kind             string
}

type hybridCandidates struct {
	key      *resourcepb.ResourceKey
	results  []*resourcepb.HybridSearchResult
	lexUIDs  map[string]struct{}
	external bool
	shared   bool
}

func (s *searchServer) prepareHybridTargets(ctx context.Context, req *resourcepb.HybridSearchRequest, keys []*resourcepb.ResourceKey) ([]hybridTarget, error) {
	targets := make([]hybridTarget, len(keys))
	for i, key := range keys {
		target := hybridTarget{key: key, storageNamespace: key.Namespace}
		sharedConfigured := s.sharedCollectionAllowlist.Allows(vector.Collection{Group: key.Group, Resource: key.Resource, IsExternal: true})
		if s.vectorBackend != nil {
			resolved, allowed, err := s.resolveAllowedCollection(ctx, key.Namespace, key.Group, key.Resource)
			if err != nil {
				return nil, s.grpcStatusError(ctx, "hybrid search: resolve collection", err)
			}
			if !allowed {
				if s.embedder != nil || sharedConfigured || resolved.collection.IsExternal || resolved.collection.Scope == vector.ScopeShared {
					return nil, status.Error(codes.NotFound, "collection not found")
				}
			} else {
				target.collection, target.storageNamespace, target.shared = resolved.collection, resolved.storageNamespace, resolved.shared
			}
		} else if sharedConfigured {
			return nil, status.Error(codes.Unavailable, "shared collection backend unavailable")
		}
		if target.collection.IsExternal {
			if s.externalLexical == nil {
				return nil, status.Error(codes.InvalidArgument, "hybrid search requires an indexed resource; use VectorSearch for external collections")
			}
			if s.embedder == nil || s.vectorBackend == nil {
				return nil, status.Error(codes.Unavailable, "external hybrid search backend unavailable")
			}
		}
		config := hybridSearchConfig{}
		if !target.collection.IsExternal {
			config = s.hybridSearchConfig.lookup(key.Group, key.Resource)
		}
		if req.RequireHybridEnabled && !target.collection.IsExternal && !config.enabled {
			return nil, status.Errorf(codes.InvalidArgument, "hybrid search is not enabled for %s/%s", key.Group, key.Resource)
		}
		if err := validateHybridSearchFilters(req.Filters, key, target.collection.IsExternal); err != nil {
			return nil, err
		}
		target.kind = config.kind
		targets[i] = target
	}
	return targets, nil
}

func (s *searchServer) hybridSearchCandidates(ctx context.Context, user types.AuthInfo, req *resourcepb.HybridSearchRequest, targets []hybridTarget, semanticQuery string, depth int) ([]hybridCandidates, error) {
	g, gctx := errgroup.WithContext(ctx)
	// Each resource has two legs; bound their total concurrency across resources.
	g.SetLimit(8)
	// All semantic legs share one vector while lexical retrieval runs concurrently.
	// The shared group lets either leg cancel embedding without waiting on another resource.
	embedding := sync.OnceValues(func() ([]float32, error) {
		return s.embedVectorSearchQuery(gctx, targets[0].key.Namespace, semanticQuery)
	})
	lex := make([][]lexicalHit, len(targets))
	sem := make([][]vector.VectorSearchResult, len(targets))
	for i, target := range targets {
		if gctx.Err() != nil {
			break
		}
		filters := hybridVectorFilters(req.Filters)
		if target.collection.IsExternal {
			filters = hybridExternalFilters(req.Filters)
		}
		g.Go(func() error {
			var err error
			lex[i], err = s.hybridLexicalLeg(gctx, user, req, target, depth, filters)
			return err
		})
		if s.embedder != nil && s.vectorBackend != nil {
			g.Go(func() error {
				dense, err := embedding()
				if err != nil {
					return err
				}
				sem[i], err = s.hybridSemanticLeg(gctx, user, target, dense, depth, filters)
				return err
			})
		}
	}
	if err := g.Wait(); err != nil {
		return nil, s.grpcStatusError(ctx, "hybrid search", err)
	}
	if err := ctx.Err(); err != nil {
		return nil, status.FromContextError(err).Err()
	}
	candidates := make([]hybridCandidates, len(targets))
	lexicalResultsTruncated := 0
	for i, target := range targets {
		for _, hit := range lex[i] {
			if hit.lexicalTruncated {
				lexicalResultsTruncated++
			}
		}
		candidates[i] = hybridCandidates{
			key: target.key, results: fuseRRF(target.key, lex[i], sem[i]),
			lexUIDs: lexicalUIDSet(lex[i]), external: target.collection.IsExternal, shared: target.shared,
		}
	}
	trace.SpanFromContext(ctx).SetAttributes(attribute.Int("lexical_results_truncated", lexicalResultsTruncated))
	return candidates, nil
}

// hybridLexicalLeg runs the lexical retrieval: FTS over stored rows for
// external collections (authz-filtered per hit), bleve for internal (the
// index enforces authz itself).
func (s *searchServer) hybridLexicalLeg(ctx context.Context, user types.AuthInfo, req *resourcepb.HybridSearchRequest, target hybridTarget, depth int, filters []vector.SearchFilter) ([]lexicalHit, error) {
	key, coll := target.key, target.collection
	if !coll.IsExternal {
		lexReq := hybridLexicalRequest(req, key, depth)
		lexResp, err := s.searchWithIndex(ctx, lexReq, func(idx ResourceIndex) {
			queryFields, rerankFields := hybridLexicalFields(idx.SearchFieldDefinitions(), s.reranker != nil && !req.SkipRerank)
			lexReq.QueryFields = queryFields
			for _, field := range rerankFields {
				if !slices.Contains(lexReq.Fields, field) {
					lexReq.Fields = append(lexReq.Fields, field)
				}
			}
		})
		if err := searchCallError(lexResp, err); err != nil {
			return nil, fmt.Errorf("lexical leg: %w", err)
		}
		hits, err := lexicalHitsFromResponse(lexResp)
		if err != nil {
			return nil, fmt.Errorf("lexical leg: decode response: %w", err)
		}
		return hits, nil
	}

	hits, err := s.externalLexical.LexicalSearch(ctx, vector.LexicalQuery{
		Namespace: target.storageNamespace,
		Model:     s.embedder.Model,
		Resource:  coll.PartitionKey,
		Query:     req.Query,
		Limit:     depth,
		Filters:   filters,
	})
	if err != nil {
		return nil, fmt.Errorf("lexical leg: %w", err)
	}
	items := make([]vector.VectorSearchResult, len(hits))
	for i, h := range hits {
		items[i] = vector.VectorSearchResult{UID: h.UID, Folder: h.Folder}
	}
	allowed, err := s.authorizeVectorSearchResults(ctx, user, key, target.shared, items)
	if err != nil {
		return nil, fmt.Errorf("authz batch check: %w", err)
	}
	lex := make([]lexicalHit, 0, len(hits))
	for _, h := range hits {
		if !allowed[vectorAuthzKey{h.UID, h.Folder}] {
			continue
		}
		lex = append(lex, lexicalHit{
			uid:              h.UID,
			title:            h.Title,
			folder:           h.Folder,
			chunkSubresource: h.Subresource,
			chunkContent:     h.Content,
			chunkMetadata:    h.Metadata,
		})
	}
	return lex, nil
}

// hybridSemanticLeg filters vector hits using the target resource's authorization.
func (s *searchServer) hybridSemanticLeg(ctx context.Context, user types.AuthInfo, target hybridTarget, dense []float32, depth int, filters []vector.SearchFilter) ([]vector.VectorSearchResult, error) {
	key, coll := target.key, target.collection
	results, err := s.vectorBackend.Search(ctx,
		target.storageNamespace, s.embedder.Model, coll.PartitionKey,
		dense, depth, filters...)
	if err != nil {
		return nil, fmt.Errorf("vector backend: %w", err)
	}
	allowed, err := s.authorizeVectorSearchResults(ctx, user, key, target.shared, results)
	if err != nil {
		return nil, fmt.Errorf("authz batch check: %w", err)
	}
	kept := results[:0]
	for _, r := range results {
		if allowed[vectorAuthzKey{r.UID, r.Folder}] {
			kept = append(kept, r)
		}
	}
	return kept, nil
}

// lexicalUIDSet returns the UIDs the lexical leg matched.
func lexicalUIDSet(lex []lexicalHit) map[string]struct{} {
	uids := make(map[string]struct{}, len(lex))
	for _, h := range lex {
		uids[h.uid] = struct{}{}
	}
	return uids
}

// resolveSemanticMetadata fills manager fields and tags on semantic-only hits
// (absent from lexUIDs) with one batched lookup; other hits already carry
// these fields off the lexical leg's own document. Best-effort, like
// resolveFolderTitles.
func (s *searchServer) resolveSemanticMetadata(ctx context.Context, key *resourcepb.ResourceKey, lexUIDs map[string]struct{}, results []*resourcepb.HybridSearchResult) {
	uids := make([]string, 0, len(results))
	for _, r := range results {
		if _, ok := lexUIDs[r.Key.Name]; !ok {
			uids = append(uids, r.Key.Name)
		}
	}
	if len(uids) == 0 {
		return
	}

	resp, err := s.Search(ctx, &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: key,
			Fields: []*resourcepb.Requirement{
				{Key: SEARCH_FIELD_NAME, Operator: string(selection.In), Values: uids},
			},
		},
		Limit:        int64(len(uids)),
		Fields:       []string{SEARCH_FIELD_MANAGER_KIND, SEARCH_FIELD_MANAGER_ID, SEARCH_FIELD_TAGS},
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	})
	if err := searchCallError(resp, err); err != nil {
		s.log.Warn("hybrid search: semantic metadata resolution failed", "err", err)
		return
	}

	hits, err := lexicalHitsFromResponse(resp)
	if err != nil {
		s.log.Warn("hybrid search: semantic metadata response decoding failed", "err", err)
		return
	}

	metadata := make(map[string]lexicalHit, len(uids))
	for _, hit := range hits {
		metadata[hit.uid] = hit
	}
	for _, r := range results {
		if hit, ok := metadata[r.Key.Name]; ok {
			r.ManagedByKind = hit.managerKind
			r.ManagedById = hit.managerID
			r.Tags = hit.tags
		}
	}
}

// resolveFolderTitles fills FolderTitle on the final results with one
// batched lookup against the folder index, so titles are always current
// (stored chunk metadata predates folder renames and mostly lacks the
// title entirely). Best-effort display data: failures leave titles empty
// and never fail the search.
func (s *searchServer) resolveFolderTitles(ctx context.Context, namespace string, results []*resourcepb.HybridSearchResult) {
	uids := make([]string, 0, len(results))
	seen := make(map[string]struct{}, len(results))
	for _, r := range results {
		// "" and "general" are root-folder sentinels, not real folders.
		if r.Folder == "" || r.Folder == "general" {
			continue
		}
		if _, dup := seen[r.Folder]; !dup {
			seen[r.Folder] = struct{}{}
			uids = append(uids, r.Folder)
		}
	}
	if len(uids) == 0 {
		return
	}

	resp, err := s.Search(ctx, &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: namespace,
				Group:     "folder.grafana.app",
				Resource:  "folders",
			},
			Fields: []*resourcepb.Requirement{
				{Key: SEARCH_FIELD_NAME, Operator: "in", Values: uids},
			},
		},
		Limit:        int64(len(uids)),
		Fields:       []string{SEARCH_FIELD_TITLE},
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	})
	if err := searchCallError(resp, err); err != nil {
		s.log.Warn("hybrid search: folder title resolution failed", "err", err)
		return
	}

	hits, err := lexicalHitsFromResponse(resp)
	if err != nil {
		s.log.Warn("hybrid search: folder title response decoding failed", "err", err)
		return
	}

	titles := make(map[string]string, len(uids))
	for _, hit := range hits {
		titles[hit.uid] = hit.title
	}
	for _, r := range results {
		r.FolderTitle = titles[r.Folder]
	}
}

// resolvedReadTarget separates the caller namespace from the collection's storage scope.
type resolvedReadTarget struct {
	collection       vector.Collection
	storageNamespace string
	shared           bool
}

// resolveAllowedCollection verifies catalog scope against trusted enrollment.
func (s *searchServer) resolveAllowedCollection(ctx context.Context, namespace, group, resource string) (resolvedReadTarget, bool, error) {
	coll, found, err := s.vectorBackend.ResolveCollection(ctx, group, resource)
	if err != nil {
		return resolvedReadTarget{}, false, err
	}
	if !found {
		return resolvedReadTarget{}, false, nil
	}
	shared := s.sharedCollectionAllowlist.Allows(vector.Collection{Group: group, Resource: resource, IsExternal: true})
	tenant := s.collectionAllowlist.Allows(coll)
	if shared && s.collectionAllowlist.AllowsInternalOrExternal(group, resource) {
		s.log.Error("search: overlapping collection enrollment", "group", group, "resource", resource)
		return resolvedReadTarget{}, false, status.Error(codes.Internal, "invalid collection enrollment")
	}
	unsupportedCatalogScope := coll.Scope != vector.ScopeTenant && coll.Scope != vector.ScopeShared
	internalSharedCollection := coll.Scope == vector.ScopeShared && !coll.IsExternal
	sharedEnrollmentWithoutSharedScope := shared && coll.Scope != vector.ScopeShared
	tenantEnrollmentWithoutTenantScope := tenant && coll.Scope != vector.ScopeTenant
	if unsupportedCatalogScope || internalSharedCollection || sharedEnrollmentWithoutSharedScope || tenantEnrollmentWithoutTenantScope {
		s.log.Error("search: collection policy mismatch", "group", group, "resource", resource, "scope", coll.Scope, "external", coll.IsExternal)
		return resolvedReadTarget{}, false, status.Error(codes.Internal, "collection policy mismatch")
	}
	if !shared && !tenant {
		return resolvedReadTarget{collection: coll}, false, nil
	}
	if !coll.IsExternal && s.embeddingBuilders != nil && !s.embeddingBuilders.Has(group, resource) {
		return resolvedReadTarget{}, false, nil
	}
	storageNamespace := namespace
	if shared {
		storageNamespace = vector.SharedNamespace
	}
	return resolvedReadTarget{collection: coll, storageNamespace: storageNamespace, shared: shared}, true, nil
}

func (s *searchServer) grpcStatusError(ctx context.Context, op string, err error) error {
	if ctx.Err() != nil {
		return status.FromContextError(ctx.Err()).Err()
	}
	switch status.Code(err) {
	case codes.Unknown, codes.Canceled, codes.DeadlineExceeded:
		s.log.Error(op, "err", err)
		return status.Error(codes.Internal, op)
	default:
		return err
	}
}

// grpcErrorFromErrorResult preserves embedded codes that carry retry
// semantics; anything else is a server fault for a server-built request.
func grpcErrorFromErrorResult(e *resourcepb.ErrorResult) error {
	if e == nil {
		return nil
	}

	switch e.Code {
	case http.StatusTooManyRequests:
		return status.Error(codes.ResourceExhausted, e.Message)
	case http.StatusServiceUnavailable:
		return status.Error(codes.Unavailable, e.Message)
	default:
		return fmt.Errorf("%s (code %d)", e.Message, e.Code)
	}
}

// searchCallError maps an ErrorResult — embedded in the response or attached
// to a grpc error's details — to a single error, so either form yields
// the same code. The result replaces the grpc error rather than joining
// it, which would let the grpc status win status.Code.
func searchCallError(resp *resourcepb.ResourceSearchResponse, err error) error {
	if err == nil {
		return grpcErrorFromErrorResult(resp.GetError())
	}
	if res := resourceutil.ErrorResultFromGRPCDetails(err); res != nil {
		return grpcErrorFromErrorResult(res)
	}
	return err
}

// rerankHybridResults cross-encoder re-scores, re-sorts, and threshold-drops the fused candidates; fail-open on provider errors (only caller cancellation propagates).
func (s *searchServer) rerankHybridResults(ctx context.Context, query string, results []*resourcepb.HybridSearchResult, minRelevance string) ([]*resourcepb.HybridSearchResult, error) {
	if s.reranker == nil || len(results) == 0 {
		return results, nil
	}
	if len(results) > maxRerankCandidates {
		results = results[:maxRerankCandidates]
	}
	// Keep the best semantic chunk (or title), with returned lexical text as
	// additional context even when the resource was found by both legs.
	texts := make([]string, len(results))
	lexicalRerankTextsTruncated := 0
	for i, r := range results {
		texts[i] = r.Chunks[0].Content
		text, truncated := lexicalRerankText(r.Lexical)
		if truncated {
			lexicalRerankTextsTruncated++
		}
		if text != "" && !strings.Contains(texts[i], text) {
			if strings.Contains(text, texts[i]) {
				texts[i] = text
			} else {
				texts[i] = strings.TrimSpace(texts[i] + "\n" + text)
			}
		}
		// One empty document (titleless lexical-only hit) would 400 the whole provider call.
		if texts[i] == "" {
			texts[i] = r.Key.Name
		}
	}
	trace.SpanFromContext(ctx).SetAttributes(attribute.Int("lexical_rerank_texts_truncated", lexicalRerankTextsTruncated))

	scores, err := s.reranker.Score(ctx, query, texts)
	if err != nil {
		if ctx.Err() != nil {
			return nil, status.FromContextError(ctx.Err()).Err()
		}
		return s.rerankFallback(results, "hybrid rerank failed", err), nil
	}
	if len(scores) != len(results) {
		return s.rerankFallback(results, "hybrid rerank returned wrong score count",
			fmt.Errorf("%d scores for %d results", len(scores), len(results))), nil
	}

	s.vectorMetrics.RerankCandidatesTotal.
		WithLabelValues(s.reranker.Model).Add(float64(len(results)))
	for i, r := range results {
		r.Score = scores[i]
	}
	sort.SliceStable(results, func(i, j int) bool {
		if results[i].Score != results[j].Score {
			return results[i].Score > results[j].Score
		}
		return results[i].Key.Name < results[j].Key.Name
	})

	if threshold := s.reranker.Thresholds.Resolve(rerank.Relevance(minRelevance)); threshold > 0 {
		kept := results[:0]
		for _, r := range results {
			if r.Score >= threshold {
				kept = append(kept, r)
			}
		}
		if dropped := len(results) - len(kept); dropped > 0 {
			s.vectorMetrics.RerankDroppedResultsTotal.
				WithLabelValues(s.reranker.Model, minRelevance).Add(float64(dropped))
		}
		results = kept
	}
	return results, nil
}

// rerankFallback logs and preserves the candidate order. Failed provider
// calls are visible in the rerank duration histogram's error/timeout series.
func (s *searchServer) rerankFallback(results []*resourcepb.HybridSearchResult, msg string, err error) []*resourcepb.HybridSearchResult {
	s.log.Warn(msg+"; preserving candidate order", "err", err, "model", s.reranker.Model)
	return results
}

// rrfK is the standard Reciprocal Rank Fusion constant.
const rrfK = 60

// maxChunksPerHybridResult bounds response size; only the best chunk
// is used for reranking alongside lexical text; the rest are payload for RAG consumers.
const maxChunksPerHybridResult = 10

// maxRerankCandidates bounds the combined candidate pool scored in one provider call.
const maxRerankCandidates = 500

type lexicalHit struct {
	uid              string
	title            string
	folder           string
	managerKind      string
	managerID        string
	tags             []string
	lexical          map[string]*structpb.Value
	lexicalTruncated bool

	// Best chunk, only set by the external leg; bleve hits get a
	// synthesized title chunk in fuseRRF instead.
	chunkSubresource string
	chunkContent     string
	chunkMetadata    []byte
}

// fuseRRF merges the two authz-filtered rankings into one per-resource
// list ordered by descending RRF score (Σ 1/(rrfK+rank), 1-based ranks).
// Semantic rows arrive chunk-per-row in ascending-distance order; the
// first chunk per uid sets that uid's rank, later chunks ride along
// best-first. Lexical titles win over embeddings-row titles. Ties break
// by name for deterministic output.
func fuseRRF(reqKey *resourcepb.ResourceKey, lex []lexicalHit, sem []vector.VectorSearchResult) []*resourcepb.HybridSearchResult {
	fused := make(map[string]*resourcepb.HybridSearchResult, len(lex)+len(sem))
	get := func(uid string) *resourcepb.HybridSearchResult {
		r, ok := fused[uid]
		if !ok {
			r = &resourcepb.HybridSearchResult{Key: &resourcepb.ResourceKey{
				Namespace: reqKey.Namespace,
				Group:     reqKey.Group,
				Resource:  reqKey.Resource,
				Name:      uid,
			}}
			fused[uid] = r
		}
		return r
	}

	fromLex := lexicalUIDSet(lex)
	// Held aside, not appended: a both-legs hit gets the same chunks from
	// the semantic leg. Only the external leg's hits carry chunk content
	// (bleve doesn't), so this stays nil for internal collections — a nil
	// map read below is a safe no-op.
	var lexChunks map[string]*resourcepb.HybridSearchChunk
	for i, h := range lex {
		r := get(h.uid)
		r.Score += 1.0 / float64(rrfK+i+1)
		r.Title = h.title
		r.Folder = h.folder
		r.ManagedByKind = h.managerKind
		r.ManagedById = h.managerID
		r.Tags = h.tags
		r.Lexical = h.lexical
		if h.chunkContent != "" {
			if lexChunks == nil {
				lexChunks = make(map[string]*resourcepb.HybridSearchChunk, len(lex))
			}
			lexChunks[h.uid] = &resourcepb.HybridSearchChunk{
				Subresource: h.chunkSubresource,
				Content:     h.chunkContent,
				Metadata:    h.chunkMetadata,
			}
		}
	}

	seen := make(map[string]struct{}, len(sem))
	rank := 0
	for i := range sem {
		v := &sem[i]
		r := get(v.UID)
		if _, dup := seen[v.UID]; !dup {
			seen[v.UID] = struct{}{}
			rank++
			r.Score += 1.0 / float64(rrfK+rank)
			// Only fill in the title and folder when the resource wasn't found by lexical search.
			if _, ok := fromLex[v.UID]; !ok {
				r.Title = titleFromChunkMetadata(v.Metadata, v.Title)
				r.Folder = v.Folder
			}
		}
		if len(r.Chunks) < maxChunksPerHybridResult {
			r.Chunks = append(r.Chunks, &resourcepb.HybridSearchChunk{
				Subresource: v.Subresource,
				Content:     v.Content,
				Metadata:    v.Metadata,
			})
		}
	}

	out := make([]*resourcepb.HybridSearchResult, 0, len(fused))
	for _, r := range fused {
		if c, ok := lexChunks[r.Key.Name]; ok {
			appendLexicalChunk(r, c)
		} else if len(r.Chunks) == 0 {
			// Rerankers need text: synthesize a title chunk.
			r.Chunks = []*resourcepb.HybridSearchChunk{{Content: r.Title}}
		}
		out = append(out, r)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Score != out[j].Score {
			return out[i].Score > out[j].Score
		}
		return out[i].Key.Name < out[j].Key.Name
	})
	return out
}

// appendLexicalChunk ensures the lexical-matched chunk ships even when the
// semantic leg retained different chunks: appended after them (so the
// reranker still scores the semantic-best chunk), deduped by subresource,
// evicting the last semantic chunk when at the cap.
func appendLexicalChunk(r *resourcepb.HybridSearchResult, c *resourcepb.HybridSearchChunk) {
	for _, existing := range r.Chunks {
		if existing.Subresource == c.Subresource {
			return
		}
	}
	if len(r.Chunks) >= maxChunksPerHybridResult {
		r.Chunks[len(r.Chunks)-1] = c
		return
	}
	r.Chunks = append(r.Chunks, c)
}

// titleFromChunkMetadata prefers the chunk metadata's resource-level
// title: the embeddings row title is chunk-qualified ("Dashboard — Panel",
// see embed/dashboard/extractor.go displayTitle) and only a fallback.
// Kinds whose metadata lacks the key fall back naturally.
func titleFromChunkMetadata(meta []byte, fallback string) string {
	if len(meta) == 0 {
		return fallback
	}
	var m struct {
		DashboardTitle string `json:"dashboardTitle"`
	}
	if err := json.Unmarshal(meta, &m); err != nil || m.DashboardTitle == "" {
		return fallback
	}
	return m.DashboardTitle
}

// lexicalHitsFromResponse decodes search rows into rank-ordered hits. Missing
// fields remain empty; uid always comes from the row key.
func lexicalHitsFromResponse(resp *resourcepb.ResourceSearchResponse) ([]lexicalHit, error) {
	if resp == nil {
		return nil, nil
	}

	switch resp.GetResultFormat() {
	case resourcepb.ResourceSearchRequest_UNSPECIFIED, resourcepb.ResourceSearchRequest_RESOURCE_TABLE:
		return lexicalHitsFromTable(resp.GetResults()), nil
	case resourcepb.ResourceSearchRequest_FIELD_VALUES:
		return lexicalHitsFromFieldValues(resp)
	default:
		return nil, fmt.Errorf("unsupported search result format %d", resp.GetResultFormat())
	}
}

func lexicalHitsFromTable(table *resourcepb.ResourceTable) []lexicalHit {
	if table == nil {
		return nil
	}
	titleIdx, folderIdx, managerKindIdx, managerIDIdx := -1, -1, -1, -1
	tagsIdx := -1
	for i, column := range table.GetColumns() {
		switch column.GetName() {
		case SEARCH_FIELD_TITLE:
			titleIdx = i
		case SEARCH_FIELD_FOLDER:
			folderIdx = i
		case SEARCH_FIELD_MANAGER_KIND:
			managerKindIdx = i
		case SEARCH_FIELD_MANAGER_ID:
			managerIDIdx = i
		case SEARCH_FIELD_TAGS:
			tagsIdx = i
		}
	}
	hits := make([]lexicalHit, 0, len(table.GetRows()))
	for _, row := range table.GetRows() {
		if row == nil || row.GetKey() == nil {
			continue
		}
		hit := lexicalHit{uid: row.GetKey().GetName()}
		if titleIdx >= 0 && titleIdx < len(row.GetCells()) {
			hit.title = string(row.GetCells()[titleIdx])
		}
		if folderIdx >= 0 && folderIdx < len(row.GetCells()) {
			hit.folder = string(row.GetCells()[folderIdx])
		}
		if managerKindIdx >= 0 && managerKindIdx < len(row.GetCells()) {
			hit.managerKind = string(row.GetCells()[managerKindIdx])
		}
		if managerIDIdx >= 0 && managerIDIdx < len(row.GetCells()) {
			hit.managerID = string(row.GetCells()[managerIDIdx])
		}
		if tagsIdx >= 0 && tagsIdx < len(row.GetCells()) {
			_ = json.Unmarshal(row.GetCells()[tagsIdx], &hit.tags)
		}
		hits = append(hits, hit)
	}
	return hits
}

func lexicalHitsFromFieldValues(resp *resourcepb.ResourceSearchResponse) ([]lexicalHit, error) {
	hits := make([]lexicalHit, 0, len(resp.GetRows()))
	for i, row := range resp.GetRows() {
		if row == nil || row.GetKey() == nil {
			continue
		}
		values, err := DecodeSearchValues(resp.GetFields(), row)
		if err != nil {
			return nil, fmt.Errorf("row %d: %w", i, err)
		}
		hit := lexicalHit{uid: row.GetKey().GetName()}
		if hit.title, err = searchStringValue(values, SEARCH_FIELD_TITLE); err != nil {
			return nil, fmt.Errorf("row %d: %w", i, err)
		}
		if hit.folder, err = searchStringValue(values, SEARCH_FIELD_FOLDER); err != nil {
			return nil, fmt.Errorf("row %d: %w", i, err)
		}
		if hit.managerKind, err = searchStringValue(values, SEARCH_FIELD_MANAGER_KIND); err != nil {
			return nil, fmt.Errorf("row %d: %w", i, err)
		}
		if hit.managerID, err = searchStringValue(values, SEARCH_FIELD_MANAGER_ID); err != nil {
			return nil, fmt.Errorf("row %d: %w", i, err)
		}
		if value, ok := values[SEARCH_FIELD_TAGS]; ok {
			var valid bool
			hit.tags, valid = value.([]string)
			if !valid {
				return nil, fmt.Errorf("row %d: field %q: expected string array, got %T", i, SEARCH_FIELD_TAGS, value)
			}
		}
		hit.lexical, hit.lexicalTruncated = boundedLexicalFields(values)
		hits = append(hits, hit)
	}
	return hits, nil
}

func searchStringValue(values map[string]any, name string) (string, error) {
	value, ok := values[name]
	if !ok {
		return "", nil
	}
	text, ok := value.(string)
	if !ok {
		return "", fmt.Errorf("field %q is not a string", name)
	}
	return text, nil
}

func hybridFetchDepth(limit int) int {
	return min(2*limit, maxVectorSearchLimit)
}

// hybridFilterKeys is the v1 contract: only keys BOTH legs enforce
// natively, so filtering never degrades either leg's recall.
var hybridFilterKeys = map[string]struct{}{
	"uid": {}, "folder": {}, "datasource_uid": {}, "language": {},
}

// languageToDSTypes approximates language filtering on the lexical leg,
// which indexes datasource types but not per-query languages. Mirrors
// inferLanguage in embed/dashboard/extractor.go — keep in sync. That
// function matches substrings, so exotic plugin ids can still be missed
// here; the real fix is indexing languages in bleve (tracked follow-up).
var languageToDSTypes = map[string][]string{
	"promql":  {"prometheus", "grafana-azureprometheus-datasource", "grafana-amazonprometheus-datasource"},
	"logql":   {"loki"},
	"traceql": {"tempo"},
	// "postgres" is the legacy alias; current dashboards carry the full
	// plugin id.
	"sql": {
		"mysql", "postgres", "grafana-postgresql-datasource", "mssql",
		"grafana-clickhouse-datasource", "grafana-bigquery-datasource",
		"grafana-snowflake-datasource",
	},
}

// Hybrid search uses gRPC status errors instead of response-embedded errors
// so failed requests remain visible to client metrics.
func parseHybridSearchRequest(req *resourcepb.HybridSearchRequest) ([]*resourcepb.ResourceKey, error) {
	reqErr := func(msg string) error {
		return status.Error(codes.InvalidArgument, msg)
	}
	keys, err := hybridSearchKeys(req)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(req.Query) == "" {
		return nil, reqErr("query must not be empty")
	}
	if len(req.Query) > 1000 {
		return nil, reqErr("query exceeds maximum length of 1000 bytes")
	}
	if len(req.SemanticQuery) > 1000 {
		return nil, reqErr("semantic_query exceeds maximum length of 1000 bytes")
	}
	if req.SemanticQuery != "" && strings.TrimSpace(req.SemanticQuery) == "" {
		return nil, reqErr("semantic_query must not be whitespace")
	}
	if req.MinRelevance != "" {
		if _, err := rerank.ParseRelevance(req.MinRelevance); err != nil {
			return nil, reqErr(fmt.Sprintf("unsupported min_relevance %q (expected lowest, low, medium, high, or highest)", req.MinRelevance))
		}
		// A threshold without reranking is meaningless — reject rather than
		// silently ignore one of the two.
		if req.SkipRerank {
			return nil, reqErr("min_relevance cannot be combined with skip_rerank")
		}
	}
	// Duplicate keys would diverge between legs: the lexical leg ANDs
	// repeated requirements while the vector backend keeps the last one.
	seen := make(map[string]struct{}, len(req.Filters))
	totalValues := 0
	for _, f := range req.Filters {
		if f == nil || f.Key == "" {
			return nil, reqErr("filter key must not be empty")
		}
		// Both legs evaluate every filter with IN semantics; accepting
		// other operators would silently misinterpret them.
		switch selection.Operator(f.Operator) {
		case selection.In, selection.Equals, selection.DoubleEquals, selection.Operator(""):
		default:
			return nil, reqErr(fmt.Sprintf("unsupported filter operator %q (only in/= are supported)", f.Operator))
		}
		if _, dup := seen[f.Key]; dup {
			return nil, reqErr(fmt.Sprintf("duplicate filter key %q", f.Key))
		}
		seen[f.Key] = struct{}{}
		if len(f.Values) == 0 {
			return nil, reqErr(fmt.Sprintf("filter %q has no values", f.Key))
		}
		totalValues += len(f.Values)
	}
	// Values become SQL parameters; mirror the write path's cap.
	if totalValues > maxFilterValues {
		return nil, reqErr(fmt.Sprintf("too many filter values: %d > %d", totalValues, maxFilterValues))
	}
	if len(keys) > 1 {
		for _, filter := range req.Filters {
			if filter.Key != "uid" && filter.Key != "folder" {
				return nil, reqErr("cross-resource filters support only uid and folder")
			}
		}
	}
	return keys, nil
}

// validateHybridSearchFilters applies the per-kind filter contract after
// collection resolution: internal = closed allowlist enforced natively by
// both legs; external = any metadata key (both legs share one table).
func validateHybridSearchFilters(filters []*resourcepb.Requirement, key *resourcepb.ResourceKey, isExternal bool) error {
	reqErr := func(msg string) error {
		return status.Error(codes.InvalidArgument, msg)
	}
	if isExternal {
		return nil
	}
	for _, f := range filters {
		if _, ok := hybridFilterKeys[f.Key]; !ok {
			return reqErr(fmt.Sprintf("unsupported filter key %q", f.Key))
		}
		// These keys map to dashboard index fields and dashboard chunk
		// metadata; other kinds have no equivalents, so the filter would
		// silently match nothing — reject instead.
		if (f.Key == "datasource_uid" || f.Key == "language") && key.Resource != "dashboards" {
			return reqErr(fmt.Sprintf("filter %q is only supported for dashboards", f.Key))
		}
		// Unknown languages would leave the lexical leg unfiltered while
		// the semantic leg matches nothing — reject instead.
		if f.Key == "language" {
			for _, v := range f.Values {
				if _, ok := languageToDSTypes[v]; !ok {
					return reqErr(fmt.Sprintf("unsupported language %q", v))
				}
			}
		}
	}
	return nil
}

// hybridLexicalRequest maps the hybrid request onto the Search contract.
// Field names "reference.DataSource" and "ds_types" are the dashboard
// index's declared fields (search/builders/dashboard.go); importing the
// builders package here would cycle, hence the literals.
func hybridLexicalRequest(req *resourcepb.HybridSearchRequest, key *resourcepb.ResourceKey, depth int) *resourcepb.ResourceSearchRequest {
	out := &resourcepb.ResourceSearchRequest{
		Options:      &resourcepb.ListOptions{Key: key},
		Query:        req.Query,
		Limit:        int64(depth),
		Fields:       []string{SEARCH_FIELD_TITLE, SEARCH_FIELD_FOLDER, SEARCH_FIELD_MANAGER_KIND, SEARCH_FIELD_MANAGER_ID, SEARCH_FIELD_TAGS},
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	}
	add := func(key string, values []string) {
		out.Options.Fields = append(out.Options.Fields, &resourcepb.Requirement{
			Key: key, Operator: "in", Values: values,
		})
	}
	for _, f := range req.Filters {
		switch f.Key {
		case "uid":
			add(SEARCH_FIELD_NAME, f.Values)
		case "folder":
			add(SEARCH_FIELD_FOLDER, f.Values)
		case "datasource_uid":
			add("reference.DataSource", f.Values)
		case "language":
			var types []string
			for _, v := range f.Values {
				types = append(types, languageToDSTypes[v]...)
			}
			// Per-kind fields live under the "fields." sub-document in the
			// index, unlike top-level name/folder/reference fields.
			add(SEARCH_FIELD_PREFIX+"ds_types", types)
		}
	}
	return out
}

// hybridVectorFilters maps filter keys onto the vector backend's shape:
// uid/folder are first-class columns; the rest are metadata containment
// against the embed extractor's keys (datasourceUid, language — see
// search/embed/dashboard/extractor.go).
// expandRootFolder mirrors the lexical leg's root-folder handling (see
// bleve.go's folder requirement rewrite): stored rows carry either the
// legacy "" or the canonical "general" sentinel, so filtering by one
// must match both.
func expandRootFolder(values []string) []string {
	hasEmpty, hasGeneral := false, false
	for _, v := range values {
		switch v {
		case "":
			hasEmpty = true
		case "general":
			hasGeneral = true
		}
	}
	if hasEmpty == hasGeneral {
		return values
	}
	if hasEmpty {
		return append(append(make([]string, 0, len(values)+1), values...), "general")
	}
	return append(append(make([]string, 0, len(values)+1), values...), "")
}

func hybridVectorFilters(reqs []*resourcepb.Requirement) []vector.SearchFilter {
	out := make([]vector.SearchFilter, 0, len(reqs))
	for _, f := range reqs {
		switch f.Key {
		case "uid":
			out = append(out, vector.SearchFilter{Field: f.Key, Values: f.Values})
		case "folder":
			out = append(out, vector.SearchFilter{Field: f.Key, Values: expandRootFolder(f.Values)})
		case "datasource_uid":
			out = append(out, vector.SearchFilter{Field: "datasourceUid", Values: f.Values})
		case "language":
			out = append(out, vector.SearchFilter{Field: "language", Values: f.Values})
		}
	}
	return out
}

// hybridExternalFilters passes keys through verbatim: "uid" and "folder"
// are columns, anything else is metadata containment.
func hybridExternalFilters(reqs []*resourcepb.Requirement) []vector.SearchFilter {
	out := make([]vector.SearchFilter, 0, len(reqs))
	for _, f := range reqs {
		out = append(out, vector.SearchFilter{Field: f.Key, Values: f.Values})
	}
	return out
}
