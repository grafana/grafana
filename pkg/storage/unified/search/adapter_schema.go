package search

import (
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// AdapterSchema shares Grafana's field rules with standalone search adapters.
// The adapter still owns its native mappings and query execution.
type AdapterSchema struct {
	fields resource.SearchableDocumentFields
	kind   kindSearchFields
}

func NewAdapterSchema(provider resource.SearchFieldsProvider, key resource.NamespacedResource, selectable []string) (AdapterSchema, error) {
	fields, err := resource.SearchableFieldsFromProvider(provider, key.Group, key.Resource)
	if err != nil {
		return AdapterSchema{}, err
	}
	return AdapterSchema{fields: fields, kind: newKindSearchFields(provider, key.Group, key.Resource, selectable)}, nil
}

func (s AdapterSchema) Resolve(name string) string { return resolveFieldName(s.fields, name) }
func (s AdapterSchema) Result(name string) (resource.SearchFieldDefinition, bool) {
	def, ok := s.kind.resultFields[name]
	return def, ok
}
func (s AdapterSchema) DefaultFields() []resource.SearchFieldDefinition {
	return s.kind.allResultFields
}
func (s AdapterSchema) Sortable(name string) bool { return s.kind.sortableFields[name] }
func (s AdapterSchema) Facet(name string) string  { return s.kind.storedFacetField(name) }
func (s AdapterSchema) Keyword(name string) (field KeywordField, ok bool) {
	kf, ok := s.kind.keywordFields[name]
	return KeywordField{Name: kf.name, Filterable: kf.filterable, Lowered: kf.lowered}, ok
}

type KeywordField struct {
	Name                string
	Filterable, Lowered bool
}

func (s AdapterSchema) NumberOrBool(name string) (field NumberOrBoolField, ok bool) {
	nb, ok := s.kind.numberOrBoolFields[name]
	return NumberOrBoolField{Name: nb.name, Type: nb.fieldType, Filterable: nb.filterable}, ok
}

type NumberOrBoolField struct {
	Name       string
	Type       resource.SearchFieldType
	Filterable bool
}

func (s AdapterSchema) QueryFields(requested []*resourcepb.ResourceSearchRequest_QueryField) []*resourcepb.ResourceSearchRequest_QueryField {
	return resolveQueryFields(s.fields, requested)
}

func (s AdapterSchema) TextTerm(name string) (exact, lowered bool) {
	kind := s.kind.textQueryKinds[name]
	return kind == textQueryTerm || kind == textQueryTermLowered, kind == textQueryTermLowered
}

type AdapterField struct {
	Name, Prefix string
	Definition   resource.SearchFieldDefinition
}

func AdapterFields(provider resource.SearchFieldsProvider, key resource.NamespacedResource) []AdapterField {
	fields := declaredFields(provider, key.Group, key.Resource)
	result := make([]AdapterField, 0, len(fields))
	for _, f := range fields {
		result = append(result, AdapterField{Name: f.key, Prefix: f.prefix, Definition: f.def})
	}
	return result
}

func KeywordVariant(def resource.SearchFieldDefinition) (string, bool) { return keywordVariant(def) }
func NgramVariant(def resource.SearchFieldDefinition) (string, bool)   { return ngramVariant(def) }
func LowerStrings(value any) (any, bool)                               { return lowerStrings(value) }
func RemoveSmallTerms(text string) string                              { return removeSmallTerms(text) }
func SplitTermCharacters(text string) string                           { return splitTermCharacters(text) }
func FirstTermSeparator(text string) (string, bool)                    { return firstTermSeparator(text) }
func ParseBooleanFilterValue(text string) (bool, bool)                 { return parseBooleanFilterValue(text) }
func ParseDoubleFilterValue(key, text string) (float64, *resourcepb.ErrorResult) {
	return parseNumericFilterValue(numberOrBoolField{fieldType: resource.SearchFieldTypeDouble}, key, text)
}
func ValidateAdapterQuery(req *resourcepb.ResourceSearchRequest) *resourcepb.ErrorResult {
	if err := rejectInternalFields(req); err != nil {
		return err
	}
	return validateTrashRequest(req)
}
