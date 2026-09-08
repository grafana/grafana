package search

import (
	"context"
	"fmt"
	"math"
	"reflect"
	"slices"
	"strconv"
	"strings"

	blevesearch "github.com/blevesearch/bleve/v2/search"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// fieldValueResultSchema keeps the public field declarations aligned with the
// internal definitions used to encode each row value at the same index.
type fieldValueResultSchema struct {
	fields                 []*resourcepb.ResourceSearchField
	definitions            []resource.SearchFieldDefinition
	includeScore           bool
	includeResourceVersion bool
}

func selectedResultFormat(format resourcepb.ResourceSearchRequest_ResultFormat) (resourcepb.ResourceSearchRequest_ResultFormat, error) {
	switch format {
	case resourcepb.ResourceSearchRequest_UNSPECIFIED, resourcepb.ResourceSearchRequest_RESOURCE_TABLE:
		return resourcepb.ResourceSearchRequest_RESOURCE_TABLE, nil
	case resourcepb.ResourceSearchRequest_FIELD_VALUES:
		return resourcepb.ResourceSearchRequest_FIELD_VALUES, nil
	default:
		return resourcepb.ResourceSearchRequest_UNSPECIFIED, fmt.Errorf("unsupported search result format %d", format)
	}
}

// fieldValueDefinitions keeps result types on the same manifest-backed source
// as indexing. The map resolves explicit request names; the slice preserves the
// curated field set returned when a request does not select fields.
func fieldValueDefinitions(provider resource.SearchFieldsProvider, group, kindResource string) (map[string]resource.SearchFieldDefinition, []resource.SearchFieldDefinition) {
	fields := make(map[string]resource.SearchFieldDefinition)
	for _, field := range requestableFields(provider, group, kindResource) {
		fields[field.key] = field.def
	}

	// These fields predate manifest search fields or are derived while building a
	// result. Keep their response shape here until they have first-class definitions.
	for _, field := range []resource.SearchFieldDefinition{
		{Name: resource.SEARCH_FIELD_ID, Type: resource.SearchFieldTypeString},
		{Name: resource.SEARCH_FIELD_GROUP_RESOURCE, Type: resource.SearchFieldTypeString},
		{Name: resource.SEARCH_FIELD_NAMESPACE, Type: resource.SearchFieldTypeString},
		{Name: resource.SEARCH_FIELD_RV, Type: resource.SearchFieldTypeInt64},
		{Name: resource.SEARCH_FIELD_SCORE, Type: resource.SearchFieldTypeDouble},
		{Name: resource.SEARCH_FIELD_EXPLAIN, Type: resource.SearchFieldTypeUnknown},
		{Name: resource.SEARCH_FIELD_LEGACY_ID, Type: resource.SearchFieldTypeInt64},
		{Name: resource.SEARCH_FIELD_MANAGER_KIND, Type: resource.SearchFieldTypeString},
		{Name: resource.SEARCH_FIELD_MANAGER_ID, Type: resource.SearchFieldTypeString},
		{Name: resource.SEARCH_FIELD_SOURCE_TIME, Type: resource.SearchFieldTypeInt64},
		{Name: resource.SEARCH_FIELD_SOURCE_PATH, Type: resource.SearchFieldTypeString},
		{Name: resource.SEARCH_FIELD_SOURCE_CHECKSUM, Type: resource.SearchFieldTypeString},
	} {
		fields[field.Name] = field
	}

	mappingFields := fieldDefinitionsForMapping(provider, group, kindResource)
	defaultFieldNames := defaultSearchResultFieldNames()
	allNames := make([]string, 0, len(defaultFieldNames)+len(mappingFields))
	allNames = append(allNames, defaultFieldNames...)
	for _, field := range mappingFields {
		allNames = append(allNames, field.Name)
	}
	allFields := make([]resource.SearchFieldDefinition, 0, len(allNames))
	for _, name := range allNames {
		allFields = append(allFields, fields[name])
	}
	return fields, allFields
}

func (b *bleveIndex) setSearchResults(
	ctx context.Context,
	response *resourcepb.ResourceSearchResponse,
	selectFields []string,
	fieldValueSchema *fieldValueResultSchema,
	hits blevesearch.DocumentMatchCollection,
	sort blevesearch.SortOrder,
	explain bool,
) error {
	if response.ResultFormat == resourcepb.ResourceSearchRequest_RESOURCE_TABLE {
		results, err := b.hitsToTable(ctx, selectFields, hits, sort, explain)
		if err != nil {
			return err
		}
		response.Results = results
		return nil
	}

	if fieldValueSchema == nil {
		return fmt.Errorf("missing field-value result schema")
	}
	fields, rows, err := b.hitsToFieldValues(fieldValueSchema, hits, sort)
	if err != nil {
		return err
	}
	response.Fields = fields
	response.Rows = rows
	return nil
}

// resolveFieldValueSchema validates the response fields before running the
// query, so an expensive search cannot finish with an unusable result shape.
func (b *bleveIndex) resolveFieldValueSchema(selectFields []string) (*fieldValueResultSchema, error) {
	definitions := make([]resource.SearchFieldDefinition, 0, len(selectFields))
	if slices.Contains(selectFields, resource.SEARCH_FIELD_ALL_FIELDS) {
		definitions = append(definitions, b.searchFields.allResultFields...)
	}
	for _, name := range selectFields {
		if name == resource.SEARCH_FIELD_ALL_FIELDS {
			continue
		}
		definition, ok := b.searchFields.resultFields[name]
		if !ok && strings.HasPrefix(name, resource.SEARCH_FIELD_LABELS+".") {
			definition = resource.SearchFieldDefinition{Name: name, Type: resource.SearchFieldTypeString}
			ok = true
		}
		if !ok {
			return nil, fmt.Errorf("unknown response field %q", name)
		}
		definitions = append(definitions, definition)
	}

	schema := &fieldValueResultSchema{
		fields:      make([]*resourcepb.ResourceSearchField, 0, len(definitions)),
		definitions: make([]resource.SearchFieldDefinition, 0, len(definitions)),
	}
	seen := make(map[string]struct{}, len(definitions))
	for _, definition := range definitions {
		if _, ok := seen[definition.Name]; ok {
			return nil, fmt.Errorf("duplicate response field %q", definition.Name)
		}
		seen[definition.Name] = struct{}{}

		switch definition.Name {
		case resource.SEARCH_FIELD_SCORE:
			schema.includeScore = true
			continue
		case resource.SEARCH_FIELD_EXPLAIN:
			// The new format does not expose engine-specific explanations.
			continue
		case resource.SEARCH_FIELD_ID,
			resource.SEARCH_FIELD_NAMESPACE,
			resource.SEARCH_FIELD_GROUP_RESOURCE,
			resource.SEARCH_FIELD_NAME:
			// ResourceSearchRow.key already carries the resource identity.
			continue
		case resource.SEARCH_FIELD_RV:
			schema.includeResourceVersion = true
			continue
		}

		fieldType, err := fieldValueType(definition.Type)
		if err != nil {
			return nil, fmt.Errorf("field %q: %w", definition.Name, err)
		}
		schema.fields = append(schema.fields, &resourcepb.ResourceSearchField{
			Name:    definition.Name,
			Type:    fieldType,
			IsArray: definition.Array,
		})
		schema.definitions = append(schema.definitions, definition)
	}
	return schema, nil
}

func (b *bleveIndex) hitsToFieldValues(
	schema *fieldValueResultSchema,
	hits blevesearch.DocumentMatchCollection,
	sort blevesearch.SortOrder,
) ([]*resourcepb.ResourceSearchField, []*resourcepb.ResourceSearchRow, error) {
	rows := make([]*resourcepb.ResourceSearchRow, len(hits))
	for rowIndex, match := range hits {
		row := &resourcepb.ResourceSearchRow{
			Key:        &resourcepb.ResourceKey{},
			SortFields: hitSortFields(match, sort),
			Values:     make([]*resourcepb.ResourceSearchValue, 0, len(schema.definitions)),
		}
		if err := resource.ReadSearchID(row.Key, match.ID); err != nil {
			return nil, nil, err
		}
		if schema.includeScore {
			row.Score = new(match.Score)
		}
		if schema.includeResourceVersion {
			value, ok, err := searchHitFieldValue(match, resource.SEARCH_FIELD_RV)
			if err != nil {
				return nil, nil, fmt.Errorf("row %d resource version: %w", rowIndex, err)
			}
			if ok && value != nil {
				row.ResourceVersion, err = searchResultInt64(value)
				if err != nil {
					return nil, nil, fmt.Errorf("row %d resource version: %w", rowIndex, err)
				}
			}
		}

		for fieldIndex, definition := range schema.definitions {
			value, ok, err := searchHitFieldValue(match, definition.Name)
			if err != nil {
				return nil, nil, fmt.Errorf("row %d field %q: %w", rowIndex, definition.Name, err)
			}
			if !ok || value == nil {
				continue
			}
			resultValue, err := newSearchResultValue(uint32(fieldIndex), definition, value)
			if err != nil {
				return nil, nil, fmt.Errorf("row %d field %q: %w", rowIndex, definition.Name, err)
			}
			row.Values = append(row.Values, resultValue)
		}
		rows[rowIndex] = row
	}
	return schema.fields, rows, nil
}

func fieldValueType(fieldType resource.SearchFieldType) (resourcepb.ResourceSearchField_Type, error) {
	switch fieldType {
	case resource.SearchFieldTypeString:
		return resourcepb.ResourceSearchField_STRING, nil
	case resource.SearchFieldTypeBoolean:
		return resourcepb.ResourceSearchField_BOOLEAN, nil
	case resource.SearchFieldTypeInt64:
		return resourcepb.ResourceSearchField_INT64, nil
	case resource.SearchFieldTypeDouble:
		return resourcepb.ResourceSearchField_DOUBLE, nil
	case resource.SearchFieldTypeDate:
		return resourcepb.ResourceSearchField_DATE, nil
	default:
		return resourcepb.ResourceSearchField_UNSPECIFIED, fmt.Errorf("unsupported field type %q", fieldType)
	}
}

func searchHitFieldValue(match *blevesearch.DocumentMatch, name string) (any, bool, error) {
	if name == resource.SEARCH_FIELD_LEGACY_ID {
		return searchHitLegacyID(match)
	}

	value, ok := match.Fields[name]
	if !ok {
		value, ok = match.Fields[resource.SEARCH_FIELD_PREFIX+name]
	}
	return value, ok, nil
}

// Dashboard callers still use the numeric legacy ID while the index stores
// its source label as a string.
func searchHitLegacyID(match *blevesearch.DocumentMatch) (any, bool, error) {
	value, ok := match.Fields[resource.SEARCH_FIELD_LABELS+"."+resource.SEARCH_FIELD_LEGACY_ID]
	if !ok || value == nil {
		return nil, false, nil
	}
	text, ok := value.(string)
	if !ok {
		return nil, false, fmt.Errorf("expected legacy ID string, got %T", value)
	}
	id, err := strconv.ParseInt(text, 10, 64)
	if err != nil {
		return int64(0), true, fmt.Errorf("invalid legacy ID %q: %w", text, err)
	}
	return id, true, nil
}

func newSearchResultValue(
	fieldIndex uint32,
	definition resource.SearchFieldDefinition,
	value any,
) (*resourcepb.ResourceSearchValue, error) {
	values := flattenSearchResultValue(value)
	if !definition.Array && len(values) != 1 {
		return nil, fmt.Errorf("scalar field has %d values", len(values))
	}

	result := &resourcepb.ResourceSearchValue{FieldIndex: fieldIndex}
	for _, value := range values {
		switch definition.Type {
		case resource.SearchFieldTypeString:
			v, ok := value.(string)
			if !ok {
				return nil, fmt.Errorf("expected string, got %T", value)
			}
			result.StringValues = append(result.StringValues, v)
		case resource.SearchFieldTypeBoolean:
			v, ok := value.(bool)
			if !ok {
				return nil, fmt.Errorf("expected boolean, got %T", value)
			}
			result.BooleanValues = append(result.BooleanValues, v)
		case resource.SearchFieldTypeInt64, resource.SearchFieldTypeDate:
			v, err := searchResultInt64(value)
			if err != nil {
				return nil, err
			}
			result.Int64Values = append(result.Int64Values, v)
		case resource.SearchFieldTypeDouble:
			v, err := searchResultFloat64(value)
			if err != nil {
				return nil, err
			}
			result.DoubleValues = append(result.DoubleValues, v)
		default:
			return nil, fmt.Errorf("unsupported field type %q", definition.Type)
		}
	}
	return result, nil
}

func flattenSearchResultValue(value any) []any {
	rv := reflect.ValueOf(value)
	if !rv.IsValid() || (rv.Kind() != reflect.Slice && rv.Kind() != reflect.Array) {
		return []any{value}
	}
	values := make([]any, rv.Len())
	for i := range rv.Len() {
		values[i] = rv.Index(i).Interface()
	}
	return values
}

// Bleve returns stored numeric fields as float64. The int64 case is the parsed
// dashboard legacy ID above, before it reaches this conversion.
func searchResultInt64(value any) (int64, error) {
	if v, ok := value.(int64); ok {
		return v, nil
	}
	v, ok := value.(float64)
	if ok && !math.IsNaN(v) && !math.IsInf(v, 0) && math.Trunc(v) == v && v >= math.MinInt64 && v < math.MaxInt64 {
		return int64(v), nil
	}
	return 0, fmt.Errorf("expected int64-compatible number, got %T (%v)", value, value)
}

func searchResultFloat64(value any) (float64, error) {
	v, ok := value.(float64)
	if !ok {
		return 0, fmt.Errorf("expected float64, got %T", value)
	}
	return v, nil
}
