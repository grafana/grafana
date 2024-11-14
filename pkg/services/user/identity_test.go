package user

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIdentityGetName(t *testing.T) {
	tt := []struct {
		name string
		user *SignedInUser
	}{
		{
			name: "GetName on a user with empty name returns raw identifier",
			user: &SignedInUser{
				UserUID: "u000000002",
			},
		},
	}

	for _, tc := range tt {
		user := tc.user
		require.Equal(t, user.GetName(), user.GetRawIdentifier(), tc.name)
	}
}
