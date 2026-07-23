package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

// HybridSearch implements ResourceIndexServer. Runs the lexical and
// semantic legs concurrently, each filtered and authz-checked, then
// fuses the rankings with RRF. When a reranker is configured, the fused
// pool (top maxRerankCandidates) is re-scored by a cross-encoder and
// results below the requested min_relevance threshold are dropped. Both
// legs fetch 2x the requested limit so near-miss overlaps can still fuse
// into the top results.
//
// Returns Unimplemented when no embedding provider or vector backend is
// configured.
func (s *searchServer) HybridSearch(ctx context.Context, req *resourcepb.HybridSearchRequest) (resp *resourcepb.HybridSearchResponse, retErr error) {
	ctx, span := tracer.Start(ctx, "resource.searchServer.HybridSearch")
	defer span.End()

	if s.embedder == nil || s.vectorBackend == nil {
		return nil, status.Error(codes.Unimplemented, "hybrid search not configured")
	}
	if err := validateHybridSearchRequest(req); err != nil {
		return nil, err
	}

	limit := int(req.Limit)
	switch {
	case limit <= 0:
		limit = defaultVectorSearchLimit
	case limit > maxVectorSearchLimit:
		limit = maxVectorSearchLimit
	}
	depth := hybridFetchDepth(limit)

	span.SetAttributes(
		attribute.String("namespace", req.Key.Namespace),
		attribute.String("group", req.Key.Group),
		attribute.String("resource", req.Key.Resource),
		attribute.Int("limit", limit),
	)

	// Reject unauthenticated requests before they consume a slot of the
	// tenant's rate budget.
	user, ok := types.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return nil, status.Error(codes.Unauthenticated, "no user in context")
	}
	// Hybrid embeds a query, so it draws from the same per-tenant budget
	// as VectorSearch.
	if err := s.checkVectorSearchRateLimit(ctx, req.Key.Namespace); err != nil {
		return nil, err
	}

	embedText := req.Query
	if req.SemanticQuery != "" {
		embedText = req.SemanticQuery
	}

	g, gctx := errgroup.WithContext(ctx)

	var lex []lexicalHit
	g.Go(func() error {
		lexResp, err := s.Search(gctx, hybridLexicalRequest(req, depth))
		if err != nil {
			return fmt.Errorf("lexical leg: %w", err)
		}
		if lexResp.Error != nil {
			return fmt.Errorf("lexical leg: %s", lexResp.Error.Message)
		}
		lex = lexicalHitsFromResponse(lexResp)
		return nil
	})

	var sem []vector.VectorSearchResult
	g.Go(func() error {
		dense, err := s.embedVectorSearchQuery(gctx, req.Key.Namespace, embedText)
		if err != nil {
			return err
		}
		results, err := s.vectorBackend.Search(gctx,
			req.Key.Namespace, s.embedder.Model, req.Key.Resource,
			dense, depth, hybridVectorFilters(req.Filters)...)
		if err != nil {
			return fmt.Errorf("vector backend: %w", err)
		}
		allowed, err := s.batchCheckVectorSearchResults(gctx, user, req.Key, results)
		if err != nil {
			return fmt.Errorf("authz batch check: %w", err)
		}
		sem = make([]vector.VectorSearchResult, 0, len(results))
		for _, r := range results {
			if allowed[vectorAuthzKey{r.UID, r.Folder}] {
				sem = append(sem, r)
			}
		}
		return nil
	})

	if err := g.Wait(); err != nil {
		return nil, s.grpcStatusError(ctx, "hybrid search", err)
	}

	fused := fuseRRF(req.Key, lex, sem)
	if !req.SkipRerank {
		var err error
		fused, err = s.rerankHybridResults(ctx, embedText, fused, req.MinRelevance)
		if err != nil {
			return nil, err
		}
	}
	if len(fused) > limit {
		fused = fused[:limit]
	}
	return &resourcepb.HybridSearchResponse{Results: fused}, nil
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

// rerankHybridResults cross-encoder re-scores, re-sorts, and threshold-drops the fused candidates; fail-open on provider errors (only caller cancellation propagates).
func (s *searchServer) rerankHybridResults(ctx context.Context, query string, results []*resourcepb.HybridSearchResult, minRelevance string) ([]*resourcepb.HybridSearchResult, error) {
	if s.reranker == nil || len(results) == 0 {
		return results, nil
	}
	if len(results) > maxRerankCandidates {
		results = results[:maxRerankCandidates]
	}
	// Chunks[0] is the best text per resource: closest embedded chunk, whole-resource text for unchunked kinds, or the synthesized title chunk for lexical-only hits.
	texts := make([]string, len(results))
	for i, r := range results {
		texts[i] = r.Chunks[0].Content
		// One empty document (titleless lexical-only hit) would 400 the whole provider call.
		if texts[i] == "" {
			texts[i] = r.Key.Name
		}
	}

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

	if s.vectorMetrics != nil {
		s.vectorMetrics.RerankCandidatesTotal.
			WithLabelValues(s.reranker.Model).Add(float64(len(results)))
	}
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
		if dropped := len(results) - len(kept); dropped > 0 && s.vectorMetrics != nil {
			s.vectorMetrics.RerankDroppedResultsTotal.
				WithLabelValues(s.reranker.Model, minRelevance).Add(float64(dropped))
		}
		results = kept
	}
	return results, nil
}

// rerankFallback logs and returns the RRF-ordered input. Failed provider
// calls are visible in the rerank duration histogram's error/timeout series.
func (s *searchServer) rerankFallback(results []*resourcepb.HybridSearchResult, msg string, err error) []*resourcepb.HybridSearchResult {
	s.log.Warn(msg+"; returning RRF-ordered results", "err", err, "model", s.reranker.Model)
	return results
}

// rrfK is the standard Reciprocal Rank Fusion constant.
const rrfK = 60

// maxChunksPerHybridResult bounds response size; only the best chunk
// influences score, the rest are payload for RAG consumers.
const maxChunksPerHybridResult = 10

// maxRerankCandidates caps the scored pool (fused legs can reach 2x200) to one provider call
const maxRerankCandidates = 200

type lexicalHit struct {
	uid    string
	title  string
	folder string
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

	fromLex := make(map[string]struct{}, len(lex))
	for i, h := range lex {
		fromLex[h.uid] = struct{}{}
		r := get(h.uid)
		r.Score += 1.0 / float64(rrfK+i+1)
		r.Title = h.title
		r.Folder = h.folder
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
			// Only fill in the title and folder when the resource wasn't found by lexical search
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
		// Rerankers score content, so hits found only by title matching
		// still need text to score.
		if len(r.Chunks) == 0 {
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

// lexicalHitsFromResponse flattens the lexical leg's table into
// rank-ordered hits. STRING cells are raw bytes (see table.go's
// encoder). Missing columns leave fields empty; uid always comes from
// the row key.
func lexicalHitsFromResponse(resp *resourcepb.ResourceSearchResponse) []lexicalHit {
	if resp == nil || resp.Results == nil {
		return nil
	}
	titleIdx, folderIdx := -1, -1
	for i, c := range resp.Results.Columns {
		switch c.Name {
		case SEARCH_FIELD_TITLE:
			titleIdx = i
		case SEARCH_FIELD_FOLDER:
			folderIdx = i
		}
	}
	hits := make([]lexicalHit, 0, len(resp.Results.Rows))
	for _, row := range resp.Results.Rows {
		if row.Key == nil {
			continue
		}
		h := lexicalHit{uid: row.Key.Name}
		if titleIdx >= 0 && titleIdx < len(row.Cells) {
			h.title = string(row.Cells[titleIdx])
		}
		if folderIdx >= 0 && folderIdx < len(row.Cells) {
			h.folder = string(row.Cells[folderIdx])
		}
		hits = append(hits, h)
	}
	return hits
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

// validateHybridSearchRequest returns nil when valid, otherwise an
// InvalidArgument status error. Unlike Search/VectorSearch, hybrid never
// embeds errors in a successful response — request failures are always
// gRPC statuses so client metrics/alerting can track them.
func validateHybridSearchRequest(req *resourcepb.HybridSearchRequest) error {
	reqErr := func(msg string) error {
		return status.Error(codes.InvalidArgument, msg)
	}
	if req.Key == nil || req.Key.Namespace == "" || req.Key.Group == "" || req.Key.Resource == "" {
		return reqErr("missing namespace, group or resource")
	}
	if strings.TrimSpace(req.Query) == "" {
		return reqErr("query must not be empty")
	}
	if len(req.Query) > 1000 {
		return reqErr("query exceeds maximum length of 1000 bytes")
	}
	if len(req.SemanticQuery) > 1000 {
		return reqErr("semantic_query exceeds maximum length of 1000 bytes")
	}
	if req.SemanticQuery != "" && strings.TrimSpace(req.SemanticQuery) == "" {
		return reqErr("semantic_query must not be whitespace")
	}
	if req.MinRelevance != "" {
		if _, err := rerank.ParseRelevance(req.MinRelevance); err != nil {
			return reqErr(fmt.Sprintf("unsupported min_relevance %q (expected lowest, low, medium, high, or highest)", req.MinRelevance))
		}
		// A threshold without reranking is meaningless — reject rather than
		// silently ignore one of the two.
		if req.SkipRerank {
			return reqErr("min_relevance cannot be combined with skip_rerank")
		}
	}
	// Duplicate keys would diverge between legs: the lexical leg ANDs
	// repeated requirements while the vector backend keeps the last one.
	seen := make(map[string]struct{}, len(req.Filters))
	for _, f := range req.Filters {
		if _, ok := hybridFilterKeys[f.Key]; !ok {
			return reqErr(fmt.Sprintf("unsupported filter key %q", f.Key))
		}
		// Both legs evaluate every filter with IN semantics; accepting
		// other operators would silently misinterpret them.
		switch selection.Operator(f.Operator) {
		case selection.In, selection.Equals, selection.DoubleEquals, selection.Operator(""):
		default:
			return reqErr(fmt.Sprintf("unsupported filter operator %q (only in/= are supported)", f.Operator))
		}
		if _, dup := seen[f.Key]; dup {
			return reqErr(fmt.Sprintf("duplicate filter key %q", f.Key))
		}
		seen[f.Key] = struct{}{}
		if len(f.Values) == 0 {
			return reqErr(fmt.Sprintf("filter %q has no values", f.Key))
		}
		// These keys map to dashboard index fields and dashboard chunk
		// metadata; other kinds have no equivalents, so the filter would
		// silently match nothing — reject instead.
		if (f.Key == "datasource_uid" || f.Key == "language") && req.Key.Resource != "dashboards" {
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
func hybridLexicalRequest(req *resourcepb.HybridSearchRequest, depth int) *resourcepb.ResourceSearchRequest {
	out := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{Key: req.Key},
		Query:   req.Query,
		Limit:   int64(depth),
		Fields:  []string{SEARCH_FIELD_TITLE, SEARCH_FIELD_FOLDER},
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
