package search

import (
	"fmt"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type decodedResults struct {
	items          []searchv0.ResultItem
	lastSortFields []string
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
	switch res.GetResultFormat() {
	case resourcepb.ResourceSearchRequest_UNSPECIFIED, resourcepb.ResourceSearchRequest_RESOURCE_TABLE:
		return decodeTableResults(res.GetResults(), kind)
	case resourcepb.ResourceSearchRequest_FIELD_VALUES:
		return decodeFieldValueResults(res.GetFields(), res.GetRows(), kind)
	default:
		return decodedResults{}, fmt.Errorf("unsupported search result format %d", res.GetResultFormat())
	}
}

// decodeTableResults converts the legacy backend result table into envelope items.
// Column names are already public names: the backend resolves them back from
// their physical fields.* form when it builds the table.
func decodeTableResults(table *resourcepb.ResourceTable, kind kindRef) (decodedResults, error) {
	rows := table.GetRows()
	items := make([]searchv0.ResultItem, 0, len(rows))
	cols := table.GetColumns()

	for _, row := range rows {
		if len(row.GetCells()) != len(cols) {
			return decodedResults{}, fmt.Errorf("row has %d cells but the table declares %d columns", len(row.GetCells()), len(cols))
		}

		item := resultItem(kind, row.GetKey())
		values := map[string]any{}
		for i, col := range cols {
			v, err := resource.DecodeCell(col, i, row.GetCells()[i])
			if err != nil {
				return decodedResults{}, fmt.Errorf("decoding column %q: %w", col.GetName(), err)
			}
			if v == nil {
				continue
			}
			// _score is surfaced as its own field, not as a searchable field.
			if col.GetName() == resource.SEARCH_FIELD_SCORE {
				if score, ok := toFloat64(v); ok {
					item.Score = &score
				}
				continue
			}
			values[col.GetName()] = v
		}
		if len(values) > 0 {
			item.Fields = &common.Unstructured{Object: values}
		}

		items = append(items, item)
	}

	var lastSortFields []string
	if len(rows) > 0 {
		lastSortFields = rows[len(rows)-1].GetSortFields()
	}
	return decodedResults{items: items, lastSortFields: lastSortFields}, nil
}

func decodeFieldValueResults(fields []*resourcepb.ResourceSearchField, rows []*resourcepb.ResourceSearchRow, kind kindRef) (decodedResults, error) {
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
	return searchv0.ResultItem{
		Resource: searchv0.ResourceRef{
			Group:    kind.group,
			Resource: kind.resource,
			Kind:     kind.kind,
			Name:     key.GetName(),
		},
	}
}

func toFloat64(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int64:
		return float64(n), true
	}
	return 0, false
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
