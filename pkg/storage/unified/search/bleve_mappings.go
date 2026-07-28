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

// facetFieldsForMapping returns the logical facet field names accepted by the
// search API and the keyword-analyzed bleve fields that back them. Dynamic
// fields are deliberately absent because they have no facet capability.
func facetFieldsForMapping(provider resource.SearchFieldsProvider, group, kindResource string) map[string]string {
	fields := make(map[string]string)
	add := func(def resource.SearchFieldDefinition, prefix string) {
		if !def.HasCapability(resource.SearchCapabilityFacet) {
			return
		}
		logicalName := prefix + def.Name
		fields[logicalName] = prefix + keywordVariantName(def.Name, def.HasCapability(resource.SearchCapabilityText))
	}

	for _, def := range resource.StandardSearchFieldDefinitions() {
		add(def, "")
	}
	for _, def := range fieldDefinitionsForMapping(provider, group, kindResource) {
		add(def, resource.SEARCH_FIELD_PREFIX)
		// Requests accept per-kind fields with or without the internal fields. prefix.
		if physicalName, ok := fields[resource.SEARCH_FIELD_PREFIX+def.Name]; ok {
			fields[def.Name] = physicalName
		}
	}
	return fields
}

// textQueryKind is the free-text query a physical index field needs, so callers
// don't have to know how the field is analyzed.
type textQueryKind int

const (
	textQueryStandard textQueryKind = iota // standard analyzer
	textQueryNgram                         // ngram analyzer
	textQueryTerm                          // keyword analyzer, exact token
	// textQueryTermLowered is a keyword field holding a copy of another field's
	// value. Those copies are written lowercased, so the term looked up has to
	// be lowercased too.
	textQueryTermLowered
)

// textQueryKindsForMapping derives the query kind of every physical index field
// from the same declarations that produced the mapping, so the two cannot drift
// apart (see addCapabilityFieldMappings).
func textQueryKindsForMapping(provider resource.SearchFieldsProvider, group, kindResource string, selectableFields []string) map[string]textQueryKind {
	kinds := map[string]textQueryKind{}
	add := func(def resource.SearchFieldDefinition, prefix string) {
		// Non-string fields are never analyzed.
		if def.Type != resource.SearchFieldTypeString {
			return
		}
		if def.HasCapability(resource.SearchCapabilityText) {
			kinds[prefix+def.Name] = textQueryStandard
		}
		if name, ok := ngramVariant(def); ok {
			kinds[prefix+name] = textQueryNgram
		}
		if name, ok := keywordVariant(def); ok {
			// A keyword form under its own name is the value as indexed; under a
			// different name it is a lowercased copy (see populateFieldVariants
			// and UpdateCopyFields for title).
			kind := textQueryTerm
			if name != def.Name {
				kind = textQueryTermLowered
			}
			kinds[prefix+name] = kind
		}
	}

	for _, def := range resource.StandardSearchFieldDefinitions() {
		add(def, "")
	}
	for _, def := range fieldDefinitionsForMapping(provider, group, kindResource) {
		add(def, resource.SEARCH_FIELD_PREFIX)
	}
	// Selectable fields are keyword-mapped (see getBleveDocMappings).
	for _, name := range selectableFields {
		kinds[resource.SEARCH_SELECTABLE_FIELDS_PREFIX+name] = textQueryTerm
	}
	for _, name := range keywordSubDocumentFields {
		kinds[name] = textQueryTerm
	}
	return kinds
}

// keywordSubDocumentFields are keyword-mapped fields that live in sub-documents
// and so are not modellable as SearchFieldDefinitions yet (see
// managerSubDocumentMapping and sourceSubDocumentMapping). The labels
// sub-document is deliberately absent: it has no keyword default analyzer.
var keywordSubDocumentFields = []string{
	resource.SEARCH_FIELD_MANAGER_KIND,
	resource.SEARCH_FIELD_MANAGER_ID,
	resource.SEARCH_FIELD_SOURCE_PATH,
	resource.SEARCH_FIELD_SOURCE_CHECKSUM,
}

// referenceFieldPrefix is the keyword-analyzed reference sub-document. Its keys
// are resource kinds, so they cannot be enumerated up front.
const referenceFieldPrefix = "reference."

// addCapabilityFieldMappings adds bleve field mappings to parent for a single
// declared search field. The field is placed under parent using def.Name as
// the local name; this helper does not add any sub-document prefix (callers
// scope by passing the right parent, e.g. the "fields" sub-document mapper).
//
// Mappings emitted are driven by def.Capabilities:
//
//   - filter / facet / sort   → keyword mapping at the keyword variant name
//     (see keywordVariant). sort enables DocValues.
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

	keywordName, needKeyword := keywordVariant(def)

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

	if ngramName, ok := ngramVariant(def); ok {
		m := bleve.NewTextFieldMapping()
		m.Analyzer = TITLE_ANALYZER
		m.IncludeTermVectors = false
		m.DocValues = false
		// ngram variant is never the canonical retrieval target; the keyword
		// or text variant already stores the value.
		m.Store = false
		m.IncludeInAll = false
		parent.AddFieldMappingsAt(ngramName, m)
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

// keywordVariantName returns the name the keyword form of a field is mapped
// to. "title" keeps the historic "title_phrase" because in-tree clients ask
// for it by that name. A text-capable field needs a suffix because its
// analyzed form already occupies the bare name. Everything else keeps the bare
// name, so filter-only fields hold their current on-disk shape.
func keywordVariantName(name string, hasText bool) string {
	if name == resource.SEARCH_FIELD_TITLE {
		return resource.SEARCH_FIELD_TITLE_PHRASE
	}
	if hasText {
		return name + "_keyword"
	}
	return name
}

// keywordVariant returns the field def's keyword form is mapped to, and false
// when def gets no keyword mapping. The mapping builder and the index-time
// copy both call this, so a mapped variant cannot end up unwritten.
func keywordVariant(def resource.SearchFieldDefinition) (string, bool) {
	if def.Type != resource.SearchFieldTypeString {
		return "", false
	}
	if !def.HasCapability(resource.SearchCapabilityFilter) &&
		!def.HasCapability(resource.SearchCapabilityFacet) &&
		!def.HasCapability(resource.SearchCapabilitySort) {
		return "", false
	}
	return keywordVariantName(def.Name, def.HasCapability(resource.SearchCapabilityText)), true
}

// ngramVariant returns the field def's ngram form is mapped to, and false when
// def gets no ngram mapping.
func ngramVariant(def resource.SearchFieldDefinition) (string, bool) {
	if def.Type != resource.SearchFieldTypeString || !def.HasCapability(resource.SearchCapabilityPartial) {
		return "", false
	}
	return def.Name + "_ngram", true
}

// fieldVariant is a per-kind value that has to be copied into a second field,
// because the mapping analyzes it differently there.
type fieldVariant struct {
	field   string
	keyword string // empty when the value is keyword-analyzed under field itself
	ngram   string // empty when the field has no ngram mapping
}

// fieldVariantsOf lists the copies a kind's declarations call for. Without the
// copy the mapped variant stays empty and queries against it match nothing.
func fieldVariantsOf(defs []resource.SearchFieldDefinition) []fieldVariant {
	var out []fieldVariant
	for _, def := range defs {
		v := fieldVariant{field: def.Name}
		if name, ok := keywordVariant(def); ok && name != def.Name {
			v.keyword = name
		}
		if name, ok := ngramVariant(def); ok {
			v.ngram = name
		}
		if v.keyword != "" || v.ngram != "" {
			out = append(out, v)
		}
	}
	return out
}

// populateFieldVariants fills in the variant fields of a document's per-kind
// values. Standard fields are left alone: title's variants come from
// UpdateCopyFields, and no other standard field has one.
//
// TODO: fold this together with UpdateCopyFields, so title and per-kind fields
// get their variants from one declaration-driven pass.
func populateFieldVariants(doc *resource.IndexableDocument, variants []fieldVariant) {
	for _, v := range variants {
		value, ok := doc.Fields[v.field]
		if !ok {
			continue
		}
		if v.keyword != "" {
			// Stored pre-lowered like title_phrase, so the query side can
			// lowercase the term it looks up and still match.
			if lowered, ok := lowerStrings(value); ok {
				doc.Fields[v.keyword] = lowered
			}
		}
		if v.ngram != "" {
			doc.Fields[v.ngram] = value
		}
	}
}

// lowerStrings lowercases a string or a list of strings, keeping the shape: an
// array's keyword form is the set of whole elements, not one joined string.
// Anything else is reported as unusable, so a value that does not match its
// declared type is left alone rather than mangled.
func lowerStrings(value any) (any, bool) {
	switch v := value.(type) {
	case string:
		return strings.ToLower(v), true
	case []string:
		out := make([]string, len(v))
		for i, s := range v {
			out[i] = strings.ToLower(s)
		}
		return out, true
	case []any:
		out := make([]any, 0, len(v))
		for _, e := range v {
			s, ok := e.(string)
			if !ok {
				return nil, false
			}
			out = append(out, strings.ToLower(s))
		}
		return out, true
	}
	return nil, false
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
	mapper.AddSubDocumentMapping(strings.TrimSuffix(referenceFieldPrefix, "."), referenceMapper)

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
