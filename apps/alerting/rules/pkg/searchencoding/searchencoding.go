// Package searchencoding defines alerting-specific search value encodings.
package searchencoding

import "encoding/json"

// AnnotationsJSON encodes rule annotations as a JSON object string for display,
// or "" when there are none. Annotations are display-only, so unlike labels
// they are stored whole rather than flattened into matchable terms.
func AnnotationsJSON[T ~string](annotations map[string]T) string {
	if len(annotations) == 0 {
		return ""
	}
	m := make(map[string]string, len(annotations))
	for k, v := range annotations {
		m[k] = string(v)
	}
	b, err := json.Marshal(m)
	if err != nil {
		return ""
	}
	return string(b)
}
