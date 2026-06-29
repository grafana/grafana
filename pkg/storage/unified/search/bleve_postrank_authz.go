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
// the page is filled or MaxCandidates is hit.
type PostRankAuthzConfig struct {
	// OverFetchFactor multiplies the requested limit to size each bleve window.
	OverFetchFactor int
	// MinWindow / MaxWindow clamp the per-window bleve Size.
	MinWindow int
	MaxWindow int
	// MaxCandidates is the total number of candidate hits scanned across all
	// windows before the scan stops. Bounds work for low authorized fractions.
	MaxCandidates int
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
	return c
}

// windowSize returns the per-window bleve Size for the post-filter path:
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
// Unlike batchAuthzSearcher.parseDocInfo (which reads doc values from the index
// reader mid-search), the hit here already has its external ID and stored
// fields populated by bleve. The doc ID format is
// <namespace>/<group>/<resourceType>/<name>; the resourceType segment is what
// distinguishes dashboards from folders in a federated alias, and is used to
// look up the verb in the resources map.
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

// runPostFilterAuthz implements the postFilter mode: bleve ranks without the
// authz wrapper, the runner fetches bounded windows (paging via SearchAfter),
// authorizes each window's hits in rank order with authz.FilterAuthorized, and
// stops once the page is filled (no facets) or the MaxCandidates cap is hit
// (facets, or a low authorized fraction). The first window's res.Total is used
// for TotalHits (the unfiltered match count). Facets, when requested, are
// aggregated app-side over the authorized hits seen during the bounded scan.
//
// The index argument may be a single bleve index or a bleve.IndexAlias merging
// several (e.g. dashboards + folders); in either case the doc ID
// {namespace}/{group}/{resource}/{name} is globally unique, so the SortDocID
// tie-breaker keeps SearchAfter cursors deterministic across the merged set.
//
// SearchBefore is handled by transforming it into a reversed-sort SearchAfter
// (see the reverseSort block below): the scan walks away from the cursor in
// reversed order and the page is reversed back to forward order before
// returning, so callers see the same result shape as bleve's native
// SearchBefore.
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
	var firstRes *bleve.SearchResult
	maxCandidates := int64(cfg.MaxCandidates)

	// SearchBefore is implemented as a reversed-sort SearchAfter, mirroring
	// bleve's native SearchBefore handling (index_impl.go: reverse Sort, treat
	// SearchBefore as SearchAfter, collect, then re-sort forward). The forward
	// bounded scan below then walks away from the cursor in reversed order and
	// early-exits at the limit; we reverse the page back to the caller's forward
	// order before returning. Reversing the whole Sort (not just req.SortBy)
	// keeps the SortDocID tie-breaker a total order in the reversed direction,
	// so deterministic paging holds for federated aliases too.
	searchBefore := req.SearchBefore
	reverseSort := len(searchBefore) > 0
	if reverseSort {
		req.SearchAfter = searchBefore
		req.SearchBefore = nil
		firstReq.Sort.Reverse()
		firstReq.SearchAfter = firstReq.SearchBefore
		firstReq.SearchBefore = nil
	}

	// Subsequent windows are built by re-running toBleveSearchRequest with
	// req.SearchAfter set from the previous window's last hit. Restore the
	// caller's cursors afterwards so we don't mutate the inbound request.
	prevSearchAfter := req.SearchAfter
	prevSearchBefore := req.SearchBefore
	defer func() {
		req.SearchAfter = prevSearchAfter
		req.SearchBefore = prevSearchBefore
	}()

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
		// stops feeding FilterAuthorized once the candidate cap is reached, so
		// the total scan stays bounded even at a near-zero authorized fraction.
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
			// No facets requested: stop as soon as the page is full (early-exit).
			if !wantFacets && len(page) >= limit {
				stop = true
				break
			}
			// Facets requested, or page not yet full: stop at the candidate cap.
			if candidates >= maxCandidates {
				stop = true
				break
			}
		}
		if stop {
			break
		}
		// Window exhausted with fewer hits than requested -> no more matches.
		if len(res.Hits) < windowReq.Size || len(res.Hits) == 0 {
			break
		}
		last := res.Hits[len(res.Hits)-1]
		if len(last.Sort) == 0 {
			break // no sort values -> cannot build a SearchAfter cursor
		}
		req.SearchAfter = last.Sort
		nextReq, e := b.toBleveSearchRequest(ctx, req, access, true)
		if e != nil {
			response.Error = e
			return response, nil
		}
		if reverseSort {
			nextReq.Sort.Reverse()
		}
		if err := b.ensureSearchFields(nextReq, req); err != nil {
			return nil, err
		}
		windowReq = nextReq
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
		response.Facet = agg.build()
	}
	stats.AddResultsConversionTime(time.Since(resultsConversionStart))

	span.SetAttributes(
		attribute.Int64("search.candidates", candidates),
		attribute.Int64("search.authorized", authorized),
	)
	return response, nil
}

// facetAggregator computes facet counts app-side over authorized hits. Counts
// reflect only the authorized hits seen during the bounded post-filter scan
// (<= PostRankAuthzConfig.MaxCandidates), not the full authorized set.
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
// per field (by count desc, then term asc for determinism).
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
