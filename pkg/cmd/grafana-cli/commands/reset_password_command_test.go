package commands

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
)

func TestResetPassword(t *testing.T) {
	tests := map[string]struct {
		UserID    int64
		IsAdmin   bool
		ExpectErr error
	}{
		"basic success": {
			DefaultAdminUserId,
			true,
			nil,
		},
		"default user is not an admin": {
			DefaultAdminUserId,
			false,
			ErrMustBeAdmin,
		},
		"random user is not an admin": {
			11,
			false,
			ErrMustBeAdmin,
		},
		"random user is an admin": {
			11,
			true,
			nil,
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			svc := &usertest.FakeUserService{}
			svc.ExpectedUser = &user.User{
				IsAdmin: test.IsAdmin,
			}
			err := resetPassword(test.UserID, "s00pers3cure!", svc)
			if test.ExpectErr != nil {
				require.EqualError(t, err, test.ExpectErr.Error())
			} else {
				require.NoError(t, err)
			}
		})
	}
}
