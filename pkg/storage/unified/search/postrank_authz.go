package search

import (
	"context"
	"fmt"
	"iter"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// PostRankAuthzConfig tunes the post-filter authorization path: the engine ranks,
// a bounded window of hits is fetched,
// and authorization runs app-side in rank order, paging via SearchAfter until
// the page is filled or matches are exhausted. Counting can stop at the budget.
type PostRankAuthzConfig struct {
	// Over-fetching avoids another query when some candidates are unauthorized.
	OverFetchFactor int
	// MaxWindow bounds memory per query without limiting how far a page scans.
	MaxWindow int
	// MaxCandidates limits count-only scans and counting beyond a full trash
	// page. It never shortens a result page.
	MaxCandidates int
	// ExactCountThreshold enables full authorized counts when the initial
	// match count fits. Nonpositive values disable optional counting.
	ExactCountThreshold int
	// FacetSampleSize is the candidate budget when aggregating facets. Facet
	// counts reflect a sample of up to this many ranked hits, not the full
	// authorized set. Smaller than MaxCandidates since facets are a
	// distribution that stabilizes with a modest sample.
	FacetSampleSize int
}

// effective defaults the scan tunables but leaves optional exact counting off
// unless its threshold is explicitly configured.
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

// countSmallResultSet decides whether to keep authorizing after the page fills.
// The initial pre-authorization total bounds the work needed for an exact count;
// above the threshold, extra checks cannot guarantee one within that budget.
// Cursor scans omit earlier matches, while count-only and facet requests have
// their own counting policies. Eligibility alone does not prove an exact total:
// the scan must still exhaust the matches. The caller excludes trash searches.
func countSmallResultSet(req *resourcepb.ResourceSearchRequest, total uint64, threshold int64) bool {
	return req.Limit > 0 && len(req.Facet) == 0 &&
		len(req.SearchAfter) == 0 && len(req.SearchBefore) == 0 &&
		threshold > 0 && total <= uint64(threshold)
}

func (c PostRankAuthzConfig) windowSize(limit int) int {
	w := min(limit*c.OverFetchFactor, c.MaxWindow)
	return w
}

// Facet samples use large windows to avoid extra queries.
func (c PostRankAuthzConfig) facetWindowSize() int {
	w := min(c.FacetSampleSize, c.MaxWindow)
	return w
}

// A count-only request has limit zero but still needs candidates to authorize.
func (c PostRankAuthzConfig) countWindowSize() int {
	w := min(c.MaxCandidates, c.MaxWindow)
	return w
}

// Growing windows reduce query count when permissions leave few matches.
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

type docInfo struct {
	doc          *queryHit
	namespace    string
	group        string
	resourceType string
	name         string
	folder       string
	verb         string
	deletedBy    string
}

// windowDocInfo is parseHitDocInfo with the hit's authorization metadata. A hit
// without metadata was removed from the index since its window was searched, and
// is skipped.
func windowDocInfo(hit *queryHit, resources map[string]string, metadata map[string]authzMetadata) (docInfo, bool) {
	authzMeta, ok := metadata[hit.ID]
	if !ok {
		return docInfo{}, false
	}
	info, ok := parseHitDocInfo(hit, resources)
	info.folder, info.deletedBy = authzMeta.folder, authzMeta.deletedBy
	return info, ok
}

// A hit removed since ranking has no metadata and is skipped. Changes to its
// authorization fields or query scope are checked again before returning it.
func (p *postRankPage) readAuthzMetadata(ctx context.Context, hits []*queryHit) (map[string]authzMetadata, error) {
	if len(hits) == 0 {
		return nil, nil
	}
	ids := make([]string, len(hits))
	for i, hit := range hits {
		ids[i] = hit.ID
	}
	res, err := p.backend.ReadAuthzMetadata(ctx, ids)
	if err != nil {
		return nil, err
	}
	p.stats.AddSearchTime(res.Took)
	p.cost += res.Cost
	return res.Values, nil
}

// postRankPage holds the page's authorized hits. Their stored fields are loaded
// after authorization, from a newer snapshot than the one they were ranked and
// authorized on, so each is checked against both before it is kept.
type postRankPage struct {
	backend queryBackend
	reverse bool
	fields  []string
	limit   int
	stats   *resource.SearchStats

	// cost is what the lookups read, part of the search's reported cost as the
	// stored fields were when window searches loaded them.
	cost uint64

	hits      []docInfo
	validated int
}

func (p *postRankPage) full() bool {
	return len(p.hits) >= p.limit
}

// add takes an authorized hit while the page has room. Once the page is full,
// it validates what was added and returns how many hits it dropped, which the
// hits still to come can replace.
func (p *postRankPage) add(ctx context.Context, info docInfo) (int, error) {
	if !p.full() {
		p.hits = append(p.hits, info)
	}
	if !p.full() {
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
	res, err := p.backend.Lookup(ctx, queryLookupRequest{IDs: ids, Fields: p.fields, Reverse: p.reverse})
	if err != nil {
		return 0, err
	}
	p.stats.AddSearchTime(res.Took)
	p.cost += res.Cost
	loaded := make(map[string]*queryHit, len(res.Hits))
	for _, hit := range res.Hits {
		loaded[hit.ID] = hit
	}

	kept := p.hits[:p.validated]
	for _, info := range pending {
		hit, ok := loaded[info.doc.ID]
		if !ok || !slices.Equal(hit.StableSortKey, info.doc.StableSortKey) {
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

func (p *postRankPage) documents() []*queryHit {
	docs := make([]*queryHit, len(p.hits))
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
func authzResources(key resource.NamespacedResource, req *resourcepb.ResourceSearchRequest) map[string]string {
	verb := utils.VerbGet
	if req.Permission == int64(dashboardaccess.PERMISSION_EDIT) {
		verb = utils.VerbUpdate
	}
	resources := map[string]string{}
	if key.IsGlobal() {
		resources[anyResourceType] = verb
	} else {
		resources[key.Group+"/"+key.Resource] = verb
	}
	if req.Permission == int64(dashboardaccess.PERMISSION_CREATE) && (key.IsGlobal() || (key.Group == folderGroup && key.Resource == folderResource)) {
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
// The hit already has its ID and stored fields populated by the engine. The doc
// id is <namespace>/<group>/<resourceType>/<name>; the resourceType segment
// distinguishes dashboards from folders in a federated alias and keys the verb.
func parseHitDocInfo(doc *queryHit, resources map[string]string) (docInfo, bool) {
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

type postRankSearch struct {
	key          resource.NamespacedResource
	backend      queryBackend
	config       PostRankAuthzConfig
	indexMetrics *resource.BleveIndexMetrics
	facetField   func(string) string
}

// run fills pages independently of the counting budget: existing callers treat
// a short page as exhaustion. Facets use a separate authorized sample.
func (s *postRankSearch) run(
	ctx context.Context,
	access authlib.AccessClient,
	req *resourcepb.ResourceSearchRequest,
	firstReq queryRequest,
	stats *resource.SearchStats,
	response *resourcepb.ResourceSearchResponse,
	trashAuthz *resource.TrashAuthorizer,
) ([]*queryHit, error) {
	limit, offset := int(req.Limit), int(req.Offset)
	ctx, span := tracer.Start(ctx, "search.postRankAuthz", trace.WithAttributes(
		attribute.String("namespace", s.key.Namespace),
		attribute.String("group", s.key.Group),
		attribute.Int("search.limit", limit),
		attribute.Int("search.offset", offset),
	))
	defer span.End()

	resources := authzResources(s.key, req)
	cfg := s.config
	exactCountThreshold := int64(cfg.ExactCountThreshold)
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

	agg, facetAuthorized, facetExhausted, err := s.prepareFacetAggregation(
		ctx, access, req, firstReq, resources, stats, trashAuthz,
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

	page := postRankPage{backend: s.backend, reverse: firstReq.Reverse, fields: firstReq.Fields, limit: limit, stats: stats}

	var candidates int64
	var authorized int64
	var exhausted bool
	var firstRes queryResult
	maxCandidates := int64(cfg.MaxCandidates)

	// Walk away from a backward cursor, then return its page in forward order.
	reverseSort := firstReq.Reverse

	// Most candidates never reach a page, so load their stored fields only
	// after authorization.
	windowReq := firstReq
	windowReq.Fields = nil
	// Existing callers treat a short page as exhaustion. Only count-only scans
	// and counting beyond a full page may stop at the budget.
	budgetSpent := func() bool { return candidates >= maxCandidates && (countOnly || page.full()) }
windows:
	for window := 0; ; window++ {
		res, err := s.backend.Search(ctx, windowReq)
		if err != nil {
			return nil, err
		}
		stats.AddSearchTime(res.Took)
		if window == 0 {
			firstRes = res
			stats.AddTotalHits(int(res.Total))
			if trashAuthz == nil && countSmallResultSet(req, res.Total, exactCountThreshold) {
				countEveryHit = true
				// This budget is independent of count-only and trash scans.
				maxCandidates = exactCountThreshold
			}
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
			dropped, err := page.add(ctx, info)
			if err != nil {
				return nil, err
			}
			authorized -= int64(dropped)
			// Stop as soon as the page is full (early-exit).
			if !countEveryHit && page.full() {
				break windows
			}
		}
		if budgetSpent() {
			// A budget that covered every match leaves nothing unseen, so the
			// authorized count is still exact. candidates never exceeds the
			// number of hits walked, so this can only under-claim.
			exhausted = candidates >= int64(firstRes.Total)
			if !exhausted {
				s.indexMetrics.SearchAuthEvents.WithLabelValues("candidate_budget").Inc()
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
		cursor := last.Cursor
		if len(cursor) == 0 {
			exhausted = true
			break // no sort values -> cannot build a SearchAfter cursor
		}
		// Only the cursor and the window Size change between windows; query, sort
		// (already reversed once for SearchBefore), and fields are identical.
		// Page-fill windows grow geometrically (capped at MaxWindow).
		windowReq.SearchAfter = cursor
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
	docs := page.documents()
	finalizePostFilter(response, docs, req, firstRes,
		authorized, exhausted, reverseSort, wantFacets, trashAuthz != nil, agg, stats)
	return docs, nil
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

func (s *postRankSearch) prepareFacetAggregation(
	ctx context.Context,
	access authlib.AccessClient,
	req *resourcepb.ResourceSearchRequest,
	firstReq queryRequest,
	resources map[string]string,
	stats *resource.SearchStats,
	trashAuthz *resource.TrashAuthorizer,
) (*facetAggregator, int64, bool, error) {
	if len(req.Facet) == 0 {
		return nil, 0, false, nil
	}

	extractFn := batchCheckItem
	agg, authorized, exhausted, err := s.aggregateFacetsFromTop(
		ctx, access, firstReq, resources, extractFn, req.Facet, stats, trashAuthz,
	)
	return agg, authorized, exhausted, err
}

// facetScanFields is the stored-field projection the facet scan needs: the
// folder to authorize a hit and the stored facet fields to count its terms.
// The response columns come from the page scan, so loading them here would
// fetch stored data for up to FacetSampleSize hits that is never returned.
func (s *postRankSearch) facetScanFields(facets map[string]*resourcepb.ResourceSearchRequest_Facet, trash bool) []string {
	fields := make([]string, 0, len(facets)+2)
	for _, facet := range facets {
		field := s.facetField(facet.Field)
		if field != "" && !slices.Contains(fields, field) {
			fields = append(fields, field)
		}
	}
	slices.Sort(fields)
	return append(fields, authzLoadFields(trash)...)
}

func (s *postRankSearch) aggregateFacetsFromTop(
	ctx context.Context,
	access authlib.AccessClient,
	firstReq queryRequest,
	resources map[string]string,
	extractFn func(docInfo) authz.BatchCheckItem,
	facets map[string]*resourcepb.ResourceSearchRequest_Facet,
	stats *resource.SearchStats,
	trashAuthz *resource.TrashAuthorizer,
) (*facetAggregator, int64, bool, error) {
	agg := newFacetAggregator(facets, s.facetField)
	cfg := s.config
	maxCandidates := int64(cfg.FacetSampleSize)
	var candidates int64
	var authorized int64

	windowReq := firstReq
	windowReq.SearchAfter = nil
	windowReq.Reverse = false
	windowReq.Size = cfg.facetWindowSize()
	windowReq.Fields = s.facetScanFields(facets, trashAuthz != nil)

	var firstRes queryResult
	for window := 0; ; window++ {
		res, err := s.backend.Search(ctx, windowReq)
		if err != nil {
			return nil, 0, false, err
		}
		stats.AddSearchTime(res.Took)
		if window == 0 {
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
			agg.add(info.doc.Fields)
		}

		if candidates >= maxCandidates {
			// Like the page scan: a budget that covered every match leaves
			// nothing unsampled, so the facets are the complete authorized set.
			if candidates < int64(firstRes.Total) {
				s.indexMetrics.SearchAuthEvents.WithLabelValues("facet_budget").Inc()
			}
			return agg, authorized, candidates >= int64(firstRes.Total), nil
		}
		if len(res.Hits) < windowReq.Size || len(res.Hits) == 0 {
			return agg, authorized, true, nil
		}
		cursor := res.Hits[len(res.Hits)-1].Cursor
		if len(cursor) == 0 {
			return agg, authorized, true, nil
		}
		windowReq.SearchAfter = cursor
		windowReq.Size = cfg.facetWindowSize()
	}
}

// Facet totals must describe the same authorized sample as their term counts.
// Other searches retain the unfiltered fallback when counting was incomplete.
func finalizePostFilter(
	response *resourcepb.ResourceSearchResponse,
	page []*queryHit,
	req *resourcepb.ResourceSearchRequest,
	firstRes queryResult,
	authorized int64,
	exhausted, reverseSort, wantFacets, trash bool,
	agg *facetAggregator,
	stats *resource.SearchStats,
) {
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
		// the hit nearest the cursor last.
		for i, j := 0, len(page)-1; i < j; i, j = i+1, j-1 {
			page[i], page[j] = page[j], page[i]
		}
	}

	resultsConversionStart := time.Now()
	if wantFacets {
		// Counts are the exact authorized term counts within the bounded sample;
		// see facetAggregator.build for why we don't extrapolate.
		response.Facet = agg.build()
	}
	stats.AddResultsConversionTime(time.Since(resultsConversionStart))
}

// facetAggregator computes facet counts app-side over the authorized sample
// (<= FacetSampleSize candidates), not the full authorized set.
type facetAggregator struct {
	fields map[string]*resourcepb.ResourceSearchRequest_Facet
	// requested field -> stored field
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

func (a *facetAggregator) add(fields map[string]any) {
	for name, f := range a.fields {
		v, ok := fields[a.storedField(f.Field)]
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

// accessCheck is one verb to check for one returned row.
type accessCheck struct {
	row  *resourcepb.ResourceSearchRow
	verb string
}

// addRowAccess answers, for each returned row, whether the caller may do each
// of verbs to it. The rows are checked in one batch. If that fails, as it does
// when the calling service may not check a verb of a type on the caller's
// behalf, each type and verb is checked on its own, and the ones that still fail
// are left out rather than answered no.
func addRowAccess(ctx context.Context, logger log.Logger, access authlib.AccessClient, verbs []string, response *resourcepb.ResourceSearchResponse, hits []*queryHit) {
	if len(verbs) == 0 || len(response.Rows) == 0 {
		return
	}
	ctx, span := tracer.Start(ctx, "search.bleveIndex.addRowAccess")
	defer span.End()
	logger = logger.FromContext(ctx)

	checks := make([]accessCheck, 0, len(response.Rows)*len(verbs))
	for _, row := range response.Rows {
		for _, verb := range verbs {
			checks = append(checks, accessCheck{row: row, verb: verb})
		}
	}
	// Without an access client the search checks nothing, so nothing is refused.
	if access == nil {
		recordAccess(checks, nil)
		return
	}
	// A permission granted on a folder applies to what is in it. The search loads
	// each hit's folder for this, whether or not it returns the folder field.
	folders := make(map[string]string, len(hits))
	for _, hit := range hits {
		folders[hit.ID], _ = hit.Fields[resource.SEARCH_FIELD_FOLDER].(string)
	}
	check := func(c accessCheck) authz.BatchCheckItem {
		return authz.BatchCheckItem{
			Name:      c.row.Key.Name,
			Folder:    folders[resource.SearchID(c.row.Key)],
			Verb:      c.verb,
			Group:     c.row.Key.Group,
			Resource:  c.row.Key.Resource,
			Namespace: c.row.Key.Namespace,
		}
	}
	ctx = withUserToReportTo(ctx, checks)
	checkAll := func(checks []accessCheck) error {
		allowed := make(map[accessCheck]bool, len(checks))
		for c, err := range authz.FilterAuthorized(ctx, access, slices.Values(checks), check, authz.WithTracer(tracer), authz.WithSizeHint(len(checks))) {
			if err != nil {
				return err
			}
			allowed[c] = true
		}
		recordAccess(checks, allowed)
		return nil
	}
	err := checkAll(checks)
	if err == nil {
		return
	}
	// Expected when the calling service may not check some type and verb, so not
	// a warning: each type and verb is checked on its own next.
	span.RecordError(err)
	logger.Debug("Failed to check access to search results in one batch, checking each type and verb", "error", err)

	var groups []string
	byGroup := map[string][]accessCheck{}
	for _, c := range checks {
		group := c.row.Key.Group + "/" + c.row.Key.Resource + ":" + c.verb
		if _, ok := byGroup[group]; !ok {
			groups = append(groups, group)
		}
		byGroup[group] = append(byGroup[group], c)
	}
	for _, group := range groups {
		if err := checkAll(byGroup[group]); err != nil {
			logger.Warn("Failed to check access to search results", "check", group, "error", err)
		}
	}
}

// userToReportTo is the user a search reports access to. The service checks are
// for a service acting on a user's behalf: whether it may do the verb for the
// user. The search only tells the user what they may do, so the user is given
// the delegated permissions the checks need, and authz checks the user. The
// calling service still had to be allowed to read each type to get the results.
type userToReportTo struct {
	authlib.AuthInfo
	permissions []string
}

func (u userToReportTo) GetTokenDelegatedPermissions() []string {
	return u.permissions
}

// withUserToReportTo puts the caller in ctx as a user to report to. A service
// acting for itself is still checked on its own permissions, which delegated
// permissions do not change.
func withUserToReportTo(ctx context.Context, checks []accessCheck) context.Context {
	user, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return ctx
	}
	var permissions []string
	for _, c := range checks {
		permission := c.row.Key.Group + "/" + c.row.Key.Resource + ":" + c.verb
		if !slices.Contains(permissions, permission) {
			permissions = append(permissions, permission)
		}
	}
	return authlib.WithAuthInfo(ctx, userToReportTo{AuthInfo: user, permissions: permissions})
}

// recordAccess sets each check's answer on its row: allowed when allowed is nil.
func recordAccess(checks []accessCheck, allowed map[accessCheck]bool) {
	for _, c := range checks {
		if c.row.Access == nil {
			c.row.Access = map[string]bool{}
		}
		c.row.Access[c.verb] = allowed == nil || allowed[c]
	}
}
