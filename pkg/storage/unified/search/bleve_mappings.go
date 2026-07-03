package search

import (
	"strings"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/keyword"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/standard"
	"github.com/blevesearch/bleve/v2/mapping"
	index "github.com/blevesearch/bleve_index_api"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// fieldDefinitionsForMapping returns the SearchFieldDefinition slice that
// drives the per-kind fields.* sub-document mapping. The provider is the
// only source of truth: a kind that wants per-kind bleve mappings must
// register a SearchFieldsProvider.
func fieldDefinitionsForMapping(provider resource.SearchFieldsProvider, group, kindResource string) []resource.SearchFieldDefinition {
	if provider == nil {
		return nil
	}
	return provider.Fields(schema.GroupVersionResource{Group: group, Resource: kindResource})
}

// addCapabilityFieldMappings adds bleve field mappings to parent for a single
// declared search field. The field is placed under parent using def.Name as
// the local name; this helper does not add any sub-document prefix (callers
// scope by passing the right parent, e.g. the "fields" sub-document mapper).
//
// Mappings emitted are driven by def.Capabilities:
//
//   - filter / facet / sort   → keyword mapping at the keyword variant name
//     (see keywordVariantName). sort enables DocValues.
//   - text                    → standard-analyzer text mapping at def.Name.
//   - partial                 → ngram mapping at def.Name + "_ngram".
//   - retrieve                → Store: true on the canonical field
//     (def.Name if text is declared, else the keyword variant).
//
// Special case: when a field has only [filter] (with or without retrieve) and
// no text capability, the keyword variant is named def.Name directly, without
// the "_keyword" suffix. This preserves the on-disk shape of today's
// Filterable-STRING fields under the "fields." prefix.
//
// Special case: when def.Name == resource.SEARCH_FIELD_TITLE, the keyword
// variant is named resource.SEARCH_FIELD_TITLE_PHRASE rather than
// "<name>_keyword". In-tree gRPC clients reference "title_phrase" by name.
//
// All emitted mappings have IncludeInAll explicitly set to false. The
// composite "_all" sub-document is disabled at the index level (see
// getBleveDocMappings), so IncludeInAll has no runtime effect; setting it
// false keeps the emitted JSON consistent.
func addCapabilityFieldMappings(parent *mapping.DocumentMapping, def resource.SearchFieldDefinition) {
	hasFilter := def.HasCapability(resource.SearchCapabilityFilter)
	hasText := def.HasCapability(resource.SearchCapabilityText)
	hasPartial := def.HasCapability(resource.SearchCapabilityPartial)
	hasSort := def.HasCapability(resource.SearchCapabilitySort)
	hasFacet := def.HasCapability(resource.SearchCapabilityFacet)
	hasRetrieve := def.HasCapability(resource.SearchCapabilityRetrieve)
	hasUnranked := def.HasCapability(resource.SearchCapabilityUnranked)

	// Non-string fields (int64, double, boolean) must be mapped to their own
	// type: bleve silently drops a numeric or boolean value fed through a
	// keyword mapping. Text, partial and facet are validated as string-only, so
	// only filter, sort and retrieve reach here for non-strings.
	if def.Type != resource.SearchFieldTypeString {
		if hasFilter || hasSort || hasRetrieve {
			m := typedNonStringFieldMapping(def.Type)
			// bleve can sort an indexed numeric field even without doc values, so
			// sort only needs the field indexed.
			m.Index = hasFilter || hasSort
			m.Store = hasRetrieve
			m.DocValues = hasSort
			m.IncludeInAll = false
			parent.AddFieldMappingsAt(def.Name, m)
		}
		return
	}

	needKeyword := hasFilter || hasFacet || hasSort
	keywordName := keywordVariantName(def.Name, hasText)

	if needKeyword {
		m := bleve.NewKeywordFieldMapping()
		m.IncludeTermVectors = false
		m.SkipFreqNorm = true
		m.DocValues = hasSort
		// Canonical field for storage is the keyword variant only when no text
		// mapping will also be created.
		m.Store = hasRetrieve && !hasText
		m.IncludeInAll = false
		parent.AddFieldMappingsAt(keywordName, m)
	}

	if hasText {
		m := bleve.NewTextFieldMapping()
		m.Analyzer = standard.Name
		m.IncludeTermVectors = false
		m.DocValues = false
		m.Store = hasRetrieve
		m.IncludeInAll = false
		m.SkipFreqNorm = hasUnranked
		parent.AddFieldMappingsAt(def.Name, m)
	}

	if hasPartial {
		m := bleve.NewTextFieldMapping()
		m.Analyzer = TITLE_ANALYZER
		m.IncludeTermVectors = false
		m.DocValues = false
		// ngram variant is never the canonical retrieval target; the keyword
		// or text variant already stores the value.
		m.Store = false
		m.IncludeInAll = false
		parent.AddFieldMappingsAt(def.Name+"_ngram", m)
	}

	// A retrieve-only string has no mapping above, so store it explicitly;
	// otherwise the static parent would drop it entirely.
	if hasRetrieve && !needKeyword && !hasText && !hasPartial {
		m := bleve.NewKeywordFieldMapping()
		m.Index = false
		m.Store = true
		m.IncludeTermVectors = false
		m.SkipFreqNorm = true
		m.DocValues = false
		m.IncludeInAll = false
		parent.AddFieldMappingsAt(def.Name, m)
	}
}

// typedNonStringFieldMapping returns a bleve field mapping matching a
// non-string search field's type, so the value is indexed and stored in its
// native form instead of being coerced through keyword analysis (which drops
// it).
func typedNonStringFieldMapping(t resource.SearchFieldType) *mapping.FieldMapping {
	switch t {
	case resource.SearchFieldTypeBoolean:
		return bleve.NewBooleanFieldMapping()
	case resource.SearchFieldTypeInt64, resource.SearchFieldTypeDouble:
		return bleve.NewNumericFieldMapping()
	default:
		// SearchFieldTypeDate and SearchFieldTypeUnknown do not appear as
		// non-string standard fields today. Fall back to numeric so an
		// int64/float value still round-trips; revisit if a real date field
		// is ever declared here.
		return bleve.NewNumericFieldMapping()
	}
}

// keywordVariantName returns the name the keyword analyzer variant of a field
// should occupy. Rules:
//
//   - name == "title" → "title_phrase" (legacy in-tree client compatibility).
//   - text capability present → name + "_keyword" so the text variant can
//     take name.
//   - otherwise → name itself, so filter-only fields keep today's on-disk
//     shape (no suffix).
func keywordVariantName(name string, hasText bool) string {
	if name == resource.SEARCH_FIELD_TITLE {
		return resource.SEARCH_FIELD_TITLE_PHRASE
	}
	if hasText {
		return name + "_keyword"
	}
	return name
}

// GetBleveMappings returns the bleve index mapping for a single
// (group, resource). When provider is non-nil and has
// SearchFieldDefinitions registered for the (group, resource), the
// per-kind fields.* sub-document mapping is built from those declarations.
// When provider is nil, no per-kind explicit mappings are emitted and
// every field under fields.* reaches the index through bleve's dynamic
// mapping.
func GetBleveMappings(provider resource.SearchFieldsProvider, group, kindResource string, selectableFields []string) (mapping.IndexMapping, error) {
	mapper := bleve.NewIndexMapping()
	mapper.DocValuesDynamic = false // only explicitly sortable fields need DocValues
	mapper.ScoringModel = index.BM25Scoring

	err := RegisterCustomAnalyzers(mapper)
	if err != nil {
		return nil, err
	}
	mapper.DefaultMapping = getBleveDocMappings(provider, group, kindResource, selectableFields)

	return mapper, nil
}

func getBleveDocMappings(provider resource.SearchFieldsProvider, group, kindResource string, selectableFields []string) *mapping.DocumentMapping {
	mapper := bleve.NewDocumentStaticMapping()

	// Standard top-level search fields are declared as SearchFieldDefinitions
	// and emitted through the capability helper.
	for _, def := range resource.StandardSearchFieldDefinitions() {
		addCapabilityFieldMappings(mapper, def)
	}

	mapper.AddSubDocumentMapping("manager", managerSubDocumentMapping())
	mapper.AddSubDocumentMapping("source", sourceSubDocumentMapping())

	// NOTE: reference and labels use dynamic mappings because their keys aren't
	// known at mapping time. Bleve auto-creates fields using NewTextFieldMapping()
	// defaults (IncludeTermVectors:true, SkipFreqNorm:false). There's no way to
	// override these on a DocumentMapping — only on individual FieldMappings.
	referenceMapper := bleve.NewDocumentMapping()
	referenceMapper.DefaultAnalyzer = keyword.Name
	mapper.AddSubDocumentMapping("reference", referenceMapper)

	labelMapper := bleve.NewDocumentMapping()
	mapper.AddSubDocumentMapping(resource.SEARCH_FIELD_LABELS, labelMapper)

	// Static so undeclared keys are dropped rather than dynamically indexed
	// (BulkIndex warns when a document carries one).
	fieldMapper := bleve.NewDocumentStaticMapping()
	for _, def := range fieldDefinitionsForMapping(provider, group, kindResource) {
		addCapabilityFieldMappings(fieldMapper, def)
	}

	mapper.AddSubDocumentMapping(strings.TrimSuffix(resource.SEARCH_FIELD_PREFIX, "."), fieldMapper)

	// Disable bleve's internal "_all" composite field. By default bleve merges
	// terms from all fields with IncludeInAll:true into a synthetic "_all"
	// field. We never query it (all searches target explicit fields). Disabling
	// it significantly reduces index size.
	// https://github.com/blevesearch/bleve/blob/v2.5.7/mapping/index.go#L366-L371
	mapper.AddSubDocumentMapping("_all", bleve.NewDocumentDisabledMapping())

	selectableFieldsMapper := bleve.NewDocumentStaticMapping()
	for _, field := range selectableFields {
		selectableFieldsMapper.AddFieldMappingsAt(field, &mapping.FieldMapping{
			Name:               field,
			Type:               "text",
			Analyzer:           keyword.Name,
			Store:              false,
			Index:              true,
			IncludeTermVectors: false,
			SkipFreqNorm:       true,
		})
	}
	mapper.AddSubDocumentMapping(strings.TrimSuffix(resource.SEARCH_SELECTABLE_FIELDS_PREFIX, "."), selectableFieldsMapper)

	return mapper
}

// keywordSubField returns a keyword (exact-match) field mapping for use inside
// a sub-document. Sub-document fields are not modellable as
// SearchFieldDefinitions today; this helper centralizes their shared shape.
func keywordSubField() *mapping.FieldMapping {
	return &mapping.FieldMapping{
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       false,
		SkipFreqNorm:       true,
	}
}

func managerSubDocumentMapping() *mapping.DocumentMapping {
	m := bleve.NewDocumentStaticMapping()
	m.AddFieldMappingsAt("kind", keywordSubField())
	m.AddFieldMappingsAt("id", keywordSubField())
	return m
}

func sourceSubDocumentMapping() *mapping.DocumentMapping {
	m := bleve.NewDocumentStaticMapping()
	m.AddFieldMappingsAt("path", keywordSubField())
	m.AddFieldMappingsAt("checksum", keywordSubField())
	timestamp := mapping.NewNumericFieldMapping()
	timestamp.DocValues = false
	timestamp.SkipFreqNorm = true
	m.AddFieldMappingsAt("timestampMillis", timestamp)
	return m
}
