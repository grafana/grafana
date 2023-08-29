package clients

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/ldap/multildap"
	"github.com/grafana/grafana/pkg/services/ldap/service"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/logintest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

type ldapTestCase struct {
	desc             string
	username         string
	password         string
	expectedErr      error
	expectedLDAPErr  error
	expectedUserErr  error
	expectedLDAPInfo *login.ExternalUserInfo
	expectedIdentity *authn.Identity
}

func TestLDAP_AuthenticateProxy(t *testing.T) {
	tests := []ldapTestCase{
		{
			desc:     "should return valid identity when found by ldap service",
			username: "test",
			expectedLDAPInfo: &login.ExternalUserInfo{
				AuthModule: login.LDAPAuthModule,
				AuthId:     "123",
				Email:      "test@test.com",
				Login:      "test",
				Name:       "test test",
				Groups:     []string{"1", "2"},
				OrgRoles:   map[int64]org.RoleType{1: org.RoleViewer},
			},
			expectedIdentity: &authn.Identity{
				OrgID:           1,
				OrgRoles:        map[int64]org.RoleType{1: org.RoleViewer},
				Login:           "test",
				Name:            "test test",
				Email:           "test@test.com",
				AuthenticatedBy: login.LDAPAuthModule,
				AuthID:          "123",
				Groups:          []string{"1", "2"},
				ClientParams: authn.ClientParams{
					SyncUser:            true,
					SyncTeams:           true,
					EnableDisabledUsers: true,
					FetchSyncedUser:     true,
					SyncOrgRoles:        true,
					SyncPermissions:     true,
					LookUpParams: login.UserLookupParams{
						Email: strPtr("test@test.com"),
						Login: strPtr("test"),
					},
				},
			},
		},
		{
			desc:            "should return error when user is not found",
			username:        "test",
			expectedLDAPErr: multildap.ErrDidNotFindUser,
			expectedErr:     errIdentityNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := setupTestCase(tt)

			identity, err := c.AuthenticateProxy(context.Background(), &authn.Request{OrgID: 1}, tt.username, nil)
			assert.ErrorIs(t, err, tt.expectedErr)
			assert.EqualValues(t, tt.expectedIdentity, identity)
		})
	}
}

func TestLDAP_AuthenticatePassword(t *testing.T) {
	tests := []ldapTestCase{
		{
			desc:     "should successfully authenticate with correct username and password",
			username: "test",
			password: "test123",
			expectedLDAPInfo: &login.ExternalUserInfo{
				AuthModule: login.LDAPAuthModule,
				AuthId:     "123",
				Email:      "test@test.com",
				Login:      "test",
				Name:       "test test",
				Groups:     []string{"1", "2"},
				OrgRoles:   map[int64]org.RoleType{1: org.RoleViewer},
			},
			expectedIdentity: &authn.Identity{
				OrgID:           1,
				OrgRoles:        map[int64]org.RoleType{1: org.RoleViewer},
				Login:           "test",
				Name:            "test test",
				Email:           "test@test.com",
				AuthenticatedBy: login.LDAPAuthModule,
				AuthID:          "123",
				Groups:          []string{"1", "2"},
				ClientParams: authn.ClientParams{
					SyncUser:            true,
					SyncTeams:           true,
					EnableDisabledUsers: true,
					FetchSyncedUser:     true,
					SyncOrgRoles:        true,
					SyncPermissions:     true,
					LookUpParams: login.UserLookupParams{
						Email: strPtr("test@test.com"),
						Login: strPtr("test"),
					},
				},
			},
		},
		{
			desc:            "should fail if provided password was incorrect",
			username:        "test",
			password:        "wrong",
			expectedErr:     errInvalidPassword,
			expectedLDAPErr: ldap.ErrInvalidCredentials,
		},
		{
			desc:            "should fail if not found",
			username:        "test",
			password:        "wrong",
			expectedErr:     errIdentityNotFound,
			expectedLDAPErr: ldap.ErrCouldNotFindUser,
			expectedUserErr: user.ErrUserNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			c := setupTestCase(tt)

			identity, err := c.AuthenticatePassword(context.Background(), &authn.Request{OrgID: 1}, tt.username, tt.password)
			assert.ErrorIs(t, err, tt.expectedErr)
			assert.EqualValues(t, tt.expectedIdentity, identity)
		})
	}
}

func setupTestCase(tt ldapTestCase) *LDAP {
	userService := usertest.NewUserServiceFake()
	userService.ExpectedError = tt.expectedUserErr

	c := &LDAP{
		cfg:             setting.NewCfg(),
		logger:          log.New("authn.ldap.test"),
		service:         &service.LDAPFakeService{ExpectedUser: tt.expectedLDAPInfo, ExpectedError: tt.expectedLDAPErr},
		userService:     userService,
		authInfoService: &logintest.AuthInfoServiceFake{},
	}

	return c
}

func strPtr(s string) *string {
	return &s
}
