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

func titleResults(names ...string) *resourcepb.ResourceSearchResponse {
	response := &resourcepb.ResourceSearchResponse{
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Fields: []*resourcepb.ResourceSearchField{
			{Name: "title", Type: resourcepb.ResourceSearchField_STRING},
		},
		TotalHits: int64(len(names)), TotalHitsExact: true,
	}
	for _, name := range names {
		response.Rows = append(response.Rows, &resourcepb.ResourceSearchRow{
			Key:        &resourcepb.ResourceKey{Namespace: "default", Group: testKind.group, Resource: testKind.resource, Name: name},
			Values:     []*resourcepb.ResourceSearchValue{{StringValues: []string{name}}},
			SortFields: []string{name},
		})
	}
	return response
}

func TestSearchResults_MapsItemsAndFields(t *testing.T) {
	response := titleResults("dash-a", "dash-b")
	response.Fields = append(response.Fields, &resourcepb.ResourceSearchField{Name: "panel_types", Type: resourcepb.ResourceSearchField_STRING})
	response.Rows[0].Values = []*resourcepb.ResourceSearchValue{
		{StringValues: []string{"A dashboard"}},
		{FieldIndex: 1, StringValues: []string{"timeseries"}},
	}
	response.Rows[1].Values = []*resourcepb.ResourceSearchValue{{StringValues: []string{"B dashboard"}}}

	out, err := ToSearchResults(response, testKind.gvr(), testKind.kind, 10)
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

	assert.Equal(t, searchv0.APIVERSION, out.APIVersion)
	assert.Equal(t, searchv0.KindSearchResults, out.Kind)
}

func TestSearchResults_ScoreIsSeparateFromFields(t *testing.T) {
	response := titleResults("dash-a", "dash-b")
	response.Rows[0].Score = new(1.5)
	response.Rows[1].Score = new(0.0)

	out, err := searchResults(response, testKind, 10)
	require.NoError(t, err)

	require.NotNil(t, out.Items[0].Score)
	assert.InDelta(t, 1.5, *out.Items[0].Score, 1e-9)
	require.NotNil(t, out.Items[1].Score)
	assert.InDelta(t, 0, *out.Items[1].Score, 1e-9)

	// _score is an envelope field, never a searchable field.
	assert.NotContains(t, out.Items[0].Fields.Object, resource.SEARCH_FIELD_SCORE)
}

func TestSearchResults_MapsFieldValueResults(t *testing.T) {
	score := 0.0
	response := &resourcepb.ResourceSearchResponse{
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Fields: []*resourcepb.ResourceSearchField{
			{Name: "title", Type: resourcepb.ResourceSearchField_STRING},
			{Name: "tags", Type: resourcepb.ResourceSearchField_STRING, IsArray: true},
			{Name: "created", Type: resourcepb.ResourceSearchField_DATE},
			{Name: "ratio", Type: resourcepb.ResourceSearchField_DOUBLE},
			{Name: "published", Type: resourcepb.ResourceSearchField_BOOLEAN},
		},
		Rows: []*resourcepb.ResourceSearchRow{
			{
				Key:        &resourcepb.ResourceKey{Name: "dash-a"},
				SortFields: []string{"dash-a"},
				Score:      &score,
				Values: []*resourcepb.ResourceSearchValue{
					{FieldIndex: 0, StringValues: []string{"A dashboard"}},
					{FieldIndex: 1, StringValues: []string{"prod", "ops"}},
					{FieldIndex: 2, Int64Values: []int64{1234}},
					{FieldIndex: 3, DoubleValues: []float64{1.5}},
					{FieldIndex: 4, BooleanValues: []bool{true}},
				},
			},
			{
				Key:        &resourcepb.ResourceKey{Name: "dash-b"},
				SortFields: []string{"dash-b"},
				Values: []*resourcepb.ResourceSearchValue{
					{FieldIndex: 0, StringValues: []string{"B dashboard"}},
					{FieldIndex: 1},
				},
			},
		},
		TotalHits:      2,
		TotalHitsExact: true,
	}

	out, err := ToSearchResults(response, testKind.gvr(), testKind.kind, 2)
	require.NoError(t, err)
	require.Len(t, out.Items, 2)

	assert.Equal(t, "dash-a", out.Items[0].Resource.Name)
	require.NotNil(t, out.Items[0].Fields)
	assert.Equal(t, "A dashboard", out.Items[0].Fields.Object["title"])
	assert.Equal(t, []string{"prod", "ops"}, out.Items[0].Fields.Object["tags"])
	assert.Equal(t, int64(1234), out.Items[0].Fields.Object["created"])
	assert.Equal(t, 1.5, out.Items[0].Fields.Object["ratio"])
	assert.Equal(t, true, out.Items[0].Fields.Object["published"])
	require.NotNil(t, out.Items[0].Score, "a score of zero must remain present")
	assert.InDelta(t, 0, *out.Items[0].Score, 1e-9)

	require.NotNil(t, out.Items[1].Fields)
	assert.Equal(t, []string{}, out.Items[1].Fields.Object["tags"], "present empty arrays remain arrays")
	assert.NotContains(t, out.Items[1].Fields.Object, "ratio", "absent fields are omitted")
	assert.Nil(t, out.Items[1].Score)

	require.NotEmpty(t, out.Metadata.Continue)
	decoded, err := decodeContinue(out.Metadata.Continue)
	require.NoError(t, err)
	assert.Equal(t, []string{"dash-b"}, decoded)
}

func TestSearchResults_TotalHitsRelation(t *testing.T) {
	response := titleResults("a")
	exact, err := searchResults(response, testKind, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), exact.Metadata.TotalHits)
	assert.Equal(t, searchv0.TotalHitsEqual, exact.Metadata.TotalHitsRelation)

	response.TotalHits, response.TotalHitsExact = 700, false
	approx, err := searchResults(response, testKind, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(700), approx.Metadata.TotalHits)
	assert.Equal(t, searchv0.TotalHitsAtMost, approx.Metadata.TotalHitsRelation)

	response.TotalHits = 0
	zero, err := ToSearchResults(response, testKind.gvr(), testKind.kind, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(0), zero.Metadata.TotalHits)
	assert.Equal(t, searchv0.TotalHitsAtMost, zero.Metadata.TotalHitsRelation, "the shared converter must not apply a custom endpoint's unknown-count policy")
	assert.Equal(t, approx.Metadata.Continue, zero.Metadata.Continue)
}

func TestSearchResults_ContinueToken(t *testing.T) {
	// A full page offers a cursor built from the last row's sort fields.
	full := titleResults("a", "b")
	out, err := searchResults(full, testKind, 2)
	require.NoError(t, err)
	require.NotEmpty(t, out.Metadata.Continue)
	decoded, err := decodeContinue(out.Metadata.Continue)
	require.NoError(t, err)
	assert.Equal(t, []string{"b"}, decoded)

	// A short page with an exact total means everything has been seen.
	short := titleResults("a")
	out, err = searchResults(short, testKind, 2)
	require.NoError(t, err)
	assert.Empty(t, out.Metadata.Continue)

	// A short page with an inexact total means the backend stopped scanning
	// early, so more rows may exist and must stay reachable.
	short.TotalHitsExact = false
	out, err = searchResults(short, testKind, 2)
	require.NoError(t, err)
	require.NotEmpty(t, out.Metadata.Continue, "an early-stopped scan must remain pageable")

	// An empty page always ends the walk, so a client cannot loop forever.
	empty := titleResults()
	empty.TotalHitsExact = false
	out, err = searchResults(empty, testKind, 2)
	require.NoError(t, err)
	assert.Empty(t, out.Metadata.Continue)

	// Without sort fields no cursor can be built.
	noSort := titleResults("a", "b")
	for _, row := range noSort.Rows {
		row.SortFields = nil
	}
	out, err = searchResults(noSort, testKind, 2)
	require.NoError(t, err)
	assert.Empty(t, out.Metadata.Continue)
}

func TestSearchResults_Facets(t *testing.T) {
	response := titleResults("a")
	response.Facet = map[string]*resourcepb.ResourceSearchResponse_Facet{
		// The backend reports the requested public name in Field even when
		// it aggregated on the physical field.
		"fields.panel_types": {
			Field: "panel_types",
			Terms: []*resourcepb.ResourceSearchResponse_TermFacet{
				{Term: "timeseries", Count: 5},
				{Term: "table", Count: 2},
			},
		},
	}
	out, err := searchResults(response, testKind, 10)
	require.NoError(t, err)

	require.Contains(t, out.Facets, "panel_types")
	assert.Equal(t, []searchv0.FacetTerm{
		{Value: "timeseries", Count: 5},
		{Value: "table", Count: 2},
	}, out.Facets["panel_types"])
}

func TestSearchResults_RejectsUnsupportedResultFormat(t *testing.T) {
	for _, format := range []resourcepb.ResourceSearchRequest_ResultFormat{
		resourcepb.ResourceSearchRequest_UNSPECIFIED,
		resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
		99,
	} {
		t.Run(format.String(), func(t *testing.T) {
			response := titleResults("a")
			response.ResultFormat = format
			_, err := searchResults(response, testKind, 10)
			require.ErrorContains(t, err, "unsupported search result format")
		})
	}
}

func TestSearchResults_RejectsMalformedFieldValueResults(t *testing.T) {
	for _, tc := range []struct {
		name string
		row  *resourcepb.ResourceSearchRow
		want string
	}{
		{name: "nil row", want: "has no resource key"},
		{name: "missing key", row: &resourcepb.ResourceSearchRow{}, want: "has no resource key"},
		{name: "invalid field index", row: &resourcepb.ResourceSearchRow{
			Key: &resourcepb.ResourceKey{Name: "a"}, Values: []*resourcepb.ResourceSearchValue{{FieldIndex: 1, StringValues: []string{"A"}}},
		}, want: "field index 1 is out of range"},
		{name: "missing scalar", row: &resourcepb.ResourceSearchRow{
			Key: &resourcepb.ResourceKey{Name: "a"}, Values: []*resourcepb.ResourceSearchValue{{}},
		}, want: "scalar has 0 values"},
		{name: "nil value", row: &resourcepb.ResourceSearchRow{
			Key: &resourcepb.ResourceKey{Name: "a"}, Values: []*resourcepb.ResourceSearchValue{nil},
		}, want: "nil field value"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := searchResults(&resourcepb.ResourceSearchResponse{
				ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
				Fields:       []*resourcepb.ResourceSearchField{{Name: "title", Type: resourcepb.ResourceSearchField_STRING}},
				Rows:         []*resourcepb.ResourceSearchRow{tc.row},
			}, testKind, 10)
			require.ErrorContains(t, err, tc.want)
		})
	}
}

func TestSearchResults_EmptyResponses(t *testing.T) {
	for _, response := range []*resourcepb.ResourceSearchResponse{nil, titleResults()} {
		out, err := searchResults(response, testKind, 10)
		require.NoError(t, err)
		require.NotNil(t, out.Items)
		require.Empty(t, out.Items)
		require.Empty(t, out.Metadata.Continue)
	}
}
