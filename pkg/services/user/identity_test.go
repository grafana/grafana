package user

import (
	"testing"

	"github.com/stretchr/testify/require"
)

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
