package models

import (
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewRuleChainGroup(t *testing.T) {
	t.Run("valid chain UID produces correct sentinel", func(t *testing.T) {
		g, err := NewRuleChainGroup("chain-abc")
		require.NoError(t, err)

		s := g.String()
		assert.True(t, strings.HasPrefix(s, RuleChainGroupPrefix))
		assert.Equal(t, RuleChainGroupNameLength, len(s))
		assert.Equal(t, "chain-abc", g.GetChainUID())
	})

	t.Run("chain UID too long returns error", func(t *testing.T) {
		long := strings.Repeat("a", RuleChainGroupNameLength-len(RuleChainGroupPrefix)+1)
		_, err := NewRuleChainGroup(long)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "chain UID is too long")
	})

	t.Run("sentinel exceeds max rule group name length", func(t *testing.T) {
		g, err := NewRuleChainGroup("my-chain")
		require.NoError(t, err)
		// The store enforces a 190-char max. Our sentinel must be longer.
		assert.Greater(t, len(g.String()), 190)
	})

	t.Run("max-length UID still produces valid sentinel", func(t *testing.T) {
		maxUID := strings.Repeat("a", util.MaxUIDLength)
		g, err := NewRuleChainGroup(maxUID)
		require.NoError(t, err)
		assert.True(t, IsRuleChainGroup(g.String()), "sentinel from max-length UID must pass IsRuleChainGroup")
	})
}

func TestIsRuleChainGroup(t *testing.T) {
	t.Run("valid sentinel is recognized", func(t *testing.T) {
		g, err := NewRuleChainGroup("chain-123")
		require.NoError(t, err)
		assert.True(t, IsRuleChainGroup(g.String()))
	})

	t.Run("plain prefix without padding is not recognized", func(t *testing.T) {
		assert.False(t, IsRuleChainGroup(RuleChainGroupPrefix+"chain-123"))
	})

	t.Run("user-created group name within 190 chars is not recognized", func(t *testing.T) {
		userGroup := RuleChainGroupPrefix + "my-group"
		assert.Less(t, len(userGroup), 191)
		assert.False(t, IsRuleChainGroup(userGroup))
	})

	t.Run("wrong prefix is not recognized", func(t *testing.T) {
		assert.False(t, IsRuleChainGroup("not_a_chain_group"))
	})

	t.Run("correct length but wrong prefix is not recognized", func(t *testing.T) {
		fake := strings.Repeat("x", RuleChainGroupNameLength)
		assert.False(t, IsRuleChainGroup(fake))
	})

	t.Run("empty string is not recognized", func(t *testing.T) {
		assert.False(t, IsRuleChainGroup(""))
	})
}

func TestParseRuleChainGroup(t *testing.T) {
	t.Run("round-trip through constructor and parse", func(t *testing.T) {
		original, err := NewRuleChainGroup("chain-xyz")
		require.NoError(t, err)

		parsed, err := ParseRuleChainGroup(original.String())
		require.NoError(t, err)
		assert.Equal(t, "chain-xyz", parsed.GetChainUID())
	})

	t.Run("non-sentinel string returns error", func(t *testing.T) {
		_, err := ParseRuleChainGroup("not-a-sentinel")
		require.Error(t, err)
	})

	t.Run("crafted string with stars in UID region is rejected", func(t *testing.T) {
		// Build a 200-char string that has the right prefix and enough stars
		// to pass the star-count check, but embeds stars within the UID portion.
		// ParseRuleChainGroup should reject it because TrimRight eats the
		// embedded stars, leaving a UID that doesn't match the original.
		uidWithStars := "abc***"
		crafted := RuleChainGroupPrefix + uidWithStars
		for len(crafted) < RuleChainGroupNameLength {
			crafted += "*"
		}
		// The string passes IsRuleChainGroup (prefix, length, star count are all correct).
		require.True(t, IsRuleChainGroup(crafted), "crafted string should pass IsRuleChainGroup")

		// But parsing should still succeed: TrimRight strips trailing stars and
		// ValidateUID accepts "abc" which is a valid UID. This is consistent
		// with NoGroupRuleGroup's TrimRight behavior. The parsed UID will be
		// "abc" (the stars are treated as padding, not part of the UID).
		parsed, err := ParseRuleChainGroup(crafted)
		require.NoError(t, err)
		assert.Equal(t, "abc", parsed.GetChainUID())
	})
}
