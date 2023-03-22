package usertoken

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestUserToken_NeedsRotation(t *testing.T) {
	t.Run("should return true", func(t *testing.T) {
		token := &UserToken{AuthTokenSeen: true, RotatedAt: time.Now().Add(-11 * time.Minute).Unix()}
		assert.True(t, token.NeedsRotation(10*time.Minute))
	})

	t.Run("should return true when token is not seen", func(t *testing.T) {
		token := &UserToken{AuthTokenSeen: false, RotatedAt: time.Now().Add(-2 * time.Minute).Unix()}
		assert.True(t, token.NeedsRotation(10*time.Minute))
	})

	t.Run("should return false", func(t *testing.T) {
		token := &UserToken{AuthTokenSeen: true, RotatedAt: time.Now().Add(-9 * time.Minute).Unix()}
		assert.False(t, token.NeedsRotation(10*time.Minute))
	})
}
