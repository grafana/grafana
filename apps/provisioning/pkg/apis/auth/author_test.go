package auth

import (
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestGetAuthorFromRequester(t *testing.T) {
	tests := []struct {
		name      string
		requester identity.Requester
		expected  *repository.CommitSignature
	}{
		{
			name: "user identity returns author",
			requester: &identity.StaticRequester{
				Type:    authlib.TypeUser,
				Name:    "Test User",
				Email:   "test@example.com",
				UserUID: "abc123",
			},
			expected: &repository.CommitSignature{Name: "Test User", Email: "test@example.com"},
		},
		{
			name: "service identity returns nothing",
			requester: &identity.StaticRequester{
				Type: authlib.TypeAccessPolicy,
				Name: "provisioning",
			},
			expected: nil,
		},
		{
			name:      "missing requester returns nothing",
			requester: nil,
			expected:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := t.Context()
			if tt.requester != nil {
				ctx = identity.WithRequester(ctx, tt.requester)
			}

			author, ok := GetAuthorFromRequester(ctx)
			if tt.expected == nil {
				assert.False(t, ok)
			} else {
				require.True(t, ok)
				assert.Equal(t, *tt.expected, author)
			}
		})
	}
}
