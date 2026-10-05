package user

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/util"
)

func TestGenerateDeterministicUID(t *testing.T) {
	t.Run("same inputs produce the same UID", func(t *testing.T) {
		uid1 := GenerateDeterministicUID("org-1", "alice@example.com", "alice")
		uid2 := GenerateDeterministicUID("org-1", "alice@example.com", "alice")
		assert.Equal(t, uid1, uid2)
	})

	t.Run("case-insensitive on email and login", func(t *testing.T) {
		uid1 := GenerateDeterministicUID("org-1", "alice@example.com", "alice")
		uid2 := GenerateDeterministicUID("org-1", "ALICE@example.com", "ALICE")
		assert.Equal(t, uid1, uid2)
	})

	t.Run("different namespace produces a different UID", func(t *testing.T) {
		uid1 := GenerateDeterministicUID("org-1", "alice@example.com", "alice")
		uid2 := GenerateDeterministicUID("org-2", "alice@example.com", "alice")
		assert.NotEqual(t, uid1, uid2)
	})

	t.Run("different email or login produces a different UID", func(t *testing.T) {
		base := GenerateDeterministicUID("org-1", "alice@example.com", "alice")
		assert.NotEqual(t, base, GenerateDeterministicUID("org-1", "bob@example.com", "alice"))
		assert.NotEqual(t, base, GenerateDeterministicUID("org-1", "alice@example.com", "bob"))
	})

	t.Run("output is a valid, fixed-length short UID", func(t *testing.T) {
		uid := GenerateDeterministicUID("org-1", "alice@example.com", "alice")
		assert.Len(t, uid, 16)
		assert.True(t, util.IsValidShortUID(uid))
		assert.False(t, util.IsShortUIDTooLong(uid))
	})
}
