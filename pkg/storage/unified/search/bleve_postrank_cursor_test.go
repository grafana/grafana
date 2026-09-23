package search_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

func cursorResultNames(res *resourcepb.ResourceSearchResponse) []string {
	if res.ResultFormat != resourcepb.ResourceSearchRequest_FIELD_VALUES {
		return namesOf(res)
	}
	names := make([]string, 0, len(res.Rows))
	for _, row := range res.Rows {
		names = append(names, row.Key.Name)
	}
	return names
}

func TestPostRankContinuationCappedPage(t *testing.T) {
	for _, format := range []resourcepb.ResourceSearchRequest_ResultFormat{
		resourcepb.ResourceSearchRequest_RESOURCE_TABLE, resourcepb.ResourceSearchRequest_FIELD_VALUES,
	} {
		for _, facets := range []bool{false, true} {
			name := format.String()
			if facets {
				name += "/facets"
			}
			t.Run(name, func(t *testing.T) {
				index := newTestDashboardsIndexPostRankWithConfig(t, 2, search.PostRankAuthzConfig{
					OverFetchFactor: 1, MaxWindow: 2, MaxCandidates: 3,
				})
				indexDocs(t, index, []*resource.BulkIndexItem{
					newDoc("a", "allowed"), newDoc("b", "denied"),
					newDoc("c", "denied"), newDoc("d", "allowed"),
				})
				ac := &countingAccessClient{allowedFolders: map[string]bool{"allowed": true}}
				q := listQuery(2)
				q.ResultFormat = format
				if facets {
					q.Facet = map[string]*resourcepb.ResourceSearchRequest_Facet{"tags": {Field: "tags", Limit: 10}}
				}
				res := searchResponse(t, index, ac, q)
				require.Nil(t, res.Error)
				require.Equal(t, []string{"a"}, cursorResultNames(res))
				require.NotEmpty(t, res.NextSearchAfter)
				require.Equal(t, []string{"a", "a", "default/dashboard.grafana.app/dashboards/a"}, res.NextSearchAfter,
					"continuation must not disclose denied candidates' sort values")
				q.SearchAfter = res.NextSearchAfter
				res = searchResponse(t, index, ac, q)
				require.Nil(t, res.Error)
				require.Equal(t, []string{"d"}, cursorResultNames(res))
				require.NotEmpty(t, res.NextSearchAfter)
				q.SearchAfter = res.NextSearchAfter
				res = searchResponse(t, index, ac, q)
				require.Nil(t, res.Error)
				require.Empty(t, cursorResultNames(res))
				require.Empty(t, res.NextSearchAfter, "the page scan is exhausted")
			})
		}
	}
}

func TestPostRankContinuationFullPage(t *testing.T) {
	for _, format := range []resourcepb.ResourceSearchRequest_ResultFormat{
		resourcepb.ResourceSearchRequest_RESOURCE_TABLE, resourcepb.ResourceSearchRequest_FIELD_VALUES,
	} {
		for _, trash := range []bool{false, true} {
			name := format.String()
			if trash {
				name += "/trash"
			}
			t.Run(name, func(t *testing.T) {
				index := newTestDashboardsIndexPostRank(t, 2)
				docs := []*resource.BulkIndexItem{newDoc("a", "allowed"), newDoc("b", "allowed"), newDoc("c", "allowed")}
				if trash {
					for _, doc := range docs {
						doc.Doc.IsDeleted = new(true)
					}
				}
				indexDocs(t, index, docs)
				ac := &countingAccessClient{allowAll: true}
				q := listQuery(1)
				q.ResultFormat = format
				q.IsDeleted = trash
				for _, expected := range []string{"a", "b", "c"} {
					res := searchResponse(t, index, ac, q)
					require.Nil(t, res.Error)
					require.Equal(t, []string{expected}, cursorResultNames(res))
					require.NotEmpty(t, res.NextSearchAfter)
					if trash && expected == "a" {
						require.Equal(t, int64(3), res.TotalHits, "counting examines authorized hits beyond the page")
						require.True(t, res.TotalHitsExact)
					}
					q.SearchAfter = res.NextSearchAfter
				}
				res := searchResponse(t, index, ac, q)
				require.Nil(t, res.Error)
				require.Empty(t, cursorResultNames(res))
				require.Empty(t, res.NextSearchAfter)
			})
		}
	}
}

func TestPostRankContinuationDoesNotExposeReverseOrCountCursor(t *testing.T) {
	index := newTestDashboardsIndexPostRankWithConfig(t, 2, search.PostRankAuthzConfig{
		MaxWindow: 2, MaxCandidates: 2,
	})
	indexDocs(t, index, []*resource.BulkIndexItem{
		newDoc("a", "allowed"), newDoc("b", "allowed"), newDoc("c", "allowed"),
	})
	ac := &countingAccessClient{allowAll: true}
	_, res := searchNames(t, index, ac, listQuery(0))
	require.False(t, res.TotalHitsExact, "the count scan hit its budget")
	require.Empty(t, res.NextSearchAfter)

	q := listQuery(1)
	q.SearchBefore = []string{"c", "c", "default/dashboard.grafana.app/dashboards/c"}
	names, res := searchNames(t, index, ac, q)
	require.Equal(t, []string{"b"}, names)
	require.Empty(t, res.NextSearchAfter, "a backward scan must not publish its position as a forward cursor")
	require.NotEmpty(t, res.Results.Rows[0].SortFields, "row-based navigation remains available")
}
