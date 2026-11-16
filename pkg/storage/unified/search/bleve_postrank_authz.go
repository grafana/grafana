package search

import (
	"context"
	"slices"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/query"
	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Load internal fields after snapshotting the requested columns, so they cannot
// become part of the public response just because authorization needs them.
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
	if len(req.AccessVerbs) > 0 && !slices.Contains(searchrequest.Fields, resource.SEARCH_FIELD_FOLDER) {
		searchrequest.Fields = append(searchrequest.Fields, resource.SEARCH_FIELD_FOLDER)
	}
	return nil
}

func (b *bleveIndex) ensureAuthzFields(searchrequest *bleve.SearchRequest, trash bool) {
	for _, f := range authzLoadFields(trash) {
		if !slices.Contains(searchrequest.Fields, f) &&
			!slices.Contains(searchrequest.Fields, resource.SEARCH_FIELD_ALL_FIELDS) {
			searchrequest.Fields = append(searchrequest.Fields, f)
		}
	}
}

func (b *bleveIndex) runPostFilterAuthz(
	ctx context.Context,
	access authlib.AccessClient,
	rowAccess authlib.AccessClient,
	req *resourcepb.ResourceSearchRequest,
	index bleve.Index,
	firstReq *bleve.SearchRequest,
	fieldValueSchema *fieldValueResultSchema,
	stats *resource.SearchStats,
	response *resourcepb.ResourceSearchResponse,
	trashAuthz *resource.TrashAuthorizer,
) (*resourcepb.ResourceSearchResponse, error) {
	runner := postRankSearch{
		key:          b.key,
		backend:      &bleveQueryBackend{index: index, request: firstReq},
		config:       b.postRankAuthz,
		indexMetrics: b.indexMetrics,
		facetField:   b.searchFields.storedFacetField,
	}
	window := queryRequest{Fields: firstReq.Fields, SearchAfter: firstReq.SearchAfter}
	if len(req.SearchBefore) > 0 {
		window.SearchAfter = firstReq.SearchBefore
		window.Reverse = true
	}
	hits, err := runner.run(ctx, access, req, window, stats, response, trashAuthz)
	if err != nil {
		return nil, err
	}

	started := time.Now()
	err = setSearchResults(b.logger, response, fieldValueSchema, hits)
	stats.AddResultsConversionTime(time.Since(started))
	addRowAccess(ctx, b.logger, rowAccess, req.AccessVerbs, response, hits)
	return response, err
}

type bleveQueryBackend struct {
	index   bleve.Index
	request *bleve.SearchRequest
}

var _ queryBackend = (*bleveQueryBackend)(nil)

func (b *bleveQueryBackend) sort(reverse bool) search.SortOrder {
	if !reverse {
		return b.request.Sort
	}
	order := b.request.Sort.Copy()
	order.Reverse()
	return order
}

func (b *bleveQueryBackend) Search(ctx context.Context, req queryRequest) (*queryResult, error) {
	prepared := *b.request
	prepared.Size = req.Size
	prepared.Fields = req.Fields
	prepared.SearchAfter = req.SearchAfter
	prepared.SearchBefore = nil
	prepared.Sort = b.sort(req.Reverse)
	return b.search(ctx, &prepared)
}

func (b *bleveQueryBackend) Lookup(ctx context.Context, ids, fields []string, reverse bool) (*queryResult, error) {
	return b.search(ctx, &bleve.SearchRequest{
		Query:  b.lookupQuery(ids),
		Size:   len(ids),
		Fields: fields,
		Sort:   b.sort(reverse),
		Score:  bleve.ScoreNone,
	})
}

func (b *bleveQueryBackend) lookupQuery(ids []string) query.Query {
	byID := bleve.NewDocIDQuery(ids)
	// A match-all searcher walks every document. Drive a scoped match-all lookup
	// from the selected IDs instead, without dropping its live or trash filters.
	if scoped, ok := b.request.Query.(*query.BooleanQuery); ok {
		if must, ok := scoped.Must.(*query.ConjunctionQuery); ok && len(must.Conjuncts) == 1 {
			if _, all := must.Conjuncts[0].(*query.MatchAllQuery); all {
				byIDs := *scoped
				byIDs.Must = bleve.NewConjunctionQuery(byID)
				return &byIDs
			}
		}
	}
	return bleve.NewConjunctionQuery(b.request.Query, byID)
}

func (b *bleveQueryBackend) ReadAuthzMetadata(ctx context.Context, ids []string) (*queryMetadata, error) {
	// Doc values avoid loading stored fields for candidates that never make a
	// page. A missing folder sorts before every real folder ID.
	sortBy := func(field string) *search.SortField {
		return &search.SortField{Field: field, Type: search.SortFieldAsString, Missing: search.SortFieldMissingFirst}
	}
	res, err := searchInContext(ctx, b.index, &bleve.SearchRequest{
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
	return &queryMetadata{Values: metadata, Took: res.Took, Cost: res.Cost}, nil
}

func (b *bleveQueryBackend) search(ctx context.Context, req *bleve.SearchRequest) (*queryResult, error) {
	res, err := searchInContext(ctx, b.index, req)
	if err != nil {
		return nil, err
	}
	return &queryResult{
		Hits:     toQueryHits(res.Hits, req.Sort),
		Total:    res.Total,
		MaxScore: res.MaxScore,
		Took:     res.Took,
		Cost:     res.Cost,
	}, nil
}

func toQueryHits(hits search.DocumentMatchCollection, order search.SortOrder) []*queryHit {
	result := make([]*queryHit, len(hits))
	for i, hit := range hits {
		key := make([]string, 0, len(hit.Sort))
		for j, value := range hit.Sort {
			if j < len(order) {
				if _, score := order[j].(*search.SortScore); score {
					continue
				}
			}
			key = append(key, value)
		}
		result[i] = &queryHit{
			ID: hit.ID, Score: hit.Score, Fields: hit.Fields,
			Sort: hitSortFields(hit, order), SortKey: key,
		}
	}
	return result
}
