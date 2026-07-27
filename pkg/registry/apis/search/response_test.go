package search

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var testKind = kindRef{
	group:    "dashboard.grafana.app",
	version:  "v1beta1",
	resource: "dashboards",
	kind:     "Dashboard",
}

func col(name string, t resourcepb.ResourceTableColumnDefinition_ColumnType) *resourcepb.ResourceTableColumnDefinition {
	return &resourcepb.ResourceTableColumnDefinition{Name: name, Type: t}
}

// buildTable mirrors what the backend returns: public column names, one cell
// per column, sort fields for cursor paging.
func buildTable(t *testing.T, cols []*resourcepb.ResourceTableColumnDefinition, rows []map[string]any, sortFields [][]string) *resourcepb.ResourceTable {
	t.Helper()
	b, err := resource.NewTableBuilder(cols)
	require.NoError(t, err)
	for i, row := range rows {
		// Copy so the caller's fixtures can be reused across tables.
		vals := map[string]any{}
		var name string
		for k, v := range row {
			if k == "__name" {
				name = v.(string)
				continue
			}
			vals[k] = v
		}
		key := &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     testKind.group,
			Resource:  testKind.resource,
			Name:      name,
		}
		require.NoError(t, b.AddRow(key, 1, vals))
		if sortFields != nil {
			b.Rows[i].SortFields = sortFields[i]
		}
	}
	return &b.ResourceTable
}

func TestSearchResults_MapsItemsAndFields(t *testing.T) {
	cols := []*resourcepb.ResourceTableColumnDefinition{
		col("title", resourcepb.ResourceTableColumnDefinition_STRING),
		col("panel_types", resourcepb.ResourceTableColumnDefinition_STRING),
	}
	table := buildTable(t, cols, []map[string]any{
		{"__name": "dash-a", "title": "A dashboard", "panel_types": "timeseries"},
		// panel_types absent for this row: it must be omitted, not zero-valued.
		{"__name": "dash-b", "title": "B dashboard"},
	}, nil)

	out, err := searchResults(&resourcepb.ResourceSearchResponse{
		Results:        table,
		TotalHits:      2,
		TotalHitsExact: true,
	}, testKind, 10)
	require.NoError(t, err)

	require.Len(t, out.Items, 2)
	assert.Equal(t, searchv0.ResourceRef{
		Group: "dashboard.grafana.app", Resource: "dashboards", Kind: "Dashboard", Name: "dash-a",
	}, out.Items[0].Resource)
	require.NotNil(t, out.Items[0].Fields)
	assert.Equal(t, "A dashboard", out.Items[0].Fields.Object["title"])
	assert.Equal(t, "timeseries", out.Items[0].Fields.Object["panel_types"])

	require.NotNil(t, out.Items[1].Fields)
	assert.NotContains(t, out.Items[1].Fields.Object, "panel_types", "absent fields are omitted")

	// No text query was run, so no score.
	assert.Nil(t, out.Items[0].Score)

	assert.Equal(t, searchv0.APIVERSION, out.TypeMeta.APIVersion)
	assert.Equal(t, searchv0.KindSearchResults, out.TypeMeta.Kind)
}

func TestSearchResults_ScoreIsSeparateFromFields(t *testing.T) {
	cols := []*resourcepb.ResourceTableColumnDefinition{
		col("title", resourcepb.ResourceTableColumnDefinition_STRING),
		col(resource.SEARCH_FIELD_SCORE, resourcepb.ResourceTableColumnDefinition_DOUBLE),
	}
	table := buildTable(t, cols, []map[string]any{
		{"__name": "dash-a", "title": "A", resource.SEARCH_FIELD_SCORE: float64(1.5)},
		// A real score of zero must still be reported, not treated as absent.
		{"__name": "dash-b", "title": "B", resource.SEARCH_FIELD_SCORE: float64(0)},
	}, nil)

	out, err := searchResults(&resourcepb.ResourceSearchResponse{Results: table}, testKind, 10)
	require.NoError(t, err)

	require.NotNil(t, out.Items[0].Score)
	assert.InDelta(t, 1.5, *out.Items[0].Score, 1e-9)
	require.NotNil(t, out.Items[1].Score)
	assert.InDelta(t, 0, *out.Items[1].Score, 1e-9)

	// _score is an envelope field, never a searchable field.
	assert.NotContains(t, out.Items[0].Fields.Object, resource.SEARCH_FIELD_SCORE)
}

func TestSearchResults_TotalHitsRelation(t *testing.T) {
	table := buildTable(t, []*resourcepb.ResourceTableColumnDefinition{
		col("title", resourcepb.ResourceTableColumnDefinition_STRING),
	}, []map[string]any{{"__name": "a", "title": "A"}}, nil)

	exact, err := searchResults(&resourcepb.ResourceSearchResponse{
		Results: table, TotalHits: 1, TotalHitsExact: true,
	}, testKind, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), exact.Metadata.TotalHits)
	assert.Equal(t, searchv0.TotalHitsEqual, exact.Metadata.TotalHitsRelation)

	approx, err := searchResults(&resourcepb.ResourceSearchResponse{
		Results: table, TotalHits: 700, TotalHitsExact: false,
	}, testKind, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(700), approx.Metadata.TotalHits)
	assert.Equal(t, searchv0.TotalHitsAtMost, approx.Metadata.TotalHitsRelation)
}

func TestSearchResults_ContinueToken(t *testing.T) {
	cols := []*resourcepb.ResourceTableColumnDefinition{
		col("title", resourcepb.ResourceTableColumnDefinition_STRING),
	}
	rows := []map[string]any{
		{"__name": "a", "title": "A"},
		{"__name": "b", "title": "B"},
	}

	// A full page offers a cursor built from the last row's sort fields.
	full := buildTable(t, cols, []map[string]any{rows[0], rows[1]}, [][]string{{"a"}, {"b"}})
	out, err := searchResults(&resourcepb.ResourceSearchResponse{Results: full}, testKind, 2)
	require.NoError(t, err)
	require.NotEmpty(t, out.Metadata.Continue)
	decoded, err := decodeContinue(out.Metadata.Continue)
	require.NoError(t, err)
	assert.Equal(t, []string{"b"}, decoded)

	// A short page with an exact total means everything has been seen.
	short := buildTable(t, cols, []map[string]any{{"__name": "a", "title": "A"}}, [][]string{{"a"}})
	out, err = searchResults(&resourcepb.ResourceSearchResponse{
		Results: short, TotalHitsExact: true,
	}, testKind, 2)
	require.NoError(t, err)
	assert.Empty(t, out.Metadata.Continue)

	// A short page with an inexact total means the backend stopped scanning
	// early, so more rows may exist and must stay reachable.
	out, err = searchResults(&resourcepb.ResourceSearchResponse{
		Results: short, TotalHitsExact: false,
	}, testKind, 2)
	require.NoError(t, err)
	require.NotEmpty(t, out.Metadata.Continue, "an early-stopped scan must remain pageable")

	// An empty page always ends the walk, so a client cannot loop forever.
	empty := buildTable(t, cols, nil, nil)
	out, err = searchResults(&resourcepb.ResourceSearchResponse{
		Results: empty, TotalHitsExact: false,
	}, testKind, 2)
	require.NoError(t, err)
	assert.Empty(t, out.Metadata.Continue)

	// Without sort fields no cursor can be built.
	noSort := buildTable(t, cols, []map[string]any{rows[0], rows[1]}, nil)
	out, err = searchResults(&resourcepb.ResourceSearchResponse{Results: noSort}, testKind, 2)
	require.NoError(t, err)
	assert.Empty(t, out.Metadata.Continue)
}

func TestSearchResults_Facets(t *testing.T) {
	table := buildTable(t, []*resourcepb.ResourceTableColumnDefinition{
		col("title", resourcepb.ResourceTableColumnDefinition_STRING),
	}, []map[string]any{{"__name": "a", "title": "A"}}, nil)

	out, err := searchResults(&resourcepb.ResourceSearchResponse{
		Results: table,
		Facet: map[string]*resourcepb.ResourceSearchResponse_Facet{
			// The backend reports the requested public name in Field even when
			// it aggregated on the physical field.
			"fields.panel_types": {
				Field: "panel_types",
				Terms: []*resourcepb.ResourceSearchResponse_TermFacet{
					{Term: "timeseries", Count: 5},
					{Term: "table", Count: 2},
				},
			},
		},
	}, testKind, 10)
	require.NoError(t, err)

	require.Contains(t, out.Facets, "panel_types")
	assert.Equal(t, []searchv0.FacetTerm{
		{Value: "timeseries", Count: 5},
		{Value: "table", Count: 2},
	}, out.Facets["panel_types"])
}

func TestSearchResults_RejectsMalformedTable(t *testing.T) {
	// Cells and columns must line up; a mismatch means the backend and the
	// mapper disagree, which would silently misattribute values.
	table := &resourcepb.ResourceTable{
		Columns: []*resourcepb.ResourceTableColumnDefinition{
			col("title", resourcepb.ResourceTableColumnDefinition_STRING),
			col("folder", resourcepb.ResourceTableColumnDefinition_STRING),
		},
		Rows: []*resourcepb.ResourceTableRow{
			{Key: &resourcepb.ResourceKey{Name: "a"}, Cells: [][]byte{[]byte("A")}},
		},
	}
	_, err := searchResults(&resourcepb.ResourceSearchResponse{Results: table}, testKind, 10)
	require.Error(t, err)
}
