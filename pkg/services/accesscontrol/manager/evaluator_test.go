package manager

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/stretchr/testify/assert"
)

func TestEvaluator_ExtractPermissions(t *testing.T) {
	perms := []*accesscontrol.Permission{
		{
			Permission: "users:test",
			Scope:      "users:self",
		},
		{
			Permission: "reports:test",
			Scope:      "reports:*",
		},
	}

	t.Run("returns false with empty scopes when permission is not found", func(t *testing.T) {
		ok, scopes := extractPermission(perms, "reports:test1")
		assert.False(t, ok)
		assert.Empty(t, scopes)
	})

	t.Run("returns true with scopes when permission is found", func(t *testing.T) {
		expectedScopes := map[string]struct{}{
			"reports:*": {},
		}

		ok, scopes := extractPermission(perms, "reports:test")
		assert.True(t, ok)
		assert.Equal(t, scopes, expectedScopes)
	})
}
