package resource

import (
	"fmt"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// DecodeSearchValues resolves a field-value row into values keyed by field name.
func DecodeSearchValues(fields []*resourcepb.ResourceSearchField, row *resourcepb.ResourceSearchRow) (map[string]any, error) {
	if row == nil {
		return nil, fmt.Errorf("nil search result row")
	}

	values := make(map[string]any, len(row.Values))
	seen := make(map[uint32]struct{}, len(row.Values))
	for _, value := range row.Values {
		if value == nil {
			return nil, fmt.Errorf("nil field value")
		}
		if _, ok := seen[value.FieldIndex]; ok {
			return nil, fmt.Errorf("duplicate field index %d", value.FieldIndex)
		}
		seen[value.FieldIndex] = struct{}{}
		if value.FieldIndex >= uint32(len(fields)) {
			return nil, fmt.Errorf("field index %d is out of range", value.FieldIndex)
		}
		field := fields[value.FieldIndex]
		if field == nil {
			return nil, fmt.Errorf("field index %d has no definition", value.FieldIndex)
		}
		decoded, err := decodeSearchValue(field, value)
		if err != nil {
			return nil, fmt.Errorf("field %q: %w", field.Name, err)
		}
		values[field.Name] = decoded
	}
	return values, nil
}

func decodeSearchValue(field *resourcepb.ResourceSearchField, value *resourcepb.ResourceSearchValue) (any, error) {
	switch field.Type {
	case resourcepb.ResourceSearchField_STRING:
		return searchScalarOrArray(value.StringValues, field.IsArray)
	case resourcepb.ResourceSearchField_INT64, resourcepb.ResourceSearchField_DATE:
		return searchScalarOrArray(value.Int64Values, field.IsArray)
	case resourcepb.ResourceSearchField_DOUBLE:
		return searchScalarOrArray(value.DoubleValues, field.IsArray)
	case resourcepb.ResourceSearchField_BOOLEAN:
		return searchScalarOrArray(value.BooleanValues, field.IsArray)
	default:
		return nil, fmt.Errorf("unsupported type %s", field.Type)
	}
}

func searchScalarOrArray[T any](values []T, isArray bool) (any, error) {
	if isArray {
		return values, nil
	}
	if len(values) != 1 {
		return nil, fmt.Errorf("scalar has %d values", len(values))
	}
	return values[0], nil
}
