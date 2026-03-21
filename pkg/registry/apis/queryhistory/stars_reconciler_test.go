package queryhistory

import (
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateStarCount(t *testing.T) {
	t.Run("star from zero triggers TTL change", func(t *testing.T) {
		labels := map[string]string{}
		labels, ttlChanged := updateStarCount(labels, 1)
		assert.True(t, ttlChanged)
		assert.Equal(t, "1", labels[LabelStarCount])
	})

	t.Run("second star does not trigger TTL change", func(t *testing.T) {
		labels := map[string]string{LabelStarCount: "1"}
		labels, ttlChanged := updateStarCount(labels, 1)
		assert.False(t, ttlChanged)
		assert.Equal(t, "2", labels[LabelStarCount])
	})

	t.Run("unstar to zero triggers TTL change", func(t *testing.T) {
		labels := map[string]string{LabelStarCount: "1"}
		labels, ttlChanged := updateStarCount(labels, -1)
		assert.True(t, ttlChanged)
		assert.Equal(t, "0", labels[LabelStarCount])
	})

	t.Run("unstar from two does not trigger TTL change", func(t *testing.T) {
		labels := map[string]string{LabelStarCount: "2"}
		labels, ttlChanged := updateStarCount(labels, -1)
		assert.False(t, ttlChanged)
		assert.Equal(t, "1", labels[LabelStarCount])
	})

	t.Run("nil labels are handled", func(t *testing.T) {
		labels, ttlChanged := updateStarCount(nil, 1)
		assert.True(t, ttlChanged)
		assert.Equal(t, "1", labels[LabelStarCount])
	})

	t.Run("count does not go below zero", func(t *testing.T) {
		labels := map[string]string{LabelStarCount: "0"}
		labels, ttlChanged := updateStarCount(labels, -1)
		assert.False(t, ttlChanged) // 0 → 0 is not a transition
		assert.Equal(t, "0", labels[LabelStarCount])
	})
}

func TestSetExpiresAt(t *testing.T) {
	labels := setExpiresAt(nil, DefaultTTL)
	assert.Contains(t, labels, LabelExpiresAt)

	ts, err := strconv.ParseInt(labels[LabelExpiresAt], 10, 64)
	require.NoError(t, err)

	expected := time.Now().Add(DefaultTTL).Unix()
	assert.InDelta(t, expected, ts, 2)
}

func TestRemoveExpiresAt(t *testing.T) {
	labels := map[string]string{LabelExpiresAt: "1700000000"}
	labels = removeExpiresAt(labels)
	assert.NotContains(t, labels, LabelExpiresAt)
}
