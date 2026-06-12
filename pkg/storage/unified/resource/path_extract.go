package resource

import (
	"fmt"
	"math"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// arrayProjection is the substring that marks an array projection step in a
// declared search field path. The current evaluator supports a single
// projection per path: everything before it is dot-traversed to a slice;
// everything after it is dot-traversed against each element of that slice.
const arrayProjection = "[*]"

// extractPath evaluates path against the given unstructured object. Three
// shapes are supported:
//
//   - Plain dot path ("spec.email"): traverses the object via
//     unstructured.NestedFieldNoCopy. The returned value may be a scalar, a
//     slice, or a map; the caller decides what to do with it.
//   - Scalar-array passthrough ("spec.tags"): identical to the plain dot
//     path; the result happens to be a slice of scalars.
//   - Array projection ("spec.members[*].name"): traverses to the slice
//     before "[*]", then evaluates the remainder against each element. The
//     returned value is []any with one entry per source element. Elements
//     that fail their own traversal contribute nil.
//
// Returns (nil, nil) when the path resolves to a missing field at any step
// (or to a JSON null). The caller drops such fields. An error is returned
// only for malformed paths or type mismatches during projection (a non-slice
// found at the [*] step).
func extractPath(obj map[string]any, path string) (any, error) {
	if path == "" {
		return nil, fmt.Errorf("empty path")
	}

	idx := strings.Index(path, arrayProjection)
	if idx < 0 {
		return extractDotPath(obj, path)
	}

	pre := strings.TrimSuffix(path[:idx], ".")
	post := strings.TrimPrefix(path[idx+len(arrayProjection):], ".")

	if strings.Contains(post, arrayProjection) {
		return nil, fmt.Errorf("path %q: only one %s projection is supported", path, arrayProjection)
	}

	val, err := extractDotPath(obj, pre)
	if err != nil || val == nil {
		return nil, err
	}

	slice, ok := val.([]any)
	if !ok {
		return nil, fmt.Errorf("path %q: expected slice at %q, got %T", path, pre, val)
	}

	out := make([]any, 0, len(slice))
	for _, elem := range slice {
		if post == "" {
			out = append(out, elem)
			continue
		}
		elemMap, ok := elem.(map[string]any)
		if !ok {
			// Non-object element under a projection that wants a sub-field.
			// Contribute nil rather than fail the whole extraction.
			out = append(out, nil)
			continue
		}
		sub, err := extractDotPath(elemMap, post)
		if err != nil {
			return nil, fmt.Errorf("path %q: %w", path, err)
		}
		out = append(out, sub)
	}
	return out, nil
}

func extractDotPath(obj map[string]any, path string) (any, error) {
	val, _, err := unstructured.NestedFieldNoCopy(obj, strings.Split(path, ".")...)
	return val, err
}

// coerceToFieldShape converts the raw value produced by extractPath into the
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
