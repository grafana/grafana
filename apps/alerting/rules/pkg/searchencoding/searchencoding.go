// Package searchencoding defines how a rule's map-shaped fields are
// represented in the search index and on a search hit.
package searchencoding

import (
	"encoding/json"
	"sort"
	"strings"
)

// LabelTerms flattens a rule's labels into the indexed representation: a bare
// "key" term so an existence matcher can hit, plus a "key=value" term so an
// equality matcher can filter using it.
func LabelTerms[T ~string](labels map[string]T) []string {
	if len(labels) == 0 {
		return nil
	}
	out := make([]string, 0, len(labels)*2)
	for k, v := range labels {
		out = append(out, k, k+"="+string(v))
	}
	return out
}

// LabelMap rebuilds the label map from the flattened terms produced by
// LabelTerms.
//
// Splitting each term on its first "=" would be wrong when a label key itself
// contains "=", because the bare existence term for key "a=b" is then
// indistinguishable from the equality term for key "a" with value "b". Nothing
// validates rule label names — sanitizeLabelName in the external Alertmanager
// sender exists precisely because names that are not valid Prometheus label
// names reach storage — so that input is reachable.
//
// LabelTerms always emits both forms for every label, so a term is a key
// exactly when some other term extends it by "=". Candidates are tried longest
// first and each term is consumed once, which resolves the case where one key
// is a "k=v"-shaped prefix of another: given {"a": "x", "a=b": "y"} the term
// "a=b" is claimed as a key by "a=b=y" before "a" can mistake it for its own
// value, leaving "a=x" for "a".
//
// Ties in length are broken lexicographically so the result never depends on
// the order bleve happens to return the terms in.
func LabelMap(terms []string) map[string]string {
	if len(terms) == 0 {
		return nil
	}

	order := make([]int, len(terms))
	for i := range order {
		order[i] = i
	}
	sort.Slice(order, func(a, b int) bool { return before(terms[order[a]], terms[order[b]]) })

	used := make([]bool, len(terms))
	out := make(map[string]string, len(terms)/2)
	for _, ki := range order {
		if used[ki] {
			continue
		}
		prefix := terms[ki] + "="
		best := -1
		for vi, candidate := range terms {
			if used[vi] || vi == ki || !strings.HasPrefix(candidate, prefix) {
				continue
			}
			// Shortest extension first: it is the value of this key rather than
			// of a longer key that also starts with it.
			if best == -1 || shortest(candidate, terms[best]) {
				best = vi
			}
		}
		if best == -1 {
			continue
		}
		used[ki], used[best] = true, true
		out[terms[ki]] = terms[best][len(prefix):]
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// before orders terms longest first, then lexicographically.
func before(a, b string) bool {
	if len(a) != len(b) {
		return len(a) > len(b)
	}
	return a < b
}

// shortest orders terms shortest first, then lexicographically.
func shortest(a, b string) bool {
	if len(a) != len(b) {
		return len(a) < len(b)
	}
	return a < b
}

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
