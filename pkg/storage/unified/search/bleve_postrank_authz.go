package search

import (
	"context"
	"fmt"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/search"

	"github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// PostRankAuthzConfig tunes the post-filter authorization path: bleve ranks
// without the in-searcher authz wrapper, a bounded window of hits is fetched,
// and authorization runs app-side in rank order, paging via SearchAfter until
// the page is filled or the candidate budget is hit.
type PostRankAuthzConfig struct {
	// OverFetchFactor multiplies the requested limit to size the first bleve
	// window. Subsequent windows grow geometrically (see growWindow).
	OverFetchFactor int
	// MaxWindow is the ceiling on each per-window bleve Size, and the cap the
	// geometric window growth saturates at. Bounds per-search peak memory (the
	// post-rank path loads all stored fields per hit) while letting sparse
	// scans cover ground in fewer searches.
	MaxWindow int
	// MaxCandidates is the page-fill candidate budget: the scan stops after
	// authorizing this many ranked hits. Bounds work for low authorized
	// fractions. Trade-off: authorized docs sorting beyond the budget yield a
	// short/empty page for sparse-access users (the in-searcher path is the
	// exact alternative).
	MaxCandidates int
	// FacetSampleSize is the candidate budget when aggregating facets. Facet
	// counts reflect a sample of up to this many ranked hits, not the full
	// authorized set. Smaller than MaxCandidates since facets are a
	// distribution that stabilizes with a modest sample.
	FacetSampleSize int
}

// effective fills zero/negative fields with the defaults used by the post-filter
// path.
func (c PostRankAuthzConfig) effective() PostRankAuthzConfig {
	if c.OverFetchFactor <= 0 {
		c.OverFetchFactor = 5
	}
	if c.MaxWindow <= 0 {
		c.MaxWindow = 10000
	}
	if c.MaxCandidates <= 0 {
		c.MaxCandidates = 50000
	}
	if c.FacetSampleSize <= 0 {
		c.FacetSampleSize = 10000
	}
	return c
}

// windowSize returns the per-window bleve Size for the first window:
// limit * OverFetchFactor clamped to MaxWindow. Ranking is unaffected: bleve
// ranks the full match set and returns the top-N regardless of Size.
func (c PostRankAuthzConfig) windowSize(limit int) int {
	w := limit * c.OverFetchFactor
	if w > c.MaxWindow {
		w = c.MaxWindow
	}
	return w
}

// facetWindowSize returns the per-window bleve Size for facet queries: the
// facet sample budget (FacetSampleSize) capped at MaxWindow. Facets need a
// stable sample of up to FacetSampleSize candidates, so each window is as
// large as the budget allows (capped by MaxWindow) to cover the sample in the
// fewest bleve searches — each SearchAfter is a fresh search that re-walks the
// match set, so fewer, larger windows means less total scoring work. With the
// defaults (FacetSampleSize == MaxWindow == 10000) the whole sample is one
// window.
func (c PostRankAuthzConfig) facetWindowSize() int {
	w := c.FacetSampleSize
	if w > c.MaxWindow {
		w = c.MaxWindow
	}
	return w
}

// growWindow sizes each bleve window after the first. The first window uses
// windowSize(limit); subsequent windows double so a sparse-access or
// deep-offset scan covers ground in fewer, larger windows. Each bleve
// SearchAfter is a fresh search that re-walks the match set (SearchAfter
// filters inside the collector, after per-hit sort values are computed), so
// fewer searches means less total scoring work. Capped at MaxWindow — the
// per-search peak-memory bound, which matters here because the post-rank
// path loads all stored fields per hit. The common case (high authorized
// fraction) still fills the page on the first small window, so growth only
// kicks in when early windows come back sparse.
func (c PostRankAuthzConfig) growWindow(base, nextWindow int) int {
	w := base
	for i := 0; i < nextWindow; i++ {
		w <<= 1
		if w >= c.MaxWindow {
			return c.MaxWindow
		}
	}
	return w
}

// ensureSearchFields makes bleve load every stored field when the caller did not
// request an explicit field set. The SEARCH_FIELD_ALL_FIELDS sentinel tells
// hitsToTable to use the curated allFields column list.
func (b *bleveIndex) ensureSearchFields(searchrequest *bleve.SearchRequest, req *resourcepb.ResourceSearchRequest) error {
	if len(searchrequest.Fields) < 1 && req.Limit > 0 {
		f, err := b.index.Fields()
		if err != nil {
			return err
		}
		searchrequest.Fields = append(f, resource.SEARCH_FIELD_ALL_FIELDS)
	}
	return nil
}

// ensureAuthzFields makes bleve load the folder stored field so the post-rank
// runner can authorize each hit (parseHitDocInfo reads it from doc.Fields). This
// extends the bleve load list only; it is NOT part of the response column list
// (selectFields) — Search snapshots selectFields before calling this so the
// caller's requested columns are returned unchanged.
func (b *bleveIndex) ensureAuthzFields(searchrequest *bleve.SearchRequest) {
	if !slices.Contains(searchrequest.Fields, resource.SEARCH_FIELD_FOLDER) &&
		!slices.Contains(searchrequest.Fields, resource.SEARCH_FIELD_ALL_FIELDS) {
		searchrequest.Fields = append(searchrequest.Fields, resource.SEARCH_FIELD_FOLDER)
	}
}

// ensureFacetFields makes bleve load the facet stored fields so the post-rank
// runner can aggregate them app-side (facetAggregator.add reads them from
// doc.Fields). Like ensureAuthzFields this extends the bleve load list only; it
// is NOT part of the response column list (selectFields).
func (b *bleveIndex) ensureFacetFields(searchrequest *bleve.SearchRequest, req *resourcepb.ResourceSearchRequest) {
	if slices.Contains(searchrequest.Fields, resource.SEARCH_FIELD_ALL_FIELDS) {
		return
	}
	for _, f := range req.Facet {
		if !slices.Contains(searchrequest.Fields, f.Field) {
			searchrequest.Fields = append(searchrequest.Fields, f.Field)
		}
	}
}

// authzResources builds the resource-type -> verb map used to authorize hits.
// The primary resource uses the verb implied by req.Permission; federated
// resources are read-only.
func (b *bleveIndex) authzResources(req *resourcepb.ResourceSearchRequest) map[string]string {
	verb := utils.VerbGet
	if req.Permission == int64(dashboardaccess.PERMISSION_EDIT) {
		verb = utils.VerbUpdate
	}
	resources := map[string]string{
		b.key.Resource: verb,
	}
	for _, federated := range req.Federated {
		resources[federated.Resource] = utils.VerbGet
	}
	return resources
}

// parseHitDocInfo extracts the authorization fields from an already-ranked hit.
// Unlike batchAuthzSearcher.parseDocInfo (which reads doc values mid-search),
// the hit here already has its ID and stored fields populated by bleve. The doc
// id is <namespace>/<group>/<resourceType>/<name>; the resourceType segment
// distinguishes dashboards from folders in a federated alias and keys the verb.
func parseHitDocInfo(doc *search.DocumentMatch, resources map[string]string) (docInfo, bool) {
	parts := strings.Split(doc.ID, "/")
	if len(parts) != 4 {
		return docInfo{}, false
	}
	resourceType := parts[2]
	verb, ok := resources[resourceType]
	if !ok {
		return docInfo{}, false
	}

	folder := ""
	if v, ok := doc.Fields[resource.SEARCH_FIELD_FOLDER].(string); ok {
		folder = v
	}

	return docInfo{
		doc:          doc,
		namespace:    parts[0],
		group:        parts[1],
		resourceType: resourceType,
		name:         parts[3],
		folder:       folder,
		verb:         verb,
	}, true
}

// runPostFilterAuthz implements postFilter mode: bleve ranks without the authz
// wrapper, the runner fetches bounded windows (paging via SearchAfter),
// authorizes hits in rank order, and stops once the page is filled (page-fill
// queries) or the candidate budget is hit. TotalHits is the exact authorized
// count when the scan exhausts the index from the top (small sets, no incoming
// SearchAfter), else the unfiltered match count (page filled early / cap hit /
// cursor pages — fast over exact). Facets are aggregated app-side over the
// authorized sample. index may be a single bleve index or an IndexAlias
// (dashboards + folders); the globally-unique doc ID keeps the SortDocID
// tie-breaker a total order across the merged set. SearchBefore is a
// reversed-sort SearchAfter (see applySearchBefore).
func (b *bleveIndex) runPostFilterAuthz(
	ctx context.Context,
	access authlib.AccessClient,
	req *resourcepb.ResourceSearchRequest,
	index bleve.Index,
	firstReq *bleve.SearchRequest,
	selectFields []string,
	stats *resource.SearchStats,
	response *resourcepb.ResourceSearchResponse,
) (*resourcepb.ResourceSearchResponse, error) {
	limit, offset := int(req.Limit), int(req.Offset)
	ctx, span := tracer.Start(ctx, "search.postRankAuthz", trace.WithAttributes(
		attribute.String("namespace", b.key.Namespace),
		attribute.String("group", b.key.Group),
		attribute.Int("search.limit", limit),
		attribute.Int("search.offset", offset),
	))
	defer span.End()

	resources := b.authzResources(req)
	cfg := b.postRankAuthz
	wantFacets := len(req.Facet) > 0

	extractFn := func(info docInfo) authz.BatchCheckItem {
		return authz.BatchCheckItem{
			Name:      info.name,
			Folder:    info.folder,
			Verb:      info.verb,
			Group:     info.group,
			Resource:  info.resourceType,
			Namespace: info.namespace,
		}
	}

	page := make(search.DocumentMatchCollection, 0, limit)
	var agg *facetAggregator
	if wantFacets {
		agg = newFacetAggregator(req.Facet)
	}

	var candidates int64
	var authorized int64
	var exhausted bool
	var firstRes *bleve.SearchResult
	// Facet scans sample to FacetSampleSize; page-fill scans use the larger
	// MaxCandidates budget so low authorized fractions can still fill the page.
	maxCandidates := int64(cfg.MaxCandidates)
	if wantFacets {
		maxCandidates = int64(cfg.FacetSampleSize)
	}

	// SearchBefore is a reversed-sort SearchAfter (mirrors bleve's native
	// SearchBefore): reverse the whole Sort once so the SortDocID tie-breaker
	// stays a total order in the reversed direction, walk away from the cursor,
	// then reverse the page back to forward order in finalizePostFilter.
	reverseSort := applySearchBefore(req, firstReq)

	windowReq := firstReq
	for window := 0; ; window++ {
		res, err := index.SearchInContext(ctx, windowReq)
		if err != nil {
			return nil, err
		}
		stats.AddSearchTime(res.Took)
		if firstRes == nil {
			firstRes = res
			stats.AddTotalHits(int(res.Total))
		}

		// Authorize this window's hits in rank order. Facets always stop at the
		// sample budget; page-fill scans keep going past MaxCandidates until at
		// least one row is found, so sparse users don't get an empty first page.
		windowHits := res.Hits
		candidateSeq := func(yield func(docInfo) bool) {
			for _, hit := range windowHits {
				if candidates >= maxCandidates && (wantFacets || len(page) > 0) {
					return
				}
				info, ok := parseHitDocInfo(hit, resources)
				if !ok {
					continue
				}
				candidates++
				if !yield(info) {
					return
				}
			}
		}

		stop := false
		for info, err := range authz.FilterAuthorized(ctx, access, candidateSeq, extractFn, authz.WithTracer(tracer)) {
			if err != nil {
				return nil, err
			}
			authorized++
			if wantFacets {
				agg.add(info.doc)
			}
			// Skip the first `offset` authorized hits, then fill the page.
			if authorized > int64(offset) && len(page) < limit {
				page = append(page, info.doc)
			}
			// Page-fill: stop as soon as the page is full (early-exit). Facet
			// scans never early-exit — they walk the whole sample budget.
			if !wantFacets && len(page) >= limit {
				stop = true
				break
			}
		}
		if stop {
			break
		}
		// Candidate budget exhausted. For page-fill scans, only enforce the
		// budget after the first authorized row; otherwise keep scanning so a
		// sparse user does not get an empty first page just because the first
		// authorized hit sorted beyond MaxCandidates. Facet scans always honor
		// the FacetSampleSize budget.
		if candidates >= maxCandidates && (wantFacets || len(page) > 0) {
			break
		}
		// Window returned fewer hits than requested -> no more matches: every
		// matching doc has been seen and authorized, so `authorized` is exact.
		if len(res.Hits) < windowReq.Size || len(res.Hits) == 0 {
			exhausted = true
			break
		}
		last := res.Hits[len(res.Hits)-1]
		cursor := hitSortFields(last, windowReq.Sort)
		if len(cursor) == 0 {
			exhausted = true
			break // no sort values -> cannot build a SearchAfter cursor
		}
		// Page on a shallow copy of the current request: only the cursor and
		// the window Size change between windows; query, sort (already reversed
		// once for SearchBefore), and fields are identical. Page-fill windows
		// grow geometrically (capped at MaxWindow); facet windows stay fixed
		// (they need a stable sample).
		next := *windowReq
		next.SearchAfter = cursor
		next.SearchBefore = nil
		if wantFacets {
			next.Size = cfg.facetWindowSize()
		} else {
			next.Size = cfg.growWindow(cfg.windowSize(limit), window+1)
		}
		windowReq = &next
	}

	span.SetAttributes(
		attribute.Int64("search.candidates", candidates),
		attribute.Int64("search.authorized", authorized),
	)
	return response, b.finalizePostFilter(ctx, response, page, selectFields, firstReq.Sort, req, firstRes,
		authorized, exhausted, reverseSort, wantFacets, agg, stats)
}

// applySearchBefore converts a SearchBefore request into a reversed-sort
// SearchAfter: the whole Sort is reversed once so the SortDocID tie-breaker
// stays a total order in the reversed direction. Returns whether the request
// was a SearchBefore (the page is reversed back to forward order in
// finalizePostFilter).
func applySearchBefore(req *resourcepb.ResourceSearchRequest, firstReq *bleve.SearchRequest) bool {
	if len(req.SearchBefore) == 0 {
		return false
	}
	firstReq.Sort.Reverse()
	firstReq.SearchAfter = firstReq.SearchBefore
	firstReq.SearchBefore = nil
	return true
}

// finalizePostFilter sets TotalHits (exact authorized count when the scan
// exhausted the index from the top, else the unfiltered match count), reverses
// the page for SearchBefore, converts hits + facets into the response, and
// reverses the page back to forward order for SearchBefore. See
// runPostFilterAuthz for the TotalHits / facet-count semantics.
func (b *bleveIndex) finalizePostFilter(
	ctx context.Context,
	response *resourcepb.ResourceSearchResponse,
	page search.DocumentMatchCollection,
	selectFields []string,
	sort search.SortOrder,
	req *resourcepb.ResourceSearchRequest,
	firstRes *bleve.SearchResult,
	authorized int64,
	exhausted, reverseSort, wantFacets bool,
	agg *facetAggregator,
	stats *resource.SearchStats,
) error {
	// Exact authorized total only when the scan started from the top (no
	// incoming SearchAfter/SearchBefore) and exhausted it. With a cursor the
	// runner only authorizes hits returned after the cursor, so `authorized`
	// on exhaustion is the tail count, not the whole-query total — fall back
	// to the unfiltered firstRes.Total.
	if exhausted && req.Limit > 0 && len(req.SearchAfter) == 0 && len(req.SearchBefore) == 0 {
		response.TotalHits = authorized
	} else {
		response.TotalHits = int64(firstRes.Total)
	}
	response.QueryCost = float64(firstRes.Cost)
	response.MaxScore = firstRes.MaxScore
	stats.AddReturnedDocuments(len(page))

	if reverseSort {
		// The scan collected the limit authorized hits closest to the cursor in
		// reversed (descending) order; reverse to return them ascending, with
		// the hit nearest the cursor last — matching bleve's SearchBefore.
		for i, j := 0, len(page)-1; i < j; i, j = i+1, j-1 {
			page[i], page[j] = page[j], page[i]
		}
	}

	resultsConversionStart := time.Now()
	results, err := b.hitsToTable(ctx, selectFields, page, sort, req.Explain)
	if err != nil {
		return err
	}
	response.Results = results
	if wantFacets {
		// Counts are the exact authorized term counts within the bounded sample;
		// see facetAggregator.build for why we don't extrapolate.
		response.Facet = agg.build()
	}
	stats.AddResultsConversionTime(time.Since(resultsConversionStart))
	return nil
}

// facetAggregator computes facet counts app-side over the authorized sample
// (<= FacetSampleSize candidates), not the full authorized set.
type facetAggregator struct {
	fields map[string]*resourcepb.ResourceSearchRequest_Facet
	// field -> term -> count
	counts map[string]map[string]int64
	// field -> number of authorized hits missing that field
	missing map[string]int64
	// field -> total authorized hits considered for that field
	total map[string]int64
}

func newFacetAggregator(facets map[string]*resourcepb.ResourceSearchRequest_Facet) *facetAggregator {
	a := &facetAggregator{
		fields:  facets,
		counts:  make(map[string]map[string]int64, len(facets)),
		missing: make(map[string]int64, len(facets)),
		total:   make(map[string]int64, len(facets)),
	}
	for _, f := range facets {
		a.counts[f.Field] = make(map[string]int64)
	}
	return a
}

func (a *facetAggregator) add(doc *search.DocumentMatch) {
	for _, f := range a.fields {
		v, ok := doc.Fields[f.Field]
		if !ok || v == nil {
			a.missing[f.Field]++
			continue
		}
		terms := facetTermValues(v)
		if len(terms) == 0 {
			a.missing[f.Field]++
			continue
		}
		// Total is the number of field values, not documents (matches bleve's
		// TermsFacetBuilder: total counts every term visited).
		a.total[f.Field] += int64(len(terms))
		for _, term := range terms {
			a.counts[f.Field][term]++
		}
	}
}

// facetTermValues extracts the individual facet terms from a stored field
// value. Multi-value fields (e.g. tags) are stored as slices, so each element
// is counted as its own term — matching bleve's native term facets. Empty
// strings are dropped. Non-string scalars are formatted as a single term.
func facetTermValues(v any) []string {
	switch s := v.(type) {
	case string:
		if s == "" {
			return nil
		}
		return []string{s}
	case []string:
		out := make([]string, 0, len(s))
		for _, t := range s {
			if t != "" {
				out = append(out, t)
			}
		}
		return out
	case []any:
		out := make([]string, 0, len(s))
		for _, e := range s {
			if str, ok := e.(string); ok && str != "" {
				out = append(out, str)
			}
		}
		return out
	default:
		t := fmt.Sprintf("%v", v)
		if t == "" {
			return nil
		}
		return []string{t}
	}
}

// build assembles the response facets, keeping the top req.Facet[f].Limit terms
// per field (by count desc, then term asc for determinism). Counts are the exact
// number of authorized hits with that term within the bounded sample
// (<= FacetSampleSize candidates). We deliberately do NOT extrapolate to the
// full set: scaling by totalHits/candidates estimates the unfiltered term count,
// not the authorized one, and over-counts badly for low-access-fraction users
// (e.g. a tag on 2 authorized docs reported as 42). Exhausted scans are fully
// exact; capped scans are a conservative lower bound — never more than what the
// sample saw.
func (a *facetAggregator) build() map[string]*resourcepb.ResourceSearchResponse_Facet {
	out := make(map[string]*resourcepb.ResourceSearchResponse_Facet, len(a.fields))
	for k, f := range a.fields {
		terms := a.counts[f.Field]
		limit := int(f.Limit)
		sorted := make([]*resourcepb.ResourceSearchResponse_TermFacet, 0, len(terms))
		for term, count := range terms {
			sorted = append(sorted, &resourcepb.ResourceSearchResponse_TermFacet{
				Term:  term,
				Count: count,
			})
		}
		sort.Slice(sorted, func(i, j int) bool {
			if sorted[i].Count != sorted[j].Count {
				return sorted[i].Count > sorted[j].Count
			}
			return sorted[i].Term < sorted[j].Term
		})
		if limit > 0 && len(sorted) > limit {
			sorted = sorted[:limit]
		}
		out[k] = &resourcepb.ResourceSearchResponse_Facet{
			Field:   f.Field,
			Total:   a.total[f.Field],
			Missing: a.missing[f.Field],
			Terms:   sorted,
		}
	}
	return out
}
