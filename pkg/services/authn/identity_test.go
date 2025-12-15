package authn

import (
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIdentity_GetExtra(t *testing.T) {
	tests := []struct {
		name     string
		identity *Identity
		expected map[string][]string
	}{
		{
			name: "returns empty map when no extra fields are set",
			identity: &Identity{
				ID:   "1",
				Type: types.TypeUser,
			},
			expected: map[string][]string{
				"user-instance-role": {"None"},
			},
		},
		{
			name: "returns id-token when IDToken is set",
			identity: &Identity{
				ID:      "1",
				Type:    types.TypeUser,
				IDToken: "test-id-token",
			},
			expected: map[string][]string{
				"id-token":           {"test-id-token"},
				"user-instance-role": {"None"},
			},
		},
		{
			name: "returns user-instance-role when OrgRole is valid",
			identity: &Identity{
				ID:       "1",
				Type:     types.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: "Admin"},
			},
			expected: map[string][]string{
				"user-instance-role": {"Admin"},
			},
		},
		{
			name: "returns service-identity when AccessTokenClaims contains ServiceIdentity",
			identity: &Identity{
				ID:   "1",
				Type: types.TypeAccessPolicy,
				AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{
					Rest: authnlib.AccessTokenClaims{
						ServiceIdentity: "secrets-manager",
					},
				},
			},
			expected: map[string][]string{
				string(authnlib.ServiceIdentityKey): {"secrets-manager"},
				"user-instance-role":                {"None"},
			},
		},
		{
			name: "returns all extra fields when multiple are set",
			identity: &Identity{
				ID:       "1",
				Type:     types.TypeUser,
				OrgID:    1,
				IDToken:  "test-id-token",
				OrgRoles: map[int64]org.RoleType{1: "Editor"},
				AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{
					Rest: authnlib.AccessTokenClaims{
						ServiceIdentity: "custom-service",
					},
				},
			},
			expected: map[string][]string{
				"id-token":                          {"test-id-token"},
				"user-instance-role":                {"Editor"},
				string(authnlib.ServiceIdentityKey): {"custom-service"},
			},
		},
		{
			name: "does not include service-identity when AccessTokenClaims is nil",
			identity: &Identity{
				ID:                "1",
				Type:              types.TypeUser,
				AccessTokenClaims: nil,
			},
			expected: map[string][]string{
				"user-instance-role": {"None"},
			},
		},
		{
			name: "does not include service-identity when ServiceIdentity is empty",
			identity: &Identity{
				ID:   "1",
				Type: types.TypeUser,
				AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{
					Rest: authnlib.AccessTokenClaims{
						ServiceIdentity: "",
					},
				},
			},
			expected: map[string][]string{
				"user-instance-role": {"None"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			extra := tt.identity.GetExtra()
			assert.Equal(t, tt.expected, extra)
		})
	}
}

func TestIdentity_GetExtra_ServiceIdentityKey(t *testing.T) {
	// Test that the ServiceIdentityKey constant matches authlib's constant
	identity := &Identity{
		ID:   "1",
		Type: types.TypeAccessPolicy,
		AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{
			Rest: authnlib.AccessTokenClaims{
				ServiceIdentity: "test-service",
			},
		},
	}

	extra := identity.GetExtra()
	require.Contains(t, extra, string(authnlib.ServiceIdentityKey))
	assert.Equal(t, []string{"test-service"}, extra[string(authnlib.ServiceIdentityKey)])
}
