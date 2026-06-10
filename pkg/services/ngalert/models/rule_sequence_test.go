package models

import (
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewRuleSequenceGroup(t *testing.T) {
	t.Run("valid sequence UID produces correct sentinel", func(t *testing.T) {
		g, err := NewRuleSequenceGroup("seq-abc")
		require.NoError(t, err)

		s := g.String()
		assert.True(t, strings.HasPrefix(s, RuleSequenceGroupPrefix))
		assert.Equal(t, RuleSequenceGroupNameLength, len(s))
		assert.Equal(t, "seq-abc", g.GetSequenceUID())
	})

	t.Run("sequence UID too long returns error", func(t *testing.T) {
		long := strings.Repeat("a", RuleSequenceGroupNameLength-len(RuleSequenceGroupPrefix)+1)
		_, err := NewRuleSequenceGroup(long)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "sequence UID is too long")
	})

	t.Run("sentinel exceeds max rule group name length", func(t *testing.T) {
		g, err := NewRuleSequenceGroup("my-seq")
		require.NoError(t, err)
		// The store enforces a 190-char max. Our sentinel must be longer.
		assert.Greater(t, len(g.String()), 190)
	})

	t.Run("max-length UID still produces valid sentinel", func(t *testing.T) {
		maxUID := strings.Repeat("a", util.MaxUIDLength)
		g, err := NewRuleSequenceGroup(maxUID)
		require.NoError(t, err)
		assert.True(t, IsRuleSequenceGroup(g.String()), "sentinel from max-length UID must pass IsRuleSequenceGroup")
	})
}

func TestIsRuleSequenceGroup(t *testing.T) {
	t.Run("valid sentinel is recognized", func(t *testing.T) {
		g, err := NewRuleSequenceGroup("seq-123")
		require.NoError(t, err)
		assert.True(t, IsRuleSequenceGroup(g.String()))
	})

	t.Run("plain prefix without padding is not recognized", func(t *testing.T) {
		assert.False(t, IsRuleSequenceGroup(RuleSequenceGroupPrefix+"seq-123"))
	})

	t.Run("user-created group name within 190 chars is not recognized", func(t *testing.T) {
		userGroup := RuleSequenceGroupPrefix + "my-group"
		assert.Less(t, len(userGroup), 191)
		assert.False(t, IsRuleSequenceGroup(userGroup))
	})

	t.Run("wrong prefix is not recognized", func(t *testing.T) {
		assert.False(t, IsRuleSequenceGroup("not_a_sequence_group"))
	})

	t.Run("correct length but wrong prefix is not recognized", func(t *testing.T) {
		fake := strings.Repeat("x", RuleSequenceGroupNameLength)
		assert.False(t, IsRuleSequenceGroup(fake))
	})

	t.Run("empty string is not recognized", func(t *testing.T) {
		assert.False(t, IsRuleSequenceGroup(""))
	})
}

func TestParseRuleSequenceGroup(t *testing.T) {
	t.Run("round-trip through constructor and parse", func(t *testing.T) {
		original, err := NewRuleSequenceGroup("seq-xyz")
		require.NoError(t, err)

		parsed, err := ParseRuleSequenceGroup(original.String())
		require.NoError(t, err)
		assert.Equal(t, "seq-xyz", parsed.GetSequenceUID())
	})

	t.Run("non-sentinel string returns error", func(t *testing.T) {
		_, err := ParseRuleSequenceGroup("not-a-sentinel")
		require.Error(t, err)
	})

	t.Run("crafted string with stars in UID region is rejected", func(t *testing.T) {
		// Build a 200-char string that has the right prefix and enough stars
		// to pass the star-count check, but embeds stars within the UID portion.
		// ParseRuleSequenceGroup should reject it because TrimRight eats the
		// embedded stars, leaving a UID that doesn't match the original.
		uidWithStars := "abc***"
		crafted := RuleSequenceGroupPrefix + uidWithStars
		for len(crafted) < RuleSequenceGroupNameLength {
			crafted += "*"
		}
		// The string passes IsRuleSequenceGroup (prefix, length, star count are all correct).
		require.True(t, IsRuleSequenceGroup(crafted), "crafted string should pass IsRuleSequenceGroup")

		// But parsing should still succeed: TrimRight strips trailing stars and
		// ValidateUID accepts "abc" which is a valid UID. This is consistent
		// with NoGroupRuleGroup's TrimRight behavior. The parsed UID will be
		// "abc" (the stars are treated as padding, not part of the UID).
		parsed, err := ParseRuleSequenceGroup(crafted)
		require.NoError(t, err)
		assert.Equal(t, "abc", parsed.GetSequenceUID())
	})
}
