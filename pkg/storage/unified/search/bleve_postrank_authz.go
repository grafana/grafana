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

// countWindowSize returns the per-window bleve Size for count-only requests
// (Limit == 0, no facets). There is no page to fill, so windowSize(0) would be
// zero and bleve would return no hits to authorize at all. The scan instead
// walks the ranked set in windows as large as the budget allows (capped by
// MaxWindow) until it exhausts the match set — giving an exact authorized
// total — or reaches MaxCandidates.
func (c PostRankAuthzConfig) countWindowSize() int {
	w := c.MaxCandidates
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

// ensureFacetFields makes Bleve load the stored facet fields so the post-rank
// runner can aggregate them app-side. Facet capability implies the canonical
// field is stored, so every facetable field has a stored form to load. Like
// ensureAuthzFields this extends the Bleve load list only; it is not part of
// the response column list.
func (b *bleveIndex) ensureFacetFields(searchrequest *bleve.SearchRequest, req *resourcepb.ResourceSearchRequest) {
	if slices.Contains(searchrequest.Fields, resource.SEARCH_FIELD_ALL_FIELDS) {
		return
	}
	for _, facet := range req.Facet {
		field := b.searchFields.storedFacetFields[facet.Field]
		if !slices.Contains(searchrequest.Fields, field) {
			searchrequest.Fields = append(searchrequest.Fields, field)
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
// queries) or the candidate budget is hit. Count-only queries (Limit == 0, no
// facets) have no page and stop only on exhaustion or the budget. TotalHits is
// the exact authorized
// count when the scan exhausts the index from the top (small sets, no incoming
// cursor), else the unfiltered match count (page filled early / cap hit /
// cursor pages — fast over exact). Facets are aggregated app-side over an
// authorized sample that always starts at the top of the full query. index may
// be a single bleve index or an IndexAlias
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
	// A count-only request returns no rows, so there is no page to fill: the
	// scan authorizes ranked hits purely to total them and runs until the match
	// set is exhausted or the candidate budget is reached.
	countOnly := limit == 0 && !wantFacets

	agg, facetAuthorized, facetExhausted, err := b.prepareFacetAggregation(
		ctx, access, req, index, firstReq, resources, stats,
	)
	if err != nil {
		return nil, err
	}

	baseWindow := cfg.windowSize(limit)
	switch {
	case countOnly:
		baseWindow = cfg.countWindowSize()
		// No rows are returned, so load only what authorization reads.
		firstReq.Fields = []string{resource.SEARCH_FIELD_FOLDER}
		firstReq.Size = baseWindow
	case wantFacets:
		// Facets always use a separate scan starting at the top of the query.
		// The page scan must retain its normal fetch window, otherwise the
		// facet sample size can unnecessarily shorten pages for sparse-access
		// users.
		firstReq.Size = baseWindow
	}

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

	var candidates int64
	var authorized int64
	var exhausted bool
	var firstRes *bleve.SearchResult
	maxCandidates := int64(cfg.MaxCandidates)

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

		// Authorize this window's hits in rank order. Page-fill scans keep going
		// past MaxCandidates until at least one row is found, so sparse users
		// don't get an empty first page. Count-only scans have no page, so the
		// budget applies on its own.
		windowHits := res.Hits
		candidateSeq := func(yield func(docInfo) bool) {
			for _, hit := range windowHits {
				if candidates >= maxCandidates && (countOnly || len(page) > 0) {
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
			// Skip the first `offset` authorized hits, then fill the page.
			if authorized > int64(offset) && len(page) < limit {
				page = append(page, info.doc)
			}
			// Stop as soon as the page is full (early-exit).
			if !countOnly && len(page) >= limit {
				stop = true
				break
			}
		}
		if stop {
			break
		}
		// Candidate budget exhausted. On page-fill scans only enforce the budget
		// after the first authorized row; otherwise keep scanning so a sparse
		// user does not get an empty first page just because the first
		// authorized hit sorted beyond MaxCandidates.
		if candidates >= maxCandidates && (countOnly || len(page) > 0) {
			// A budget that covered every match leaves nothing unseen, so the
			// authorized count is still exact. candidates never exceeds the
			// number of hits walked, so this can only under-claim.
			exhausted = candidates >= int64(firstRes.Total)
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
		// grow geometrically (capped at MaxWindow).
		next := *windowReq
		next.SearchAfter = cursor
		next.SearchBefore = nil
		next.Size = cfg.growWindow(baseWindow, window+1)
		windowReq = &next
	}

	span.SetAttributes(
		attribute.Int64("search.candidates", candidates),
		attribute.Int64("search.authorized", authorized),
	)
	if wantFacets {
		// The independent facet scan defines exactness, but a returned page may
		// observe more authorized hits than a capped top sample.
		authorized = max(authorized, facetAuthorized)
		exhausted = facetExhausted
	}
	return response, b.finalizePostFilter(ctx, response, page, selectFields, firstReq.Sort, req, firstRes,
		authorized, exhausted, reverseSort, wantFacets, agg, stats)
}

func (b *bleveIndex) prepareFacetAggregation(
	ctx context.Context,
	access authlib.AccessClient,
	req *resourcepb.ResourceSearchRequest,
	index bleve.Index,
	firstReq *bleve.SearchRequest,
	resources map[string]string,
	stats *resource.SearchStats,
) (*facetAggregator, int64, bool, error) {
	if len(req.Facet) == 0 {
		return nil, 0, false, nil
	}

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
	agg, authorized, exhausted, err := b.aggregateFacetsFromTop(
		ctx, access, index, firstReq, resources, extractFn, req.Facet, stats,
	)
	return agg, authorized, exhausted, err
}

// facetScanFields is the stored-field projection the facet scan needs: the
// folder to authorize a hit and the stored facet fields to count its terms.
// The response columns come from the page scan, so loading them here would
// fetch stored data for up to FacetSampleSize hits that is never returned.
func (b *bleveIndex) facetScanFields(facets map[string]*resourcepb.ResourceSearchRequest_Facet) []string {
	fields := make([]string, 0, len(facets)+1)
	for _, facet := range facets {
		field := b.searchFields.storedFacetFields[facet.Field]
		if field != "" && !slices.Contains(fields, field) {
			fields = append(fields, field)
		}
	}
	slices.Sort(fields)
	return append(fields, resource.SEARCH_FIELD_FOLDER)
}

func (b *bleveIndex) aggregateFacetsFromTop(
	ctx context.Context,
	access authlib.AccessClient,
	index bleve.Index,
	firstReq *bleve.SearchRequest,
	resources map[string]string,
	extractFn func(docInfo) authz.BatchCheckItem,
	facets map[string]*resourcepb.ResourceSearchRequest_Facet,
	stats *resource.SearchStats,
) (*facetAggregator, int64, bool, error) {
	agg := newFacetAggregator(facets, b.searchFields.storedFacetFields)
	cfg := b.postRankAuthz
	maxCandidates := int64(cfg.FacetSampleSize)
	var candidates int64
	var authorized int64

	initial := *firstReq
	initial.SearchAfter = nil
	initial.SearchBefore = nil
	initial.Size = cfg.facetWindowSize()
	initial.Fields = b.facetScanFields(facets)
	windowReq := &initial

	for {
		res, err := index.SearchInContext(ctx, windowReq)
		if err != nil {
			return nil, 0, false, err
		}
		stats.AddSearchTime(res.Took)

		windowHits := res.Hits
		candidateSeq := func(yield func(docInfo) bool) {
			for _, hit := range windowHits {
				if candidates >= maxCandidates {
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
		for info, err := range authz.FilterAuthorized(ctx, access, candidateSeq, extractFn, authz.WithTracer(tracer)) {
			if err != nil {
				return nil, 0, false, err
			}
			authorized++
			agg.add(info.doc)
		}

		if candidates >= maxCandidates {
			return agg, authorized, false, nil
		}
		if len(res.Hits) < windowReq.Size || len(res.Hits) == 0 {
			return agg, authorized, true, nil
		}
		cursor := hitSortFields(res.Hits[len(res.Hits)-1], windowReq.Sort)
		if len(cursor) == 0 {
			return agg, authorized, true, nil
		}
		next := *windowReq
		next.SearchAfter = cursor
		next.Size = cfg.facetWindowSize()
		windowReq = &next
	}
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

// finalizePostFilter sets TotalHits, reverses the page for SearchBefore, and
// converts hits + facets into the response. Facet requests report the
// authorized facet-sample count so TotalHits and facet counts have the same
// lower-bound semantics when capped. Non-facet requests retain the unfiltered
// upper-bound fallback when their page scan does not produce an exact total.
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
	exact := exhausted
	if wantFacets {
		response.TotalHits = authorized
	} else if exhausted && len(req.SearchAfter) == 0 && len(req.SearchBefore) == 0 {
		// The scan saw every match from the top, so the authorized count is
		// exact. Count-only requests (Limit == 0) reach this too: they scan
		// solely to total, and only fall through when the budget cuts them off.
		response.TotalHits = authorized
	} else {
		exact = false
		// Approximate: report the pre-authz match count (an over-count of the
		// authorized total) instead of paying for a full scan.
		response.TotalHits = int64(firstRes.Total)
	}
	response.TotalHitsExact = exact
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
	// requested field -> stored Bleve field
	storedFields map[string]string
	// facet name -> term -> count
	counts map[string]map[string]int64
	// facet name -> number of authorized hits missing that field
	missing map[string]int64
	// facet name -> total authorized hits considered for that field
	total map[string]int64
}

func newFacetAggregator(
	facets map[string]*resourcepb.ResourceSearchRequest_Facet,
	storedFields map[string]string,
) *facetAggregator {
	a := &facetAggregator{
		fields:       facets,
		storedFields: storedFields,
		counts:       make(map[string]map[string]int64, len(facets)),
		missing:      make(map[string]int64, len(facets)),
		total:        make(map[string]int64, len(facets)),
	}
	for name := range facets {
		a.counts[name] = make(map[string]int64)
	}
	return a
}

func (a *facetAggregator) add(doc *search.DocumentMatch) {
	for name, f := range a.fields {
		v, ok := doc.Fields[a.storedFields[f.Field]]
		if !ok || v == nil {
			a.missing[name]++
			continue
		}
		terms := facetTermValues(v)
		if len(terms) == 0 {
			a.missing[name]++
			continue
		}
		// Total counts terms, not documents (matches bleve's
		// TermsFacetBuilder: total counts every term visited).
		a.total[name] += int64(len(terms))
		for _, term := range terms {
			a.counts[name][term]++
		}
	}
}

// facetTermValues extracts the individual facet terms from a stored field
// value. Multi-value fields (e.g. tags) are stored as slices, so each element
// is counted as its own term — matching bleve's native term facets. Empty
// strings are dropped. Non-string scalars are formatted as a single term.
//
// A value repeated within one document yields one term: native facets read the
// document's term set, where a duplicate leaves a single posting, so counting
// the stored slice verbatim would report it twice.
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
			if t != "" && !slices.Contains(out, t) {
				out = append(out, t)
			}
		}
		return out
	case []any:
		out := make([]string, 0, len(s))
		for _, e := range s {
			if str, ok := e.(string); ok && str != "" && !slices.Contains(out, str) {
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
		terms := a.counts[k]
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
		if limit == 0 {
			sorted = nil
		} else if len(sorted) > limit {
			sorted = sorted[:limit]
		}
		out[k] = &resourcepb.ResourceSearchResponse_Facet{
			Field:   f.Field,
			Total:   a.total[k],
			Missing: a.missing[k],
			Terms:   sorted,
		}
	}
	return out
}
