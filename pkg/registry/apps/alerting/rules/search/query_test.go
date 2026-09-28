package search

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"k8s.io/apimachinery/pkg/runtime/schema"

	rulesmanifest "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/manifestdata"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
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

// TestResultColumnsCoverSearchFields asserts the result table carries exactly
// the fields the kinds declare, plus the two standard fields the document
// builder supplies. A field added to the CUE but not here would be indexed and
// filterable on the unified backend yet missing from every hit, and a name here
// that no kind declares has no column definition to encode against.
func TestResultColumnsCoverSearchFields(t *testing.T) {
	want := map[string]struct{}{fieldTitle: {}, fieldFolder: {}}
	provider := resource.NewManifestBackedProvider(rulesmanifest.LocalManifest().ManifestData)
	for _, gr := range []schema.GroupResource{
		alertrule.ResourceInfo.GroupResource(),
		recordingrule.ResourceInfo.GroupResource(),
	} {
		for _, sfd := range provider.Fields(schema.GroupVersionResource{Group: gr.Group, Resource: gr.Resource}) {
			want[sfd.Name] = struct{}{}
		}
	}

	names := make([]string, 0, len(want))
	for name := range want {
		names = append(names, name)
	}
	assert.ElementsMatch(t, names, resultColumns)
}

// TestSearchFieldsAgreeAcrossKinds guards the fields both rule kinds declare.
// validateCrossVersionConsistency enforces this across versions of one kind,
// but nothing enforces it across the two kinds, and buildSearchColumns resolves
// a conflict by taking the first declaration. A divergence would therefore give
// one kind's rows the other kind's column type: the legacy encoder would reject
// the value at request time, and a unified hit would decode against a type it
// was not encoded with.
func TestSearchFieldsAgreeAcrossKinds(t *testing.T) {
	provider := resource.NewManifestBackedProvider(rulesmanifest.LocalManifest().ManifestData)
	fieldsFor := func(gr schema.GroupResource) map[string]resource.SearchFieldDefinition {
		out := map[string]resource.SearchFieldDefinition{}
		for _, sfd := range provider.Fields(schema.GroupVersionResource{Group: gr.Group, Resource: gr.Resource}) {
			out[sfd.Name] = sfd
		}
		return out
	}

	alert := fieldsFor(alertrule.ResourceInfo.GroupResource())
	recording := fieldsFor(recordingrule.ResourceInfo.GroupResource())

	shared := 0
	for name, a := range alert {
		r, ok := recording[name]
		if !ok {
			continue
		}
		shared++
		assert.Equal(t, a.Type, r.Type, "field %q has a different type on each kind", name)
		assert.Equal(t, a.Array, r.Array, "field %q is an array on only one kind", name)
		assert.ElementsMatch(t, a.Capabilities, r.Capabilities, "field %q has different capabilities on each kind", name)
	}
	// Guard the guard: if the kinds stop sharing fields entirely this test would
	// pass vacuously.
	require.NotZero(t, shared, "expected the rule kinds to share search fields")
}

// TestResultTableBuiltCleanly asserts the result table assembled without
// dropping columns. Construction degrades rather than panicking, so a
// declaration gap would otherwise only show up as a missing field at runtime.
func TestResultTableBuiltCleanly(t *testing.T) {
	require.NoError(t, results.err)
	require.Empty(t, results.skipped)
	require.Len(t, results.defs, len(resultColumns))
	require.Len(t, results.encoders, len(resultColumns))
}

// TestResultColumnsAreTyped pins that the legacy table declares the same column
// types the unified index does. Declaring everything as a string would still
// round-trip through this package's own reader, but a hit from the unified
// backend would then decode against different types.
func TestResultColumnsAreTyped(t *testing.T) {
	byName := map[string]*resourcepb.ResourceTableColumnDefinition{}
	for _, col := range resultColumnDefinitions() {
		byName[col.Name] = col
	}

	require.Equal(t, resourcepb.ResourceTableColumnDefinition_BOOLEAN, byName[fieldPaused].Type)
	require.Equal(t, resourcepb.ResourceTableColumnDefinition_INT64, byName[fieldPanelID].Type)
	require.True(t, byName[fieldLabels].IsArray, "labels is indexed as flattened terms")
	require.True(t, byName[fieldDatasourceUIDs].IsArray)
	require.False(t, byName[fieldAnnotations].IsArray, "annotations is a whole JSON object")
}
