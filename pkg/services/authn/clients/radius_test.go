package clients

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/radius"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

type radiusTestCase struct {
	desc               string
	username           string
	password           string
	expectedErr        error
	expectedRADIUSErr  error
	expectedRADIUSInfo *login.ExternalUserInfo
	expectedIdentity   *authn.Identity
}

func TestRADIUS_AuthenticatePassword(t *testing.T) {
	tests := []radiusTestCase{
		{
			desc:     "should successfully authenticate with correct username and password",
			username: "test",
			password: "test123",
			expectedRADIUSInfo: &login.ExternalUserInfo{
				AuthModule: login.RADIUSAuthModule,
				AuthId:     "test",
				Email:      "test@example.com",
				Login:      "test",
				Name:       "test",
				Groups:     []string{"admin", "users"},
				OrgRoles:   map[int64]org.RoleType{1: org.RoleAdmin},
			},
			expectedIdentity: &authn.Identity{
				OrgID:           1,
				OrgRoles:        map[int64]org.RoleType{1: org.RoleAdmin},
				Login:           "test",
				Name:            "test",
				Email:           "test@example.com",
				AuthenticatedBy: login.RADIUSAuthModule,
				AuthID:          "test",
				Groups:          []string{"admin", "users"},
				ClientParams: authn.ClientParams{
					SyncUser:        true,
					SyncTeams:       true,
					EnableUser:      true,
					FetchSyncedUser: true,
					SyncOrgRoles:    true,
					SyncPermissions: true,
					AllowSignUp:     true,
					LookUpParams: login.UserLookupParams{
						Email: strPtr("test@example.com"),
						Login: strPtr("test"),
					},
				},
			},
		},
		{
			desc:              "should fail if provided password was incorrect",
			username:          "test",
			password:          "wrong",
			expectedErr:       errInvalidPassword,
			expectedRADIUSErr: radius.ErrInvalidCredentials,
		},
		{
			desc:     "should work with skip org role sync enabled",
			username: "test",
			password: "test123",
			expectedRADIUSInfo: &login.ExternalUserInfo{
				AuthModule: login.RADIUSAuthModule,
				AuthId:     "test",
				Email:      "test@example.com",
				Login:      "test",
				Name:       "test",
				Groups:     []string{"users"},
				OrgRoles:   map[int64]org.RoleType{},
			},
			expectedIdentity: &authn.Identity{
				OrgID:           1,
				OrgRoles:        map[int64]org.RoleType{},
				Login:           "test",
				Name:            "test",
				Email:           "test@example.com",
				AuthenticatedBy: login.RADIUSAuthModule,
				AuthID:          "test",
				Groups:          []string{"users"},
				ClientParams: authn.ClientParams{
					SyncUser:        true,
					SyncTeams:       true,
					EnableUser:      true,
					FetchSyncedUser: true,
					SyncOrgRoles:    false, // skip org role sync
					SyncPermissions: true,
					AllowSignUp:     true,
					LookUpParams: login.UserLookupParams{
						Email: strPtr("test@example.com"),
						Login: strPtr("test"),
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			radiusService := &FakeRADIUSService{
				ExpectedError:    tt.expectedRADIUSErr,
				ExpectedUserInfo: tt.expectedRADIUSInfo,
			}
			userService := usertest.NewUserServiceFake()
			authInfoService := &authinfotest.FakeService{}
			cfg := &setting.Cfg{
				RADIUSAllowSignup:     true,
				RADIUSSkipOrgRoleSync: tt.expectedIdentity != nil && !tt.expectedIdentity.ClientParams.SyncOrgRoles,
			}

			c := ProvideRADIUS(cfg, radiusService, userService, authInfoService, tracing.InitializeTracerForTest())

			identity, err := c.AuthenticatePassword(context.Background(), &authn.Request{OrgID: 1}, tt.username, tt.password)

			assert.ErrorIs(t, err, tt.expectedErr)
			assert.EqualValues(t, tt.expectedIdentity, identity)

			// Verify the RADIUS service was called correctly
			assert.Equal(t, 1, radiusService.LoginCallCount)
			assert.Equal(t, tt.username, radiusService.LastUsername)
			assert.Equal(t, tt.password, radiusService.LastPassword)
		})
	}
}

func TestRADIUS_identityFromRADIUSInfo(t *testing.T) {
	tests := []struct {
		desc             string
		info             *login.ExternalUserInfo
		orgID            int64
		skipOrgRoleSync  bool
		allowSignUp      bool
		expectedIdentity *authn.Identity
	}{
		{
			desc: "should create identity with org roles sync enabled",
			info: &login.ExternalUserInfo{
				AuthModule:     login.RADIUSAuthModule,
				AuthId:         "123",
				Email:          "test@test.com",
				Login:          "test",
				Name:           "test test",
				Groups:         []string{"admin", "users"},
				OrgRoles:       map[int64]org.RoleType{1: org.RoleEditor, 2: org.RoleViewer},
				IsGrafanaAdmin: boolPtr(true),
			},
			orgID:           1,
			skipOrgRoleSync: false,
			allowSignUp:     true,
			expectedIdentity: &authn.Identity{
				OrgID:           1,
				OrgRoles:        map[int64]org.RoleType{1: org.RoleEditor, 2: org.RoleViewer},
				Login:           "test",
				Name:            "test test",
				Email:           "test@test.com",
				AuthenticatedBy: login.RADIUSAuthModule,
				AuthID:          "123",
				Groups:          []string{"admin", "users"},
				IsGrafanaAdmin:  boolPtr(true),
				ClientParams: authn.ClientParams{
					SyncUser:        true,
					SyncTeams:       true,
					EnableUser:      true,
					FetchSyncedUser: true,
					SyncOrgRoles:    true,
					SyncPermissions: true,
					AllowSignUp:     true,
					LookUpParams: login.UserLookupParams{
						Login: strPtr("test"),
						Email: strPtr("test@test.com"),
					},
				},
			},
		},
		{
			desc: "should create identity with org roles sync disabled",
			info: &login.ExternalUserInfo{
				AuthModule: login.RADIUSAuthModule,
				AuthId:     "123",
				Email:      "test@test.com",
				Login:      "test",
				Name:       "test test",
				Groups:     []string{"users"},
				OrgRoles:   map[int64]org.RoleType{1: org.RoleViewer},
			},
			orgID:           2,
			skipOrgRoleSync: true,
			allowSignUp:     false,
			expectedIdentity: &authn.Identity{
				OrgID:           2,
				OrgRoles:        map[int64]org.RoleType{1: org.RoleViewer},
				Login:           "test",
				Name:            "test test",
				Email:           "test@test.com",
				AuthenticatedBy: login.RADIUSAuthModule,
				AuthID:          "123",
				Groups:          []string{"users"},
				ClientParams: authn.ClientParams{
					SyncUser:        true,
					SyncTeams:       true,
					EnableUser:      true,
					FetchSyncedUser: true,
					SyncOrgRoles:    false,
					SyncPermissions: true,
					AllowSignUp:     false,
					LookUpParams: login.UserLookupParams{
						Login: strPtr("test"),
						Email: strPtr("test@test.com"),
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			radiusService := &FakeRADIUSService{}
			userService := usertest.NewUserServiceFake()
			authInfoService := &authinfotest.FakeService{}
			cfg := &setting.Cfg{
				RADIUSAllowSignup:     tt.allowSignUp,
				RADIUSSkipOrgRoleSync: tt.skipOrgRoleSync,
			}

			c := ProvideRADIUS(cfg, radiusService, userService, authInfoService, tracing.InitializeTracerForTest())

			identity := c.identityFromRADIUSInfo(tt.orgID, tt.info)

			assert.EqualValues(t, tt.expectedIdentity, identity)
		})
	}
}

func TestRADIUS_String(t *testing.T) {
	radiusService := &FakeRADIUSService{}
	userService := usertest.NewUserServiceFake()
	authInfoService := &authinfotest.FakeService{}
	cfg := &setting.Cfg{}

	c := ProvideRADIUS(cfg, radiusService, userService, authInfoService, tracing.InitializeTracerForTest())

	assert.Equal(t, "radius", c.String())
}

// FakeRADIUSService is a fake implementation of the RADIUS service for testing
type FakeRADIUSService struct {
	ExpectedError    error
	ExpectedUserInfo *login.ExternalUserInfo

	// Call tracking
	LoginCallCount int
	LastUsername   string
	LastPassword   string
}

func (f *FakeRADIUSService) Login(query *login.LoginUserQuery) (*login.ExternalUserInfo, error) {
	f.LoginCallCount++
	f.LastUsername = query.Username
	f.LastPassword = query.Password

	if f.ExpectedError != nil {
		return nil, f.ExpectedError
	}

	return f.ExpectedUserInfo, nil
}

func (f *FakeRADIUSService) User(username string) (*login.ExternalUserInfo, error) {
	// RADIUS doesn't support user lookup without authentication
	return f.ExpectedUserInfo, nil
}

func (f *FakeRADIUSService) IsEnabled() bool {
	return true
}
