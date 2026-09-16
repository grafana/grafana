package fieldpath

import (
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

const arrayProjection = "[*]"

// Extract evaluates a dot path with [*] array projections.
// Missing fields and JSON nulls return nil. Projections flatten array results in source order.
// When projecting a sub-field, non-object elements and missing paths contribute nil entries.
// Empty paths and incompatible traversal types return errors.
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
