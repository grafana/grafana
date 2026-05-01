package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

func TestParseLabelSelectorFilter(t *testing.T) {
	const key = "grafana.com/group"

	t.Run("nil selector returns empty filter", func(t *testing.T) {
		filter, err := ParseLabelSelectorFilter(nil, key)
		require.NoError(t, err)
		assert.Nil(t, filter.Exists)
		assert.Empty(t, filter.Include)
		assert.Empty(t, filter.Exclude)
	})

	t.Run("Everything selector returns empty filter", func(t *testing.T) {
		filter, err := ParseLabelSelectorFilter(labels.Everything(), key)
		require.NoError(t, err)
		assert.Nil(t, filter.Exists)
		assert.Empty(t, filter.Include)
		assert.Empty(t, filter.Exclude)
	})

	t.Run("Equals operator populates Include", func(t *testing.T) {
		sel, err := labels.Parse(key + "=value")
		require.NoError(t, err)
		filter, err := ParseLabelSelectorFilter(sel, key)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"value"}, filter.Include)
		assert.Empty(t, filter.Exclude)
		assert.Nil(t, filter.Exists)
	})

	t.Run("DoubleEquals operator populates Include", func(t *testing.T) {
		sel, err := labels.Parse(key + "==value")
		require.NoError(t, err)
		filter, err := ParseLabelSelectorFilter(sel, key)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"value"}, filter.Include)
		assert.Empty(t, filter.Exclude)
		assert.Nil(t, filter.Exists)
	})

	t.Run("In operator populates Include with multiple values", func(t *testing.T) {
		sel, err := labels.Parse(key + " in (v1,v2)")
		require.NoError(t, err)
		filter, err := ParseLabelSelectorFilter(sel, key)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"v1", "v2"}, filter.Include)
		assert.Empty(t, filter.Exclude)
		assert.Nil(t, filter.Exists)
	})

	t.Run("NotEquals operator populates Exclude", func(t *testing.T) {
		sel, err := labels.Parse(key + "!=value")
		require.NoError(t, err)
		filter, err := ParseLabelSelectorFilter(sel, key)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"value"}, filter.Exclude)
		assert.Empty(t, filter.Include)
		assert.Nil(t, filter.Exists)
	})

	t.Run("NotIn operator populates Exclude with multiple values", func(t *testing.T) {
		sel, err := labels.Parse(key + " notin (v1,v2)")
		require.NoError(t, err)
		filter, err := ParseLabelSelectorFilter(sel, key)
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"v1", "v2"}, filter.Exclude)
		assert.Empty(t, filter.Include)
		assert.Nil(t, filter.Exists)
	})

	t.Run("Exists operator sets Exists=true", func(t *testing.T) {
		sel, err := labels.Parse(key)
		require.NoError(t, err)
		filter, err := ParseLabelSelectorFilter(sel, key)
		require.NoError(t, err)
		require.NotNil(t, filter.Exists)
		assert.True(t, *filter.Exists)
		assert.Empty(t, filter.Include)
		assert.Empty(t, filter.Exclude)
	})

	t.Run("DoesNotExist operator sets Exists=false", func(t *testing.T) {
		sel, err := labels.Parse("!" + key)
		require.NoError(t, err)
		filter, err := ParseLabelSelectorFilter(sel, key)
		require.NoError(t, err)
		require.NotNil(t, filter.Exists)
		assert.False(t, *filter.Exists)
		assert.Empty(t, filter.Include)
		assert.Empty(t, filter.Exclude)
	})

	t.Run("requirement for a different key returns empty filter", func(t *testing.T) {
		sel, err := labels.Parse("other.key=value")
		require.NoError(t, err)
		filter, err := ParseLabelSelectorFilter(sel, key)
		require.NoError(t, err)
		assert.Nil(t, filter.Exists)
		assert.Empty(t, filter.Include)
		assert.Empty(t, filter.Exclude)
	})
}

func TestAccumulateFieldSelectorFilter(t *testing.T) {
	t.Run("Equals appends to Include", func(t *testing.T) {
		f := provisioning.ListRuleStringFilter{}
		err := AccumulateFieldSelectorFilter(&f, fields.Requirement{Field: "spec.title", Operator: selection.Equals, Value: "a"}, nil)
		require.NoError(t, err)
		assert.Equal(t, []string{"a"}, f.Include)
		assert.Empty(t, f.Exclude)
	})

	t.Run("DoubleEquals appends to Include", func(t *testing.T) {
		f := provisioning.ListRuleStringFilter{}
		err := AccumulateFieldSelectorFilter(&f, fields.Requirement{Field: "spec.title", Operator: selection.DoubleEquals, Value: "a"}, nil)
		require.NoError(t, err)
		assert.Equal(t, []string{"a"}, f.Include)
	})

	t.Run("NotEquals appends to Exclude", func(t *testing.T) {
		f := provisioning.ListRuleStringFilter{}
		err := AccumulateFieldSelectorFilter(&f, fields.Requirement{Field: "spec.title", Operator: selection.NotEquals, Value: "a"}, nil)
		require.NoError(t, err)
		assert.Empty(t, f.Include)
		assert.Equal(t, []string{"a"}, f.Exclude)
	})

	t.Run("multiple Equals on same field bucket into Include (IN semantics)", func(t *testing.T) {
		f := provisioning.ListRuleStringFilter{}
		require.NoError(t, AccumulateFieldSelectorFilter(&f, fields.Requirement{Field: "spec.title", Operator: selection.Equals, Value: "a"}, nil))
		require.NoError(t, AccumulateFieldSelectorFilter(&f, fields.Requirement{Field: "spec.title", Operator: selection.Equals, Value: "b"}, nil))
		assert.ElementsMatch(t, []string{"a", "b"}, f.Include)
	})

	t.Run("validate is invoked on the value", func(t *testing.T) {
		f := provisioning.ListRuleStringFilter{}
		err := AccumulateFieldSelectorFilter(&f, fields.Requirement{Field: "spec.foo", Operator: selection.Equals, Value: "x"}, ValidateOneOf("spec.foo", []string{"y"}))
		require.Error(t, err)
		assert.Empty(t, f.Include)
	})

	t.Run("In operator is rejected (field selectors do not support it)", func(t *testing.T) {
		f := provisioning.ListRuleStringFilter{}
		err := AccumulateFieldSelectorFilter(&f, fields.Requirement{Field: "spec.title", Operator: selection.In, Value: "a"}, nil)
		require.Error(t, err)
	})
}
