package search

import (
	"context"
	"fmt"
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
	// OverFetchFactor multiplies the requested limit to size each bleve window.
	OverFetchFactor int
	// MinWindow / MaxWindow clamp the per-window bleve Size.
	MinWindow int
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
		c.OverFetchFactor = 10
	}
	if c.MinWindow <= 0 {
		c.MinWindow = 500
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

// windowSize returns the per-window bleve Size for facet/distinct queries:
// limit * OverFetchFactor clamped to [MinWindow, MaxWindow].
func (c PostRankAuthzConfig) windowSize(limit int) int {
	w := limit * c.OverFetchFactor
	if w < c.MinWindow {
		w = c.MinWindow
	}
	if w > c.MaxWindow {
		w = c.MaxWindow
	}
	return w
}

// scanWindowSize returns the bleve Size for scan window `window`.
// Facet/distinct queries need a stable sample, so they use the fixed window.
// Page-fill queries start just over the page and grow geometrically on each
// miss, so the common high-authorized-fraction case loads far fewer stored
// fields. Ranking is unaffected: bleve ranks the full match set and returns
// the top-N regardless of Size.
func (c PostRankAuthzConfig) scanWindowSize(limit, offset, window int, wantFacets bool) int {
	if wantFacets {
		return c.windowSize(limit)
	}
	size := limit + offset
	for i := 0; i < window && size < c.MaxWindow; i++ {
		size *= c.OverFetchFactor
	}
	if size > c.MaxWindow {
		size = c.MaxWindow
	}
	return size
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
// ID is <namespace>/<group>/<resourceType>/<name>; the resourceType segment
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
// authorizes hits in rank order, and stops once the page is filled (no facets)
// or the candidate budget is hit. The first window's res.Total is TotalHits
// (unfiltered match count). Facets are aggregated app-side over the authorized
// sample. index may be a single bleve index or an IndexAlias (dashboards +
// folders); the globally-unique doc ID keeps the SortDocID tie-breaker a total
// order across the merged set. SearchBefore is a reversed-sort SearchAfter
// (see the reverseSort block).
func (b *bleveIndex) runPostFilterAuthz(
	ctx context.Context,
	access authlib.AccessClient,
	req *resourcepb.ResourceSearchRequest,
	index bleve.Index,
	firstReq *bleve.SearchRequest,
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
	var capped bool
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
	// then reverse the page back to forward order before returning.
	reverseSort := len(req.SearchBefore) > 0
	if reverseSort {
		firstReq.Sort.Reverse()
		firstReq.SearchAfter = firstReq.SearchBefore
		firstReq.SearchBefore = nil
	}

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

		// Authorize this window's hits in rank order. The candidate iterator
		// stops feeding FilterAuthorized once the candidate budget is reached.
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
			// No facets: stop as soon as the page is full (early-exit).
			if !wantFacets && len(page) >= limit {
				stop = true
				break
			}
		}
		if stop {
			break
		}
		// Candidate budget exhausted (sparse authorized fraction). Hoisted out
		// of the FilterAuthorized loop: that loop only yields authorized hits,
		// so an all-unauthorized capping window would otherwise never set stop
		// and the scan would keep paging until bleve exhausted the whole index.
		if candidates >= maxCandidates {
			capped = true
			break
		}
		// Window returned fewer hits than requested -> no more matches.
		if len(res.Hits) < windowReq.Size || len(res.Hits) == 0 {
			break
		}
		last := res.Hits[len(res.Hits)-1]
		if len(last.Sort) == 0 {
			break // no sort values -> cannot build a SearchAfter cursor
		}
		// Page on a shallow copy of the current request: only the cursor and
		// the adaptive window Size change between windows; query, sort (already
		// reversed once for SearchBefore), facets, and fields are identical.
		next := *windowReq
		next.SearchAfter = last.Sort
		next.SearchBefore = nil
		next.Size = cfg.scanWindowSize(limit, offset, window+1, wantFacets)
		windowReq = &next
	}

	response.TotalHits = int64(firstRes.Total)
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
	results, err := b.hitsToTable(ctx, firstReq.Fields, page, req.Explain)
	if err != nil {
		return nil, err
	}
	response.Results = results
	if wantFacets {
		// When the scan hit the candidate cap before exhausting the index,
		// extrapolate counts by the inverse sampling fraction (TotalHits /
		// candidates) so facet magnitudes reflect the full matching set rather
		// than just the bounded sample. Exact when the scan was not capped.
		response.Facet = agg.build(candidates, int64(firstRes.Total), capped)
	}
	stats.AddResultsConversionTime(time.Since(resultsConversionStart))

	span.SetAttributes(
		attribute.Int64("search.candidates", candidates),
		attribute.Int64("search.authorized", authorized),
	)
	return response, nil
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
		a.total[f.Field]++
		v, ok := doc.Fields[f.Field]
		if !ok || v == nil {
			a.missing[f.Field]++
			continue
		}
		term := facetTermValue(v)
		if term == "" {
			a.missing[f.Field]++
			continue
		}
		a.counts[f.Field][term]++
	}
}

// facetTermValue stringifies a stored field value for facet counting. Facet
// fields are tokenized keyword fields stored as strings; non-string values are
// formatted with fmt.
func facetTermValue(v any) string {
	switch s := v.(type) {
	case string:
		return s
	default:
		return fmt.Sprintf("%v", v)
	}
}

// build assembles the response facets, keeping the top req.Facet[f].Limit terms
// per field (by count desc, then term asc for determinism). When capped is true
// and totalHits > candidates, counts are extrapolated by the inverse sampling
// fraction (totalHits / candidates) to estimate the full-set magnitudes from the
// bounded authorized sample; otherwise counts are exact.
func (a *facetAggregator) build(candidates, totalHits int64, capped bool) map[string]*resourcepb.ResourceSearchResponse_Facet {
	scale := int64(1)
	if capped && totalHits > candidates {
		scale = totalHits / candidates
	}
	out := make(map[string]*resourcepb.ResourceSearchResponse_Facet, len(a.fields))
	for k, f := range a.fields {
		terms := a.counts[f.Field]
		limit := int(f.Limit)
		sorted := make([]*resourcepb.ResourceSearchResponse_TermFacet, 0, len(terms))
		for term, count := range terms {
			sorted = append(sorted, &resourcepb.ResourceSearchResponse_TermFacet{
				Term:  term,
				Count: count * scale,
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
			Total:   a.total[f.Field] * scale,
			Missing: a.missing[f.Field] * scale,
			Terms:   sorted,
		}
	}
	return out
}
