package clients

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestGrafana_AuthenticateProxy(t *testing.T) {
	type testCase struct {
		desc             string
		req              *authn.Request
		username         string
		proxyProperty    string
		additional       map[string]string
		expectedErr      error
		expectedIdentity *authn.Identity
	}

	tests := []testCase{
		{
			desc:          "expect valid identity",
			username:      "test",
			req:           &authn.Request{HTTPRequest: &http.Request{}},
			proxyProperty: "username",
			additional: map[string]string{
				proxyFieldName:   "name",
				proxyFieldRole:   "Viewer",
				proxyFieldGroups: "grp1,grp2",
				proxyFieldEmail:  "email@email.com",
			},
			expectedIdentity: &authn.Identity{
				OrgRoles:   map[int64]org.RoleType{1: org.RoleViewer},
				Login:      "test",
				Name:       "name",
				Email:      "email@email.com",
				AuthModule: "authproxy",
				AuthID:     "test",
				Groups:     []string{"grp1", "grp2"},
				ClientParams: authn.ClientParams{
					SyncUser:        true,
					SyncTeams:       true,
					AllowSignUp:     true,
					FetchSyncedUser: true,
					SyncOrgRoles:    true,
					LookUpParams: login.UserLookupParams{
						Email: strPtr("email@email.com"),
						Login: strPtr("test"),
					},
				},
			},
		},
		{
			desc:       "should set email as both email and login when configured proxy auth header property is email",
			username:   "test@test.com",
			req:        &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{}}},
			additional: map[string]string{},
			expectedIdentity: &authn.Identity{
				Login:      "test@test.com",
				Email:      "test@test.com",
				AuthModule: "authproxy",
				AuthID:     "test@test.com",
				ClientParams: authn.ClientParams{
					SyncUser:     true,
					SyncTeams:    true,
					AllowSignUp:  true,
					SyncOrgRoles: true,
					LookUpParams: login.UserLookupParams{
						Email: strPtr("test@test.com"),
						Login: strPtr("test@test.com"),
					},
				},
			},
			proxyProperty: "email",
		},
		{
			desc:          "should return error on invalid auth proxy header property",
			req:           &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{}}},
			proxyProperty: "other",
			expectedErr:   errInvalidProxyHeader,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.AuthProxyAutoSignUp = true
			cfg.AuthProxyHeaderProperty = tt.proxyProperty
			c := ProvideGrafana(cfg, usertest.NewUserServiceFake())

			identity, err := c.AuthenticateProxy(context.Background(), tt.req, tt.username, tt.additional)
			assert.ErrorIs(t, err, tt.expectedErr)
			if tt.expectedIdentity != nil {
				assert.Equal(t, tt.expectedIdentity.OrgID, identity.OrgID)
				assert.Equal(t, tt.expectedIdentity.Login, identity.Login)
				assert.Equal(t, tt.expectedIdentity.Name, identity.Name)
				assert.Equal(t, tt.expectedIdentity.Email, identity.Email)
				assert.Equal(t, tt.expectedIdentity.AuthID, identity.AuthID)
				assert.Equal(t, tt.expectedIdentity.AuthModule, identity.AuthModule)
				assert.Equal(t, tt.expectedIdentity.Groups, identity.Groups)

				assert.Equal(t, tt.expectedIdentity.ClientParams.SyncUser, identity.ClientParams.SyncUser)
				assert.Equal(t, tt.expectedIdentity.ClientParams.AllowSignUp, identity.ClientParams.AllowSignUp)
				assert.Equal(t, tt.expectedIdentity.ClientParams.SyncTeams, identity.ClientParams.SyncTeams)
				assert.Equal(t, tt.expectedIdentity.ClientParams.EnableDisabledUsers, identity.ClientParams.EnableDisabledUsers)

				assert.EqualValues(t, tt.expectedIdentity.ClientParams.LookUpParams.Email, identity.ClientParams.LookUpParams.Email)
				assert.EqualValues(t, tt.expectedIdentity.ClientParams.LookUpParams.Login, identity.ClientParams.LookUpParams.Login)
				assert.EqualValues(t, tt.expectedIdentity.ClientParams.LookUpParams.UserID, identity.ClientParams.LookUpParams.UserID)
			} else {
				assert.Nil(t, tt.expectedIdentity)
			}
		})
	}
}

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
			expectedIdentity: &authn.Identity{
				ID:             "user:1",
				OrgID:          1,
				OrgRoles:       map[int64]org.RoleType{1: "Viewer"},
				IsGrafanaAdmin: boolPtr(false),
				ClientParams:   authn.ClientParams{SyncPermissions: true}},
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

			c := ProvideGrafana(setting.NewCfg(), userService)
			identity, err := c.AuthenticatePassword(context.Background(), &authn.Request{OrgID: 1}, tt.username, tt.password)
			assert.ErrorIs(t, err, tt.expectedErr)
			assert.EqualValues(t, tt.expectedIdentity, identity)
		})
	}
}
