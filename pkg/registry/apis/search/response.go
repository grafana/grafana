package search

import (
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type decodedResults struct {
	items          []searchv0.ResultItem
	lastSortFields []string
}

// ToSearchResults lets custom endpoints reuse result decoding and row-based
// continuation before applying their own response metadata policy.
func ToSearchResults(res *resourcepb.ResourceSearchResponse, gvr schema.GroupVersionResource, kind string, limit int64) (*searchv0.SearchResults, error) {
	return searchResults(res, kindRef{group: gvr.Group, version: gvr.Version, resource: gvr.Resource, kind: kind}, limit)
}

// searchResults maps a backend search response into the public envelope.
//
// limit is the page size that was requested; it decides whether a continue
// token is offered, since the backend does not say whether more results exist.
func searchResults(res *resourcepb.ResourceSearchResponse, kind kindRef, limit int64) (*searchv0.SearchResults, error) {
	decoded, err := decodeResults(res, kind)
	if err != nil {
		return nil, err
	}

	out := &searchv0.SearchResults{
		TypeMeta: metaForKind(searchv0.KindSearchResults),
		Metadata: searchv0.ResultsMetadata{
			TotalHits:         res.GetTotalHits(),
			TotalHitsRelation: totalHitsRelation(res.GetTotalHitsExact()),
			Continue:          continueToken(len(decoded.items), decoded.lastSortFields, limit, res.GetTotalHitsExact()),
		},
		Items:  decoded.items,
		Facets: facets(res.GetFacet()),
	}
	return out, nil
}

// globalSearchResults is searchResults for the search across resource types,
// which also reports the types it left out.
func globalSearchResults(res *resourcepb.ResourceSearchResponse, kind kindRef, limit int64) (*searchv0.GlobalSearchResults, error) {
	results, err := searchResults(res, kind, limit)
	if err != nil {
		return nil, err
	}
	return &searchv0.GlobalSearchResults{
		TypeMeta: metaForKind(searchv0.KindGlobalSearchResults),
		Metadata: searchv0.GlobalResultsMetadata{
			ResultsMetadata: results.Metadata,
			SkippedTypes:    res.GetSkippedTypes(),
		},
		Items:  results.Items,
		Facets: results.Facets,
	}, nil
}

// trashResults maps a backend search response into the trash envelope. No facets:
// trash never requests any, so the backend never returns any.
func trashResults(res *resourcepb.ResourceSearchResponse, kind kindRef, limit int64) (*searchv0.TrashResults, error) {
	decoded, err := decodeResults(res, kind)
	if err != nil {
		return nil, err
	}

	return &searchv0.TrashResults{
		TypeMeta: metaForKind(searchv0.KindTrashResults),
		Metadata: searchv0.ResultsMetadata{
			TotalHits:         res.GetTotalHits(),
			TotalHitsRelation: totalHitsRelation(res.GetTotalHitsExact()),
			Continue:          continueToken(len(decoded.items), decoded.lastSortFields, limit, res.GetTotalHitsExact()),
		},
		Items: decoded.items,
	}, nil
}

func totalHitsRelation(exact bool) searchv0.TotalHitsRelation {
	if exact {
		return searchv0.TotalHitsEqual
	}
	return searchv0.TotalHitsAtMost
}

// continueToken offers a cursor when more results may exist.
//
// A short page usually means the end, but not always: the backend may stop
// scanning before it runs out of matches, and it reports that by marking the
// total as inexact. Ending the walk there would leave those results
// unreachable, so only an exact total lets a short page finish. The cost is at
// most one extra empty page.
func continueToken(rowCount int, lastSortFields []string, limit int64, totalIsExact bool) string {
	// Translation always resolves a limit, so the zero check is only here to keep
	// the function honest if it is ever called directly.
	if limit <= 0 || rowCount == 0 {
		return ""
	}
	if int64(rowCount) < limit && totalIsExact {
		return ""
	}
	// The cursor is the last row's sort values. The backend returns them per row
	// and takes them back as SearchAfter, so the next page resumes at the point
	// this one stopped, in the same order. A row without them cannot be resumed
	// from, which happens when the query has no sort to position against.
	if len(lastSortFields) == 0 {
		return ""
	}
	return encodeContinue(lastSortFields)
}

func decodeResults(res *resourcepb.ResourceSearchResponse, kind kindRef) (decodedResults, error) {
	if res != nil && res.GetResultFormat() != resourcepb.ResourceSearchRequest_FIELD_VALUES {
		return decodedResults{}, fmt.Errorf("unsupported search result format %d", res.GetResultFormat())
	}
	// The search server reads manifests at runtime, so it can name kinds this
	// process does not know. An older server sends none.
	kind.reportedKinds = res.GetKinds()
	fields, rows := res.GetFields(), res.GetRows()
	items := make([]searchv0.ResultItem, 0, len(rows))
	for i, row := range rows {
		if row == nil || row.GetKey() == nil {
			return decodedResults{}, fmt.Errorf("field-value search result row %d has no resource key", i)
		}
		values, err := resource.DecodeSearchValues(fields, row)
		if err != nil {
			return decodedResults{}, fmt.Errorf("decoding field-value search result row %d: %w", i, err)
		}

		item := resultItem(kind, row.GetKey())
		if len(values) > 0 {
			item.Fields = &common.Unstructured{Object: values}
		}
		if row.Score != nil {
			score := row.GetScore()
			item.Score = &score
		}
		items = append(items, item)
	}

	var lastSortFields []string
	if len(rows) > 0 {
		lastSortFields = rows[len(rows)-1].GetSortFields()
	}
	return decodedResults{items: items, lastSortFields: lastSortFields}, nil
}

func resultItem(kind kindRef, key *resourcepb.ResourceKey) searchv0.ResultItem {
	group, resourceName, kindName := kind.group, kind.resource, kind.kind
	if kind.spansResourceTypes() {
		group, resourceName = key.GetGroup(), key.GetResource()
		// An unknown pair leaves the kind empty rather than borrowing another
		// result's: the group and resource still identify the object.
		var ok bool
		if kindName, ok = kind.reportedKinds[group+"/"+resourceName]; !ok {
			kindName = kind.kinds[schema.GroupResource{Group: group, Resource: resourceName}]
		}
	}
	return searchv0.ResultItem{
		Resource: searchv0.ResourceRef{
			Group:    group,
			Resource: resourceName,
			Kind:     kindName,
			Name:     key.GetName(),
		},
	}
}

func facets(in map[string]*resourcepb.ResourceSearchResponse_Facet) map[string][]searchv0.FacetTerm {
	if len(in) == 0 {
		return nil
	}
	out := make(map[string][]searchv0.FacetTerm, len(in))
	for key, f := range in {
		// The backend reports the requested (public) field name in Field; the
		// map key is the physical field it aggregated on.
		name := f.GetField()
		if name == "" {
			name = key
		}
		terms := make([]searchv0.FacetTerm, 0, len(f.GetTerms()))
		for _, t := range f.GetTerms() {
			terms = append(terms, searchv0.FacetTerm{Value: t.GetTerm(), Count: t.GetCount()})
		}
		out[name] = terms
	}
	return out
}
