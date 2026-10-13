package search

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestParseLabelMatcher(t *testing.T) {
	tests := map[string]labelMatcher{
		"team=a":            {key: "team", value: "a", op: matchEquals},
		"team!=a":           {key: "team", value: "a", op: matchNotEquals},
		"__grafana_origin":  {key: "__grafana_origin", op: matchExists},
		"!__grafana_origin": {key: "__grafana_origin", op: matchNotExists},
	}
	for in, want := range tests {
		assert.Equal(t, want, parseLabelMatcher(in), in)
		// matchers must survive the round trip through the labels-field requirement.
		got := requirementToLabelMatcher(labelMatcherRequirement(want))
		require.Equal(t, want, got, in)
	}
}

func TestMatchLabels(t *testing.T) {
	rule := &ngmodels.AlertRule{Labels: map[string]string{"team": "a", "__grafana_origin": "plugin/x"}}

	matchers := func(vals ...string) []labelMatcher {
		out := make([]labelMatcher, 0, len(vals))
		for _, v := range vals {
			out = append(out, parseLabelMatcher(v))
		}
		return out
	}
	assert.True(t, matchLabels(rule, matchers("team=a")))
	assert.False(t, matchLabels(rule, matchers("team=b")))
	assert.True(t, matchLabels(rule, matchers("team!=b")))
	assert.True(t, matchLabels(rule, matchers("__grafana_origin")))
	assert.False(t, matchLabels(rule, matchers("!__grafana_origin")))

	// matchers conjoin: every one must be satisfied
	assert.False(t, matchLabels(rule, matchers("team=a", "missing")))
	assert.True(t, matchLabels(rule, matchers("team=a", "__grafana_origin")))
	assert.False(t, matchLabels(rule, matchers("team=a", "team=b")))

	// no matchers constrains nothing
	assert.True(t, matchLabels(rule, nil))
}
