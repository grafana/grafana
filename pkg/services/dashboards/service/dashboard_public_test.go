package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetPublicDashboard(t *testing.T) {
	t.Run("fails! because this is a placeholder", func(t *testing.T) {
		assert.NotNil(t, nil)
	})

	t.Run("40 when malformed uid", func(t *testing.T) {})
	t.Run("404 when missing public dashboard", func(t *testing.T) {})
	t.Run("404 when missing dashboard", func(t *testing.T) {})
}
