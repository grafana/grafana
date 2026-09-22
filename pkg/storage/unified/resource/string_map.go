package resource

import (
	"slices"
	"strings"
)

// StringMapTerms encodes a string map as stable keyword terms. Each entry has
// a bare key term for existence checks and a key=value term for value checks.
func StringMapTerms(values map[string]string) []string {
	if len(values) == 0 {
		return nil
	}
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	terms := make([]string, 0, len(values)*2)
	for _, key := range keys {
		terms = append(terms, key, key+"="+values[key])
	}
	return terms
}

// StringMapFromTerms reconstructs a string map from StringMapTerms' wire and
// index representation. Keys containing '=' remain round-trippable even though
// keyed predicates cannot address them.
func StringMapFromTerms(terms []string) map[string]string {
	if len(terms) == 0 {
		return nil
	}

	order := make([]int, len(terms))
	for i := range order {
		order[i] = i
	}
	slices.SortFunc(order, func(a, b int) int {
		left, right := terms[a], terms[b]
		if len(left) != len(right) {
			return len(right) - len(left)
		}
		return strings.Compare(left, right)
	})

	used := make([]bool, len(terms))
	values := make(map[string]string, len(terms)/2)
	for _, keyIndex := range order {
		if used[keyIndex] {
			continue
		}
		prefix := terms[keyIndex] + "="
		valueIndex := -1
		for i, candidate := range terms {
			if used[i] || i == keyIndex || !strings.HasPrefix(candidate, prefix) {
				continue
			}
			if valueIndex == -1 || len(candidate) < len(terms[valueIndex]) ||
				(len(candidate) == len(terms[valueIndex]) && candidate < terms[valueIndex]) {
				valueIndex = i
			}
		}
		if valueIndex == -1 {
			continue
		}
		used[keyIndex], used[valueIndex] = true, true
		values[terms[keyIndex]] = terms[valueIndex][len(prefix):]
	}
	if len(values) == 0 {
		return nil
	}
	return values
}

// StringMapFromWireValue decodes the string-array representation used by the
// search service. Protobuf-native callers provide []string; JSON/table decoding
// may produce []any instead.
func StringMapFromWireValue(value any) (map[string]string, bool) {
	var terms []string
	switch v := value.(type) {
	case []string:
		terms = v
	case []any:
		terms = make([]string, len(v))
		for i, item := range v {
			term, ok := item.(string)
			if !ok {
				return nil, false
			}
			terms[i] = term
		}
	default:
		return nil, false
	}
	if len(terms) == 0 {
		return map[string]string{}, true
	}
	return StringMapFromTerms(terms), true
}
