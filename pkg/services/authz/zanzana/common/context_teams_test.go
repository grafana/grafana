package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseTeamGroup(t *testing.T) {
	t.Run("valid", func(t *testing.T) {
		n, ok := ParseTeamGroup("team:abc-123")
		assert.True(t, ok)
		assert.Equal(t, "abc-123", n)
	})
	t.Run("missing prefix", func(t *testing.T) {
		_, ok := ParseTeamGroup("group:1")
		assert.False(t, ok)
	})
	t.Run("empty name", func(t *testing.T) {
		_, ok := ParseTeamGroup("team:")
		assert.False(t, ok)
	})
}
