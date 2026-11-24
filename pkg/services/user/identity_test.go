package user

import (
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestSignedInUserIsProvisioningServiceIdentity(t *testing.T) {
	user := &SignedInUser{AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{Rest: authnlib.AccessTokenClaims{ServiceIdentity: "provisioning.grafana.app"}}}
	require.Equal(t, []string{"provisioning.grafana.app"}, user.GetExtra()[authnlib.ServiceIdentityKey])
	require.True(t, identity.IsProvisioningServiceIdentity(user))
	require.False(t, identity.IsProvisioningServiceIdentity(&SignedInUser{}))
}

func TestIdentityGetName(t *testing.T) {
	tt := []struct {
		name     string
		user     *SignedInUser
		expected string
	}{
		{
			name: "GetName on a user with empty name returns Login, if set",
			user: &SignedInUser{
				Login: "userLogin",
				Email: "user@grafana.com",
			},
			expected: "userLogin",
		},
		{
			name: "GetName on a user with empty name returns Email, if no Login is set",
			user: &SignedInUser{
				Email: "user@grafana.com",
			},
			expected: "user@grafana.com",
		},
	}

	for _, tc := range tt {
		user := tc.user
		require.Equal(t, user.GetName(), tc.expected, tc.name)
	}
}
