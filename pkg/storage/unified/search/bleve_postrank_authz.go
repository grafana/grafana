package search

import (
	"context"
	"fmt"
	"iter"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/query"

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
	w := min(limit*c.OverFetchFactor, c.MaxWindow)
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
	w := min(c.FacetSampleSize, c.MaxWindow)
	return w
}

// countWindowSize returns the per-window bleve Size for count-only requests
// (Limit == 0, no facets). There is no page to fill, so windowSize(0) would be
// zero and bleve would return no hits to authorize at all. The scan instead
// walks the ranked set in windows as large as the budget allows (capped by
// MaxWindow) until it exhausts the match set — giving an exact authorized
// total — or reaches MaxCandidates.
func (c PostRankAuthzConfig) countWindowSize() int {
	w := min(c.MaxCandidates, c.MaxWindow)
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
	for range nextWindow {
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
//
// It also adds the resource version, which every result carries regardless of the
// requested fields. Both happen here rather than in toBleveSearchRequest because
// Search snapshots the response field list before calling this, so what is added
// is loaded without becoming a response column.
func (b *bleveIndex) ensureSearchFields(searchrequest *bleve.SearchRequest, req *resourcepb.ResourceSearchRequest) error {
	if len(req.Fields) < 1 && req.Limit > 0 {
		f, err := b.index.Fields()
		if err != nil {
			return err
		}
		searchrequest.Fields = append(f, resource.SEARCH_FIELD_ALL_FIELDS)
		return nil
	}
	if !slices.Contains(searchrequest.Fields, resource.SEARCH_FIELD_RV_STRING) {
		searchrequest.Fields = append(searchrequest.Fields, resource.SEARCH_FIELD_RV_STRING)
	}
	return nil
}

// ensureAuthzFields makes the page load the stored fields authorization reads,
// so each page hit can be checked against what it was authorized on (see
// postRankPage.validate). This extends the bleve load list only; it is NOT part
// of the response column list (selectFields) - Search snapshots selectFields
// before calling this so the caller's requested columns are returned unchanged.
func (b *bleveIndex) ensureAuthzFields(searchrequest *bleve.SearchRequest, trash bool) {
	for _, f := range authzLoadFields(trash) {
		if !slices.Contains(searchrequest.Fields, f) &&
			!slices.Contains(searchrequest.Fields, resource.SEARCH_FIELD_ALL_FIELDS) {
			searchrequest.Fields = append(searchrequest.Fields, f)
		}
	}
}

// authzLoadFields are the stored fields the post-rank runner reads to authorize a
// hit. Every place that narrows the load list has to keep all of them: dropping
// deleted_by raises no error, it just stops the deleter seeing their own objects.
func authzLoadFields(trash bool) []string {
	if trash {
		return []string{resource.SEARCH_FIELD_FOLDER, resource.SEARCH_FIELD_DELETED_BY}
	}
	return []string{resource.SEARCH_FIELD_FOLDER}
}

type authzMetadata struct {
	folder, deletedBy string
}

// windowDocInfo is parseHitDocInfo with the hit's authorization metadata. A hit
// without metadata was removed from the index since its window was searched, and
// is skipped.
func windowDocInfo(hit *search.DocumentMatch, resources map[string]string, metadata map[string]authzMetadata) (docInfo, bool) {
	authzMeta, ok := metadata[hit.ID]
	if !ok {
		return docInfo{}, false
	}
	info, ok := parseHitDocInfo(hit, resources)
	info.folder, info.deletedBy = authzMeta.folder, authzMeta.deletedBy
	return info, ok
}

// readAuthzMetadata reads what authorization needs for a window's hits from doc
// values, so window searches need no stored fields: a search for the hits sorted
// on the folder and deleter returns them as sort keys, which bleve reads from doc
// values in index order. Found by ID alone: what has changed since, even out of
// the query or its scope, is dropped when the page is validated.
func (p *postRankPage) readAuthzMetadata(ctx context.Context, hits search.DocumentMatchCollection) (map[string]authzMetadata, error) {
	if len(hits) == 0 {
		return nil, nil
	}
	ids := make([]string, len(hits))
	for i, hit := range hits {
		ids[i] = hit.ID
	}
	// Ascending with missing values first gives a missing field LowTerm, which no
	// folder or user ID can be. Live documents have no deleter.
	sortBy := func(field string) *search.SortField {
		return &search.SortField{Field: field, Type: search.SortFieldAsString, Missing: search.SortFieldMissingFirst}
	}
	res, err := p.search(ctx, &bleve.SearchRequest{
		Query: bleve.NewDocIDQuery(ids),
		Size:  len(ids),
		Sort:  search.SortOrder{sortBy(resource.SEARCH_FIELD_FOLDER), sortBy(resource.SEARCH_FIELD_DELETED_BY)},
		Score: bleve.ScoreNone,
	})
	if err != nil {
		return nil, err
	}

	value := func(sortKey string) string {
		if sortKey == search.LowTerm {
			return ""
		}
		return sortKey
	}
	metadata := make(map[string]authzMetadata, len(res.Hits))
	for _, hit := range res.Hits {
		metadata[hit.ID] = authzMetadata{folder: value(hit.Sort[0]), deletedBy: value(hit.Sort[1])}
	}
	return metadata, nil
}

// postRankPage holds the page's authorized hits. Their stored fields are loaded
// after authorization, from a newer snapshot than the one they were ranked and
// authorized on, so each is checked against both before it is kept.
type postRankPage struct {
	index bleve.Index
	// The ranked request's query and sort.
	query  query.Query
	sort   search.SortOrder
	fields []string
	limit  int
	stats  *resource.SearchStats

	// cost is what the lookups read, part of the search's reported cost as the
	// stored fields were when window searches loaded them.
	cost uint64

	hits      []docInfo
	validated int
}

func (p *postRankPage) search(ctx context.Context, req *bleve.SearchRequest) (*bleve.SearchResult, error) {
	res, err := searchInContext(ctx, p.index, req)
	if err != nil {
		return nil, err
	}
	p.stats.AddSearchTime(res.Took)
	p.cost += res.Cost
	return res, nil
}

// lookup finds the hits that still match the ranked query, which also keeps
// them in its live or trash scope: a live document deleted meanwhile is still
// in the index, as trash. A match-all searcher advances by walking every
// document, so in a scoped match-all query the IDs take its place rather than
// being intersected with it.
func (p *postRankPage) lookup(ids []string) query.Query {
	byID := bleve.NewDocIDQuery(ids)
	if scoped, ok := p.query.(*query.BooleanQuery); ok {
		if must, ok := scoped.Must.(*query.ConjunctionQuery); ok && len(must.Conjuncts) == 1 {
			if _, all := must.Conjuncts[0].(*query.MatchAllQuery); all {
				byIDs := *scoped
				byIDs.Must = bleve.NewConjunctionQuery(byID)
				return &byIDs
			}
		}
	}
	return bleve.NewConjunctionQuery(p.query, byID)
}

func (p *postRankPage) full() bool {
	return len(p.hits) >= p.limit
}

// add takes an authorized hit while the page has room. Once the page is full,
// or when asked to, it validates what was added and returns how many hits it
// dropped, which the hits still to come can replace.
func (p *postRankPage) add(ctx context.Context, info docInfo, validate bool) (int, error) {
	if !p.full() {
		p.hits = append(p.hits, info)
	}
	if !p.full() && !validate {
		return 0, nil
	}
	return p.validate(ctx)
}

// validate loads the stored fields of the hits added since the last call, and
// drops those no longer as they were ranked and authorized: not matching the
// query, sorting elsewhere, or with another folder or deleter. Their fields
// could otherwise belong to an object the caller cannot see, or disagree with
// the hit's place and cursor. It returns how many it dropped.
//
// A score is not compared, as it depends on the rest of the index.
func (p *postRankPage) validate(ctx context.Context) (int, error) {
	pending := p.hits[p.validated:]
	if len(pending) == 0 {
		return 0, nil
	}
	ids := make([]string, len(pending))
	for i, info := range pending {
		ids[i] = info.doc.ID
	}
	res, err := p.search(ctx, &bleve.SearchRequest{
		Query:  p.lookup(ids),
		Size:   len(ids),
		Fields: p.fields,
		// Sorting by score with none computed gives every hit the same placeholder
		// key, so comparing the keys skips the score.
		Sort:  p.sort,
		Score: bleve.ScoreNone,
	})
	if err != nil {
		return 0, err
	}
	loaded := make(map[string]*search.DocumentMatch, len(res.Hits))
	for _, hit := range res.Hits {
		loaded[hit.ID] = hit
	}

	kept := p.hits[:p.validated]
	for _, info := range pending {
		hit, ok := loaded[info.doc.ID]
		if !ok || !slices.Equal(hit.Sort, info.doc.Sort) {
			continue
		}
		folder, _ := hit.Fields[resource.SEARCH_FIELD_FOLDER].(string)
		deletedBy, _ := hit.Fields[resource.SEARCH_FIELD_DELETED_BY].(string)
		if folder != info.folder || deletedBy != info.deletedBy {
			continue
		}
		info.doc.Fields = hit.Fields
		kept = append(kept, info)
	}
	dropped := len(p.hits) - len(kept)
	p.hits, p.validated = kept, len(kept)
	return dropped, nil
}

func (p *postRankPage) documents() search.DocumentMatchCollection {
	docs := make(search.DocumentMatchCollection, len(p.hits))
	for i, info := range p.hits {
		docs[i] = info.doc
	}
	return docs
}

// authzResources builds the {group}/{resource} -> verb map used to authorize
// hits. The primary resource uses the verb implied by req.Permission; federated
// resources are read-only.
//
// A hit whose type is absent from the map is dropped. A namespace-wide index
// answers every type under anyResourceType instead: its covered types change
// with the manifests, and the search server limits each search to the ones it
// may search with a filter. Each hit is still authorized against its own type and
// group, read from its document id.
func (b *bleveIndex) authzResources(req *resourcepb.ResourceSearchRequest) map[string]string {
	verb := utils.VerbGet
	if req.Permission == int64(dashboardaccess.PERMISSION_EDIT) {
		verb = utils.VerbUpdate
	}
	resources := map[string]string{}
	if b.key.IsGlobal() {
		resources[anyResourceType] = verb
	} else {
		resources[b.key.Group+"/"+b.key.Resource] = verb
	}
	if req.Permission == int64(dashboardaccess.PERMISSION_CREATE) && (b.key.IsGlobal() || (b.key.Group == folderGroup && b.key.Resource == folderResource)) {
		resources[folderGroup+"/"+folderResource] = utils.VerbCreate
	}
	for _, federated := range req.Federated {
		resources[federated.Group+"/"+federated.Resource] = utils.VerbGet
	}
	return resources
}

// anyResourceType keys the verb for every type in authzResources.
const anyResourceType = "*"

// authzVerb returns the verb a hit of the type is authorized with, and false
// when hits of the type are not returned.
func authzVerb(resources map[string]string, group, resourceType string) (string, bool) {
	if verb, ok := resources[group+"/"+resourceType]; ok {
		return verb, true
	}
	verb, ok := resources[anyResourceType]
	return verb, ok
}

const (
	folderGroup    = "folder.grafana.app"
	folderResource = "folders"
)

// batchCheckItem authorizes a folder hit under permission=create by the right to
// create dashboards inside it; every other hit is checked as itself.
func batchCheckItem(info docInfo) authz.BatchCheckItem {
	if info.verb == utils.VerbCreate && info.group == folderGroup && info.resourceType == folderResource {
		return authz.BatchCheckItem{
			Folder:    info.name,
			Verb:      utils.VerbCreate,
			Group:     dashboardGroup,
			Resource:  "dashboards",
			Namespace: info.namespace,
		}
	}
	return authz.BatchCheckItem{
		Name:      info.name,
		Folder:    info.folder,
		Verb:      info.verb,
		Group:     info.group,
		Resource:  info.resourceType,
		Namespace: info.namespace,
	}
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
	verb, ok := authzVerb(resources, parts[1], resourceType)
	if !ok {
		return docInfo{}, false
	}

	folder := ""
	if v, ok := doc.Fields[resource.SEARCH_FIELD_FOLDER].(string); ok {
		folder = v
	}
	deletedBy := ""
	if v, ok := doc.Fields[resource.SEARCH_FIELD_DELETED_BY].(string); ok {
		deletedBy = v
	}

	return docInfo{
		doc:          doc,
		namespace:    parts[0],
		group:        parts[1],
		resourceType: resourceType,
		name:         parts[3],
		folder:       folder,
		verb:         verb,
		deletedBy:    deletedBy,
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
	fieldValueSchema *fieldValueResultSchema,
	stats *resource.SearchStats,
	response *resourcepb.ResourceSearchResponse,
	trashAuthz *resource.TrashAuthorizer,
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

	// A trash total counts only hits the caller is allowed to see, so the scan
	// cannot stop at a full page and fall back to the unfiltered match count. It
	// keeps counting instead, which trash can afford: the deleter half costs no
	// authorization call and the folder half is one cached call per folder.
	countEveryHit := countOnly || trashAuthz != nil

	agg, facetAuthorized, facetExhausted, err := b.prepareFacetAggregation(
		ctx, access, req, index, firstReq, resources, stats, trashAuthz,
	)
	if err != nil {
		return nil, err
	}

	baseWindow := cfg.windowSize(limit)
	if countOnly {
		baseWindow = cfg.countWindowSize()
	}
	// Facets use a separate scan, with its own sample size; the page scan keeps
	// its normal fetch window, or the facet sample could shorten pages for
	// sparse-access users.
	firstReq.Size = baseWindow

	extractFn := batchCheckItem

	page := postRankPage{index: index, query: firstReq.Query, sort: firstReq.Sort, fields: firstReq.Fields, limit: limit, stats: stats}

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

	// Windows read what authorization needs from doc values, and only the hits
	// that make the page get their stored fields loaded, as on the in-searcher
	// path. Most window hits never reach a page.
	windowReq := *firstReq
	windowReq.Fields = nil
	// Page-fill scans keep going past MaxCandidates until the page has a row, so
	// sparse users don't get an empty first page just because the first
	// authorized hit sorted beyond the budget. Count-only scans have no page, so
	// the budget applies on its own.
	budgetSpent := func() bool { return candidates >= maxCandidates && (countOnly || page.validated > 0) }
windows:
	for window := 0; ; window++ {
		res, err := searchInContext(ctx, index, &windowReq)
		if err != nil {
			return nil, err
		}
		stats.AddSearchTime(res.Took)
		if firstRes == nil {
			firstRes = res
			stats.AddTotalHits(int(res.Total))
		}

		metadata, err := page.readAuthzMetadata(ctx, res.Hits)
		if err != nil {
			return nil, err
		}

		// Authorize this window's hits in rank order.
		candidateSeq := func(yield func(docInfo) bool) {
			for _, hit := range res.Hits {
				if budgetSpent() {
					return
				}
				info, ok := windowDocInfo(hit, resources, metadata)
				if !ok {
					continue
				}
				candidates++
				if !yield(info) {
					return
				}
			}
		}

		for info, err := range authorizeHits(ctx, access, candidateSeq, len(res.Hits), extractFn, trashAuthz) {
			if err != nil {
				return nil, err
			}
			authorized++
			// Skip the first `offset` authorized hits, then fill the page.
			if authorized <= int64(offset) {
				continue
			}
			// The rest of the scan refills whatever validation drops. Past the
			// budget each hit is validated as it comes, as the first to survive
			// ends the scan.
			dropped, err := page.add(ctx, info, candidates >= maxCandidates)
			if err != nil {
				return nil, err
			}
			authorized -= int64(dropped)
			// Stop as soon as the page is full (early-exit).
			if !countEveryHit && page.full() {
				break windows
			}
		}
		// Candidate budget exhausted. Only rows that survive validation count.
		if candidates >= maxCandidates {
			dropped, err := page.validate(ctx)
			if err != nil {
				return nil, err
			}
			authorized -= int64(dropped)
		}
		if budgetSpent() {
			// A budget that covered every match leaves nothing unseen, so the
			// authorized count is still exact. candidates never exceeds the
			// number of hits walked, so this can only under-claim.
			exhausted = candidates >= int64(firstRes.Total)
			if !exhausted {
				b.indexMetrics.SearchAuthEvents.WithLabelValues("candidate_budget").Inc()
			}
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
		// Only the cursor and the window Size change between windows; query, sort
		// (already reversed once for SearchBefore), and fields are identical.
		// Page-fill windows grow geometrically (capped at MaxWindow).
		windowReq.SearchAfter = cursor
		windowReq.SearchBefore = nil
		windowReq.Size = cfg.growWindow(baseWindow, window+1)
	}

	span.SetAttributes(
		attribute.Int64("search.candidates", candidates),
		attribute.Int64("search.authorized", authorized),
	)
	dropped, err := page.validate(ctx)
	if err != nil {
		return nil, err
	}
	authorized -= int64(dropped)
	firstRes.Cost += page.cost
	if wantFacets {
		// The independent facet scan defines exactness, but a returned page may
		// observe more authorized hits than a capped top sample.
		authorized = max(authorized, facetAuthorized)
		exhausted = facetExhausted
	}
	return response, b.finalizePostFilter(ctx, response, page.documents(), selectFields, fieldValueSchema, firstReq.Sort, req, firstRes,
		authorized, exhausted, reverseSort, wantFacets, trashAuthz != nil, agg, stats)
}

// authorizeHits filters ranked hits by the trash rule when trashAuthz is set,
// otherwise by the read check. Same shape either way, so the scan loops do not
// need to know which is running. sizeHint is how many hits candidates yields
// at most.
func authorizeHits(
	ctx context.Context,
	access authlib.AccessClient,
	candidates iter.Seq[docInfo],
	sizeHint int,
	extractFn func(docInfo) authz.BatchCheckItem,
	trashAuthz *resource.TrashAuthorizer,
) iter.Seq2[docInfo, error] {
	if trashAuthz != nil {
		return trashAuthorized(ctx, candidates, trashAuthz)
	}
	return authz.FilterAuthorized(ctx, access, candidates, extractFn, authz.WithTracer(tracer), authz.WithSizeHint(sizeHint))
}

func (b *bleveIndex) prepareFacetAggregation(
	ctx context.Context,
	access authlib.AccessClient,
	req *resourcepb.ResourceSearchRequest,
	index bleve.Index,
	firstReq *bleve.SearchRequest,
	resources map[string]string,
	stats *resource.SearchStats,
	trashAuthz *resource.TrashAuthorizer,
) (*facetAggregator, int64, bool, error) {
	if len(req.Facet) == 0 {
		return nil, 0, false, nil
	}

	extractFn := batchCheckItem
	agg, authorized, exhausted, err := b.aggregateFacetsFromTop(
		ctx, access, index, firstReq, resources, extractFn, req.Facet, stats, trashAuthz,
	)
	return agg, authorized, exhausted, err
}

// facetScanFields is the stored-field projection the facet scan needs: the
// folder to authorize a hit and the stored facet fields to count its terms.
// The response columns come from the page scan, so loading them here would
// fetch stored data for up to FacetSampleSize hits that is never returned.
func (b *bleveIndex) facetScanFields(facets map[string]*resourcepb.ResourceSearchRequest_Facet, trash bool) []string {
	fields := make([]string, 0, len(facets)+2)
	for _, facet := range facets {
		field := b.searchFields.storedFacetField(facet.Field)
		if field != "" && !slices.Contains(fields, field) {
			fields = append(fields, field)
		}
	}
	slices.Sort(fields)
	return append(fields, authzLoadFields(trash)...)
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
	trashAuthz *resource.TrashAuthorizer,
) (*facetAggregator, int64, bool, error) {
	agg := newFacetAggregator(facets, b.searchFields.storedFacetField)
	cfg := b.postRankAuthz
	maxCandidates := int64(cfg.FacetSampleSize)
	var candidates int64
	var authorized int64

	initial := *firstReq
	initial.SearchAfter = nil
	initial.SearchBefore = nil
	initial.Size = cfg.facetWindowSize()
	initial.Fields = b.facetScanFields(facets, trashAuthz != nil)
	windowReq := &initial

	var firstRes *bleve.SearchResult
	for {
		res, err := searchInContext(ctx, index, windowReq)
		if err != nil {
			return nil, 0, false, err
		}
		stats.AddSearchTime(res.Took)
		if firstRes == nil {
			firstRes = res
		}

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
		for info, err := range authorizeHits(ctx, access, candidateSeq, len(windowHits), extractFn, trashAuthz) {
			if err != nil {
				return nil, 0, false, err
			}
			authorized++
			agg.add(info.doc)
		}

		if candidates >= maxCandidates {
			// Like the page scan: a budget that covered every match leaves
			// nothing unsampled, so the facets are the complete authorized set.
			if candidates < int64(firstRes.Total) {
				b.indexMetrics.SearchAuthEvents.WithLabelValues("facet_budget").Inc()
			}
			return agg, authorized, candidates >= int64(firstRes.Total), nil
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
	fieldValueSchema *fieldValueResultSchema,
	sort search.SortOrder,
	req *resourcepb.ResourceSearchRequest,
	firstRes *bleve.SearchResult,
	authorized int64,
	exhausted, reverseSort, wantFacets, trash bool,
	agg *facetAggregator,
	stats *resource.SearchStats,
) error {
	fromTop := len(req.SearchAfter) == 0 && len(req.SearchBefore) == 0
	exact := exhausted
	switch {
	case wantFacets:
		response.TotalHits = authorized
	case trash:
		// The unfiltered count would say how many deleted objects match regardless
		// of who deleted them, which is what the trash rule exists to withhold: a
		// caller could vary filters and read other people's deletions off the
		// total. Only authorized hits are counted, even when that undercounts.
		response.TotalHits = authorized
		exact = exhausted && fromTop
	case exhausted && fromTop:
		// The scan saw every match from the top, so the authorized count is
		// exact. Count-only requests (Limit == 0) reach this too: they scan
		// solely to total, and only fall through when the budget cuts them off.
		response.TotalHits = authorized
	default:
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
	if err := b.setSearchResults(ctx, response, selectFields, fieldValueSchema, page, sort, req.Explain); err != nil {
		return err
	}
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
	storedField func(string) string
	// facet name -> term -> count
	counts map[string]map[string]int64
	// facet name -> number of authorized hits missing that field
	missing map[string]int64
	// facet name -> total authorized hits considered for that field
	total map[string]int64
}

func newFacetAggregator(
	facets map[string]*resourcepb.ResourceSearchRequest_Facet,
	storedField func(string) string,
) *facetAggregator {
	a := &facetAggregator{
		fields:      facets,
		storedField: storedField,
		counts:      make(map[string]map[string]int64, len(facets)),
		missing:     make(map[string]int64, len(facets)),
		total:       make(map[string]int64, len(facets)),
	}
	for name := range facets {
		a.counts[name] = make(map[string]int64)
	}
	return a
}

func (a *facetAggregator) add(doc *search.DocumentMatch) {
	for name, f := range a.fields {
		v, ok := doc.Fields[a.storedField(f.Field)]
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
		// Zero means no term buckets, matching what bleve returns for size 0.
		// Negative is rejected before the search runs; treating it the same way
		// here keeps the slice bound below unreachable.
		if limit <= 0 {
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
