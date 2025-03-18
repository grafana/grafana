package clients

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/loginattempt/loginattempttest"
	"github.com/grafana/grafana/pkg/services/notifications"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/services/temp_user/tempusertest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestPasswordless_StartPasswordless(t *testing.T) {
	type testCase struct {
		desc         string
		email        string
		findUser     bool
		findTempUser bool
		blockLogin   bool
		expectedErr  error
	}

	tests := []testCase{
		{
			desc:       "should succeed if user is found",
			email:      "user@domain.com",
			findUser:   true,
			blockLogin: false,
		},
		{
			desc:         "should succeed if temp user is found",
			email:        "user@domain.com",
			findUser:     false,
			findTempUser: true,
			blockLogin:   false,
		},
		{
			desc:         "should fail if user or temp user is not found",
			email:        "user@domain.com",
			findUser:     false,
			findTempUser: false,
			blockLogin:   false,
			expectedErr:  errPasswordlessClientInvalidEmail.Errorf("no user or invite found with email user@domain.com"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			hashed, _ := util.EncodePassword("password", "salt")
			userService := &usertest.FakeUserService{
				ExpectedUser: &user.User{ID: 1, Email: "user@domain.com", Login: "user", Password: user.Password(hashed), Salt: "salt"},
			}
			las := &loginattempttest.FakeLoginAttemptService{ExpectedValid: !tt.blockLogin}
			tus := &tempusertest.FakeTempUserService{}
			tus.GetTempUsersQueryFN = func(ctx context.Context, query *tempuser.GetTempUsersQuery) ([]*tempuser.TempUserDTO, error) {
				return []*tempuser.TempUserDTO{{
					ID:        1,
					Email:     "user@domain.com",
					Status:    tempuser.TmpUserInvitePending,
					EmailSent: true,
				}}, nil
			}
			ns := notifications.MockNotificationService()
			cache := remotecache.NewFakeCacheStorage()

			if !tt.findUser {
				userService.ExpectedUser = nil
				userService.ExpectedError = user.ErrUserNotFound
			}

			if !tt.findTempUser {
				tus.GetTempUsersQueryFN = func(ctx context.Context, query *tempuser.GetTempUsersQuery) ([]*tempuser.TempUserDTO, error) {
					return nil, tempuser.ErrTempUserNotFound
				}
			}

			c := ProvidePasswordless(setting.NewCfg(), las, userService, tus, ns, cache)
			_, err := c.startPasswordless(context.Background(), tt.email)
			assert.ErrorIs(t, err, tt.expectedErr)
		})
	}
}

func TestPasswordless_AuthenticatePasswordless(t *testing.T) {
	type testCase struct {
		desc             string
		email            string
		findUser         bool
		blockLogin       bool
		expectedErr      error
		expectedIdentity *authn.Identity
	}

	tests := []testCase{
		{
			desc:       "should successfully authenticate user with correct passwordless magic link",
			email:      "user@domain.com",
			findUser:   true,
			blockLogin: false,
			expectedIdentity: &authn.Identity{
				ID:              "1",
				Type:            claims.TypeUser,
				OrgID:           1,
				AuthenticatedBy: login.PasswordlessAuthModule,
				ClientParams:    authn.ClientParams{FetchSyncedUser: true, SyncPermissions: true},
			},
		},
		{
			desc:        "should fail if login is blocked",
			email:       "user@domain.com",
			findUser:    true,
			blockLogin:  true,
			expectedErr: errPasswordlessClientTooManyLoginAttempts.Errorf("too many consecutive incorrect login attempts for user - login for user temporarily blocked"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			hashed, _ := util.EncodePassword("password", "salt")
			userService := &usertest.FakeUserService{
				ExpectedUser: &user.User{ID: 1, Email: "user@domain.com", Login: "user", Password: user.Password(hashed), Salt: "salt"},
			}
			las := &loginattempttest.FakeLoginAttemptService{ExpectedValid: !tt.blockLogin}
			tus := &tempusertest.FakeTempUserService{}
			ns := notifications.MockNotificationService()
			cache := remotecache.NewFakeCacheStorage()

			if !tt.findUser {
				userService.ExpectedUser = nil
				userService.ExpectedError = user.ErrUserNotFound
			}

			c := ProvidePasswordless(setting.NewCfg(), las, userService, tus, ns, cache)
			code, err := c.startPasswordless(context.Background(), tt.email)
			if err != nil {
				t.Fatalf("failed to start passwordless: %v", err)
			}

			form := &PasswordlessForm{
				Code:             code,
				ConfirmationCode: ns.Email.Data["ConfirmationCode"].(string),
				Name:             "user",
				Username:         "username",
			}
			identity, err := c.authenticatePasswordless(context.Background(), &authn.Request{OrgID: 1}, *form)
			assert.ErrorIs(t, err, tt.expectedErr)
			assert.EqualValues(t, tt.expectedIdentity, identity)
		})
	}
}
