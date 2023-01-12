package clients

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
)

func TestGrafana_AuthenticatePassword(t *testing.T) {
	type testCase struct {
		desc                 string
		username             string
		password             string
		findUser             bool
		expectedErr          error
		expectedIdentity     *authn.Identity
		expectedSignedInUser *user.SignedInUser
	}

	tests := []testCase{
		{
			desc:                 "should successfully authenticate user with correct password",
			username:             "user",
			password:             "password",
			findUser:             true,
			expectedSignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: "Viewer"},
			expectedIdentity:     &authn.Identity{ID: "user:1", OrgID: 1, OrgRoles: map[int64]org.RoleType{1: "Viewer"}, IsGrafanaAdmin: boolPtr(false)},
		},
		{
			desc:        "should fail for incorrect password",
			username:    "user",
			password:    "wrong",
			findUser:    true,
			expectedErr: errInvalidPassword,
		},
		{
			desc:        "should fail if user is not found",
			username:    "user",
			password:    "password",
			expectedErr: errIdentityNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			hashed, _ := util.EncodePassword("password", "salt")
			userService := &usertest.FakeUserService{
				ExpectedSignedInUser: tt.expectedSignedInUser,
				ExpectedUser:         &user.User{Password: hashed, Salt: "salt"},
			}

			if !tt.findUser {
				userService.ExpectedUser = nil
				userService.ExpectedError = user.ErrUserNotFound
			}

			c := ProvideGrafana(userService)
			identity, err := c.AuthenticatePassword(context.Background(), &authn.Request{OrgID: 1}, tt.username, tt.password)
			assert.ErrorIs(t, err, tt.expectedErr)
			assert.EqualValues(t, tt.expectedIdentity, identity)
		})
	}
}
