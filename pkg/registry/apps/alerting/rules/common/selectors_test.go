package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
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

func TestParseListMode(t *testing.T) {
	t.Run("nil selector returns normal mode", func(t *testing.T) {
		mode, name, err := ParseListMode(nil, nil)
		require.NoError(t, err)
		assert.Equal(t, ListModeNormal, mode)
		assert.Empty(t, name)
	})

	t.Run("non-reserved label returns normal mode", func(t *testing.T) {
		sel, err := labels.Parse("foo=bar")
		require.NoError(t, err)
		mode, name, err := ParseListMode(sel, nil)
		require.NoError(t, err)
		assert.Equal(t, ListModeNormal, mode)
		assert.Empty(t, name)
	})

	t.Run("trash label returns trash mode", func(t *testing.T) {
		sel, err := labels.Parse(utils.LabelKeyGetTrash + "=true")
		require.NoError(t, err)
		mode, name, err := ParseListMode(sel, nil)
		require.NoError(t, err)
		assert.Equal(t, ListModeTrash, mode)
		assert.Empty(t, name)
	})

	t.Run("trash label rejects values other than true", func(t *testing.T) {
		sel, err := labels.Parse(utils.LabelKeyGetTrash + "=false")
		require.NoError(t, err)
		_, _, err = ParseListMode(sel, nil)
		require.Error(t, err)
	})

	t.Run("history label requires metadata.name field selector", func(t *testing.T) {
		sel, err := labels.Parse(utils.LabelKeyGetHistory + "=true")
		require.NoError(t, err)

		_, _, err = ParseListMode(sel, nil)
		require.Error(t, err)

		fs, err := fields.ParseSelector("spec.title=foo")
		require.NoError(t, err)
		_, _, err = ParseListMode(sel, fs)
		require.Error(t, err)

		fs, err = fields.ParseSelector("metadata.name=rule-uid")
		require.NoError(t, err)
		mode, name, err := ParseListMode(sel, fs)
		require.NoError(t, err)
		assert.Equal(t, ListModeHistory, mode)
		assert.Equal(t, "rule-uid", name)
	})

	t.Run("reserved label combined with another label is rejected", func(t *testing.T) {
		sel, err := labels.Parse(utils.LabelKeyGetTrash + "=true,foo=bar")
		require.NoError(t, err)
		_, _, err = ParseListMode(sel, nil)
		require.Error(t, err)
	})

	t.Run("non-equality operator on reserved label is rejected", func(t *testing.T) {
		sel, err := labels.Parse(utils.LabelKeyGetTrash + " in (true)")
		require.NoError(t, err)
		_, _, err = ParseListMode(sel, nil)
		require.Error(t, err)
	})
}
