package search

import (
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/enginequery"
)

// fieldValueResultSchema keeps the public field declarations aligned with the
// internal definitions used to encode each row value at the same index.
type fieldValueResultSchema struct {
	fields                 []*resourcepb.ResourceSearchField
	definitions            []resource.SearchFieldDefinition
	includeScore           bool
	includeResourceVersion bool
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

func setSearchResults(
	logger log.Logger,
	response *resourcepb.ResourceSearchResponse,
	fieldValueSchema *fieldValueResultSchema,
	hits []*queryHit,
) error {
	if fieldValueSchema == nil {
		return fmt.Errorf("missing field-value result schema")
	}
	fields, rows, err := hitsToFieldValues(logger, fieldValueSchema, hits)
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
	return b.searchFields.resolveFieldValueSchema(selectFields)
}

func (k kindSearchFields) resolveFieldValueSchema(selectFields []string) (*fieldValueResultSchema, error) {
	definitions := make([]resource.SearchFieldDefinition, 0, len(selectFields))
	if slices.Contains(selectFields, resource.SEARCH_FIELD_ALL_FIELDS) {
		definitions = append(definitions, k.allResultFields...)
	}
	for _, name := range selectFields {
		if name == resource.SEARCH_FIELD_ALL_FIELDS {
			continue
		}
		definition, ok := k.resultFields[name]
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

		fieldType, err := enginequery.FieldValueType(definition.Type)
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

func hitsToFieldValues(
	logger log.Logger,
	schema *fieldValueResultSchema,
	hits []*queryHit,
) ([]*resourcepb.ResourceSearchField, []*resourcepb.ResourceSearchRow, error) {
	rows := make([]*resourcepb.ResourceSearchRow, len(hits))
	for rowIndex, match := range hits {
		row := &resourcepb.ResourceSearchRow{
			Key:        &resourcepb.ResourceKey{},
			SortFields: match.Cursor,
			Values:     make([]*resourcepb.ResourceSearchValue, 0, len(schema.definitions)),
		}
		if err := resource.ReadSearchID(row.Key, match.ID); err != nil {
			return nil, nil, err
		}
		if schema.includeResourceVersion {
			row.ResourceVersion = hitResourceVersion(logger, match)
		}
		if schema.includeScore {
			row.Score = new(match.Score)
		}
		for fieldIndex, definition := range schema.definitions {
			value, ok, err := searchHitFieldValue(match, definition.Name)
			if err != nil {
				if definition.Name != resource.SEARCH_FIELD_LEGACY_ID {
					return nil, nil, fmt.Errorf("row %d field %q: %w", rowIndex, definition.Name, err)
				}
				// A malformed legacy ID must not fail an otherwise valid search.
				logger.Debug("ignoring malformed legacy ID in search result", "resource", match.ID, "error", err)
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

// hitResourceVersion reads the resource version a hit was indexed with. The index
// stores it as a string because a number would come back rounded (see
// SEARCH_FIELD_RV_STRING), so it is parsed here rather than converted.
//
// Returns 0 when the value is absent, which is the case for every document in an
// index built before the field existed.
func hitResourceVersion(logger log.Logger, match *queryHit) int64 {
	value, ok := match.Fields[resource.SEARCH_FIELD_RV_STRING]
	if !ok || value == nil {
		return 0
	}
	text, ok := value.(string)
	if !ok {
		logger.Debug("ignoring non-string resource version in search result", "resource", match.ID, "type", fmt.Sprintf("%T", value))
		return 0
	}
	rv, err := strconv.ParseInt(text, 10, 64)
	if err != nil {
		logger.Debug("ignoring invalid resource version in search result", "resource", match.ID, "value", text, "error", err)
		return 0
	}
	return rv
}

func searchHitFieldValue(match *queryHit, name string) (any, bool, error) {
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
func searchHitLegacyID(match *queryHit) (any, bool, error) {
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

func newSearchResultValue(index uint32, def resource.SearchFieldDefinition, value any) (*resourcepb.ResourceSearchValue, error) {
	return enginequery.NewSearchResultValue(index, def, value)
}
