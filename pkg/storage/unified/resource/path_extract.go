package resource

import "math"

// coerceToFieldShape converts the raw path value into the
// shape declared by the SearchFieldDefinition. Returns (nil, false) on type
// mismatch or on a nil input; the caller is expected to drop the field and
// log a warning.
//
// Number handling is shaped by unstructured.Unstructured.UnmarshalJSON, which
// preserves integer JSON values as int64 and fractional values as float64.
// Int64 accepts an int64 directly or a float64 that rounds (half away from
// zero) into the int64 range; fractional input is rounded rather than
// rejected. Double accepts a float64 directly or an int64 (numbers without a
// decimal point still represent a valid double).
func coerceToFieldShape(val any, t SearchFieldType, isArray bool) (any, bool) {
	if val == nil {
		return nil, false
	}
	if !isArray {
		return coerceScalar(val, t)
	}
	slice, ok := val.([]any)
	if !ok {
		return nil, false
	}
	out := make([]any, 0, len(slice))
	for _, elem := range slice {
		// Nil entries come from array-projection elements whose sub-path was
		// missing. Skip them so the array stays indexed
		// with the elements that did resolve, rather than dropping the
		// whole field on a single missing sub-path.
		if elem == nil {
			continue
		}
		coerced, ok := coerceScalar(elem, t)
		if !ok {
			return nil, false
		}
		out = append(out, coerced)
	}
	return out, true
}

// maxInt64AsFloat is the smallest float64 strictly greater than math.MaxInt64.
// math.MaxInt64 (2^63 - 1) has no exact float64 representation, so the safe
// upper bound for a rounded-to-int64 conversion is 2^63 (strict-less).
const maxInt64AsFloat float64 = 1 << 63

func coerceScalar(val any, t SearchFieldType) (any, bool) {
	switch t {
	case SearchFieldTypeUnknown:
		return nil, false
	case SearchFieldTypeString, SearchFieldTypeDate:
		s, ok := val.(string)
		return s, ok
	case SearchFieldTypeBoolean:
		b, ok := val.(bool)
		return b, ok
	case SearchFieldTypeInt64:
		switch v := val.(type) {
		case int64:
			return v, true
		case float64:
			// Round to nearest, half away from zero (3.7 → 4, 3.4 → 3,
			// -3.7 → -4). Range-check explicitly: Go's float-to-int64
			// conversion is implementation-defined for out-of-range
			// values, and rejecting is safer than corrupting.
			if math.IsNaN(v) || math.IsInf(v, 0) {
				return nil, false
			}
			rounded := math.Round(v)
			if rounded < float64(math.MinInt64) || rounded >= maxInt64AsFloat {
				return nil, false
			}
			return int64(rounded), true
		}
		return nil, false
	case SearchFieldTypeDouble:
		switch v := val.(type) {
		case float64:
			return v, true
		case int64:
			return float64(v), true
		}
		return nil, false
	}
	return nil, false
}
