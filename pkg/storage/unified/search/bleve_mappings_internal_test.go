package search

import (
	"maps"
	"slices"
	"testing"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/keyword"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/standard"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// flatMappings returns the field mappings emitted by the helper for the given
// SearchFieldDefinition, keyed by the resulting field name.
func flatMappings(t *testing.T, def resource.SearchFieldDefinition) map[string]*mapping.FieldMapping {
	t.Helper()
	// Production uses a static parent for both the top-level and fields.*
	// mappings, so mirror that here.
	parent := bleve.NewDocumentStaticMapping()
	addCapabilityFieldMappings(parent, def)

	out := map[string]*mapping.FieldMapping{}
	for name, sub := range parent.Properties {
		require.Lenf(t, sub.Fields, 1, "field %q should have exactly one mapping", name)
		out[name] = sub.Fields[0]
	}
	return out
}

func TestAddCapabilityFieldMappings_FilterRetrieve_LegacyShape(t *testing.T) {
	// The only capability combination exercised by today's
	// SearchFieldsFromTableColumns translation: a Filterable STRING becomes
	// [filter, retrieve]. The on-disk shape must match the pre-refactor
	// keyword mapping byte-for-byte so existing indexes remain valid.
	got := flatMappings(t, resource.SearchFieldDefinition{
		Name: "panel_types",
		Type: resource.SearchFieldTypeString,
		Capabilities: []resource.SearchCapability{
			resource.SearchCapabilityFilter,
			resource.SearchCapabilityRetrieve,
		},
	})

	require.Equal(t, []string{"panel_types"}, slices.Sorted(maps.Keys(got)))
	m := got["panel_types"]
	assert.Equal(t, keyword.Name, m.Analyzer)
	assert.True(t, m.Store)
	assert.False(t, m.DocValues)
	assert.False(t, m.IncludeTermVectors)
	assert.True(t, m.SkipFreqNorm)
}

func TestAddCapabilityFieldMappings_TextRetrieve(t *testing.T) {
	got := flatMappings(t, resource.SearchFieldDefinition{
		Name: "summary",
		Type: resource.SearchFieldTypeString,
		Capabilities: []resource.SearchCapability{
			resource.SearchCapabilityText,
			resource.SearchCapabilityRetrieve,
		},
	})

	require.Equal(t, []string{"summary"}, slices.Sorted(maps.Keys(got)))
	m := got["summary"]
	assert.Equal(t, standard.Name, m.Analyzer)
	assert.True(t, m.Store)
	assert.False(t, m.DocValues)
	assert.False(t, m.IncludeTermVectors)
}

func TestAddCapabilityFieldMappings_TextRetrieveUnranked(t *testing.T) {
	// unranked on a text field drops BM25 frequency / length stats from the
	// index. Used by standard "description" today.
	got := flatMappings(t, resource.SearchFieldDefinition{
		Name: "summary",
		Type: resource.SearchFieldTypeString,
		Capabilities: []resource.SearchCapability{
			resource.SearchCapabilityText,
			resource.SearchCapabilityRetrieve,
			resource.SearchCapabilityUnranked,
		},
	})

	require.Equal(t, []string{"summary"}, slices.Sorted(maps.Keys(got)))
	m := got["summary"]
	assert.Equal(t, standard.Name, m.Analyzer)
	assert.True(t, m.Store)
	assert.True(t, m.SkipFreqNorm, "unranked must set SkipFreqNorm on the text mapping")
}

func TestAddCapabilityFieldMappings_FilterAndText(t *testing.T) {
	// Filter together with text: text takes the base name, keyword variant
	// moves to "<name>_keyword".
	got := flatMappings(t, resource.SearchFieldDefinition{
		Name: "summary",
		Type: resource.SearchFieldTypeString,
		Capabilities: []resource.SearchCapability{
			resource.SearchCapabilityFilter,
			resource.SearchCapabilityText,
			resource.SearchCapabilityRetrieve,
		},
	})

	require.Equal(t, []string{"summary", "summary_keyword"}, slices.Sorted(maps.Keys(got)))

	text := got["summary"]
	assert.Equal(t, standard.Name, text.Analyzer)
	assert.True(t, text.Store, "text variant takes the retrieve store")

	kw := got["summary_keyword"]
	assert.Equal(t, keyword.Name, kw.Analyzer)
	assert.False(t, kw.Store, "keyword variant must not also store when text takes that role")
	assert.False(t, kw.DocValues)
}

func TestAddCapabilityFieldMappings_FullSet(t *testing.T) {
	// A field that declares the full capability set produces the same shape
	// as today's hardcoded standard "title" field: three mappings.
	got := flatMappings(t, resource.SearchFieldDefinition{
		Name: resource.SEARCH_FIELD_TITLE,
		Type: resource.SearchFieldTypeString,
		Capabilities: []resource.SearchCapability{
			resource.SearchCapabilityFilter,
			resource.SearchCapabilityText,
			resource.SearchCapabilityPartial,
			resource.SearchCapabilitySort,
			resource.SearchCapabilityRetrieve,
		},
	})

	require.Equal(t, []string{
		resource.SEARCH_FIELD_TITLE,
		resource.SEARCH_FIELD_TITLE_NGRAM,
		resource.SEARCH_FIELD_TITLE_PHRASE,
	}, slices.Sorted(maps.Keys(got)))

	// text variant: standard analyzer, stored.
	text := got[resource.SEARCH_FIELD_TITLE]
	assert.Equal(t, standard.Name, text.Analyzer)
	assert.True(t, text.Store)
	assert.False(t, text.DocValues)
	assert.False(t, text.IncludeTermVectors)

	// keyword variant uses the "title_phrase" legacy name. sort adds DocValues.
	phrase := got[resource.SEARCH_FIELD_TITLE_PHRASE]
	assert.Equal(t, keyword.Name, phrase.Analyzer)
	assert.False(t, phrase.Store, "text variant already stores; phrase must not duplicate")
	assert.True(t, phrase.DocValues, "sort capability enables DocValues on the keyword variant")
	assert.True(t, phrase.SkipFreqNorm)

	// ngram variant: never canonical for retrieval.
	ngram := got[resource.SEARCH_FIELD_TITLE_NGRAM]
	assert.Equal(t, TITLE_ANALYZER, ngram.Analyzer)
	assert.False(t, ngram.Store)
	assert.False(t, ngram.DocValues)
}

func TestAddCapabilityFieldMappings_NonTitleFullSet(t *testing.T) {
	// Same capability combo as title but a different field name: keyword
	// variant uses the uniform "_keyword" suffix, not "_phrase".
	got := flatMappings(t, resource.SearchFieldDefinition{
		Name: "subject",
		Type: resource.SearchFieldTypeString,
		Capabilities: []resource.SearchCapability{
			resource.SearchCapabilityFilter,
			resource.SearchCapabilityText,
			resource.SearchCapabilityPartial,
			resource.SearchCapabilitySort,
			resource.SearchCapabilityRetrieve,
		},
	})
	require.Equal(t, []string{"subject", "subject_keyword", "subject_ngram"}, slices.Sorted(maps.Keys(got)))
}

func TestAddCapabilityFieldMappings_SortWithoutFilter(t *testing.T) {
	// sort on its own still needs a keyword variant to back DocValues. Sort
	// is validated as string-only at provider construction time (the bleve
	// mapper emits keyword regardless of declared Type, so non-strings
	// would sort lexically), so this test uses a string-typed field.
	got := flatMappings(t, resource.SearchFieldDefinition{
		Name: "lastSeenAt",
		Type: resource.SearchFieldTypeString,
		Capabilities: []resource.SearchCapability{
			resource.SearchCapabilitySort,
			resource.SearchCapabilityRetrieve,
		},
	})
	require.Equal(t, []string{"lastSeenAt"}, slices.Sorted(maps.Keys(got)))
	m := got["lastSeenAt"]
	assert.Equal(t, keyword.Name, m.Analyzer)
	assert.True(t, m.DocValues)
	assert.True(t, m.Store)
}

func TestAddCapabilityFieldMappings_FacetOnly(t *testing.T) {
	// facet shares the keyword variant. Without retrieve, the field is
	// indexed but not stored — same as the existing "managedBy" mapping.
	got := flatMappings(t, resource.SearchFieldDefinition{
		Name:         "managedBy",
		Type:         resource.SearchFieldTypeString,
		Capabilities: []resource.SearchCapability{resource.SearchCapabilityFacet},
	})
	require.Equal(t, []string{"managedBy"}, slices.Sorted(maps.Keys(got)))
	m := got["managedBy"]
	assert.Equal(t, keyword.Name, m.Analyzer)
	assert.False(t, m.Store)
}

func TestFacetFieldsForMapping(t *testing.T) {
	gvr := schema.GroupVersionResource{Group: "example.test", Version: "v1", Resource: "widgets"}
	provider := resource.NewMapProvider(map[schema.GroupVersionResource][]resource.SearchFieldDefinition{
		gvr: {
			{
				Name: "summary",
				Type: resource.SearchFieldTypeString,
				Capabilities: []resource.SearchCapability{
					resource.SearchCapabilityText,
					resource.SearchCapabilityFacet,
				},
			},
			{
				Name:         "category",
				Type:         resource.SearchFieldTypeString,
				Capabilities: []resource.SearchCapability{resource.SearchCapabilityFacet},
			},
		},
	}, nil)

	fields := facetFieldsForMapping(provider, gvr.Group, gvr.Resource)
	assert.Equal(t, resource.SEARCH_FIELD_TAGS, fields[resource.SEARCH_FIELD_TAGS])
	assert.Equal(t, resource.SEARCH_FIELD_MANAGED_BY, fields[resource.SEARCH_FIELD_MANAGED_BY])
	assert.Equal(t, "fields.summary_keyword", fields["summary"])
	assert.Equal(t, "fields.summary_keyword", fields["fields.summary"])
	assert.Equal(t, "fields.category", fields["category"])
	assert.NotContains(t, fields, resource.SEARCH_FIELD_FOLDER)
	assert.NotContains(t, fields, "labels.region")
}

func TestAddCapabilityFieldMappings_RetrieveOnly_StoreOnly(t *testing.T) {
	// With no dynamic fallback, a retrieve-only field must be stored explicitly.
	t.Run("int64", func(t *testing.T) {
		m := flatMappings(t, resource.SearchFieldDefinition{
			Name:         "linkCount",
			Type:         resource.SearchFieldTypeInt64,
			Capabilities: []resource.SearchCapability{resource.SearchCapabilityRetrieve},
		})["linkCount"]
		require.NotNil(t, m)
		assert.False(t, m.Index, "retrieve-only field is not indexed")
		assert.True(t, m.Store, "retrieve-only field is stored")
	})
	t.Run("string", func(t *testing.T) {
		m := flatMappings(t, resource.SearchFieldDefinition{
			Name:         "permission",
			Type:         resource.SearchFieldTypeString,
			Capabilities: []resource.SearchCapability{resource.SearchCapabilityRetrieve},
		})["permission"]
		require.NotNil(t, m)
		assert.False(t, m.Index, "retrieve-only string is not indexed")
		assert.True(t, m.Store, "retrieve-only string is stored")
	})
}

func TestBleveIndex_isDeclaredField(t *testing.T) {
	fields, err := resource.NewSearchableDocumentFields(resource.SearchFieldDefinitionsToTableColumns(
		[]resource.SearchFieldDefinition{
			{Name: "email", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityRetrieve}},
		},
	))
	require.NoError(t, err)
	b := &bleveIndex{fields: fields, standard: resource.StandardSearchFields()}

	assert.True(t, b.isDeclaredField("email"), "declared per-kind field")
	assert.True(t, b.isDeclaredField(resource.SEARCH_FIELD_PREFIX+"email"), "declared per-kind field with fields. prefix")
	assert.True(t, b.isDeclaredField(resource.SEARCH_FIELD_TITLE), "standard field")
	assert.False(t, b.isDeclaredField("undeclaredCustomField"), "undeclared field is not reported as declared")
}
