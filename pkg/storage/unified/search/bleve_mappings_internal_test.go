package search

import (
	"maps"
	"slices"
	"testing"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/keyword"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/standard"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/blevesearch/bleve/v2/search/query"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
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

func TestTextQueryKindsForMapping(t *testing.T) {
	gvr := schema.GroupVersionResource{Group: "example.grafana.app", Version: "v1", Resource: "widgets"}
	provider := resource.NewMapProvider(map[schema.GroupVersionResource][]resource.SearchFieldDefinition{
		gvr: {
			{
				Name: "panel_title",
				Type: resource.SearchFieldTypeString,
				Capabilities: []resource.SearchCapability{
					resource.SearchCapabilityText,
					resource.SearchCapabilityPartial,
				},
			},
			{
				Name:         "team",
				Type:         resource.SearchFieldTypeString,
				Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter},
			},
			{
				Name:         "summary",
				Type:         resource.SearchFieldTypeString,
				Capabilities: []resource.SearchCapability{resource.SearchCapabilityText, resource.SearchCapabilityFilter},
			},
			{
				Name:         "linkCount",
				Type:         resource.SearchFieldTypeInt64,
				Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter},
			},
		},
	}, nil)

	kinds := textQueryKindsForMapping(provider, gvr.Group, gvr.Resource, []string{"spec.slug"})

	// The title trio: each variant gets the query its analyzer needs.
	assert.Equal(t, textQueryStandard, kinds[resource.SEARCH_FIELD_TITLE])
	assert.Equal(t, textQueryNgram, kinds[resource.SEARCH_FIELD_TITLE_NGRAM])
	// title_phrase holds a lowercased copy of the title.
	assert.Equal(t, textQueryTermLowered, kinds[resource.SEARCH_FIELD_TITLE_PHRASE])

	// Other standard fields.
	assert.Equal(t, textQueryStandard, kinds[resource.SEARCH_FIELD_DESCRIPTION])
	assert.Equal(t, textQueryTerm, kinds[resource.SEARCH_FIELD_FOLDER])
	assert.Equal(t, textQueryTerm, kinds[resource.SEARCH_FIELD_TAGS])

	// Per-kind fields live under fields.*
	assert.Equal(t, textQueryStandard, kinds["fields.panel_title"])
	assert.Equal(t, textQueryNgram, kinds["fields.panel_title_ngram"])
	// team is keyword-mapped in place, so it keeps the value's case, while
	// summary_keyword is a lowercased copy of the text field.
	assert.Equal(t, textQueryTerm, kinds["fields.team"])
	assert.Equal(t, textQueryStandard, kinds["fields.summary"])
	assert.Equal(t, textQueryTermLowered, kinds["fields.summary_keyword"])

	// Non-string fields are never analyzed, so they are absent.
	assert.NotContains(t, kinds, "fields.linkCount")

	// Selectable fields are keyword-mapped.
	assert.Equal(t, textQueryTerm, kinds[resource.SEARCH_SELECTABLE_FIELDS_PREFIX+"spec.slug"])

	// Keyword-mapped sub-document fields, and labels which are not.
	assert.Equal(t, textQueryTerm, kinds[resource.SEARCH_FIELD_MANAGER_KIND])
	assert.Equal(t, textQueryTerm, kinds[resource.SEARCH_FIELD_SOURCE_PATH])
	assert.NotContains(t, kinds, resource.SEARCH_FIELD_LABELS+".region")

	// An index without per-kind fields still knows the standard ones.
	assert.Equal(t, textQueryTermLowered, textQueryKindsForMapping(nil, "", "", nil)[resource.SEARCH_FIELD_TITLE_PHRASE])
}

func TestBleveIndex_textQueryKindFor(t *testing.T) {
	b := &bleveIndex{textQueryKinds: map[string]textQueryKind{resource.SEARCH_FIELD_TITLE_PHRASE: textQueryTerm}}
	assert.Equal(t, textQueryTerm, b.textQueryKindFor(resource.SEARCH_FIELD_TITLE_PHRASE))
	// reference keys are dynamic, so the keyword sub-document is matched by prefix.
	assert.Equal(t, textQueryTerm, b.textQueryKindFor("reference.datasource"))
	// Undeclared fields fall back to the analyzed query.
	assert.Equal(t, textQueryStandard, b.textQueryKindFor(resource.SEARCH_FIELD_LABELS+".region"))
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

func TestResolveFieldName(t *testing.T) {
	fields, err := resource.NewSearchableDocumentFields(resource.SearchFieldDefinitionsToTableColumns(
		[]resource.SearchFieldDefinition{
			{Name: "panel_type", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter}},
		},
	))
	require.NoError(t, err)

	// Declared per-kind field gets the fields. prefix so it targets the sub-document.
	assert.Equal(t, resource.SEARCH_FIELD_PREFIX+"panel_type", resolveFieldName(fields, "panel_type"))
	// Standard top-level fields are left as-is.
	assert.Equal(t, resource.SEARCH_FIELD_TITLE, resolveFieldName(fields, resource.SEARCH_FIELD_TITLE))
	assert.Equal(t, resource.SEARCH_FIELD_FOLDER, resolveFieldName(fields, resource.SEARCH_FIELD_FOLDER))
	// Already-prefixed keys are passed through untouched.
	assert.Equal(t, resource.SEARCH_FIELD_PREFIX+"panel_type", resolveFieldName(fields, resource.SEARCH_FIELD_PREFIX+"panel_type"))
	assert.Equal(t, resource.SEARCH_SELECTABLE_FIELDS_PREFIX+"anything", resolveFieldName(fields, resource.SEARCH_SELECTABLE_FIELDS_PREFIX+"anything"))
	// Undeclared, unprefixed names are left alone (caller/validation handles them).
	assert.Equal(t, "undeclared", resolveFieldName(fields, "undeclared"))

	// A nil per-kind field set never prefixes.
	assert.Equal(t, "panel_type", resolveFieldName(nil, "panel_type"))

	// A per-kind set that also declares a standard name must not shadow it into
	// fields.* (standard fields stay top-level).
	shadow, err := resource.NewSearchableDocumentFields(resource.SearchFieldDefinitionsToTableColumns(
		[]resource.SearchFieldDefinition{
			{Name: resource.SEARCH_FIELD_TITLE, Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter}},
		},
	))
	require.NoError(t, err)
	assert.Equal(t, resource.SEARCH_FIELD_TITLE, resolveFieldName(shadow, resource.SEARCH_FIELD_TITLE))

	// Internal title variants are reserved: a per-kind field declaring one can't
	// shadow the physical field (callers pass these directly, e.g. legacy QueryFields).
	reserved, err := resource.NewSearchableDocumentFields(resource.SearchFieldDefinitionsToTableColumns(
		[]resource.SearchFieldDefinition{
			{Name: resource.SEARCH_FIELD_TITLE_PHRASE, Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter}},
		},
	))
	require.NoError(t, err)
	assert.Equal(t, resource.SEARCH_FIELD_TITLE_PHRASE, resolveFieldName(reserved, resource.SEARCH_FIELD_TITLE_PHRASE))
	assert.Equal(t, resource.SEARCH_FIELD_TITLE_NGRAM, resolveFieldName(reserved, resource.SEARCH_FIELD_TITLE_NGRAM))
}

func TestBleveIndex_exactFieldValueQuery(t *testing.T) {
	fields, err := resource.NewSearchableDocumentFields(resource.SearchFieldDefinitionsToTableColumns(
		[]resource.SearchFieldDefinition{
			{Name: "note", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityText, resource.SearchCapabilityFilter}},
			{Name: "tag", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter}},
		},
	))
	require.NoError(t, err)
	b := &bleveIndex{fields: fields, standard: resource.StandardSearchFields()}

	termOf := func(q query.Query) *query.TermQuery {
		tq, ok := q.(*query.TermQuery)
		require.True(t, ok)
		return tq
	}

	// title routes to its populated keyword variant and is pre-lowered.
	title := termOf(b.exactFieldValueQuery(resource.SEARCH_FIELD_TITLE, "Foo Bar"))
	assert.Equal(t, resource.SEARCH_FIELD_TITLE_PHRASE, title.Field())
	assert.Equal(t, "foo bar", title.Term)

	// Custom fields match on their indexed name (their <name>_keyword variant is
	// not populated at index time), value unchanged. This holds for text+filter
	// and filter-only fields alike.
	assert.Equal(t, resource.SEARCH_FIELD_PREFIX+"note", termOf(b.exactFieldValueQuery(resource.SEARCH_FIELD_PREFIX+"note", "Exact")).Field())
	assert.Equal(t, resource.SEARCH_FIELD_PREFIX+"tag", termOf(b.exactFieldValueQuery(resource.SEARCH_FIELD_PREFIX+"tag", "x")).Field())
	// A standard non-text field is unchanged.
	assert.Equal(t, resource.SEARCH_FIELD_FOLDER, termOf(b.exactFieldValueQuery(resource.SEARCH_FIELD_FOLDER, "x")).Field())
}

func TestRequirementQuery_TextFilterDispatch(t *testing.T) {
	fields, err := resource.NewSearchableDocumentFields(resource.SearchFieldDefinitionsToTableColumns(
		[]resource.SearchFieldDefinition{
			{Name: "note", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityText, resource.SearchCapabilityFilter}},
		},
	))
	require.NoError(t, err)
	b := &bleveIndex{fields: fields, standard: resource.StandardSearchFields()}

	// title has a populated keyword variant, so "in" dispatches an exact TermQuery
	// against title_phrase.
	q, errRes := b.requirementQuery(&resourcepb.Requirement{Key: resource.SEARCH_FIELD_TITLE, Operator: "in", Values: []string{"Foo Bar"}})
	require.Nil(t, errRes)
	tq, ok := q.(*query.TermQuery)
	require.True(t, ok, "in on title should build an exact TermQuery")
	assert.Equal(t, resource.SEARCH_FIELD_TITLE_PHRASE, tq.Field())
	assert.Equal(t, "foo bar", tq.Term)

	// A custom text+filter field has no populated keyword variant, so "in" stays
	// on the analyzed indexed field (exact set-membership for such fields is a
	// tracked follow-up that needs index-time keyword population).
	note := resource.SEARCH_FIELD_PREFIX + "note" // resolved physical name, as filterQueries passes it
	q, errRes = b.requirementQuery(&resourcepb.Requirement{Key: note, Operator: "in", Values: []string{"Foo Bar"}})
	require.Nil(t, errRes)
	mq, ok := q.(*query.MatchQuery)
	require.True(t, ok, "in on a custom text field should build an analyzed MatchQuery")
	assert.Equal(t, note, mq.Field())
}

func TestFilterQueries_LabelExactTermAllowlist(t *testing.T) {
	b := &bleveIndex{standard: resource.StandardSearchFields()}
	// A label whose key is in the exact-term allowlist keeps its TermQuery
	// semantics even though it is hoisted to labels.<key> for the physical query
	// (labels are standard-analyzed, so the analyzed path would tokenize the value).
	req := &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{
		Labels: []*resourcepb.Requirement{{Key: "login", Operator: "in", Values: []string{"foo-bar"}}},
	}}
	queries, e := b.filterQueries(req)
	require.Nil(t, e)
	require.Len(t, queries, 1)
	tq, ok := queries[0].(*query.TermQuery)
	require.True(t, ok, "login label filter should use an exact TermQuery")
	assert.Equal(t, resource.SEARCH_FIELD_LABELS+".login", tq.Field())
	assert.Equal(t, "foo-bar", tq.Term)
}

func TestFilterQueries_LabelNotInUsesAnalyzedPath(t *testing.T) {
	b := &bleveIndex{standard: resource.StandardSearchFields()}
	// notin keeps the legacy analyzed path even for an allowlist label key: only
	// "="/"in" consult the exact-term allowlist, and title is the sole notin exact
	// case. A raw TermQuery here would fail to exclude standard-analyzed labels.
	req := &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{
		Labels: []*resourcepb.Requirement{{Key: "login", Operator: "notin", Values: []string{"foo-bar"}}},
	}}
	queries, e := b.filterQueries(req)
	require.Nil(t, e)
	require.Len(t, queries, 1)
	bq, ok := queries[0].(*query.BooleanQuery)
	require.True(t, ok)
	mustNot, ok := bq.MustNot.(*query.DisjunctionQuery)
	require.True(t, ok)
	require.Len(t, mustNot.Disjuncts, 1)
	_, ok = mustNot.Disjuncts[0].(*query.MatchQuery)
	require.True(t, ok, "notin on a label should use an analyzed MatchQuery, not a raw TermQuery")
}

func TestFilterQueries_DoesNotMutateRequest(t *testing.T) {
	b := &bleveIndex{standard: resource.StandardSearchFields()}
	req := &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{
		Labels: []*resourcepb.Requirement{{Key: "team", Operator: "in", Values: []string{"x"}}},
		Fields: []*resourcepb.Requirement{{Key: resource.SEARCH_FIELD_FOLDER, Operator: "in", Values: []string{"f1"}}},
	}}

	// Search can re-run the builder on the post-rank authz cursor fallback, so
	// two passes must leave the shared requirements untouched (no double-prefix).
	for range 2 {
		_, e := b.filterQueries(req)
		require.Nil(t, e)
	}
	assert.Equal(t, "team", req.Options.Labels[0].Key)
	assert.Equal(t, resource.SEARCH_FIELD_FOLDER, req.Options.Fields[0].Key)
}

func TestGetSortFields_ResolvesPhysicalNames(t *testing.T) {
	fields, err := resource.NewSearchableDocumentFields(resource.SearchFieldDefinitionsToTableColumns(
		[]resource.SearchFieldDefinition{
			{Name: "note", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityText, resource.SearchCapabilitySort}},
			{Name: "num", Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilitySort}},
		},
	))
	require.NoError(t, err)

	req := &resourcepb.ResourceSearchRequest{SortBy: []*resourcepb.ResourceSearchRequest_Sort{
		{Field: resource.SEARCH_FIELD_TITLE},           // standard title -> populated title_phrase
		{Field: "note"},                                // text field -> indexed name (no _keyword)
		{Field: "num"},                                 // numeric sort field -> its indexed name
		{Field: resource.SEARCH_FIELD_PREFIX + "note"}, // already-prefixed text-only name is preserved
	}}
	// name is appended as a stable tie-breaker.
	assert.Equal(t, []string{
		resource.SEARCH_FIELD_TITLE_PHRASE,
		resource.SEARCH_FIELD_PREFIX + "note",
		resource.SEARCH_FIELD_PREFIX + "num",
		resource.SEARCH_FIELD_PREFIX + "note",
		resource.SEARCH_FIELD_NAME,
	}, getSortFields(req, fields))
}

func TestBleveIndex_resolveQueryFields(t *testing.T) {
	fields, err := resource.NewSearchableDocumentFields(resource.SearchFieldDefinitionsToTableColumns(
		[]resource.SearchFieldDefinition{
			{Name: "panel_title", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityText}},
		},
	))
	require.NoError(t, err)
	b := &bleveIndex{fields: fields, standard: resource.StandardSearchFields()}

	names := func(qfs []*resourcepb.ResourceSearchRequest_QueryField) []string {
		out := make([]string, len(qfs))
		for i, f := range qfs {
			out[i] = f.Name
		}
		return out
	}
	titleVariants := []string{resource.SEARCH_FIELD_TITLE_PHRASE, resource.SEARCH_FIELD_TITLE, resource.SEARCH_FIELD_TITLE_NGRAM}

	// An empty request fans out to the three title variants.
	assert.Equal(t, titleVariants, names(b.resolveQueryFields(nil)))
	// An explicit title field fans out the same way.
	assert.Equal(t, titleVariants, names(b.resolveQueryFields([]*resourcepb.ResourceSearchRequest_QueryField{{Name: resource.SEARCH_FIELD_TITLE}})))

	// A per-kind field resolves to fields.* and keeps its requested boost. The
	// requested type is dropped: the backend derives it from the mapping.
	got := b.resolveQueryFields([]*resourcepb.ResourceSearchRequest_QueryField{{Name: "panel_title", Type: resourcepb.QueryFieldType_KEYWORD, Boost: 3}})
	require.Len(t, got, 1)
	assert.Equal(t, resource.SEARCH_FIELD_PREFIX+"panel_title", got[0].Name)
	assert.Equal(t, resourcepb.QueryFieldType_DEFAULT, got[0].Type)
	assert.Equal(t, float32(3), got[0].Boost)

	// title + per-kind field: title variants first, then the resolved field.
	assert.Equal(t, append(append([]string{}, titleVariants...), resource.SEARCH_FIELD_PREFIX+"panel_title"),
		names(b.resolveQueryFields([]*resourcepb.ResourceSearchRequest_QueryField{
			{Name: resource.SEARCH_FIELD_TITLE},
			{Name: "panel_title", Type: resourcepb.QueryFieldType_TEXT},
		})))

	// When the caller already names the physical title variants (legacy dashboard
	// search), the logical title is not re-expanded, so nothing is duplicated.
	legacy := []*resourcepb.ResourceSearchRequest_QueryField{
		{Name: resource.SEARCH_FIELD_TITLE_PHRASE, Type: resourcepb.QueryFieldType_KEYWORD, Boost: 10},
		{Name: resource.SEARCH_FIELD_TITLE, Type: resourcepb.QueryFieldType_TEXT, Boost: 2},
		{Name: resource.SEARCH_FIELD_TITLE_NGRAM, Type: resourcepb.QueryFieldType_TEXT, Boost: 1},
	}
	assert.Equal(t, titleVariants, names(b.resolveQueryFields(legacy)))
}

func TestCombineFilterAndTextQueries(t *testing.T) {
	text := bleve.NewMatchQuery("cpu")
	f1 := bleve.NewTermQuery("a")
	f1.SetField("x")
	f2 := bleve.NewTermQuery("b")
	f2.SetField("y")

	// No filters and no text query matches everything.
	assert.IsType(t, &query.MatchAllQuery{}, combineFilterAndTextQueries(nil, nil))

	// No filters: the text query is used as-is (it is the only scoring clause).
	assert.Same(t, text, combineFilterAndTextQueries(nil, text))

	// Filters only (no text): the filters drive the query directly so bleve
	// iterates their posting lists rather than scanning every document.
	assert.Same(t, f1, combineFilterAndTextQueries([]query.Query{f1}, nil))
	conj, ok := combineFilterAndTextQueries([]query.Query{f1, f2}, nil).(*query.ConjunctionQuery)
	require.True(t, ok)
	assert.Equal(t, []query.Query{f1, f2}, conj.Conjuncts)

	// Filters + text: text scores in Must, the filter stays in the Filter slot.
	bq, ok := combineFilterAndTextQueries([]query.Query{f1}, text).(*query.BooleanQuery)
	require.True(t, ok)
	must, ok := bq.Must.(*query.ConjunctionQuery)
	require.True(t, ok)
	assert.Equal(t, []query.Query{text}, must.Conjuncts)
	assert.Same(t, f1, bq.Filter)

	// Multiple filters are combined into a single conjunction in the Filter slot.
	bq, ok = combineFilterAndTextQueries([]query.Query{f1, f2}, text).(*query.BooleanQuery)
	require.True(t, ok)
	filter, ok := bq.Filter.(*query.ConjunctionQuery)
	require.True(t, ok)
	assert.Equal(t, []query.Query{f1, f2}, filter.Conjuncts)
}

// TestBulkIndexPopulatesFieldVariants indexes a document for a synthetic kind
// that declares a field with both text and filter capabilities. No in-tree
// kind declares that combination, so the keyword variant it maps can only be
// exercised with a kind constructed here.
func TestBulkIndexPopulatesFieldVariants(t *testing.T) {
	const group, kindResource = "example.test", "widgets"
	gvr := schema.GroupVersionResource{Group: group, Version: "v1", Resource: kindResource}
	provider := resource.NewMapProvider(map[schema.GroupVersionResource][]resource.SearchFieldDefinition{
		gvr: {
			{
				Name: "category",
				Type: resource.SearchFieldTypeString,
				Capabilities: []resource.SearchCapability{
					resource.SearchCapabilityText,
					resource.SearchCapabilityFilter,
					resource.SearchCapabilityRetrieve,
				},
			},
			{
				Name:  "owners",
				Type:  resource.SearchFieldTypeString,
				Array: true,
				Capabilities: []resource.SearchCapability{
					resource.SearchCapabilityText,
					resource.SearchCapabilityFilter,
				},
			},
			{
				Name:         "region",
				Type:         resource.SearchFieldTypeString,
				Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter},
			},
		},
	}, map[schema.GroupResource]string{gvr.GroupResource(): gvr.Version})

	key := resource.NamespacedResource{Namespace: "default", Group: group, Resource: kindResource}
	backend, err := NewBleveBackend(BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: 5, // stay in memory
		SearchFields: resource.NewSearchFieldsRegistry(nil, nil, map[resource.LowerGroupResource]resource.SearchFieldsProvider{
			resource.NewLowerGroupResource(group, kindResource): provider,
		}),
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	index, err := backend.BuildIndex(t.Context(), key, 1, "test", func(index resource.ResourceIndex) (int64, error) {
		return 1, index.BulkIndex(&resource.BulkIndexRequest{
			Items: []*resource.BulkIndexItem{{
				Action: resource.ActionIndex,
				Doc: &resource.IndexableDocument{
					Key:   &resourcepb.ResourceKey{Namespace: key.Namespace, Group: group, Resource: kindResource, Name: "w1"},
					Title: "Widget one",
					Fields: map[string]any{
						"category": "Time Series",
						"owners":   []string{"Ops Team", "SRE"},
						"region":   "US West",
					},
				},
			}},
		})
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)

	bi, ok := index.(*bleveIndex)
	require.True(t, ok)

	termHits := func(t *testing.T, field, term string) uint64 {
		t.Helper()
		q := bleve.NewTermQuery(term)
		q.SetField(field)
		res, err := bi.index.Search(bleve.NewSearchRequest(q))
		require.NoError(t, err)
		return res.Total
	}

	t.Run("keyword variant holds the whole value, lowercased", func(t *testing.T) {
		assert.Equal(t, uint64(1), termHits(t, "fields.category_keyword", "time series"))
		// The analyzed variant still only matches single tokens, which is why
		// the keyword variant is needed for exact matching.
		assert.Equal(t, uint64(0), termHits(t, "fields.category", "time series"))
		assert.Equal(t, uint64(1), termHits(t, "fields.category", "series"))
	})

	t.Run("array keyword variant holds whole elements", func(t *testing.T) {
		assert.Equal(t, uint64(1), termHits(t, "fields.owners_keyword", "ops team"))
		assert.Equal(t, uint64(1), termHits(t, "fields.owners_keyword", "sre"))
		assert.Equal(t, uint64(0), termHits(t, "fields.owners_keyword", "ops"))
	})

	t.Run("filter-only field keeps its own name", func(t *testing.T) {
		assert.Equal(t, uint64(1), termHits(t, "fields.region", "US West"))
		assert.Equal(t, uint64(0), termHits(t, "fields.region_keyword", "us west"))
	})

	// Re-indexing a document sees the variants the previous pass added, so they
	// must not be mistaken for values written under an undeclared name.
	t.Run("variant names count as declared", func(t *testing.T) {
		assert.True(t, bi.isDeclaredField("fields.category_keyword"))
		assert.True(t, bi.isDeclaredField("owners_keyword"))
		assert.False(t, bi.isDeclaredField("fields.region_keyword"))
	})
}

// TestNoVariantsForDashboards guards the on-disk shape of the kinds that exist
// today: none of them declares a text field that also filters, sorts or
// facets, so no extra field is written and no index has to be rebuilt.
func TestNoVariantsForDashboards(t *testing.T) {
	provider := DashboardSearchFieldsProviderForTest()
	assert.Empty(t, fieldVariantsOf(fieldDefinitionsForMapping(provider, "dashboard.grafana.app", "dashboards")))
}

func TestFieldVariantsOf(t *testing.T) {
	str := func(caps ...resource.SearchCapability) resource.SearchFieldDefinition {
		return resource.SearchFieldDefinition{Name: "field", Type: resource.SearchFieldTypeString, Capabilities: caps}
	}

	tests := []struct {
		name string
		def  resource.SearchFieldDefinition
		want []fieldVariant
	}{
		{
			name: "text and filter",
			def:  str(resource.SearchCapabilityText, resource.SearchCapabilityFilter),
			want: []fieldVariant{{field: "field", keyword: "field_keyword"}},
		},
		{
			name: "text and facet",
			def:  str(resource.SearchCapabilityText, resource.SearchCapabilityFacet),
			want: []fieldVariant{{field: "field", keyword: "field_keyword"}},
		},
		{
			name: "text and sort",
			def:  str(resource.SearchCapabilityText, resource.SearchCapabilitySort),
			want: []fieldVariant{{field: "field", keyword: "field_keyword"}},
		},
		{
			name: "partial",
			def:  str(resource.SearchCapabilityText, resource.SearchCapabilityPartial),
			want: []fieldVariant{{field: "field", ngram: "field_ngram"}},
		},
		{
			name: "text, filter and partial",
			def:  str(resource.SearchCapabilityText, resource.SearchCapabilityFilter, resource.SearchCapabilityPartial),
			want: []fieldVariant{{field: "field", keyword: "field_keyword", ngram: "field_ngram"}},
		},
		{
			name: "filter only is keyword-analyzed under its own name",
			def:  str(resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve),
		},
		{
			name: "text only has no keyword mapping to fill in",
			def:  str(resource.SearchCapabilityText, resource.SearchCapabilityRetrieve),
		},
		{
			name: "retrieve only",
			def:  str(resource.SearchCapabilityRetrieve),
		},
		{
			name: "non-string fields keep their native form",
			def: resource.SearchFieldDefinition{Name: "field", Type: resource.SearchFieldTypeInt64,
				Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilitySort}},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, fieldVariantsOf([]resource.SearchFieldDefinition{tc.def}))
		})
	}
}

func TestPopulateFieldVariants(t *testing.T) {
	variants := fieldVariantsOf([]resource.SearchFieldDefinition{
		{
			Name:         "category",
			Type:         resource.SearchFieldTypeString,
			Capabilities: []resource.SearchCapability{resource.SearchCapabilityText, resource.SearchCapabilityFilter},
		},
		{
			Name:  "owners",
			Type:  resource.SearchFieldTypeString,
			Array: true,
			Capabilities: []resource.SearchCapability{resource.SearchCapabilityText, resource.SearchCapabilityFilter,
				resource.SearchCapabilityPartial},
		},
		{
			Name:         "region",
			Type:         resource.SearchFieldTypeString,
			Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter},
		},
		{
			Name:         "linkCount",
			Type:         resource.SearchFieldTypeInt64,
			Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilitySort},
		},
	})

	t.Run("writes lowercased whole values", func(t *testing.T) {
		doc := &resource.IndexableDocument{Fields: map[string]any{
			"category":  "Time Series",
			"owners":    []string{"Ops Team", "SRE"},
			"region":    "US West",
			"linkCount": int64(3),
		}}
		populateFieldVariants(doc, variants)

		assert.Equal(t, map[string]any{
			"category":         "Time Series",
			"category_keyword": "time series",
			"owners":           []string{"Ops Team", "SRE"},
			"owners_keyword":   []string{"ops team", "sre"},
			"owners_ngram":     []string{"Ops Team", "SRE"},
			"region":           "US West",
			"linkCount":        int64(3),
		}, doc.Fields)
	})

	t.Run("handles the []any shape the path extractor produces", func(t *testing.T) {
		doc := &resource.IndexableDocument{Fields: map[string]any{"owners": []any{"Ops Team"}}}
		populateFieldVariants(doc, variants)
		assert.Equal(t, []any{"ops team"}, doc.Fields["owners_keyword"])
	})

	t.Run("absent fields stay absent", func(t *testing.T) {
		doc := &resource.IndexableDocument{Fields: map[string]any{"region": "US West"}}
		populateFieldVariants(doc, variants)
		assert.Equal(t, map[string]any{"region": "US West"}, doc.Fields)
	})

	t.Run("a value that does not match its declared type is left alone", func(t *testing.T) {
		doc := &resource.IndexableDocument{Fields: map[string]any{"category": 42}}
		populateFieldVariants(doc, variants)
		assert.Equal(t, map[string]any{"category": 42}, doc.Fields)
	})
}
