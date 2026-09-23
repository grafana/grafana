package fieldpath

import (
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

const arrayProjection = "[*]"

// Extract evaluates path against the given unstructured object. Three
// shapes are supported:
//
//   - Plain dot path ("spec.email"): traverses the object via
//     unstructured.NestedFieldNoCopy. The returned value reflects whatever
//     sits at the path — a scalar, a slice, or a map. The caller decides
//     which value types it accepts; this function does not coerce values.
//   - Scalar-array passthrough ("spec.tags"): identical to the plain dot
//     path; the result happens to be a slice of scalars. Array values are
//     returned unchanged when no projection is used.
//   - Array projection ("spec.members[*].name"): traverses to the slice
//     before "[*]", then evaluates the remainder against each element.
//     The remainder may contain further projections, as in
//     "spec.groups[*].members[*].name". Each projection flattens array-valued
//     results into []any in source order, so "spec.members[*].tags" also
//     collects the elements of each member's tags array. Missing or null
//     values contribute nil entries, as do non-object elements when a
//     sub-field is requested. Callers can skip those entries without
//     dropping the values collected from other elements.
//
// Returns (nil, nil) when a dot traversal resolves to a missing field or
// JSON null, including before a projection. Within a projection, those
// values appear as nil entries in the result. An error is returned for an
// empty path, a non-slice at a [*] step, or an incompatible intermediate
// type during dot traversal. Traversal errors within a projection fail
// the entire extraction.
func Extract(obj map[string]any, path string) (any, error) {
	if path == "" {
		return nil, fmt.Errorf("empty path")
	}

	before, after, ok0 := strings.Cut(path, arrayProjection)
	if !ok0 {
		return extractDotPath(obj, path)
	}

	pre := strings.TrimSuffix(before, ".")
	post := strings.TrimPrefix(after, ".")

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
		sub := elem
		if post != "" {
			elemMap, ok := elem.(map[string]any)
			if !ok {
				// A non-object cannot supply a sub-field, but other elements can.
				out = append(out, nil)
				continue
			}
			sub, err = Extract(elemMap, post)
			if err != nil {
				return nil, fmt.Errorf("path %q: %w", path, err)
			}
		}
		if values, ok := sub.([]any); ok {
			out = append(out, values...)
		} else {
			out = append(out, sub)
		}
	}
	return out, nil
}

func extractDotPath(obj map[string]any, path string) (any, error) {
	val, _, err := unstructured.NestedFieldNoCopy(obj, strings.Split(path, ".")...)
	return val, err
}
