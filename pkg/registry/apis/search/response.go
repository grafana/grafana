package search

import (
	"fmt"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// searchResults maps a backend search response into the public envelope.
//
// limit is the page size that was requested; it decides whether a continue
// token is offered, since the backend does not say whether more results exist.
func searchResults(res *resourcepb.ResourceSearchResponse, kind kindRef, limit int64) (*searchv0.SearchResults, error) {
	items, err := resultItems(res.GetResults(), kind)
	if err != nil {
		return nil, err
	}

	out := &searchv0.SearchResults{
		TypeMeta: metaForKind(searchv0.KindSearchResults),
		Metadata: searchv0.ResultsMetadata{
			TotalHits:         res.GetTotalHits(),
			TotalHitsRelation: totalHitsRelation(res.GetTotalHitsExact()),
			Continue:          continueToken(res.GetResults(), limit, res.GetTotalHitsExact()),
		},
		Items:  items,
		Facets: facets(res.GetFacet()),
	}
	return out, nil
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
func continueToken(table *resourcepb.ResourceTable, limit int64, totalIsExact bool) string {
	rows := table.GetRows()
	if limit <= 0 || len(rows) == 0 {
		return ""
	}
	if int64(len(rows)) < limit && totalIsExact {
		return ""
	}
	last := rows[len(rows)-1]
	if len(last.GetSortFields()) == 0 {
		return ""
	}
	return encodeContinue(last.GetSortFields())
}

// resultItems converts the backend result table into envelope items. Column
// names are already public names: the backend resolves them back from their
// physical fields.* form when it builds the table.
func resultItems(table *resourcepb.ResourceTable, kind kindRef) ([]searchv0.ResultItem, error) {
	rows := table.GetRows()
	items := make([]searchv0.ResultItem, 0, len(rows))
	cols := table.GetColumns()

	for _, row := range rows {
		if len(row.GetCells()) != len(cols) {
			return nil, fmt.Errorf("row has %d cells but the table declares %d columns", len(row.GetCells()), len(cols))
		}

		item := searchv0.ResultItem{
			Resource: searchv0.ResourceRef{
				Group:    kind.group,
				Resource: kind.resource,
				Kind:     kind.kind,
				Name:     row.GetKey().GetName(),
			},
		}

		values := map[string]any{}
		for i, col := range cols {
			v, err := resource.DecodeCell(col, i, row.GetCells()[i])
			if err != nil {
				return nil, fmt.Errorf("decoding column %q: %w", col.GetName(), err)
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
	return items, nil
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
