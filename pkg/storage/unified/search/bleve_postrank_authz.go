package search

import (
	"context"
	"slices"
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

// runPostFilterAuthz implements postFilter mode for normal paginated search and
// federated queries: bleve ranks without the authz wrapper, the runner fetches
// bounded windows (paging via SearchAfter), authorizes hits in rank order, and
// stops once the page is filled or the candidate budget is hit. TotalHits is the
// exact authorized count when the scan exhausts the index (small sets), else the
// unfiltered match count (page filled early / cap hit — fast over exact). index
// may be a single bleve index or an IndexAlias (dashboards + folders); the
// globally-unique doc ID keeps the SortDocID tie-breaker a total order across
// the merged set.
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

		// Authorize this window's hits in rank order. Keep scanning past the
		// candidate budget until at least one row is found, so sparse users
		// don't get an empty first page just because the first authorized hit
		// sorted beyond MaxCandidates.
		windowHits := res.Hits
		candidateSeq := func(yield func(docInfo) bool) {
			for _, hit := range windowHits {
				if candidates >= maxCandidates && len(page) > 0 {
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
			if len(page) >= limit {
				stop = true
				break
			}
		}
		if stop {
			break
		}
		// Candidate budget exhausted. Only enforce it after the first
		// authorized row; otherwise keep scanning so a sparse user does not get
		// an empty first page.
		if candidates >= maxCandidates && len(page) > 0 {
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
		// the window Size change between windows; query, sort, and fields are
		// identical. Grow the window geometrically (capped at MaxWindow) so a
		// sparse-access or deep-offset scan reaches its first authorized hit in
		// fewer, larger windows rather than many same-sized bleve searches.
		next := *windowReq
		next.SearchAfter = cursor
		next.SearchBefore = nil
		next.Size = cfg.growWindow(cfg.windowSize(limit), window+1)
		windowReq = &next
	}

	span.SetAttributes(
		attribute.Int64("search.candidates", candidates),
		attribute.Int64("search.authorized", authorized),
	)
	return response, b.finalizePostFilter(ctx, response, page, selectFields, firstReq.Sort, req, firstRes,
		authorized, exhausted, stats)
}

// finalizePostFilter sets TotalHits (exact authorized count when the scan
// exhausted the index, else the unfiltered match count) and converts hits into
// the response. See runPostFilterAuthz for the TotalHits semantics.
func (b *bleveIndex) finalizePostFilter(
	ctx context.Context,
	response *resourcepb.ResourceSearchResponse,
	page search.DocumentMatchCollection,
	selectFields []string,
	sort search.SortOrder,
	req *resourcepb.ResourceSearchRequest,
	firstRes *bleve.SearchResult,
	authorized int64,
	exhausted bool,
	stats *resource.SearchStats,
) error {
	// Exact authorized total only when the scan started from the top (no
	// incoming SearchAfter) and exhausted it. With a SearchAfter cursor the
	// runner only authorizes hits returned after the cursor, so `authorized`
	// on exhaustion is the tail count, not the whole-query total — fall back
	// to the unfiltered firstRes.Total.
	if exhausted && req.Limit > 0 && len(req.SearchAfter) == 0 {
		response.TotalHits = authorized
	} else {
		response.TotalHits = int64(firstRes.Total)
	}
	response.QueryCost = float64(firstRes.Cost)
	response.MaxScore = firstRes.MaxScore
	stats.AddReturnedDocuments(len(page))

	resultsConversionStart := time.Now()
	results, err := b.hitsToTable(ctx, selectFields, page, sort, req.Explain)
	if err != nil {
		return err
	}
	response.Results = results
	stats.AddResultsConversionTime(time.Since(resultsConversionStart))
	return nil
}
