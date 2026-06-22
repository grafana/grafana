package search

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestBuildSearchRequestFacets(t *testing.T) {
	gr := alertrule.ResourceInfo.GroupResource()

	t.Run("no facet param leaves facets unset", func(t *testing.T) {
		req, _, err := buildSearchRequest(url.Values{"q": {"cpu"}}, "default", gr, nil)
		require.NoError(t, err)
		assert.Nil(t, req.Facet)
	})

	t.Run("facet=folder uses the default limit", func(t *testing.T) {
		req, _, err := buildSearchRequest(url.Values{"facet": {fieldFolder}}, "default", gr, nil)
		require.NoError(t, err)
		require.Contains(t, req.Facet, fieldFolder)
		assert.Equal(t, fieldFolder, req.Facet[fieldFolder].Field)
		assert.EqualValues(t, defaultFacetLimit, req.Facet[fieldFolder].Limit)
	})

	t.Run("facetLimit is honoured and capped", func(t *testing.T) {
		req, _, err := buildSearchRequest(url.Values{"facet": {fieldFolder}, "facetLimit": {"10"}}, "default", gr, nil)
		require.NoError(t, err)
		assert.EqualValues(t, 10, req.Facet[fieldFolder].Limit)

		capped, _, err := buildSearchRequest(url.Values{"facet": {fieldFolder}, "facetLimit": {"99999"}}, "default", gr, nil)
		require.NoError(t, err)
		assert.EqualValues(t, maxFacetLimit, capped.Facet[fieldFolder].Limit)
	})

	t.Run("unknown facet fields are ignored", func(t *testing.T) {
		req, _, err := buildSearchRequest(url.Values{"facet": {"labels", "title"}}, "default", gr, nil)
		require.NoError(t, err)
		assert.Nil(t, req.Facet)
	})
}

func TestFolderFacet(t *testing.T) {
	rules := []*ngmodels.AlertRule{
		{UID: "1", NamespaceUID: "folder-a"},
		{UID: "2", NamespaceUID: "folder-a"},
		{UID: "3", NamespaceUID: "folder-b"},
		{UID: "4", NamespaceUID: "folder-c"},
		{UID: "5", NamespaceUID: "folder-c"},
		{UID: "6", NamespaceUID: ""}, // a rule with no folder counts as missing
	}

	t.Run("counts per folder, ordered by count then term, with missing", func(t *testing.T) {
		f := folderFacet(rules, 0)
		assert.Equal(t, fieldFolder, f.Field)
		assert.EqualValues(t, 3, f.Total) // three distinct folders
		assert.EqualValues(t, 1, f.Missing)
		// folder-a (2) and folder-c (2) tie on count, broken alphabetically; folder-b (1) last.
		assert.Equal(t, []*resourcepb.ResourceSearchResponse_TermFacet{
			{Term: "folder-a", Count: 2},
			{Term: "folder-c", Count: 2},
			{Term: "folder-b", Count: 1},
		}, f.Terms)
	})

	t.Run("limit truncates the top terms", func(t *testing.T) {
		f := folderFacet(rules, 1)
		require.Len(t, f.Terms, 1)
		assert.Equal(t, "folder-a", f.Terms[0].Term)
		assert.EqualValues(t, 3, f.Total) // total is unaffected by the term limit
	})
}

func TestBuildFacets(t *testing.T) {
	rules := []*ngmodels.AlertRule{{NamespaceUID: "folder-a"}}

	t.Run("nil when no facets requested", func(t *testing.T) {
		assert.Nil(t, buildFacets(&resourcepb.ResourceSearchRequest{}, rules))
	})

	t.Run("only folder is supported", func(t *testing.T) {
		req := &resourcepb.ResourceSearchRequest{Facet: map[string]*resourcepb.ResourceSearchRequest_Facet{
			"group": {Field: "group", Limit: 50},
		}}
		assert.Nil(t, buildFacets(req, rules))
	})

	t.Run("computes the folder facet under its request key", func(t *testing.T) {
		req := &resourcepb.ResourceSearchRequest{Facet: map[string]*resourcepb.ResourceSearchRequest_Facet{
			fieldFolder: {Field: fieldFolder, Limit: 50},
		}}
		facets := buildFacets(req, rules)
		require.Contains(t, facets, fieldFolder)
		assert.EqualValues(t, 1, facets[fieldFolder].Total)
	})
}

// TestParseRuleFacetsRoundTrip verifies a backend facet response maps into the
// generated model facet type.
func TestParseRuleFacetsRoundTrip(t *testing.T) {
	resp := &resourcepb.ResourceSearchResponse{
		Facet: map[string]*resourcepb.ResourceSearchResponse_Facet{
			fieldFolder: {
				Field:   fieldFolder,
				Total:   2,
				Missing: 1,
				Terms: []*resourcepb.ResourceSearchResponse_TermFacet{
					{Term: "folder-a", Count: 2},
					{Term: "folder-b", Count: 1},
				},
			},
		},
	}

	got := parseRuleFacets(resp)
	require.Contains(t, got, fieldFolder)
	f := got[fieldFolder]
	assert.Equal(t, fieldFolder, f.Field)
	assert.EqualValues(t, 2, f.Total)
	assert.EqualValues(t, 1, f.Missing)
	require.Len(t, f.Terms, 2)
	assert.Equal(t, "folder-a", f.Terms[0].Term)
	assert.EqualValues(t, 2, f.Terms[0].Count)

	assert.Nil(t, parseRuleFacets(&resourcepb.ResourceSearchResponse{}))
}
