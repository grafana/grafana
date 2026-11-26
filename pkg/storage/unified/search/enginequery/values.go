package enginequery

import (
	"fmt"
	"math"
	"reflect"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func DecodeValues(columns []*resourcepb.ResourceSearchField, values []*resourcepb.ResourceSearchValue) (map[string]any, error) {
	if len(values) == 0 {
		return nil, nil
	}
	fields := make(map[string]any, len(values))
	for _, v := range values {
		if v == nil || uint64(v.FieldIndex) >= uint64(len(columns)) {
			return nil, fmt.Errorf("value has no matching field declaration")
		}
		col := columns[v.FieldIndex]
		if col == nil {
			return nil, fmt.Errorf("missing field declaration for value at index %d", v.FieldIndex)
		}
		if _, exists := fields[col.Name]; exists {
			return nil, fmt.Errorf("duplicate value for field %q", col.Name)
		}
		var value any
		var n int
		switch col.Type {
		case resourcepb.ResourceSearchField_STRING:
			value, n = engineValue(v.StringValues, col.IsArray)
		case resourcepb.ResourceSearchField_INT64, resourcepb.ResourceSearchField_DATE:
			value, n = engineValue(v.Int64Values, col.IsArray)
		case resourcepb.ResourceSearchField_DOUBLE:
			value, n = engineValue(v.DoubleValues, col.IsArray)
		case resourcepb.ResourceSearchField_BOOLEAN:
			value, n = engineValue(v.BooleanValues, col.IsArray)
		case resourcepb.ResourceSearchField_UNSPECIFIED:
			return nil, fmt.Errorf("missing type for field %q", col.Name)
		}
		if value == nil || n != len(v.StringValues)+len(v.Int64Values)+len(v.DoubleValues)+len(v.BooleanValues) {
			return nil, fmt.Errorf("wrong value type or cardinality for field %q", col.Name)
		}
		fields[col.Name] = value
	}
	return fields, nil
}

func engineValue[T any](values []T, array bool) (any, int) {
	if array {
		return append([]T{}, values...), len(values)
	}
	if len(values) != 1 {
		return nil, len(values)
	}
	return values[0], 1
}

func FieldValueType(fieldType resource.SearchFieldType) (resourcepb.ResourceSearchField_Type, error) {
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

func NewSearchResultValue(
	fieldIndex uint32,
	definition resource.SearchFieldDefinition,
	value any,
) (*resourcepb.ResourceSearchValue, error) {
	values := FlattenSearchResultValue(value)
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

func FlattenSearchResultValue(value any) []any {
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
