package searchencoding

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestLabelRoundTrip is the contract that lets the index hold flattened terms
// while a hit reports a map: whatever LabelTerms writes, LabelMap must recover.
func TestLabelRoundTrip(t *testing.T) {
	cases := map[string]map[string]string{
		"empty":                {},
		"single":               {"team": "a"},
		"multiple":             {"team": "a", "env": "prod", "severity": "page"},
		"empty value":          {"team": ""},
		"value with equals":    {"team": "a=b"},
		"value with only sign": {"team": "="},
		// Nothing validates rule label names, so "=" in a key is reachable.
		"key with equals": {"a=b": "c"},
		// The hard one: one key is a "k=v"-shaped prefix of another key.
		"key prefixes key": {"a": "x", "a=b": "y"},
		"overlapping pair": {"a": "b=c", "a=b": "c"},
	}

	for name, labels := range cases {
		t.Run(name, func(t *testing.T) {
			got := LabelMap(LabelTerms(labels))
			if len(labels) == 0 {
				assert.Nil(t, got)
				return
			}
			assert.Equal(t, labels, got)
		})
	}
}

// TestLabelMapIsOrderIndependent guards against the result depending on the
// order the index happens to return terms in.
func TestLabelMapIsOrderIndependent(t *testing.T) {
	labels := map[string]string{"a": "x", "a=b": "y", "team": "core"}
	terms := LabelTerms(labels)
	want := LabelMap(terms)
	require.Equal(t, labels, want)

	// every rotation of the term list must decode identically
	for i := range terms {
		rotated := append(append([]string{}, terms[i:]...), terms[:i]...)
		assert.Equal(t, want, LabelMap(rotated), "rotation %d", i)
	}
}

func TestLabelTermsShape(t *testing.T) {
	assert.Nil(t, LabelTerms(map[string]string(nil)))
	assert.Nil(t, LabelTerms(map[string]string{}))
	// a bare key term for existence matchers, a key=value term for equality
	assert.ElementsMatch(t, []string{"team", "team=a"}, LabelTerms(map[string]string{"team": "a"}))
}

func TestLabelMapIgnoresUnpairedTerms(t *testing.T) {
	// A bare key with no value term cannot be reconstructed; it is dropped
	// rather than reported with an empty value.
	assert.Nil(t, LabelMap([]string{"orphan"}))
	assert.Equal(t, map[string]string{"team": "a"}, LabelMap([]string{"orphan", "team", "team=a"}))
}

func TestAnnotationsJSON(t *testing.T) {
	assert.Equal(t, "", AnnotationsJSON(map[string]string(nil)))
	assert.Equal(t, "", AnnotationsJSON(map[string]string{}))
	assert.JSONEq(t, `{"summary":"cpu is high"}`, AnnotationsJSON(map[string]string{"summary": "cpu is high"}))
}

// TestLabelTermsAcceptsNamedStringTypes covers the generated spec types, whose
// label values are a named string type rather than string.
func TestLabelTermsAcceptsNamedStringTypes(t *testing.T) {
	type templateString string
	assert.ElementsMatch(t, []string{"team", "team=a"},
		LabelTerms(map[string]templateString{"team": "a"}))
}
