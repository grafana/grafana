package tag

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseTagPairs(t *testing.T) {
	t.Run("Can parse one empty tag", func(t *testing.T) {
		tags := ParseTagPairs([]string{""})
		require.Empty(t, tags)
	})

	t.Run("Can parse valid tags", func(t *testing.T) {
		tags := ParseTagPairs([]string{"outage", "type:outage", "error"})
		require.Len(t, tags, 3)
		assert.Equal(t, "outage", tags[0].Key)
		assert.Empty(t, tags[0].Value)
		assert.Equal(t, "type", tags[1].Key)
		assert.Equal(t, "outage", tags[1].Value)
		assert.Equal(t, "error", tags[2].Key)
		assert.Empty(t, tags[2].Value)
	})

	t.Run("Can parse tags with spaces", func(t *testing.T) {
		tags := ParseTagPairs([]string{" outage ", " type : outage ", "error "})
		require.Len(t, tags, 3)
		assert.Equal(t, "outage", tags[0].Key)
		assert.Empty(t, tags[0].Value)
		assert.Equal(t, "type", tags[1].Key)
		assert.Equal(t, "outage", tags[1].Value)
		assert.Equal(t, "error", tags[2].Key)
		assert.Empty(t, tags[2].Value)
	})

	t.Run("Can parse empty tags", func(t *testing.T) {
		tags := ParseTagPairs([]string{" outage ", "", "", ":", "type : outage ", "error ", "", ""})
		require.Len(t, tags, 3)
		assert.Equal(t, "outage", tags[0].Key)
		assert.Empty(t, tags[0].Value)
		assert.Equal(t, "type", tags[1].Key)
		assert.Equal(t, "outage", tags[1].Value)
		assert.Equal(t, "error", tags[2].Key)
		assert.Empty(t, tags[2].Value)
	})

	t.Run("Can parse tags with extra colons", func(t *testing.T) {
		tags := ParseTagPairs([]string{" outage", "type : outage:outage2 :outage3 ", "error :"})
		require.Len(t, tags, 3)
		assert.Equal(t, "outage", tags[0].Key)
		assert.Empty(t, tags[0].Value)
		assert.Equal(t, "type", tags[1].Key)
		assert.Equal(t, "outage", tags[1].Value)
		assert.Equal(t, "error", tags[2].Key)
		assert.Empty(t, tags[2].Value)
	})

	t.Run("Can parse tags that contains key and values with spaces", func(t *testing.T) {
		tags := ParseTagPairs([]string{" outage 1", "type 1: outage 1 ", "has error "})
		require.Len(t, tags, 3)
		assert.Equal(t, "outage 1", tags[0].Key)
		assert.Empty(t, tags[0].Value)
		assert.Equal(t, "type 1", tags[1].Key)
		assert.Equal(t, "outage 1", tags[1].Value)
		assert.Equal(t, "has error", tags[2].Key)
		assert.Empty(t, tags[2].Value)
	})

	t.Run("Can filter out duplicate tags", func(t *testing.T) {
		tags := ParseTagPairs([]string{"test", "test", "key:val1", "key:val2"})
		require.Len(t, tags, 3)
		assert.Equal(t, "test", tags[0].Key)
		assert.Empty(t, tags[0].Value)
		assert.Equal(t, "key", tags[1].Key)
		assert.Equal(t, "val1", tags[1].Value)
		assert.Equal(t, "key", tags[2].Key)
		assert.Equal(t, "val2", tags[2].Value)
	})

	t.Run("Nil tag returns an allocated but empty pair", func(t *testing.T) {
		tags := ParseTagPairs(nil)
		require.NotNil(t, tags)
		require.Empty(t, tags)
	})
}

func TestJoinTagPairs(t *testing.T) {
	t.Run("Can join tag pairs", func(t *testing.T) {
		tagPairs := []*Tag{
			{Key: "key1", Value: "val1"},
			{Key: "key2", Value: ""},
			{Key: "key3"},
		}
		tags := JoinTagPairs(tagPairs)
		require.Len(t, tags, 3)
		assert.Equal(t, "key1:val1", tags[0])
		assert.Equal(t, "key2", tags[1])
		assert.Equal(t, "key3", tags[2])
	})
}
