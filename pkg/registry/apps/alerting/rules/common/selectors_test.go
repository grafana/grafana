package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/labels"
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
