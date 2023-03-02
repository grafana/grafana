package sync

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfoservice"
	"github.com/grafana/grafana/pkg/services/login/logintest"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
)

func ptrString(s string) *string {
	return &s
}

func ptrBool(b bool) *bool {
	return &b
}

func ptrInt64(i int64) *int64 {
	return &i
}

func TestUserSync_SyncUserHook(t *testing.T) {
	userProtection := &authinfoservice.OSSUserProtectionImpl{}

	authFakeNil := &logintest.AuthInfoServiceFake{
		ExpectedUser:  nil,
		ExpectedError: user.ErrUserNotFound,
		SetAuthInfoFn: func(ctx context.Context, cmd *login.SetAuthInfoCommand) error {
			return nil
		},
		UpdateAuthInfoFn: func(ctx context.Context, cmd *login.UpdateAuthInfoCommand) error {
			return nil
		},
	}
	authFakeUserID := &logintest.AuthInfoServiceFake{
		ExpectedUser:  nil,
		ExpectedError: nil,
		ExpectedUserAuth: &login.UserAuth{
			AuthModule: "oauth",
			AuthId:     "2032",
			UserId:     1,
			Id:         1}}

	userService := &usertest.FakeUserService{ExpectedUser: &user.User{
		ID:    1,
		Login: "test",
		Name:  "test",
		Email: "test",
	}}

	userServiceMod := &usertest.FakeUserService{ExpectedUser: &user.User{
		ID:         3,
		Login:      "test",
		Name:       "test",
		Email:      "test",
		IsDisabled: true,
		IsAdmin:    false,
	}}

	userServiceNil := &usertest.FakeUserService{
		ExpectedUser:  nil,
		ExpectedError: user.ErrUserNotFound,
		CreateFn: func(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
			return &user.User{
				ID:      2,
				Login:   cmd.Login,
				Name:    cmd.Name,
				Email:   cmd.Email,
				IsAdmin: cmd.IsAdmin,
			}, nil
		},
	}

	type fields struct {
		userService     user.Service
		authInfoService login.AuthInfoService
		quotaService    quota.Service
	}
	type args struct {
		ctx context.Context
		id  *authn.Identity
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		wantErr bool
		wantID  *authn.Identity
	}{
		{
			name: "no sync",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					ID:    "",
					Login: "test",
					Name:  "test",
					Email: "test",
					ClientParams: authn.ClientParams{
						LookUpParams: login.UserLookupParams{
							UserID: nil,
							Email:  ptrString("test"),
							Login:  nil,
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:    "",
				Login: "test",
				Name:  "test",
				Email: "test",
				ClientParams: authn.ClientParams{
					LookUpParams: login.UserLookupParams{
						UserID: nil,
						Email:  ptrString("test"),
						Login:  nil,
					},
				},
			},
		},
		{
			name: "sync - user found in DB - by email",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					ID:    "",
					Login: "test",
					Name:  "test",
					Email: "test",
					ClientParams: authn.ClientParams{
						SyncUser: true,
						LookUpParams: login.UserLookupParams{
							UserID: nil,
							Email:  ptrString("test"),
							Login:  nil,
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "user:1",
				Login:          "test",
				Name:           "test",
				Email:          "test",
				IsGrafanaAdmin: ptrBool(false),
				ClientParams: authn.ClientParams{
					SyncUser: true,
					LookUpParams: login.UserLookupParams{
						UserID: nil,
						Email:  ptrString("test"),
						Login:  nil,
					},
				},
			},
		},
		{
			name: "sync - user found in DB - by login",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					ID:    "",
					Login: "test",
					Name:  "test",
					Email: "test",
					ClientParams: authn.ClientParams{
						SyncUser: true,
						LookUpParams: login.UserLookupParams{
							UserID: nil,
							Email:  nil,
							Login:  ptrString("test"),
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "user:1",
				Login:          "test",
				Name:           "test",
				Email:          "test",
				IsGrafanaAdmin: ptrBool(false),
				ClientParams: authn.ClientParams{
					LookUpParams: login.UserLookupParams{
						UserID: nil,
						Email:  nil,
						Login:  ptrString("test"),
					},
					SyncUser: true,
				},
			},
		},
		{
			name: "sync - user found in DB - by ID",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					ID:    "",
					Login: "test",
					Name:  "test",
					Email: "test",
					ClientParams: authn.ClientParams{
						SyncUser: true,
						LookUpParams: login.UserLookupParams{
							UserID: ptrInt64(1),
							Email:  nil,
							Login:  nil,
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "user:1",
				Login:          "test",
				Name:           "test",
				Email:          "test",
				IsGrafanaAdmin: ptrBool(false),
				ClientParams: authn.ClientParams{
					SyncUser: true,
					LookUpParams: login.UserLookupParams{
						UserID: ptrInt64(1),
						Email:  nil,
						Login:  nil,
					},
				},
			},
		},
		{
			name: "sync - user found in authInfo",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeUserID,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					ID:         "",
					AuthID:     "2032",
					AuthModule: "oauth",
					Login:      "test",
					Name:       "test",
					Email:      "test",
					ClientParams: authn.ClientParams{
						SyncUser: true,
						LookUpParams: login.UserLookupParams{
							UserID: nil,
							Email:  nil,
							Login:  nil,
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "user:1",
				AuthID:         "2032",
				AuthModule:     "oauth",
				Login:          "test",
				Name:           "test",
				Email:          "test",
				IsGrafanaAdmin: ptrBool(false),
				ClientParams: authn.ClientParams{
					SyncUser: true,
					LookUpParams: login.UserLookupParams{
						UserID: nil,
						Email:  nil,
						Login:  nil,
					},
				},
			},
		},
		{
			name: "sync - user needs to be created - disabled signup",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					ID:         "",
					Login:      "test",
					Name:       "test",
					Email:      "test",
					AuthModule: "oauth",
					AuthID:     "2032",
					ClientParams: authn.ClientParams{
						SyncUser: true,
						LookUpParams: login.UserLookupParams{
							UserID: nil,
							Email:  nil,
							Login:  nil,
						},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "sync - user needs to be created - enabled signup",
			fields: fields{
				userService:     userServiceNil,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					ID:             "",
					Login:          "test_create",
					Name:           "test_create",
					IsGrafanaAdmin: ptrBool(true),
					Email:          "test_create",
					AuthModule:     "oauth",
					AuthID:         "2032",
					ClientParams: authn.ClientParams{
						SyncUser:            true,
						AllowSignUp:         true,
						EnableDisabledUsers: true,
						LookUpParams: login.UserLookupParams{
							UserID: nil,
							Email:  ptrString("test_create"),
							Login:  nil,
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "user:2",
				Login:          "test_create",
				Name:           "test_create",
				Email:          "test_create",
				AuthModule:     "oauth",
				AuthID:         "2032",
				IsGrafanaAdmin: ptrBool(true),
				ClientParams: authn.ClientParams{
					SyncUser:            true,
					AllowSignUp:         true,
					EnableDisabledUsers: true,
					LookUpParams: login.UserLookupParams{
						UserID: nil,
						Email:  ptrString("test_create"),
						Login:  nil,
					},
				},
			},
		},
		{
			name: "sync - needs full update",
			fields: fields{
				userService:     userServiceMod,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					ID:             "",
					Login:          "test_mod",
					Name:           "test_mod",
					Email:          "test_mod",
					IsDisabled:     false,
					IsGrafanaAdmin: ptrBool(true),
					ClientParams: authn.ClientParams{
						SyncUser:            true,
						EnableDisabledUsers: true,
						LookUpParams: login.UserLookupParams{
							UserID: ptrInt64(3),
							Email:  nil,
							Login:  nil,
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "user:3",
				Login:          "test_mod",
				Name:           "test_mod",
				Email:          "test_mod",
				IsDisabled:     false,
				IsGrafanaAdmin: ptrBool(true),
				ClientParams: authn.ClientParams{
					SyncUser:            true,
					EnableDisabledUsers: true,
					LookUpParams: login.UserLookupParams{
						UserID: ptrInt64(3),
						Email:  nil,
						Login:  nil,
					},
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := ProvideUserSync(tt.fields.userService, userProtection, tt.fields.authInfoService, tt.fields.quotaService)
			err := s.SyncUserHook(tt.args.ctx, tt.args.id, nil)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			require.EqualValues(t, tt.wantID, tt.args.id)
		})
	}
}

func TestUserSync_FetchSyncedUserHook(t *testing.T) {
	type testCase struct {
		desc        string
		req         *authn.Request
		identity    *authn.Identity
		expectedErr error
	}

	tests := []testCase{
		{
			desc:     "should skip hook when flag is not enabled",
			req:      &authn.Request{},
			identity: &authn.Identity{ClientParams: authn.ClientParams{FetchSyncedUser: false}},
		},
		{
			desc:     "should skip hook when identity is not a user",
			req:      &authn.Request{},
			identity: &authn.Identity{ID: "apikey:1", ClientParams: authn.ClientParams{FetchSyncedUser: true}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			s := UserSync{}
			err := s.FetchSyncedUserHook(context.Background(), tt.identity, tt.req)
			require.ErrorIs(t, err, tt.expectedErr)
		})
	}
}

func TestUserSync_EnableDisabledUserHook(t *testing.T) {
	type testCase struct {
		desc       string
		identity   *authn.Identity
		enableUser bool
	}

	tests := []testCase{
		{
			desc: "should skip if correct flag is not set",
			identity: &authn.Identity{
				ID:           authn.NamespacedID(authn.NamespaceUser, 1),
				IsDisabled:   true,
				ClientParams: authn.ClientParams{EnableDisabledUsers: false},
			},
			enableUser: false,
		},
		{
			desc: "should skip if identity is not disabled",
			identity: &authn.Identity{
				ID:           authn.NamespacedID(authn.NamespaceUser, 1),
				IsDisabled:   false,
				ClientParams: authn.ClientParams{EnableDisabledUsers: true},
			},
			enableUser: false,
		},
		{
			desc: "should skip if identity is not a user",
			identity: &authn.Identity{
				ID:           authn.NamespacedID(authn.NamespaceAPIKey, 1),
				IsDisabled:   true,
				ClientParams: authn.ClientParams{EnableDisabledUsers: true},
			},
			enableUser: false,
		},
		{
			desc: "should enabled disabled user",
			identity: &authn.Identity{
				ID:           authn.NamespacedID(authn.NamespaceUser, 1),
				IsDisabled:   true,
				ClientParams: authn.ClientParams{EnableDisabledUsers: true},
			},
			enableUser: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			userSvc := usertest.NewUserServiceFake()
			called := false
			userSvc.DisableFn = func(ctx context.Context, cmd *user.DisableUserCommand) error {
				called = true
				return nil
			}

			s := UserSync{userService: userSvc}
			err := s.EnableDisabledUserHook(context.Background(), tt.identity, nil)
			require.NoError(t, err)
			assert.Equal(t, tt.enableUser, called)
		})
	}
}
